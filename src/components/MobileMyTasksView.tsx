'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, isPast } from 'date-fns';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ListTodo, UserRound } from 'lucide-react';
import { Project, Task, TeamMember } from '@/types/construction';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { findCurrentTeamMember, getTaskOwnerNames as resolveTaskOwnerNames, isTaskAssignedToCurrentUser } from '@/utils/taskOwnerUtils';
import { useAuth } from '@/contexts/AuthContext';

type FilterTab = 'all' | 'soon' | 'overdue' | 'done';

interface MobileMyTasksViewProps {
    tasks: Task[];
    projects: Project[];
    teamMembers: TeamMember[];
    currentUserName: string;
    branchOptions: Array<{ id: string; label: string }>;
    departmentOptions: Array<{ id: string; label: string; branchId?: string }>;
    onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

function isTaskDone(task: Task): boolean {
    return task.status === 'completed' || task.progress >= 100;
}

function isOverdue(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return isPast(endDate);
}

function isDueSoon(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return !isPast(endDate) && endDate <= addDays(new Date(), 2);
}

function getPriorityLabel(priority?: Task['priority']): string {
    switch (priority) {
        case 'urgent':
            return 'ด่วนมาก';
        case 'high':
            return 'สูง';
        case 'medium':
            return 'ปานกลาง';
        case 'low':
            return 'ต่ำ';
        default:
            return 'ปกติ';
    }
}

function getPriorityBadgeClass(priority?: Task['priority']): string {
    switch (priority) {
        case 'urgent':
            return 'border-[#e9c3cb] bg-[#fff3f5] text-[#9b2f42]';
        case 'high':
            return 'border-[#f0d6b1] bg-[#fff8ee] text-[#8b5a1c]';
        case 'medium':
            return 'border-[#c8d7eb] bg-[#f0f6fd] text-[#2d5f92]';
        case 'low':
            return 'border-[#cfdae7] bg-[#f4f7fb] text-[#496178]';
        default:
            return 'border-[#cfdae7] bg-[#f4f7fb] text-[#5c6f83]';
    }
}

function formatDateDdMmYyyy(dateValue?: string): string {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, 'dd/MM/yyyy');
}

function formatTaskTimeline(task: Task): string {
    const start = formatDateDdMmYyyy(task.planStartDate);
    const end = formatDateDdMmYyyy(task.planEndDate);
    if (start === '-' && end === '-') return '-';
    if (start === '-') return end;
    if (end === '-') return start;
    return start === end ? start : `${start} - ${end}`;
}

export default function MobileMyTasksView({
    tasks,
    projects,
    teamMembers,
    currentUserName,
    branchOptions,
    departmentOptions,
    onStatusChange,
}: MobileMyTasksViewProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [displayLimit, setDisplayLimit] = useState(20);
    const [showProfileCard, setShowProfileCard] = useState(false);

    const handleTabChange = (tab: FilterTab) => {
        setActiveTab(tab);
        setDisplayLimit(20);
    };
    const [pendingStatusChange, setPendingStatusChange] = useState<{
        taskId: string;
        taskName: string;
        targetStatus: Task['status'];
    } | null>(null);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const [impersonatedMemberId, setImpersonatedMemberId] = useState('');
    const { user, logoutUser } = useAuth();
    const profileName = user?.displayName || currentUserName || 'User';
    const profileInitial = profileName.substring(0, 2).toUpperCase();
    const branchLabelById = useMemo(
        () => new Map(branchOptions.map((option) => [option.id, option.label])),
        [branchOptions]
    );
    const departmentLabelById = useMemo(
        () => new Map(departmentOptions.map((option) => [option.id, option.label])),
        [departmentOptions]
    );
    const registeredMemberName = useMemo(() => {
        const matchedMember = findCurrentTeamMember(
            teamMembers,
            currentUserName || profileName,
            user?.lineUserId,
            user?.uid
        );
        return matchedMember?.name || currentUserName || profileName || 'User';
    }, [teamMembers, currentUserName, profileName, user?.lineUserId, user?.uid]);
    const currentMember = useMemo(() => (
        findCurrentTeamMember(
            teamMembers,
            currentUserName || profileName,
            user?.lineUserId,
            user?.uid
        )
    ), [teamMembers, currentUserName, profileName, user?.lineUserId, user?.uid]);
    const canImpersonate = Boolean(
        user?.role && ['super_admin', 'branch_manager', 'department_manager'].includes(user.role)
    );
    const impersonationCandidates = useMemo(
        () => teamMembers
            .filter((member) => member.memberType !== 'crew')
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'th')),
        [teamMembers]
    );
    const impersonatedMember = useMemo(() => {
        if (!canImpersonate || !impersonatedMemberId) return null;
        return impersonationCandidates.find((member) => member.id === impersonatedMemberId) || null;
    }, [canImpersonate, impersonatedMemberId, impersonationCandidates]);
    const effectiveMember = impersonatedMember || currentMember;
    const effectiveMemberName = effectiveMember?.name || registeredMemberName;
    const profileBranchLabel = useMemo(() => {
        const branchId = currentMember?.branchId || user?.branchId || '';
        return branchLabelById.get(branchId) || currentMember?.position || branchId || '-';
    }, [branchLabelById, currentMember?.branchId, currentMember?.position, user?.branchId]);
    const profileDepartmentLabel = useMemo(() => {
        const departmentId = currentMember?.departmentId || user?.departmentId || '';
        return departmentLabelById.get(departmentId) || currentMember?.department || departmentId || '-';
    }, [currentMember?.department, currentMember?.departmentId, departmentLabelById, user?.departmentId]);
    const effectiveBranchLabel = useMemo(() => {
        const branchId = effectiveMember?.branchId || '';
        return branchLabelById.get(branchId) || effectiveMember?.position || branchId || '-';
    }, [branchLabelById, effectiveMember?.branchId, effectiveMember?.position]);
    const effectiveDepartmentLabel = useMemo(() => {
        const departmentId = effectiveMember?.departmentId || '';
        return departmentLabelById.get(departmentId) || effectiveMember?.department || departmentId || '-';
    }, [departmentLabelById, effectiveMember?.department, effectiveMember?.departmentId]);

    const completedProjectIds = useMemo(() => (
        new Set(
            projects
                .filter((project) => project.status === 'completed')
                .map((project) => project.id)
        )
    ), [projects]);

    const reportTasks = useMemo(() => (
        tasks.filter((task) => !completedProjectIds.has(task.projectId))
    ), [tasks, completedProjectIds]);

    const reportOwnerNamesByTaskId = useMemo(() => {
        const map = new Map<string, string[]>();
        reportTasks.forEach((task) => {
            map.set(task.id, resolveTaskOwnerNames(task, teamMembers));
        });
        return map;
    }, [reportTasks, teamMembers]);

    const myTasks = useMemo(() => {
        return reportTasks.filter((task) =>
            isTaskAssignedToCurrentUser(
                task,
                teamMembers,
                impersonatedMember?.name || currentUserName,
                impersonatedMember ? undefined : user?.lineUserId,
                impersonatedMember?.id || user?.uid
            )
        );
    }, [reportTasks, teamMembers, impersonatedMember, currentUserName, user?.lineUserId, user?.uid]);

    const taskOwnerNamesById = useMemo(() => {
        const map = new Map<string, string[]>();
        myTasks.forEach((task) => {
            map.set(task.id, reportOwnerNamesByTaskId.get(task.id) || []);
        });
        return map;
    }, [myTasks, reportOwnerNamesByTaskId]);

    const grouped = useMemo(() => {
        return {
            all: myTasks.filter((task) => !isTaskDone(task)),
            soon: myTasks.filter((task) => isDueSoon(task)),
            overdue: myTasks.filter((task) => isOverdue(task)),
            done: myTasks.filter((task) => isTaskDone(task)),
        };
    }, [myTasks]);

    const shownTasks = grouped[activeTab]
        .slice()
        .sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

    const visibleTasks = shownTasks.slice(0, displayLimit);

    const stats = {
        total: grouped.all.length,
        overdue: grouped.overdue.length,
        soon: grouped.soon.length,
        done: grouped.done.length,
    };

    const requestStatusChange = (task: Task, targetStatus: Task['status']) => {
        if (task.status === targetStatus) return;
        setPendingStatusChange({
            taskId: task.id,
            taskName: task.name,
            targetStatus,
        });
    };

    const cancelStatusChange = () => {
        if (isChangingStatus) return;
        setPendingStatusChange(null);
    };

    const confirmStatusChange = async () => {
        if (!pendingStatusChange || isChangingStatus) return;
        try {
            setIsChangingStatus(true);
            await Promise.resolve(onStatusChange(pendingStatusChange.taskId, pendingStatusChange.targetStatus));
            setPendingStatusChange(null);
        } finally {
            setIsChangingStatus(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6f9fc_0%,#eef3f8_42%,#e8eef5_100%)]">
            <header className="sticky top-0 z-20 bg-gradient-to-r from-[#00675e] via-[#1b8930] to-[#066a5b] p-4 shadow-[0_12px_28px_rgba(12,34,58,0.2)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[16px] font-bold text-white tracking-[0.02em]">POWERTEC ENGINEERING CO., LTD.</h1>
                        <p className="text-[12px] text-[#d8e7f6] flex items-center gap-1 mt-0.5">
                            <UserRound className="w-3.5 h-3.5" /> {impersonatedMember ? `โหมดทดสอบ: ${effectiveMemberName}` : registeredMemberName}
                        </p>
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowProfileCard((prev) => !prev)}
                            className="w-10 h-10 rounded-full border border-white bg-gradient-to-r from-[#6ab04c] via-[#6ab04c] to-[#badc58] hover:bg-[#325b82] transition-colors overflow-hidden flex items-center justify-center"
                            aria-label="โปรไฟล์"
                            title="โปรไฟล์"
                        >
                            {user?.pictureUrl ? (
                                <img
                                    src={user.pictureUrl}
                                    alt={profileName}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-[11px] font-bold text-[#f0f6ff]">{profileInitial}</span>
                            )}
                        </button>
                        {showProfileCard && (
                            <div className="absolute right-0 mt-2 min-w-[220px] rounded-xl border border-[#c9d4e2] bg-white shadow-[0_12px_28px_rgba(12,34,58,0.2)] px-3 py-3">
                                <p className="text-[11px] text-[#6f7f92] uppercase tracking-wide">โปรไฟล์</p>
                                <p className="text-[13px] font-semibold text-[#1e2f44] truncate mt-0.5">{registeredMemberName}</p>
                                <div className="mt-3 space-y-2">
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-[#6c7f93]">สาขา</p>
                                        <p className="text-[12px] font-semibold text-[#1f3147] mt-0.5">{profileBranchLabel}</p>
                                    </div>
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-[#6c7f93]">แผนก</p>
                                        <p className="text-[12px] font-semibold text-[#1f3147] mt-0.5">{profileDepartmentLabel}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowProfileCard(false);
                                        logoutUser();
                                    }}
                                    className="mt-3 w-full rounded-lg border border-[#ffd4db] bg-[#fff4f6] px-3 py-2 text-[12px] font-semibold text-[#c33d57] transition-colors hover:bg-[#ffe8ed]"
                                >
                                    ออกจากระบบ
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-md mx-auto md:max-w-none md:mx-0 md:p-8">
                {canImpersonate && (
                    <div className="rounded-xl border border-[#cfd9e6] bg-white p-3 shadow-[0_2px_12px_rgba(30,56,86,0.06)]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6c7f93]">โหมดทดสอบแอดมิน</p>
                                <p className="mt-1 text-[13px] text-[#24425f]">เลือกพนักงานเพื่อดูหน้า `/me` แทนคนนั้นสำหรับทดสอบการรับงาน</p>
                            </div>
                            <div className="w-full md:w-[320px]">
                                <select
                                    value={impersonatedMemberId}
                                    onChange={(e) => setImpersonatedMemberId(e.target.value)}
                                    className="w-full rounded-lg border border-[#cfd9e6] bg-[#f8fbff] px-3 py-2 text-[13px] text-[#1f3147] outline-none focus:border-[#2f5f90] focus:ring-2 focus:ring-[#2f5f90]/15"
                                >
                                    <option value="">ใช้ตัวตนปัจจุบัน</option>
                                    {impersonationCandidates.map((member) => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#24425f]">
                                กำลังดูงานของ: {effectiveMemberName}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#24425f]">
                                สาขา: {effectiveBranchLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#24425f]">
                                แผนก: {effectiveDepartmentLabel}
                            </span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                    <button
                        type="button"
                        onClick={() => handleTabChange('all')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${activeTab === 'all'
                                ? 'border-[#2f5f90] ring-2 ring-[#2f5f90]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                            }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">เปิด</div>
                        <div className="text-[18px] font-black text-[#20374f] mt-1">{stats.total}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('soon')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${activeTab === 'soon'
                                ? 'border-[#2f5f90] ring-2 ring-[#2f5f90]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                            }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">ใกล้กำหนด</div>
                        <div className="text-[18px] font-black text-[#2b5f95] mt-1">{stats.soon}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('overdue')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${activeTab === 'overdue'
                                ? 'border-[#9b2f42] ring-2 ring-[#9b2f42]/20'
                                : 'border-[#cfd9e6] hover:border-[#caa2ab]'
                            }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">เกินกำหนด</div>
                        <div className="text-[18px] font-black text-[#9b2f42] mt-1">{stats.overdue}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('done')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${activeTab === 'done'
                                ? 'border-[#1f4f7a] ring-2 ring-[#1f4f7a]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                            }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">เสร็จสิ้น</div>
                        <div className="text-[18px] font-black text-[#1f4f7a] mt-1">{stats.done}</div>
                    </button>
                </div>

                <div className="space-y-3 pb-6">
                    {shownTasks.length === 0 && (
                        <div className="bg-white rounded-xl border border-[#cfd9e6] p-8 text-center shadow-[0_2px_12px_rgba(30,56,86,0.06)]">
                            <ListTodo className="w-7 h-7 mx-auto text-[#8ea0b5]" />
                            <p className="text-[13px] text-[#5f7084] mt-2">ไม่มีงานในส่วนนี้</p>
                        </div>
                    )}

                    {visibleTasks.map((task) => {
                        const project = projects.find((p) => p.id === task.projectId);
                        const overdue = isOverdue(task);
                        const dueSoon = isDueSoon(task);
                        const ownerNames = taskOwnerNamesById.get(task.id) || [];
                        const progress = Math.max(0, Math.min(100, task.progress || 0));
                        const timelineLabel = formatTaskTimeline(task);
                        const isWorking = task.status === 'in-progress';
                        const isDone = isTaskDone(task);

                        return (
                            <div key={task.id} className="bg-white rounded-xl border border-[#cfd9e6] p-3.5 shadow-[0_3px_14px_rgba(22,46,73,0.08)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-[#5f7084] break-words [overflow-wrap:anywhere]">
                                            {project?.name || 'ไม่มีโครงการ'} • {task.category}
                                        </p>
                                        <p className="text-[14px] font-semibold text-[#1f3147] leading-snug mt-1 break-words [overflow-wrap:anywhere]">
                                            {task.name}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-semibold border border-[#d2ddea] ${getStatusColor(task.status)}`}>
                                        {getStatusLabel(task.status)}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold border ${getPriorityBadgeClass(task.priority)}`}>
                                        ความสำคัญ: {getPriorityLabel(task.priority)}
                                    </span>
                                    <span className="text-[10px] px-2 py-1 rounded-full font-semibold border border-[#ced9e7] bg-[#f3f7fb] text-[#2a4a68]">
                                        ความคืบหน้า: {progress}%
                                    </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-[11px]">
                                    <div className="text-[#5f7084] flex items-center gap-1">
                                        <CalendarDays className="w-3.5 h-3.5" /> {timelineLabel}
                                    </div>
                                    {overdue ? (
                                        <div className="text-[#9b2f42] font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> เกินกำหนด
                                        </div>
                                    ) : dueSoon ? (
                                        <div className="text-[#2f5f90] font-semibold flex items-center gap-1">
                                            <Clock3 className="w-3.5 h-3.5" /> ใกล้ถึงกำหนด
                                        </div>
                                    ) : (
                                        <div className="text-[#1f4f7a] font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> ตามกำหนด
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 h-2 rounded-full bg-[#e5edf6] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#2f5f90] via-[#3b75b1] to-[#4a8ac9]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2 py-1.5">
                                        <p className="text-[#6c7f93] uppercase tracking-wide text-[10px]">ผู้รับผิดชอบ</p>
                                        <p className="text-[#1f3147] font-semibold break-words [overflow-wrap:anywhere]">
                                            {ownerNames.length > 0 ? ownerNames.join(', ') : 'ยังไม่ระบุ'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2 py-1.5">
                                        <p className="text-[#6c7f93] uppercase tracking-wide text-[10px]">ระยะเวลา</p>
                                        <p className="text-[#1f3147] font-semibold truncate">{task.planDuration || 0} วัน</p>
                                    </div>
                                </div>

                                {task.description && (
                                    <div className="mt-2 rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-[#6c7f93]">รายละเอียด</p>
                                        <p className="text-[11px] text-[#44586c] mt-1 line-clamp-2">{task.description}</p>
                                    </div>
                                )}

                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        onClick={() => requestStatusChange(task, 'in-progress')}
                                        className={`text-[11px] px-2.5 py-1.5 rounded-md font-semibold border transition-all ${isWorking
                                                ? 'bg-gradient-to-r from-[#ffb347] to-[#ff8f1f] text-white border-[#e37b16] shadow-[0_3px_10px_rgba(255,143,31,0.35)]'
                                                : 'bg-[#fff4e8] text-[#9b5b16] border-[#ffd1a2] hover:bg-[#ffe9d3]'
                                            }`}
                                    >
                                        กำลังดำเนินการ
                                    </button>
                                    <button
                                        onClick={() => requestStatusChange(task, 'completed')}
                                        className={`text-[11px] px-2.5 py-1.5 rounded-md font-semibold border transition-all ${isDone
                                                ? 'bg-gradient-to-r from-[#2acb7a] to-[#0cae5f] text-white border-[#0e9a58] shadow-[0_3px_10px_rgba(12,174,95,0.32)]'
                                                : 'bg-[#e9f9f0] text-[#0f8a52] border-[#bde8d0] hover:bg-[#dff4e9]'
                                            }`}
                                    >
                                        เสร็จสิ้น
                                    </button>
                                    <Link
                                        href={impersonatedMemberId ? `/me/tasks/${task.id}?asMember=${encodeURIComponent(impersonatedMemberId)}` : `/me/tasks/${task.id}`}
                                        className="ml-auto text-[11px] px-2.5 py-1.5 rounded-md bg-[#f1f5fa] text-[#24425f] font-semibold border border-[#cfd8e5]"
                                    >
                                        รายละเอียด
                                    </Link>
                                </div>
                            </div>
                        );
                    })}

                    {shownTasks.length > displayLimit && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setDisplayLimit((prev) => prev + 20)}
                                className="w-full py-3 rounded-xl border border-[#cfd9e6] bg-white text-[#2b5f95] text-[13px] font-semibold hover:bg-[#f6f9fc] transition-colors shadow-[0_2px_8px_rgba(30,56,86,0.04)]"
                            >
                                โหลดเพิ่มเติม ({shownTasks.length - displayLimit} รายการ)
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {pendingStatusChange && (
                <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4">
                    <div className="w-full max-w-sm rounded-xl border border-[#d0dbe8] bg-white shadow-[0_18px_42px_rgba(15,33,53,0.25)]">
                        <div className="px-4 py-3 border-b border-[#e4ebf4]">
                            <h3 className="text-[15px] font-bold text-[#1f3147]">ยืนยันการเปลี่ยนสถานะ</h3>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                            <p className="text-[13px] text-[#42586f] leading-relaxed">
                                เปลี่ยนสถานะงานสำหรับ <span className="font-semibold text-[#1f3147]">{pendingStatusChange.taskName}</span> ใช่หรือไม่?
                            </p>
                            <div className="text-[12px] text-[#5f7084]">
                                สถานะใหม่:{' '}
                                <span className="font-semibold text-[#1f3147]">
                                    {getStatusLabel(pendingStatusChange.targetStatus)}
                                </span>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-[#e4ebf4] flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancelStatusChange}
                                disabled={isChangingStatus}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#f1f5fa] border border-[#d3ddeb] text-[#24425f] hover:bg-[#e6edf6] disabled:opacity-60"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmStatusChange()}
                                disabled={isChangingStatus}
                                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold text-white disabled:opacity-60 ${pendingStatusChange.targetStatus === 'completed'
                                        ? 'bg-[#17a864] hover:bg-[#119557]'
                                        : 'bg-[#f08f24] hover:bg-[#dd7f16]'
                                    }`}
                            >
                                {isChangingStatus ? 'กำลังอัปเดต...' : 'ยืนยัน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
