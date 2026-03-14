'use client';

import React, { useMemo, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '@/types/construction';

interface TaskCalendarViewProps {
    tasks: Task[];
    onOpenTask: (taskId: string) => void;
}

const statusDotColor: Record<Task['status'], string> = {
    'not-started': 'bg-[#c4c4c4]',
    'in-progress': 'bg-[#fdab3d]',
    'completed': 'bg-[#00c875]',
    'delayed': 'bg-[#e2445c]',
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TaskCalendarView({ tasks, onOpenTask }: TaskCalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [currentMonth]);

    const tasksByEndDate = useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach((task) => {
            if (!task.planEndDate) return;
            const key = task.planEndDate;
            const existing = map.get(key) || [];
            existing.push(task);
            map.set(key, existing);
        });

        map.forEach((list, key) => {
            list.sort((a, b) => a.name.localeCompare(b.name));
            map.set(key, list);
        });

        return map;
    }, [tasks]);

    return (
        <div className="h-full bg-white rounded-xl shadow-sm border border-[#d0d4e4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e6e9ef] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#323338]">
                    <CalendarDays className="w-4 h-4 text-[#0073ea]" />
                    <h3 className="text-[15px] font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                        className="w-8 h-8 rounded-md border border-[#d0d4e4] text-[#676879] hover:bg-[#f5f6f8]"
                        title="Previous month"
                    >
                        <ChevronLeft className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                        className="px-2.5 h-8 rounded-md border border-[#d0d4e4] text-[12px] text-[#323338] hover:bg-[#f5f6f8]"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                        className="w-8 h-8 rounded-md border border-[#d0d4e4] text-[#676879] hover:bg-[#f5f6f8]"
                        title="Next month"
                    >
                        <ChevronRight className="w-4 h-4 mx-auto" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                    <div className="grid grid-cols-7 border-b border-[#e6e9ef] bg-[#f9fafb]">
                        {weekdayLabels.map((label) => (
                            <div key={label} className="px-3 py-2 text-[12px] font-semibold text-[#676879] border-r border-[#eef1f6] last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 auto-rows-[140px]">
                        {calendarDays.map((day) => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const dayTasks = tasksByEndDate.get(dayKey) || [];
                            const visibleTasks = dayTasks.slice(0, 3);
                            const moreCount = Math.max(dayTasks.length - visibleTasks.length, 0);
                            const isToday = isSameDay(day, new Date());
                            const isInMonth = isSameMonth(day, currentMonth);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`border-r border-b border-[#eef1f6] last:border-r-0 p-2 overflow-hidden ${isInMonth ? 'bg-white' : 'bg-[#fbfcfd]'}`}
                                >
                                    <div className="mb-1.5 flex justify-between items-center">
                                        <span
                                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] ${isToday ? 'bg-[#0073ea] text-white font-semibold' : isInMonth ? 'text-[#323338]' : 'text-[#a0a2b1]'}`}
                                        >
                                            {format(day, 'd')}
                                        </span>
                                        {dayTasks.length > 0 && (
                                            <span className="text-[10px] text-[#a0a2b1]">{dayTasks.length} due</span>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        {visibleTasks.map((task) => (
                                            <button
                                                key={task.id}
                                                type="button"
                                                onClick={() => onOpenTask(task.id)}
                                                className="w-full text-left px-1.5 py-1 rounded border border-[#e6e9ef] hover:border-[#0073ea] hover:bg-[#edf5ff] transition-colors"
                                                title={`${task.name} (${task.planEndDate})`}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor[task.status]}`} />
                                                    <span className="text-[11px] text-[#323338] truncate">{task.name}</span>
                                                </div>
                                            </button>
                                        ))}

                                        {moreCount > 0 && (
                                            <div className="text-[11px] text-[#676879] px-1">+{moreCount} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
