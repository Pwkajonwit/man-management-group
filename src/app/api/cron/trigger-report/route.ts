import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getFirebaseAdminDb();
        const hostMatch = request.headers.get('host');
        const protocol = hostMatch?.includes('localhost') ? 'http' : 'https';
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || (hostMatch ? `${protocol}://${hostMatch}` : 'http://localhost:3000');

        // 1. ดึง Setting
        const settingsSnap = await db.collection('appConfig').doc('notificationSettings').get();
        const settings = settingsSnap.data() || {};
        
        const adminLineUserId = settings.lineAdminUserId || '';
        const adminLineGroupId = settings.lineAdminGroupId || '';
        
        // ถ้าไม่มีการตั้งค่า LINE ปลายทางเลย ข้ามไป
        if (!adminLineUserId && !adminLineGroupId && !process.env.LINE_ADMIN_USER_ID) {
            return NextResponse.json({ ok: true, message: 'Skip: No Line Admin ID configured.' });
        }

        // 2. ดึง Projects ทั้งหมดที่กำลังทำ
        const projectsSnap = await db.collection('projects').where('status', 'in', ['planning', 'in-progress', 'on-hold']).get();
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // 3. ดึง Tasks ทั้งหมด
        const tasksSnap = await db.collection('tasks').get();
        const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        let sentCount = 0;

        // 4. วนลูปส่งรายงานของแต่ละโปรเจกต์ (ถ้าแอดมินเปิดให้ส่ง)
        let sendProjectSummary = settings.adminReportProjectSummary ?? true;
        
        // เช็ควันเวลาจากตั้งค่าว่าสอดคล้องไหม (คล้ายๆ ของพนักงาน)
        const adminFreq = settings.adminReportFrequency || 'weekly';
        if (adminFreq === 'weekly') {
            const targetDay = settings.adminReportDayOfWeek || 'monday';
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const bkkTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
            const currentDayName = dayMap[bkkTime.getDay()];
            
            if (currentDayName !== targetDay) {
                sendProjectSummary = false;
            }
        }
        
        if (sendProjectSummary) {
            for (const project of projects) {
                const projectTasks = allTasks.filter((t: any) => t.projectId === project.id);
                
                // นำโค้ดลอจิกคล้ายหน้าบ้านมารวม
                let overdue = 0, dueSoon = 0, unassigned = 0;
                const statusCounts = { 'not-started': 0, 'in-progress': 0, completed: 0, delayed: 0 };
                
                const today = new Date();
                const todayKey = today.toISOString().split('T')[0];

                projectTasks.forEach((task: any) => {
                    if (task.status === 'completed') statusCounts.completed++;
                    else if (task.status === 'not-started') statusCounts['not-started']++;
                    else if (task.status === 'in-progress') statusCounts['in-progress']++;
                    else if (task.status === 'delayed') statusCounts.delayed++;

                    if (task.status !== 'completed' && task.planEndDate) {
                        if (task.planEndDate < todayKey) overdue++;
                        else if (task.planEndDate === todayKey) dueSoon++;
                    }

                    if (!task.assignedEmployeeIds || task.assignedEmployeeIds.length === 0) {
                        unassigned++;
                    }
                });

                // สร้าง Payload เตรียมส่งผ่าน API line-admin-report
                const payload = {
                    projectName: project.name || 'ไม่มีชื่อโครงการ',
                    projectId: project.id,
                    adminLineUserId,
                    adminLineGroupId,
                    reportType: 'project-summary', // หรือโหลดจาก settings
                    metrics: {
                        totalTasks: projectTasks.length,
                        overdue, dueSoon, unassigned,
                        notStarted: statusCounts['not-started'],
                        inProgress: statusCounts['in-progress'],
                        completed: statusCounts.completed,
                        delayed: statusCounts.delayed,
                    }
                };

                // 5. ส่งผ่าน API (Fetch loopback)
                try {
                    const res = await fetch(`${appUrl}/api/line-admin-report`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (res.ok) sentCount++;
                } catch (err) {
                    console.error(`Failed to send report for project ${project.id}:`, err);
                }
            }
        }

        // 6. ส่งรายงานให้รายบุคคล (พนักงาน)
        let sentEmployeeCount = 0;
        const employeeReportEnabled = settings.employeeReportEnabled ?? false;
        
        if (employeeReportEnabled) {
            // เช็ควันเวลาจากตั้งค่าว่าสอดคล้องกับพฤติกรรมปัจจุบันไหม
            const freq = settings.employeeReportFrequency || 'weekly';
            let shouldRunEmployeeReport = true;
            
            if (freq === 'weekly') {
                const targetDay = settings.employeeReportDayOfWeek || 'monday';
                const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const bkkTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
                const currentDayName = dayMap[bkkTime.getDay()];
                
                if (currentDayName !== targetDay) {
                    shouldRunEmployeeReport = false;
                }
            }

            if (shouldRunEmployeeReport) {
                const membersSnap = await db.collection('teamMembers').get();
                const teamMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                
                // หาคนที่เราจะส่ง: ถ้าตั้งทดสอบก็เอาแค่คนนั้น ไม่งั้นก็ส่งให้ทุกคนที่มี lineUserId
                const targetMembers = settings.employeeReportTestMemberId 
                    ? teamMembers.filter(m => m.id === settings.employeeReportTestMemberId)
                    : teamMembers.filter(m => m.lineUserId && m.lineUserId.trim() !== '');
                    
                for (const member of targetMembers) {
                    // หาเฉพาะ Task ที่จ่ายงานให้พนักงานคนนี้
                    const assignedTasks = allTasks.filter(t => t.assignedEmployeeIds && t.assignedEmployeeIds.includes(member.id));
                    if (assignedTasks.length === 0) continue; // ถ้าไม่มีงานในระบบ ไม่ต้องกวนใจ

                    let overdue = 0, dueSoon = 0;
                    const statusCounts = { 'not-started': 0, 'in-progress': 0, completed: 0 };
                    const today = new Date();
                    const todayKey = today.toISOString().split('T')[0];
                    
                    const taskList = assignedTasks.map(task => {
                        let st = task.status;
                        if (task.status === 'completed') statusCounts.completed++;
                        else if (task.status === 'not-started') statusCounts['not-started']++;
                        else if (task.status === 'in-progress') statusCounts['in-progress']++;

                        if (task.status !== 'completed' && task.planEndDate) {
                            if (task.planEndDate < todayKey) {
                               overdue++;
                               st = 'overdue';
                            }
                            else if (task.planEndDate === todayKey) dueSoon++;
                        }

                        return {
                            name: task.name,
                            status: st, // แนบ status แบบรวม overdue ไปด้วย
                            dueDate: task.planEndDate,
                            startDate: task.planStartDate,
                            durationDays: task.planDuration,
                            projectName: projects.find(p => p.id === task.projectId)?.name || 'Unknown'
                        };
                    });

                    const payload = {
                        to: member.lineUserId || '',
                        employeeName: member.name,
                        projectName: 'สรุปงานของฉัน',
                        periodLabel: 'งานปัจจุบัน',
                        template: settings.employeeReportTemplate || 'compact',
                        summary: {
                            total: assignedTasks.length,
                            overdue, dueSoon,
                            inProgress: statusCounts['in-progress'],
                            notStarted: statusCounts['not-started'],
                            completed: statusCounts.completed
                        },
                        tasks: taskList
                    };

                    // ยิงไปที่ line-employee-report API
                    try {
                        const res = await fetch(`${appUrl}/api/line-employee-report`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        if (res.ok) sentEmployeeCount++;
                    } catch (err) {
                        console.error(`Failed to send report for employee ${member.id}:`, err);
                    }
                }
            }
        }

        return NextResponse.json({ 
            ok: true, 
            message: `สร้างและส่งรายงาน: แอดมิน ${sentCount} โครงการ, พนักงาน ${sentEmployeeCount} คน` 
        });

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
