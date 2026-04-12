'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Clock3, MessageSquare, RefreshCw, Save, Send, Settings2, UserPlus, Users } from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { Task, TeamMember } from '@/types/construction';

type ToggleSettingKey = 'notifyTaskAssigned' | 'notifyTaskStatusChanged' | 'notifyTaskCommentAdded';

const settingItems: Array<{
    key: ToggleSettingKey;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
        {
            key: 'notifyTaskAssigned',
            title: 'แจ้งเตือนเมื่อมอบหมายงาน',
            description: 'ส่งข้อความ LINE เมื่อมีการมอบหมายงานให้ผู้รับผิดชอบใหม่',
            icon: UserPlus,
        },
        {
            key: 'notifyTaskStatusChanged',
            title: 'แจ้งเตือนเมื่อเปลี่ยนสถานะ',
            description: 'ส่งข้อความ LINE เมื่อสถานะงานถูกเปลี่ยน',
            icon: RefreshCw,
        },
        {
            key: 'notifyTaskCommentAdded',
            title: 'แจ้งเตือนการแสดงความคิดเห็น',
            description: 'ส่งข้อความ LINE เมื่อมีการอัปเดตงานหรือแสดงความคิดเห็น',
            icon: MessageSquare,
        },
    ];

const dayOptions = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

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
    } = useAppContext();

    const [savingKey, setSavingKey] = useState<ToggleSettingKey | null>(null);
    const [isSavingLineConfig, setIsSavingLineConfig] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);

    const [lineAdminUserIdDraft, setLineAdminUserIdDraft] = useState('');
    const [lineReportTypeDraft, setLineReportTypeDraft] = useState<'project-summary' | 'today-team-load' | 'completed-last-2-days'>('project-summary');

    const [employeeReportEnabled, setEmployeeReportEnabled] = useState(false);
    const [employeeReportFrequency, setEmployeeReportFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [employeeReportDayOfWeek, setEmployeeReportDayOfWeek] = useState<(typeof dayOptions)[number]>('monday');
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

    useEffect(() => {
        setLineAdminUserIdDraft(notificationSettings.lineAdminUserId || '');
        setLineReportTypeDraft(notificationSettings.lineReportType || 'project-summary');

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

    const handleToggle = async (key: ToggleSettingKey) => {
        try {
            setSavingKey(key);
            await updateNotificationSettings({ [key]: !notificationSettings[key] });
        } catch (error) {
            console.error('Failed to update notification settings:', error);
            alert('ไม่สามารถอัปเดตการตั้งค่าการแจ้งเตือนได้ โปรดลองอีกครั้ง');
        } finally {
            setSavingKey(null);
        }
    };

    const handleSaveLineConfig = async () => {
        try {
            setIsSavingLineConfig(true);
            await updateNotificationSettings({
                lineAdminUserId: lineAdminUserIdDraft.trim(),
                lineReportType: lineReportTypeDraft,
                employeeReportEnabled: false,
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
        lineReportTypeDraft !== (notificationSettings.lineReportType || 'project-summary') ||
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    value={lineAdminUserIdDraft}
                                    onChange={(e) => setLineAdminUserIdDraft(e.target.value)}
                                    placeholder="รหัสผู้ใช้ LINE ของผู้ดูแลระบบ"
                                    className="md:col-span-2 h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                />
                                <select
                                    value={lineReportTypeDraft}
                                    onChange={(e) => setLineReportTypeDraft(e.target.value as 'project-summary' | 'today-team-load' | 'completed-last-2-days')}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white"
                                >
                                    <option value="project-summary">สรุปโครงการ</option>
                                    <option value="today-team-load">ภาระงานทีมวันนี้</option>
                                    <option value="completed-last-2-days">เสร็จสิ้น (วันนี้ + พรุ่งนี้)</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Users className="w-4 h-4 text-[#0073ea]" />
                                การตั้งค่ารายงานพนักงาน
                            </div>

                            <div className="rounded-lg border border-[#ffe1b3] bg-[#fff7e6] px-3 py-2 text-[12px] text-[#8a5a00]">
                                ระบบส่งรายงานพนักงานอัตโนมัติยังไม่เปิดใช้งานในเวอร์ชันนี้ ขณะนี้รองรับการส่งรายงานทดสอบด้วยตนเองเท่านั้น เพื่อป้องกันการตั้งค่าคลาดเคลื่อน ระบบจะไม่บันทึกสถานะ &quot;เปิดใช้งานรายงานพนักงาน&quot; เป็นอัตโนมัติ
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {renderSwitch(false, () => undefined, 'รายงานพนักงานอัตโนมัติ', 'ยังไม่พร้อมใช้งานในระบบจริง')}
                                {renderSwitch(employeeReportIncludeTaskList, setEmployeeReportIncludeTaskList, 'รวมรายชื่อส่วนการทำงาน', 'รวมรายการงานหลักลงในรายงาน')}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <select
                                    value={employeeReportFrequency}
                                    onChange={(e) => setEmployeeReportFrequency(e.target.value as 'daily' | 'weekly')}
                                    disabled
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white disabled:opacity-60"
                                >
                                    <option value="daily">ความถี่: รายวัน</option>
                                    <option value="weekly">ความถี่: รายสัปดาห์</option>
                                </select>
                                <select
                                    value={employeeReportDayOfWeek}
                                    onChange={(e) => setEmployeeReportDayOfWeek(e.target.value as (typeof dayOptions)[number])}
                                    disabled
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white disabled:opacity-60"
                                >
                                    {dayOptions.map((day) => (
                                        <option key={day} value={day}>{`วัน: ${day}`}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Clock3 className="w-4 h-4 text-[#676879] absolute left-3 top-3" />
                                    <input
                                        type="time"
                                        value={employeeReportTime}
                                        onChange={(e) => setEmployeeReportTime(e.target.value)}
                                        disabled
                                        className="h-10 w-full pl-9 pr-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none disabled:opacity-60"
                                    />
                                </div>
                                <select
                                    value={employeeReportScope}
                                    onChange={(e) => setEmployeeReportScope(e.target.value as 'active-project' | 'all-projects' | 'active-branch' | 'active-department')}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                                >
                                    <option value="active-project">ขอบเขต: โครงการปัจจุบัน</option>
                                    <option value="all-projects">ขอบเขต: โครงการทั้งหมด</option>
                                    <option value="active-branch">ขอบเขต: สาขาปัจจุบัน</option>
                                    <option value="active-department">ขอบเขต: แผนกปัจจุบัน</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <select
                                    value={employeeReportTemplate}
                                    onChange={(e) => setEmployeeReportTemplate(e.target.value as 'compact' | 'detailed')}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                                >
                                    <option value="compact">รูปแบบ: กะทัดรัด</option>
                                    <option value="detailed">รูปแบบ: ละเอียด</option>
                                </select>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={employeeReportMaxItems}
                                    onChange={(e) => setEmployeeReportMaxItems(Number(e.target.value) || 1)}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none"
                                    placeholder="จำนวนงานสูงสุด"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    max={14}
                                    value={employeeReportDueSoonDays}
                                    onChange={(e) => setEmployeeReportDueSoonDays(Number(e.target.value) || 1)}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none"
                                    placeholder="แจ้งเตือนก่อน (วัน)"
                                />
                                <div className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[12px] text-[#676879] flex items-center">
                                    ขอบเขตที่ใช้: {reportScopeLabel}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {renderSwitch(employeeReportIncludeOverdue, setEmployeeReportIncludeOverdue, 'รวมงานที่เกินกำหนด')}
                                {renderSwitch(employeeReportIncludeDueSoon, setEmployeeReportIncludeDueSoon, 'รวมงานที่ใกล้ถึงกำหนด')}
                                {renderSwitch(employeeReportIncludeInProgress, setEmployeeReportIncludeInProgress, 'รวมสถานะกำลังดำเนินการ')}
                                {renderSwitch(employeeReportIncludeNotStarted, setEmployeeReportIncludeNotStarted, 'รวมสถานะยังไม่เริ่ม')}
                                {renderSwitch(employeeReportIncludeCompleted, setEmployeeReportIncludeCompleted, 'รวมสถานะเสร็จสิ้น')}
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

                            <div className="text-[11px] text-[#9ca3af]">
                                โหมดทดสอบจะส่งไปยังสมาชิกที่เลือกเท่านั้น และเป็นช่องทางที่รองรับจริงในเวอร์ชันปัจจุบัน
                            </div>
                        </div>

                        {settingItems.map((item) => {
                            const Icon = item.icon;
                            const enabled = notificationSettings[item.key];
                            const isSaving = savingKey === item.key;

                            return (
                                <div key={item.key} className="bg-white border border-[#d0d4e4] rounded-xl p-4 flex items-center justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[#edf5ff] text-[#0073ea] flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-semibold text-[#323338]">{item.title}</div>
                                            <div className="text-[11px] text-[#676879] mt-0.5">{item.description}</div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleToggle(item.key)}
                                        disabled={isSaving}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-[#00c875]' : 'bg-[#c4c4c4]'} ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
