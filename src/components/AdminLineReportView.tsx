'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { AlertTriangle, CalendarDays, Clock3, FolderKanban, ListChecks, UserX2, Users } from 'lucide-react';
import { Project, Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';
import { getStatusLabel } from '@/utils/statusUtils';

type ReportType = 'project-summary' | 'today-team-load' | 'completed-last-2-days';

interface AdminLineReportViewProps {
    projects: Project[];
    tasks: Task[];
    teamMembers: TeamMember[];
    activeProjectId: string | null;
    initialType?: string | null;
    initialProjectId?: string | null;
}

function normalizeReportType(value?: string | null): ReportType {
    if (value === 'today-team-load' || value === 'completed-last-2-days') return value;
    return 'project-summary';
}

function isTaskDone(task: Task): boolean {
    return task.status === 'completed' || task.progress >= 100;
}

function isOverdue(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
}

function isDueSoon(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const now = new Date();
    const dueSoonBoundary = addDays(now, 2);
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() >= now.getTime() && due.getTime() <= dueSoonBoundary.getTime();
}

function toDateKey(value?: string): string {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, 'yyyy-MM-dd');
}

function toTimeLabel(value?: string): string {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'HH:mm');
}

export default function AdminLineReportView({
    projects,
    tasks,
    teamMembers,
    activeProjectId,
    initialType,
    initialProjectId,
}: AdminLineReportViewProps) {
    const [reportType, setReportType] = useState<ReportType>(normalizeReportType(initialType));
    const [selectedProjectId, setSelectedProjectId] = useState<string>(
        initialProjectId || activeProjectId || projects[0]?.id || ''
    );

    useEffect(() => {
        setReportType(normalizeReportType(initialType));
    }, [initialType]);

    useEffect(() => {
        if (!selectedProjectId && projects.length > 0) {
            setSelectedProjectId(initialProjectId || activeProjectId || projects[0].id);
        }
    }, [activeProjectId, initialProjectId, projects, selectedProjectId]);

    const selectedProject = useMemo(
        () => projects.find((project) => project.id === selectedProjectId) || null,
        [projects, selectedProjectId]
    );

    const projectTasks = useMemo(
        () => tasks.filter((task) => task.projectId === selectedProjectId),
        [tasks, selectedProjectId]
    );

    const assignmentByTaskId = useMemo(() => {
        const map = new Map<string, string[]>();
        projectTasks.forEach((task) => {
            map.set(task.id, getTaskOwnerNames(task, teamMembers));
        });
        return map;
    }, [projectTasks, teamMembers]);

    const metrics = useMemo(() => {
        const statusCounts = projectTasks.reduce(
            (acc, task) => {
                acc[task.status] += 1;
                return acc;
            },
            { 'not-started': 0, 'in-progress': 0, completed: 0, delayed: 0 } as Record<Task['status'], number>
        );

        const overdue = projectTasks.filter((task) => isOverdue(task)).length;
        const dueSoon = projectTasks.filter((task) => isDueSoon(task)).length;
        const unassigned = projectTasks.filter((task) => (assignmentByTaskId.get(task.id) || []).length === 0).length;

        return {
            totalTasks: projectTasks.length,
            overdue,
            dueSoon,
            unassigned,
            notStarted: statusCounts['not-started'],
            inProgress: statusCounts['in-progress'],
            completed: statusCounts.completed,
            delayed: statusCounts.delayed,
        };
    }, [assignmentByTaskId, projectTasks]);

    const teamLoad = useMemo(() => {
        const todayKey = format(new Date(), 'yyyy-MM-dd');
        return teamMembers
            .map((member) => {
                const memberTasks = projectTasks.filter((task) =>
                    (assignmentByTaskId.get(task.id) || []).includes(member.name)
                );
                const openTasks = memberTasks.filter((task) => !isTaskDone(task));
                return {
                    id: member.id,
                    name: member.name,
                    totalOpen: openTasks.length,
                    dueToday: openTasks.filter((task) => task.planEndDate === todayKey).length,
                    overdue: openTasks.filter((task) => isOverdue(task)).length,
                };
            })
            .filter((item) => item.totalOpen > 0 || item.dueToday > 0 || item.overdue > 0)
            .sort((a, b) => b.overdue - a.overdue || b.totalOpen - a.totalOpen || b.dueToday - a.dueToday);
    }, [assignmentByTaskId, projectTasks, teamMembers]);

    const completedDigest = useMemo(() => {
        const today = new Date();
        const todayKey = format(today, 'yyyy-MM-dd');
        const tomorrowKey = format(addDays(today, 1), 'yyyy-MM-dd');
        const completedTasks = projectTasks.filter((task) => task.status === 'completed');
        const sortByUpdated = (items: Task[]) =>
            [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        const todayItems = sortByUpdated(completedTasks.filter((task) => toDateKey(task.updatedAt) === todayKey));
        const tomorrowItems = sortByUpdated(completedTasks.filter((task) => toDateKey(task.updatedAt) === tomorrowKey));

        return {
            todayDateLabel: format(today, 'dd/MM/yyyy'),
            tomorrowDateLabel: format(addDays(today, 1), 'dd/MM/yyyy'),
            todayItems: todayItems.map((task) => ({
                id: task.id,
                name: task.name,
                ownerLabel: (assignmentByTaskId.get(task.id) || []).join(', ') || 'Unassigned',
                timeLabel: toTimeLabel(task.updatedAt),
            })),
            tomorrowItems: tomorrowItems.map((task) => ({
                id: task.id,
                name: task.name,
                ownerLabel: (assignmentByTaskId.get(task.id) || []).join(', ') || 'Unassigned',
                timeLabel: toTimeLabel(task.updatedAt),
            })),
        };
    }, [assignmentByTaskId, projectTasks]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4fb_0%,#f7fbff_45%,#f4f8fc_100%)] px-3 py-4 sm:px-4">
            <div className="mx-auto max-w-5xl space-y-3">
                <section className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                    <h1 className="text-[16px] font-bold text-[#1f3147]">Admin Report Viewer (LINE)</h1>
                    <p className="text-[12px] text-[#5f7084] mt-0.5">
                        Generated at {format(new Date(), 'dd/MM/yyyy HH:mm')}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                        <select
                            value={selectedProjectId}
                            onChange={(event) => setSelectedProjectId(event.target.value)}
                            className="rounded-lg border border-[#d0d8e5] bg-white px-3 py-2 text-[13px] text-[#1f3147] outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
                        >
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => setReportType('project-summary')}
                            className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                                reportType === 'project-summary'
                                    ? 'border-[#1d4ed8] bg-[#eff6ff] text-[#1d4ed8]'
                                    : 'border-[#d0d8e5] bg-white text-[#334155]'
                            }`}
                        >
                            Summary
                        </button>
                        <button
                            type="button"
                            onClick={() => setReportType('today-team-load')}
                            className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                                reportType === 'today-team-load'
                                    ? 'border-[#0f766e] bg-[#ecfdf5] text-[#0f766e]'
                                    : 'border-[#d0d8e5] bg-white text-[#334155]'
                            }`}
                        >
                            Teamload
                        </button>
                        <button
                            type="button"
                            onClick={() => setReportType('completed-last-2-days')}
                            className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                                reportType === 'completed-last-2-days'
                                    ? 'border-[#9a3412] bg-[#fff7ed] text-[#9a3412]'
                                    : 'border-[#d0d8e5] bg-white text-[#334155]'
                            }`}
                        >
                            2 Days
                        </button>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#d6deea] bg-white p-3">
                        <div className="text-[10px] uppercase tracking-wide text-[#6b7f95]">Total Tasks</div>
                        <div className="text-[22px] font-black text-[#1f3147] mt-1">{metrics.totalTasks}</div>
                    </div>
                    <div className="rounded-xl border border-[#f1cbd2] bg-[#fff5f6] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-[#9b2f42]">Overdue</div>
                        <div className="text-[22px] font-black text-[#9b2f42] mt-1">{metrics.overdue}</div>
                    </div>
                    <div className="rounded-xl border border-[#d6deea] bg-white p-3">
                        <div className="text-[10px] uppercase tracking-wide text-[#6b7f95]">Due Soon</div>
                        <div className="text-[22px] font-black text-[#2f5f90] mt-1">{metrics.dueSoon}</div>
                    </div>
                    <div className="rounded-xl border border-[#d6deea] bg-white p-3">
                        <div className="text-[10px] uppercase tracking-wide text-[#6b7f95]">Unassigned</div>
                        <div className="text-[22px] font-black text-[#1f3147] mt-1">{metrics.unassigned}</div>
                    </div>
                </section>

                {reportType === 'project-summary' && (
                    <section className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                        <h2 className="text-[14px] font-bold text-[#1f3147] flex items-center gap-1.5">
                            <FolderKanban className="h-4 w-4 text-[#1d4ed8]" />
                            Project Summary
                        </h2>
                        <p className="text-[12px] text-[#5f7084] mt-1">
                            {selectedProject?.name || 'No project selected'}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] p-2.5">
                                <div className="text-[10px] text-[#6b7f95]">Not Started</div>
                                <div className="text-[18px] font-bold text-[#334155]">{metrics.notStarted}</div>
                            </div>
                            <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] p-2.5">
                                <div className="text-[10px] text-[#6b7f95]">In Progress</div>
                                <div className="text-[18px] font-bold text-[#1d4ed8]">{metrics.inProgress}</div>
                            </div>
                            <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] p-2.5">
                                <div className="text-[10px] text-[#6b7f95]">Completed</div>
                                <div className="text-[18px] font-bold text-[#0f766e]">{metrics.completed}</div>
                            </div>
                            <div className="rounded-lg border border-[#f1cbd2] bg-[#fff5f6] p-2.5">
                                <div className="text-[10px] text-[#9b2f42]">Delayed</div>
                                <div className="text-[18px] font-bold text-[#9b2f42]">{metrics.delayed}</div>
                            </div>
                        </div>
                    </section>
                )}

                {reportType === 'today-team-load' && (
                    <section className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                        <h2 className="text-[14px] font-bold text-[#1f3147] flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-[#0f766e]" />
                            Team Load Report (Today)
                        </h2>
                        {teamLoad.length === 0 ? (
                            <div className="mt-3 rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2.5 text-[12px] text-[#5f7084]">
                                No open tasks assigned today.
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {teamLoad.map((row) => (
                                    <article key={row.id} className="rounded-lg border border-[#d6deea] bg-[#f8fbff] p-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-[13px] font-semibold text-[#1f3147]">{row.name}</div>
                                                <div className="text-[11px] text-[#5f7084]">Open: {row.totalOpen}</div>
                                            </div>
                                            <div className="text-right text-[11px]">
                                                <div className="text-[#2f5f90]">Due Today: {row.dueToday}</div>
                                                <div className={`${row.overdue > 0 ? 'text-[#9b2f42] font-semibold' : 'text-[#5f7084]'}`}>
                                                    Overdue: {row.overdue}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {reportType === 'completed-last-2-days' && (
                    <section className="space-y-3">
                        <div className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                            <h2 className="text-[14px] font-bold text-[#1f3147] flex items-center gap-1.5">
                                <ListChecks className="h-4 w-4 text-[#9a3412]" />
                                Completed Work Summary
                            </h2>
                            <p className="text-[12px] text-[#5f7084] mt-1">
                                {completedDigest.todayDateLabel} and {completedDigest.tomorrowDateLabel}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <article className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                                <h3 className="text-[13px] font-semibold text-[#1f3147] flex items-center gap-1.5">
                                    <CalendarDays className="h-4 w-4 text-[#2f5f90]" />
                                    Today ({completedDigest.todayDateLabel}) - {completedDigest.todayItems.length}
                                </h3>
                                <div className="mt-2 space-y-2">
                                    {completedDigest.todayItems.length === 0 && (
                                        <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#5f7084]">
                                            No completed tasks
                                        </div>
                                    )}
                                    {completedDigest.todayItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2">
                                            <div className="text-[12px] font-semibold text-[#1f3147] break-words [overflow-wrap:anywhere]">
                                                {item.name}
                                            </div>
                                            <div className="text-[11px] text-[#5f7084] mt-0.5 break-words [overflow-wrap:anywhere]">
                                                {item.ownerLabel} • {item.timeLabel}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className="rounded-xl border border-[#d6deea] bg-white p-3.5 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                                <h3 className="text-[13px] font-semibold text-[#1f3147] flex items-center gap-1.5">
                                    <Clock3 className="h-4 w-4 text-[#9a3412]" />
                                    Tomorrow ({completedDigest.tomorrowDateLabel}) - {completedDigest.tomorrowItems.length}
                                </h3>
                                <div className="mt-2 space-y-2">
                                    {completedDigest.tomorrowItems.length === 0 && (
                                        <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#5f7084]">
                                            No completed tasks
                                        </div>
                                    )}
                                    {completedDigest.tomorrowItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2">
                                            <div className="text-[12px] font-semibold text-[#1f3147] break-words [overflow-wrap:anywhere]">
                                                {item.name}
                                            </div>
                                            <div className="text-[11px] text-[#5f7084] mt-0.5 break-words [overflow-wrap:anywhere]">
                                                {item.ownerLabel} • {item.timeLabel}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </div>
                    </section>
                )}

                <section className="rounded-xl border border-[#d6deea] bg-white p-3 shadow-[0_4px_12px_rgba(20,40,70,0.06)]">
                    <h3 className="text-[13px] font-semibold text-[#1f3147]">Quick Status List</h3>
                    <div className="mt-2 space-y-2">
                        {projectTasks.slice(0, 8).map((task) => (
                            <article key={task.id} className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2">
                                <div className="text-[12px] font-semibold text-[#1f3147] break-words [overflow-wrap:anywhere]">
                                    {task.name}
                                </div>
                                <div className="mt-0.5 text-[11px] text-[#5f7084] flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>{getStatusLabel(task.status)}</span>
                                    <span>•</span>
                                    <span>Due {task.planEndDate || '-'}</span>
                                    {isOverdue(task) && (
                                        <>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1 text-[#9b2f42] font-semibold">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Overdue
                                            </span>
                                        </>
                                    )}
                                    {(!isOverdue(task) && isDueSoon(task)) && (
                                        <>
                                            <span>•</span>
                                            <span className="text-[#2f5f90] font-semibold">Due soon</span>
                                        </>
                                    )}
                                    {(assignmentByTaskId.get(task.id) || []).length === 0 && (
                                        <>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1 text-[#5f7084]">
                                                <UserX2 className="h-3.5 w-3.5" />
                                                Unassigned
                                            </span>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}
                        {projectTasks.length === 0 && (
                            <div className="rounded-lg border border-[#d6deea] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#5f7084]">
                                No tasks in this project.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
