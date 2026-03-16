import React, { useMemo } from 'react';
import { AlertTriangle, ChevronDown, Clock3, UserX2, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { addDays, isPast } from 'date-fns';
import { Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames, isTaskUnassigned } from '@/utils/taskOwnerUtils';

interface DashboardOverviewViewProps {
    tasks: Task[];
    teamMembers: TeamMember[];
}

interface MemberLoadEntry {
    member: TeamMember;
    memberTasks: Task[];
    openTaskCount: number;
    assignedHours: number;
    capacity: number;
    utilization: number;
    overdue: number;
    completed: number;
    inProgress: number;
}

const PREVIEW_MEMBER_LIMIT = 8;

export default function DashboardOverviewView({ tasks, teamMembers }: DashboardOverviewViewProps) {
    const [expandedGroups, setExpandedGroups] = React.useState<{ team: boolean; crew: boolean }>({
        team: false,
        crew: false,
    });

    const metrics = useMemo(() => {
        const now = new Date();
        const dueSoonBoundary = addDays(now, 2);
        const isTaskDone = (task: Task) => task.status === 'completed' || task.progress >= 100;
        const teamOnlyMembers = teamMembers.filter((member) => member.memberType !== 'crew');
        const crewOnlyMembers = teamMembers.filter((member) => member.memberType === 'crew');

        const overdueTasks = tasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return isPast(endDate);
        });

        const dueSoonTasks = tasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return !isPast(endDate) && endDate <= dueSoonBoundary;
        });

        const unassignedTasks = tasks.filter((task) => isTaskUnassigned(task, teamMembers));

        const buildMemberLoad = (members: TeamMember[]): MemberLoadEntry[] =>
            members.map((member) => {
                const memberTasks = tasks.filter((task) => getTaskOwnerNames(task, teamMembers).includes(member.name));
                const openTasks = memberTasks.filter((task) => !isTaskDone(task));
                const assignedHours = openTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 8), 0);
                const capacity = member.capacityHoursPerWeek ?? 40;
                const utilization = capacity > 0 ? Math.round((assignedHours / capacity) * 100) : 0;
                const overdue = openTasks.filter((task) => {
                    if (isTaskDone(task) || !task.planEndDate) return false;
                    const endDate = new Date(task.planEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    return isPast(endDate);
                }).length;

                return {
                    member,
                    memberTasks,
                    openTaskCount: openTasks.length,
                    assignedHours,
                    capacity,
                    utilization,
                    overdue,
                    completed: memberTasks.filter((task) => isTaskDone(task)).length,
                    inProgress: memberTasks.filter((task) => task.status === 'in-progress' && !isTaskDone(task)).length,
                };
            })
            .sort((a, b) => b.utilization - a.utilization || b.assignedHours - a.assignedHours);

        const teamLoad = buildMemberLoad(teamOnlyMembers);
        const crewLoad = buildMemberLoad(crewOnlyMembers);
        const overloadedMembers = [...teamLoad, ...crewLoad].filter((entry) => entry.utilization > 100);

        return {
            overdueTasks,
            dueSoonTasks,
            unassignedTasks,
            teamOnlyMembers,
            crewOnlyMembers,
            teamLoad,
            crewLoad,
            overloadedMembers,
        };
    }, [tasks, teamMembers]);

    const getUtilizationTone = (utilization: number) => {
        if (utilization > 100) {
            return {
                text: 'text-[#e2445c]',
                bg: 'bg-[#ffebef]',
                bar: 'bg-[#e2445c]',
            };
        }
        if (utilization >= 85) {
            return {
                text: 'text-[#fdab3d]',
                bg: 'bg-[#fff6e6]',
                bar: 'bg-[#fdab3d]',
            };
        }
        return {
            text: 'text-[#00a65a]',
            bg: 'bg-[#e6faef]',
            bar: 'bg-[#00c875]',
        };
    };

    const renderWorkloadGroup = (
        label: string,
        groupKey: 'team' | 'crew',
        entries: MemberLoadEntry[],
        headerClassName: string
    ) => {
        if (entries.length === 0) return null;
        const expanded = expandedGroups[groupKey];
        const visibleEntries = expanded ? entries : entries.slice(0, PREVIEW_MEMBER_LIMIT);
        const hiddenCount = Math.max(entries.length - PREVIEW_MEMBER_LIMIT, 0);

        return (
            <div>
                <div className={`px-5 py-2 text-[11px] font-bold tracking-wide uppercase flex items-center justify-between ${headerClassName}`}>
                    <span>{label}</span>
                    <span className="text-[10px] font-semibold normal-case opacity-90">{entries.length} คน</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-[#6f7683] bg-[#fafbfc]">
                                <th className="px-5 py-2 text-left font-semibold">สมาชิก</th>
                                <th className="px-3 py-2 text-left font-semibold">ภาระงาน</th>
                                <th className="px-3 py-2 text-left font-semibold">การใช้งาน</th>
                                <th className="px-3 py-2 text-left font-semibold">งาน</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eef1f5]">
                            {visibleEntries.map((entry) => {
                                const tone = getUtilizationTone(entry.utilization);
                                return (
                                    <tr key={`${groupKey}-${entry.member.id}`} className="hover:bg-[#f9fafb]">
                                        <td className="px-5 py-2.5">
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold text-[#323338] truncate">{entry.member.name}</div>
                                                <div className="text-[11px] text-[#676879] truncate">{entry.member.position || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 align-top">
                                            <div className="text-[12px] font-semibold text-[#323338]">
                                                {entry.assignedHours} ชม. / {entry.capacity} ชม.
                                            </div>
                                            <div className="mt-1 h-1.5 rounded-full bg-[#e7edf5] overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${tone.bar}`}
                                                    style={{ width: `${Math.min(entry.utilization, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 align-top">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                                                {entry.utilization}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 align-top">
                                            <div className="text-[12px] font-semibold text-[#323338]">{entry.openTaskCount} ที่กำลังเปิด</div>
                                            {entry.overdue > 0 ? (
                                                <div className="text-[11px] text-[#e2445c]">{entry.overdue} ที่เกินกำหนด</div>
                                            ) : (
                                                <div className="text-[11px] text-[#8a8f99]">ตามกำหนด</div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {hiddenCount > 0 && (
                    <div className="px-5 py-2 border-t border-[#eef1f5] bg-[#fcfdff]">
                        <button
                            type="button"
                            onClick={() => setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0060c0] hover:underline"
                        >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            {expanded ? 'แสดงน้อยลง' : `แสดงเพิ่มเติมอีก ${hiddenCount}`}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">ภาพรวมแดชบอร์ดทีมและผู้รับเหมา</h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">งานเกินกำหนด</div>
                            <div className="text-3xl font-black text-[#e2445c] mt-1">{metrics.overdueTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">งานใกล้ครบกำหนด (48 ชม.)</div>
                            <div className="text-3xl font-black text-[#fdab3d] mt-1">{metrics.dueSoonTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">งานยังไม่มอบหมาย</div>
                            <div className="text-3xl font-black text-[#579bfc] mt-1">{metrics.unassignedTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">สมาชิกที่ภาระงานเกิน</div>
                            <div className="text-3xl font-black text-[#323338] mt-1">{metrics.overloadedMembers.length}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[#e6e9ef] flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-[15px] font-bold text-[#323338]">ภาระงานแยกตามกลุ่ม</h2>
                                    <p className="text-[12px] text-[#676879]">เปรียบเทียบความจุกับชั่วโมงงานที่ได้รับ</p>
                                </div>
                                <div className="text-[12px] text-[#676879] flex items-center gap-3">
                                    <span>{metrics.teamOnlyMembers.length} ทีมงาน</span>
                                    <span>{metrics.crewOnlyMembers.length} ทีมช่าง</span>
                                </div>
                            </div>

                            <div className="divide-y divide-[#e6e9ef]">
                                {renderWorkloadGroup('ทีมงาน', 'team', metrics.teamLoad, 'bg-[#f8f9fc] text-[#676879]')}
                                {renderWorkloadGroup('ทีมช่าง', 'crew', metrics.crewLoad, 'bg-[#fff8ee] text-[#b05b00]')}

                                {metrics.teamLoad.length === 0 && metrics.crewLoad.length === 0 && (
                                    <div className="px-5 py-6 text-[13px] text-[#676879]">ไม่พบทีมงานหรือช่าง</div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <AlertTriangle className="w-4 h-4 text-[#e2445c]" /> ต้องเร่งติดตาม
                                </div>
                                <div className="mt-3 space-y-2">
                                    {metrics.overdueTasks.slice(0, 5).map((task) => (
                                        <Link
                                            key={task.id}
                                            href={`/tasks/${task.id}`}
                                            className="block p-2.5 rounded-lg bg-[#fff5f6] border border-[#ffd9de] hover:bg-[#ffecef] transition-colors"
                                        >
                                            <div className="text-[12px] font-semibold text-[#323338] truncate">{task.name}</div>
                                            <div className="text-[11px] text-[#e2445c] mt-1">ครบกำหนด: {task.planEndDate}</div>
                                        </Link>
                                    ))}
                                    {metrics.overdueTasks.length === 0 && (
                                        <div className="text-[12px] text-[#676879]">ไม่มีงานเกินกำหนด</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <Clock3 className="w-4 h-4 text-[#fdab3d]" /> ใกล้ครบกำหนด
                                </div>
                                <div className="mt-3 space-y-2">
                                    {metrics.dueSoonTasks.slice(0, 5).map((task) => (
                                        <Link
                                            key={task.id}
                                            href={`/tasks/${task.id}`}
                                            className="block p-2.5 rounded-lg bg-[#fff8ee] border border-[#ffe0b2] hover:bg-[#fff2dd] transition-colors"
                                        >
                                            <div className="text-[12px] font-semibold text-[#323338] truncate">{task.name}</div>
                                            <div className="text-[11px] text-[#fdab3d] mt-1">ครบกำหนด: {task.planEndDate}</div>
                                        </Link>
                                    ))}
                                    {metrics.dueSoonTasks.length === 0 && (
                                        <div className="text-[12px] text-[#676879]">ไม่มีงานที่ครบกำหนดภายใน 48 ชั่วโมง</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <UserX2 className="w-4 h-4 text-[#579bfc]" /> ยังไม่มอบหมาย
                                </div>
                                <div className="mt-3 text-[12px] text-[#676879]">มี {metrics.unassignedTasks.length} งานที่ยังไม่ได้กำหนดผู้รับผิดชอบ</div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <UsersRound className="w-4 h-4 text-[#323338]" /> แจ้งเตือนภาระงาน
                                </div>
                                <div className="mt-3 text-[12px] text-[#676879]">
                                    {metrics.overloadedMembers.length > 0
                                        ? `มี ${metrics.overloadedMembers.length} คนที่ใช้ความจุเกิน 100%`
                                        : 'สมาชิกทุกคนยังอยู่ในความจุที่รองรับได้'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



