'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Save, Send, Settings2, Users } from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { subscribeSystemUserAccounts } from '@/lib/firestore';
import { SystemUserAccount, Task, TeamMember } from '@/types/construction';

type ReportDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

function isTaskOverdue(task: Task): boolean {
    if (!task.planEndDate || task.status === 'completed') return false;
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
}

function isTaskDueSoon(task: Task, days: number): boolean {
    if (!task.planEndDate || task.status === 'completed') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    const max = new Date(now);
    max.setDate(max.getDate() + days);
    max.setHours(23, 59, 59, 999);
    return due.getTime() >= now.getTime() && due.getTime() <= max.getTime();
}

export default function SettingsPage() {
    const {
        loading,
        notificationSettings,
        updateNotificationSettings,
        teamMembers,
        tasks,
        projects,
        activeProjectId,
        scopeBranchId,
        scopeDepartmentId,
        taskScopeBranchOptions,
        taskScopeDepartmentOptions,
        dataSource,
    } = useAppContext();

    const [systemUsers, setSystemUsers] = useState<SystemUserAccount[]>([]);

    useEffect(() => {
        if (dataSource !== 'firebase') return;
        const unsubscribe = subscribeSystemUserAccounts((users) => {
            setSystemUsers(users);
        });
        return () => unsubscribe();
    }, [dataSource]);

    const [isSavingLineConfig, setIsSavingLineConfig] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);

    const [lineAdminUserIdDraft, setLineAdminUserIdDraft] = useState('');
    const [lineAdminGroupIdDraft, setLineAdminGroupIdDraft] = useState('');

    const [adminReportProjectSummary, setAdminReportProjectSummary] = useState(true);
    const [adminReportTeamLoad, setAdminReportTeamLoad] = useState(true);
    const [adminReportCompleted, setAdminReportCompleted] = useState(true);

    const [employeeReportEnabled, setEmployeeReportEnabled] = useState(false);
    const [employeeReportFrequency, setEmployeeReportFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [employeeReportDayOfWeek, setEmployeeReportDayOfWeek] = useState<ReportDay>('monday');
    const [employeeReportTime, setEmployeeReportTime] = useState('17:00');
    const [employeeReportScope, setEmployeeReportScope] = useState<'active-project' | 'all-projects' | 'active-branch' | 'active-department'>('active-project');
    const [employeeReportTemplate, setEmployeeReportTemplate] = useState<'compact' | 'detailed'>('detailed');
    const [employeeReportIncludeOverdue, setEmployeeReportIncludeOverdue] = useState(true);
    const [employeeReportIncludeDueSoon, setEmployeeReportIncludeDueSoon] = useState(true);
    const [employeeReportIncludeCompleted, setEmployeeReportIncludeCompleted] = useState(true);
    const [employeeReportIncludeNotStarted, setEmployeeReportIncludeNotStarted] = useState(true);
    const [employeeReportIncludeInProgress, setEmployeeReportIncludeInProgress] = useState(true);
    const [employeeReportIncludeTaskList, setEmployeeReportIncludeTaskList] = useState(true);
    const [employeeReportMaxItems, setEmployeeReportMaxItems] = useState(6);
    const [employeeReportDueSoonDays, setEmployeeReportDueSoonDays] = useState(2);
    const [employeeReportTestMemberId, setEmployeeReportTestMemberId] = useState('');

    const reportableMembers = useMemo(
        () => teamMembers.filter((member) => member.memberType !== 'crew'),
        [teamMembers]
    );
    const branchLabelById = useMemo(
        () => new Map(taskScopeBranchOptions.map((option) => [option.id, option.label])),
        [taskScopeBranchOptions]
    );
    const departmentLabelById = useMemo(
        () => new Map(taskScopeDepartmentOptions.map((option) => [option.id, option.label])),
        [taskScopeDepartmentOptions]
    );

    const allUsersWithLine = useMemo(() => {
        const list: { id: string; name: string; lineUserId: string; source: string }[] = [];
        
        teamMembers.forEach(m => {
            if (m.lineUserId && !list.some(x => x.lineUserId === m.lineUserId)) {
                list.push({ id: m.id, name: m.name, lineUserId: m.lineUserId, source: 'พนักงาน' });
            }
        });
        
        systemUsers.forEach(u => {
            if (u.lineUserId && !list.some(x => x.lineUserId === u.lineUserId)) {
                list.push({ id: String(u.id || u.username), name: String(u.displayName || u.username), lineUserId: u.lineUserId, source: 'ผู้ใช้ระบบ' });
            }
        });
        
        return list;
    }, [teamMembers, systemUsers]);

    const [adminReportFrequency, setAdminReportFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [adminReportDayOfWeek, setAdminReportDayOfWeek] = useState<ReportDay>('monday');
    const [adminReportTime, setAdminReportTime] = useState('08:00');

    useEffect(() => {
        setLineAdminUserIdDraft(notificationSettings.lineAdminUserId || '');
        setLineAdminGroupIdDraft(notificationSettings.lineAdminGroupId || '');

        setAdminReportProjectSummary(notificationSettings.adminReportProjectSummary ?? true);
        setAdminReportTeamLoad(notificationSettings.adminReportTeamLoad ?? true);
        setAdminReportCompleted(notificationSettings.adminReportCompleted ?? true);
        setAdminReportFrequency(notificationSettings.adminReportFrequency || 'weekly');
        setAdminReportDayOfWeek(notificationSettings.adminReportDayOfWeek || 'monday');
        setAdminReportTime(notificationSettings.adminReportTime || '08:00');

        setEmployeeReportEnabled(notificationSettings.employeeReportEnabled ?? false);
        setEmployeeReportFrequency(notificationSettings.employeeReportFrequency || 'weekly');
        setEmployeeReportDayOfWeek(notificationSettings.employeeReportDayOfWeek || 'monday');
        setEmployeeReportTime(notificationSettings.employeeReportTime || '17:00');
        setEmployeeReportScope(notificationSettings.employeeReportScope || 'active-project');
        setEmployeeReportTemplate(notificationSettings.employeeReportTemplate || 'detailed');
        setEmployeeReportIncludeOverdue(notificationSettings.employeeReportIncludeOverdue ?? true);
        setEmployeeReportIncludeDueSoon(notificationSettings.employeeReportIncludeDueSoon ?? true);
        setEmployeeReportIncludeCompleted(notificationSettings.employeeReportIncludeCompleted ?? true);
        setEmployeeReportIncludeNotStarted(notificationSettings.employeeReportIncludeNotStarted ?? true);
        setEmployeeReportIncludeInProgress(notificationSettings.employeeReportIncludeInProgress ?? true);
        setEmployeeReportIncludeTaskList(notificationSettings.employeeReportIncludeTaskList ?? true);
        setEmployeeReportMaxItems(notificationSettings.employeeReportMaxItems ?? 6);
        setEmployeeReportDueSoonDays(notificationSettings.employeeReportDueSoonDays ?? 2);
        setEmployeeReportTestMemberId(notificationSettings.employeeReportTestMemberId || '');
    }, [notificationSettings]);

    const handleSaveLineConfig = async () => {
        try {
            setIsSavingLineConfig(true);
            await updateNotificationSettings({
                lineAdminUserId: lineAdminUserIdDraft.trim(),
                lineAdminGroupId: lineAdminGroupIdDraft.trim(),
                adminReportProjectSummary,
                adminReportTeamLoad,
                adminReportCompleted,
                adminReportFrequency,
                adminReportDayOfWeek,
                adminReportTime,
                employeeReportEnabled,
                employeeReportFrequency,
                employeeReportDayOfWeek,
                employeeReportTime,
                employeeReportScope,
                employeeReportTemplate,
                employeeReportIncludeOverdue,
                employeeReportIncludeDueSoon,
                employeeReportIncludeCompleted,
                employeeReportIncludeNotStarted,
                employeeReportIncludeInProgress,
                employeeReportIncludeTaskList,
                employeeReportMaxItems: Math.min(Math.max(employeeReportMaxItems, 1), 20),
                employeeReportDueSoonDays: Math.min(Math.max(employeeReportDueSoonDays, 1), 14),
                employeeReportTestMemberId,
            });
            alert('บันทึกการตั้งค่ารายงาน LINE แล้ว');
        } catch (error) {
            console.error('Failed to update LINE settings:', error);
            alert('ไม่สามารถอัปเดตการตั้งค่า LINE ได้ โปรดลองอีกครั้ง');
        } finally {
            setIsSavingLineConfig(false);
        }
    };

    const activeProject = useMemo(
        () => projects.find((project) => project.id === activeProjectId),
        [projects, activeProjectId]
    );
    const resolvedReportBranchId = useMemo(() => {
        if (scopeBranchId && scopeBranchId !== 'all' && taskScopeBranchOptions.some((option) => option.id === scopeBranchId)) {
            return scopeBranchId;
        }
        if (activeProject?.branchId && taskScopeBranchOptions.some((option) => option.id === activeProject.branchId)) {
            return activeProject.branchId;
        }
        return taskScopeBranchOptions[0]?.id || '';
    }, [activeProject?.branchId, scopeBranchId, taskScopeBranchOptions]);
    const resolvedReportDepartmentId = useMemo(() => {
        if (scopeDepartmentId && scopeDepartmentId !== 'all' && taskScopeDepartmentOptions.some((option) => option.id === scopeDepartmentId)) {
            return scopeDepartmentId;
        }
        if (activeProject?.departmentId && taskScopeDepartmentOptions.some((option) => option.id === activeProject.departmentId)) {
            return activeProject.departmentId;
        }
        return taskScopeDepartmentOptions.find((option) => !option.branchId || option.branchId === resolvedReportBranchId)?.id
            || taskScopeDepartmentOptions[0]?.id
            || '';
    }, [activeProject?.departmentId, resolvedReportBranchId, scopeDepartmentId, taskScopeDepartmentOptions]);
    const reportScopeLabel = useMemo(() => {
        if (employeeReportScope === 'all-projects') return 'ทุกโครงการ';
        if (employeeReportScope === 'active-project') return activeProject?.name || 'โครงการปัจจุบัน';
        if (employeeReportScope === 'active-branch') {
            return `สาขา: ${branchLabelById.get(resolvedReportBranchId) || resolvedReportBranchId || '-'}`;
        }
        return `แผนก: ${departmentLabelById.get(resolvedReportDepartmentId) || resolvedReportDepartmentId || '-'}`
            + ` / ${branchLabelById.get(resolvedReportBranchId) || resolvedReportBranchId || '-'}`;
    }, [activeProject?.name, branchLabelById, departmentLabelById, employeeReportScope, resolvedReportBranchId, resolvedReportDepartmentId]);

    const scopedTasks = useMemo(() => {
        if (employeeReportScope === 'all-projects') return tasks;
        if (employeeReportScope === 'active-project') {
            return tasks.filter((task) => task.projectId === activeProjectId);
        }
        if (employeeReportScope === 'active-branch') {
            if (!resolvedReportBranchId) return [];
            return tasks.filter((task) => (task.branchId || '') === resolvedReportBranchId);
        }
        if (!resolvedReportBranchId || !resolvedReportDepartmentId) return [];
        return tasks.filter((task) =>
            (task.branchId || '') === resolvedReportBranchId
            && (task.departmentId || '') === resolvedReportDepartmentId
        );
    }, [employeeReportScope, tasks, activeProjectId, resolvedReportBranchId, resolvedReportDepartmentId]);
    const scopedReportableMembers = useMemo(() => {
        if (employeeReportScope === 'all-projects') return reportableMembers;
        if (employeeReportScope === 'active-project') {
            if (!activeProject) return reportableMembers;
            return reportableMembers.filter((member) => (
                (member.branchId || '') === (activeProject.branchId || '')
                && (member.departmentId || '') === (activeProject.departmentId || '')
            ));
        }
        if (employeeReportScope === 'active-branch') {
            if (!resolvedReportBranchId) return [];
            return reportableMembers.filter((member) => (member.branchId || '') === resolvedReportBranchId);
        }
        if (!resolvedReportBranchId || !resolvedReportDepartmentId) return [];
        return reportableMembers.filter((member) => (
            (member.branchId || '') === resolvedReportBranchId
            && (member.departmentId || '') === resolvedReportDepartmentId
        ));
    }, [activeProject, employeeReportScope, reportableMembers, resolvedReportBranchId, resolvedReportDepartmentId]);
    const membersWithLine = useMemo(
        () => scopedReportableMembers.filter((member) => Boolean(member.lineUserId && member.lineUserId.trim())),
        [scopedReportableMembers]
    );

    const selectedMember = useMemo(
        () => scopedReportableMembers.find((member) => member.id === employeeReportTestMemberId) || null,
        [scopedReportableMembers, employeeReportTestMemberId]
    );

    useEffect(() => {
        if (!employeeReportTestMemberId) return;
        if (!scopedReportableMembers.some((member) => member.id === employeeReportTestMemberId)) {
            setEmployeeReportTestMemberId('');
        }
    }, [employeeReportTestMemberId, scopedReportableMembers]);

    const preview = useMemo(() => {
        if (!selectedMember) {
            return { total: 0, overdue: 0, dueSoon: 0, inProgress: 0, notStarted: 0, completed: 0, tasks: [] as Task[] };
        }

        const memberTasks = scopedTasks.filter((task) => {
            const byIds = (task.assignedEmployeeIds || []).includes(selectedMember.id);
            const byName = (task.responsible || '').trim() === selectedMember.name;
            return byIds || byName;
        });

        const filteredForList = memberTasks
            .filter((task) => {
                if (task.status === 'completed' && !employeeReportIncludeCompleted) return false;
                if (task.status === 'not-started' && !employeeReportIncludeNotStarted) return false;
                if (task.status === 'in-progress' && !employeeReportIncludeInProgress) return false;
                if (!employeeReportIncludeOverdue && isTaskOverdue(task)) return false;
                if (!employeeReportIncludeDueSoon && isTaskDueSoon(task, employeeReportDueSoonDays)) return false;
                return true;
            })
            .sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

        return {
            total: memberTasks.filter((task) => task.status !== 'completed').length,
            overdue: memberTasks.filter((task) => isTaskOverdue(task)).length,
            dueSoon: memberTasks.filter((task) => isTaskDueSoon(task, employeeReportDueSoonDays)).length,
            inProgress: memberTasks.filter((task) => task.status === 'in-progress').length,
            notStarted: memberTasks.filter((task) => task.status === 'not-started').length,
            completed: memberTasks.filter((task) => task.status === 'completed').length,
            tasks: employeeReportIncludeTaskList ? filteredForList.slice(0, employeeReportMaxItems) : [],
        };
    }, [
        selectedMember,
        scopedTasks,
        employeeReportIncludeCompleted,
        employeeReportIncludeNotStarted,
        employeeReportIncludeInProgress,
        employeeReportIncludeOverdue,
        employeeReportIncludeDueSoon,
        employeeReportDueSoonDays,
        employeeReportIncludeTaskList,
        employeeReportMaxItems,
    ]);

    const handleSendEmployeeTest = async () => {
        if (!selectedMember) {
            alert('กรุณาเลือกพนักงาน');
            return;
        }
        if (!selectedMember.lineUserId) {
            alert('พนักงานที่เลือกยังไม่ได้ผูก LINE');
            return;
        }

        try {
            setIsSendingTest(true);
            const periodLabel = employeeReportFrequency === 'weekly'
                ? `สรุปรายสัปดาห์ (${new Date().toLocaleDateString('th-TH')})`
                : `สรุปรายวัน (${new Date().toLocaleDateString('th-TH')})`;

            const response = await fetch('/api/line-employee-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedMember.lineUserId,
                    employeeName: selectedMember.name,
                    projectName: reportScopeLabel,
                    periodLabel,
                    template: employeeReportTemplate,
                    summary: {
                        total: preview.total,
                        overdue: preview.overdue,
                        dueSoon: preview.dueSoon,
                        inProgress: preview.inProgress,
                        notStarted: preview.notStarted,
                        completed: preview.completed,
                    },
                    tasks: preview.tasks.map((task) => ({
                        name: task.name,
                        status: task.status,
                        startDate: task.planStartDate,
                        endDate: task.planEndDate,
                        durationDays: task.planDuration,
                        dueDate: task.planEndDate,
                        projectName: projects.find((project) => project.id === task.projectId)?.name || 'โครงการที่ไม่ทราบชื่อ',
                    })),
                }),
            });

            const data = await response.json();
            if (!response.ok || !data?.ok) {
                throw new Error(data?.error || 'ไม่สามารถส่งรายงานพนักงานได้');
            }

            alert(`ส่งรายงานทดสอบไปยัง ${selectedMember.name} เรียบร้อยแล้ว`);
        } catch (error) {
            console.error('Failed to send employee report:', error);
            alert('ไม่สามารถส่งรายงานทดสอบให้พนักงานได้ โปรดตรวจสอบการตั้งค่า LINE');
        } finally {
            setIsSendingTest(false);
        }
    };

    if (loading) return <LinearLoadingScreen message="กำลังโหลดการตั้งค่า..." />;

    const isLineConfigChanged =
        lineAdminUserIdDraft.trim() !== (notificationSettings.lineAdminUserId || '').trim() ||
        lineAdminGroupIdDraft.trim() !== (notificationSettings.lineAdminGroupId || '').trim() ||
        adminReportProjectSummary !== (notificationSettings.adminReportProjectSummary ?? true) ||
        adminReportTeamLoad !== (notificationSettings.adminReportTeamLoad ?? true) ||
        adminReportCompleted !== (notificationSettings.adminReportCompleted ?? true) ||
        adminReportFrequency !== (notificationSettings.adminReportFrequency || 'weekly') ||
        adminReportDayOfWeek !== (notificationSettings.adminReportDayOfWeek || 'monday') ||
        adminReportTime !== (notificationSettings.adminReportTime || '08:00') ||
        employeeReportEnabled !== (notificationSettings.employeeReportEnabled ?? false) ||
        employeeReportFrequency !== (notificationSettings.employeeReportFrequency || 'weekly') ||
        employeeReportDayOfWeek !== (notificationSettings.employeeReportDayOfWeek || 'monday') ||
        employeeReportTime !== (notificationSettings.employeeReportTime || '17:00') ||
        employeeReportScope !== (notificationSettings.employeeReportScope || 'active-project') ||
        employeeReportTemplate !== (notificationSettings.employeeReportTemplate || 'detailed') ||
        employeeReportIncludeOverdue !== (notificationSettings.employeeReportIncludeOverdue ?? true) ||
        employeeReportIncludeDueSoon !== (notificationSettings.employeeReportIncludeDueSoon ?? true) ||
        employeeReportIncludeCompleted !== (notificationSettings.employeeReportIncludeCompleted ?? true) ||
        employeeReportIncludeNotStarted !== (notificationSettings.employeeReportIncludeNotStarted ?? true) ||
        employeeReportIncludeInProgress !== (notificationSettings.employeeReportIncludeInProgress ?? true) ||
        employeeReportIncludeTaskList !== (notificationSettings.employeeReportIncludeTaskList ?? true) ||
        employeeReportMaxItems !== (notificationSettings.employeeReportMaxItems ?? 6) ||
        employeeReportDueSoonDays !== (notificationSettings.employeeReportDueSoonDays ?? 2) ||
        employeeReportTestMemberId !== (notificationSettings.employeeReportTestMemberId || '');

    const renderSwitch = (
        checked: boolean,
        onChange: (value: boolean) => void,
        label: string,
        hint?: string
    ) => (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e6e9ef] px-3 py-2 bg-white">
            <div>
                <div className="text-[13px] font-medium text-[#323338]">{label}</div>
                {hint && <div className="text-[11px] text-[#676879] mt-0.5">{hint}</div>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#00c875]' : 'bg-[#c4c4c4]'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );

    const renderEmployeeScopeOption = (
        scope: typeof employeeReportScope,
        label: string
    ) => {
        const checked = employeeReportEnabled && employeeReportScope === scope;
        return (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e6e9ef] px-3 py-2 bg-white">
                <div className="text-[13px] font-medium text-[#323338]">{label}</div>
                <button
                    type="button"
                    onClick={() => {
                        if (checked) {
                            setEmployeeReportEnabled(false);
                            return;
                        }
                        setEmployeeReportEnabled(true);
                        setEmployeeReportScope(scope);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#00c875]' : 'bg-[#c4c4c4]'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate flex items-center gap-2">
                    <Bell className="w-7 h-7 text-[#0073ea]" />
                    ศูนย์รายงาน LINE
                </h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Settings2 className="w-4 h-4 text-[#0073ea]" />
                                การตั้งค่ารายงานผู้ดูแลระบบ
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-1.5">
                                    <div className="text-[13px] font-medium text-[#323338]">ส่งหาผู้ดูแลระบบ</div>
                                    <div className="border border-[#d0d4e4] rounded-lg bg-white overflow-hidden max-h-[200px] overflow-y-auto">
                                        {allUsersWithLine.length === 0 ? (
                                            <div className="p-3 text-center text-[12px] text-[#676879]">
                                                (ยังไม่มีผู้ใช้ใดที่ผูกบัญชี LINE)
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {allUsersWithLine.map(user => {
                                                    const currentIds = lineAdminUserIdDraft.split(',').map(s => s.trim()).filter(Boolean);
                                                    const isChecked = currentIds.includes(user.lineUserId);
                                                    return (
                                                        <label key={user.lineUserId} className="flex items-center gap-3 p-2.5 border-b border-[#f5f6f8] hover:bg-[#f8fbff] cursor-pointer last:border-b-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        if (!currentIds.includes(user.lineUserId)) {
                                                                            setLineAdminUserIdDraft([...currentIds, user.lineUserId].join(', '));
                                                                        }
                                                                    } else {
                                                                        setLineAdminUserIdDraft(currentIds.filter(id => id !== user.lineUserId).join(', '));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-[#0073ea] rounded focus:ring-[#0073ea]"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] text-[#323338]">{user.name}</span>
                                                                <span className="text-[10px] text-[#676879]">[{user.source}] • {user.lineUserId}</span>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-2 text-[12px] font-medium text-[#323338]">เพิ่มไอดีกำหนดเอง:</div>
                                    <input
                                        type="text"
                                        value={lineAdminUserIdDraft}
                                        onChange={(e) => setLineAdminUserIdDraft(e.target.value)}
                                        placeholder="รหัสผู้ใช้ LINE (Uxxxx...)"
                                        className="w-full h-9 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none mb-2"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                     <div className="text-[13px] font-medium text-[#323338]">ส่งเข้ากลุ่มไลน์</div>
                                    <input
                                        type="text"
                                        value={lineAdminGroupIdDraft}
                                        onChange={(e) => setLineAdminGroupIdDraft(e.target.value)}
                                        placeholder="เช่น C1234567890abcdef... (แยกหลายกลุ่มด้วยคั่นคอมม่า)"
                                        className="w-full h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-[#e6e9ef]">
                                {renderSwitch(adminReportProjectSummary, setAdminReportProjectSummary, 'รวมสรุปโครงการ')}
                                {renderSwitch(adminReportTeamLoad, setAdminReportTeamLoad, 'รวมภาระงานทีม')}
                                {renderSwitch(adminReportCompleted, setAdminReportCompleted, 'รวมงานที่เสร็จสิ้น')}
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[#e6e9ef]">
                                <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                    <Users className="w-4 h-4 text-[#0073ea]" />
                                    การตั้งค่ารายงานพนักงาน (ผ่าน AppScript)
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="text-[13px] font-medium text-[#323338]">ตั้งค่าขอบเขตการดึงรายงานพนักงาน</div>
                                {renderEmployeeScopeOption('active-project', 'เฉพาะงานที่อยู่ในโครงการปัจจุบัน')}
                                {renderEmployeeScopeOption('all-projects', 'รวมงานจากทุกโครงการ')}
                                {renderEmployeeScopeOption('active-branch', 'รวมงานตามสาขา')}
                                {renderEmployeeScopeOption('active-department', 'รวมงานตามแผนก')}
                                {!employeeReportEnabled && (
                                    <div className="text-[11px] text-[#676879] px-1">ปิดการแจ้งรายงานพนักงาน</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4">
                            <button
                                type="button"
                                onClick={() => void handleSaveLineConfig()}
                                disabled={!isLineConfigChanged || isSavingLineConfig}
                                className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-medium hover:bg-[#0060c0] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                บันทึกการตั้งค่าทั้งหมด
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3 sticky">
                            <div className="text-[15px] font-semibold text-[#323338]">ทดสอบรายงานพนักงาน</div>
                            <select
                                value={employeeReportTestMemberId}
                                onChange={(e) => setEmployeeReportTestMemberId(e.target.value)}
                                className="w-full h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                            >
                                <option value="">เลือกสมาชิกทีม</option>
                                {membersWithLine.map((member: TeamMember) => (
                                    <option key={member.id} value={member.id}>{member.name}</option>
                                ))}
                            </select>

                            <div className="rounded-lg border border-[#e6e9ef] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#516273]">
                                ขอบเขตรายงาน: {reportScopeLabel}
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border border-[#e6e9ef] p-2">
                                    <div className="text-[10px] text-[#676879]">เปิด</div>
                                    <div className="text-[18px] font-bold text-[#323338]">{preview.total}</div>
                                </div>
                                <div className="rounded-lg border border-[#ffe4e8] bg-[#fff5f7] p-2">
                                    <div className="text-[10px] text-[#676879]">เกินกำหนด</div>
                                    <div className="text-[18px] font-bold text-[#e2445c]">{preview.overdue}</div>
                                </div>
                                <div className="rounded-lg border border-[#ffeacc] bg-[#fff8ec] p-2">
                                    <div className="text-[10px] text-[#676879]">ใกล้กำหนด</div>
                                    <div className="text-[18px] font-bold text-[#fdab3d]">{preview.dueSoon}</div>
                                </div>
                            </div>

                            <div className="text-[12px] text-[#676879] space-y-1">
                                <div>กำลังดำเนินการ: <span className="font-semibold text-[#323338]">{preview.inProgress}</span></div>
                                <div>ยังไม่เริ่ม: <span className="font-semibold text-[#323338]">{preview.notStarted}</span></div>
                                <div>เสร็จสิ้น: <span className="font-semibold text-[#323338]">{preview.completed}</span></div>
                                <div>จำนวนงาน: <span className="font-semibold text-[#323338]">{preview.tasks.length}</span></div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleSendEmployeeTest()}
                                disabled={isSendingTest || !employeeReportTestMemberId}
                                className="w-full h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f2937] text-white text-[13px] font-medium hover:bg-[#111827] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                                ส่งรายงานทดสอบ
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
