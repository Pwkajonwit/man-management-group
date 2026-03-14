import React, { useMemo, useState } from 'react';
import { addDays, isPast, isToday } from 'date-fns';
import { Task, Project, TeamMember } from '@/types/construction';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';

interface MyWorkTrackerViewProps {
    tasks: Task[];
    projects: Project[];
    teamMembers: TeamMember[];
}

function isTaskDone(task: Task): boolean {
    return task.status === 'completed' || task.progress >= 100;
}

export default function MyWorkTrackerView({ tasks, projects, teamMembers }: MyWorkTrackerViewProps) {
    const selectableMembers = useMemo(
        () => teamMembers.filter((member) => member.memberType !== 'crew'),
        [teamMembers]
    );
    const [selectedMyWorkUser, setSelectedMyWorkUser] = useState<string>('');

    const activeMyWorkUser = useMemo(() => {
        if (selectableMembers.length === 0) return '';
        if (selectedMyWorkUser && selectableMembers.some((member) => member.name === selectedMyWorkUser)) {
            return selectedMyWorkUser;
        }
        return selectableMembers[0].name;
    }, [selectedMyWorkUser, selectableMembers]);


    const view = useMemo(() => {
        const myTasks = tasks
            .filter((task) => getTaskOwnerNames(task, teamMembers).includes(activeMyWorkUser))
            .sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

        const now = new Date();
        const weekBoundary = addDays(now, 7);

        const overdue = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return isPast(endDate);
        });

        const today = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            return isToday(new Date(task.planEndDate));
        });

        const thisWeek = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return endDate > now && endDate <= weekBoundary;
        });

        const completed = myTasks.filter((task) => isTaskDone(task));
        const openTasks = myTasks.filter((task) => !isTaskDone(task));
        const inProgress = myTasks.filter((task) => task.status === 'in-progress' && !isTaskDone(task));
        const averageProgress = openTasks.length > 0
            ? Math.round(openTasks.reduce((sum, task) => sum + task.progress, 0) / openTasks.length)
            : 0;

        return {
            myTasks,
            openTasks,
            overdue,
            today,
            thisWeek,
            completed,
            inProgress,
            averageProgress,
        };
    }, [activeMyWorkUser, tasks, teamMembers]);

    const ownerLoad = useMemo(() => {
        const selectedMember = selectableMembers.find((member) => member.name === activeMyWorkUser) || null;
        const capacityHours = Math.max(1, selectedMember?.capacityHoursPerWeek || 40);
        const openHours = view.openTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 8), 0);
        const utilPercent = Math.round((openHours / capacityHours) * 100);
        const onTrackCount = Math.max(0, view.openTasks.length - view.overdue.length);

        return {
            memberName: activeMyWorkUser || '-',
            memberPosition: selectedMember?.position || '',
            openHours,
            capacityHours,
            utilPercent,
            openTasks: view.openTasks.length,
            onTrackCount,
        };
    }, [activeMyWorkUser, selectableMembers, view.openTasks, view.overdue.length]);

    const renderTaskRow = (task: Task) => {
        const project = projects.find((projectItem) => projectItem.id === task.projectId);
        return (
            <div key={task.id} className="p-4 hover:bg-[#f8fafc] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="text-[#676879] text-xs font-medium mb-1 uppercase tracking-wider truncate">
                        {project?.name || 'โครงการที่ไม่รู้จัก'} • {task.category}
                    </div>
                    <div className="text-[15px] font-medium text-[#323338] truncate">{task.name}</div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-[#676879]">
                        <span>ครบกำหนด: {task.planEndDate}</span>
                        <span>{task.planDuration} วัน</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right">
                        <div className="text-[11px] text-[#676879]">ความคืบหน้า</div>
                        <div className="text-[13px] font-bold text-[#323338]">{task.progress}%</div>
                    </div>
                    <div className={`min-w-[128px] h-[32px] px-3 flex items-center justify-center text-[12px] font-semibold rounded ${getStatusColor(task.status)} text-white`}>
                        {getStatusLabel(task.status)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex flex-wrap items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-3 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">ระบบติดตามงานของฉัน</h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-6">
                    <div className="order-2 xl:order-1 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                                <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">สถานะเปิด</div>
                                <div className="text-3xl font-black text-[#323338] mt-1">{view.openTasks.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                                <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">เกินกำหนด</div>
                                <div className="text-3xl font-black text-[#e2445c] mt-1">{view.overdue.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                                <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">ครบกำหนดวันนี้</div>
                                <div className="text-3xl font-black text-[#fdab3d] mt-1">{view.today.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                                <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">กำลังดำเนินการ</div>
                                <div className="text-3xl font-black text-[#579bfc] mt-1">{view.inProgress.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                                <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">ความคืบหน้าเฉลี่ย</div>
                                <div className="text-3xl font-black text-[#00c875] mt-1">{view.averageProgress}%</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
                            <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                                <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#fff5f6]">
                                    <h2 className="text-[14px] font-bold text-[#e2445c]">เกินกำหนด & ครบกำหนดวันนี้</h2>
                                </div>
                                <div className="divide-y divide-[#e6e9ef]">
                                    {[...view.overdue, ...view.today].slice(0, 8).map(renderTaskRow)}
                                    {view.overdue.length + view.today.length === 0 && (
                                        <div className="p-8 text-center text-[#676879] text-sm">ไม่มีงานเร่งด่วนในขณะนี้</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                                <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#f0f7ff]">
                                    <h2 className="text-[14px] font-bold text-[#0052cc]">สัปดาห์นี้</h2>
                                </div>
                                <div className="divide-y divide-[#e6e9ef]">
                                    {view.thisWeek.slice(0, 8).map(renderTaskRow)}
                                    {view.thisWeek.length === 0 && (
                                        <div className="p-8 text-center text-[#676879] text-sm">ไม่มีงานที่ครบกำหนดในสัปดาห์นี้</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#eefbf3] flex items-center justify-between">
                                <h2 className="text-[14px] font-bold text-[#008a59]">เสร็จสิ้น</h2>
                                <div className="text-[12px] text-[#676879]">{view.completed.length} งาน</div>
                            </div>
                            <div className="divide-y divide-[#e6e9ef]">
                                {view.completed.slice(0, 6).map(renderTaskRow)}
                                {view.completed.length === 0 && (
                                    <div className="p-8 text-center text-[#676879] text-sm">ยังไม่มีงานที่เสร็จสิ้น</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="order-1 xl:order-2 xl:sticky xl:top-0 self-start space-y-4">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-3 py-2.5 border-b border-[#e6e9ef] bg-[#f8fbff]">
                                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#676879]">ขีดจำกัดภาระงาน</div>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                                    <div>
                                        <div className="text-[18px] font-bold text-[#323338] leading-tight">{ownerLoad.memberName}</div>
                                        {ownerLoad.memberPosition && (
                                            <div className="text-[12px] text-[#676879]">{ownerLoad.memberPosition}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[11px] text-[#676879] uppercase">งาน</div>
                                        <div className="text-[16px] font-bold text-[#323338]">กำลังทำ {ownerLoad.openTasks} งาน</div>
                                        <div className="text-[11px] text-[#00a86b]">ตามแผน {ownerLoad.onTrackCount} งาน</div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[12px] text-[#676879]">
                                        <span>ภาระงาน</span>
                                        <span className="font-semibold text-[#323338]">
                                            {ownerLoad.openHours}h / {ownerLoad.capacityHours}h
                                        </span>
                                    </div>
                                    <div className="mt-1 h-2 rounded-full bg-[#e7edf6] overflow-hidden">
                                        <div
                                            className={`h-full ${ownerLoad.utilPercent > 100 ? 'bg-[#e2445c]' : 'bg-[#00c875]'}`}
                                            style={{ width: `${Math.min(ownerLoad.utilPercent, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] text-[#676879]">ความหนาแน่น</span>
                                    <span className={`text-[13px] font-bold ${ownerLoad.utilPercent > 100 ? 'text-[#e2445c]' : 'text-[#00a86b]'}`}>
                                        {ownerLoad.utilPercent}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#676879] mb-2">ผู้รับผิดชอบ</div>
                            <select
                                value={activeMyWorkUser}
                                onChange={(e) => setSelectedMyWorkUser(e.target.value)}
                                className="w-full bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]"
                            >
                                {selectableMembers.map((member) => (
                                    <option key={member.id} value={member.name}>{member.name}</option>
                                ))}
                                {selectableMembers.length === 0 && (
                                    <option value="">ไม่มีสมาชิกทีม</option>
                                )}
                            </select>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}



