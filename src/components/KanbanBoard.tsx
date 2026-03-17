'use client';

import React, { useState } from 'react';
import { Task } from '@/types/construction';
import { useRouter } from 'next/navigation';
import { AlertTriangle, GripVertical, Clock, ChevronRight } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { getStatusLabel } from '@/utils/statusUtils';

const getPriorityDotColor = (p?: string) => {
    switch (p) {
        case 'urgent': return '#e2445c';
        case 'high': return '#fdab3d';
        case 'medium': return '#579bfc';
        case 'low': return '#c4c4c4';
        default: return 'transparent';
    }
};

interface KanbanBoardProps {
    tasks: Task[];
    teamMembers: { id: string; name: string; avatar?: string }[];
    onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

const STATUS_COLUMNS: { key: Task['status']; label: string; color: string; bgLight: string }[] = [
    { key: 'not-started', label: getStatusLabel('not-started'), color: '#c4c4c4', bgLight: '#f5f5f5' },
    { key: 'in-progress', label: getStatusLabel('in-progress'), color: '#fdab3d', bgLight: '#fff8f0' },
    { key: 'completed', label: getStatusLabel('completed'), color: '#00c875', bgLight: '#eefbf3' },
    { key: 'delayed', label: getStatusLabel('delayed'), color: '#e2445c', bgLight: '#fef2f2' },
];

const formatDateDisplay = (value?: string): string => {
    if (!value) return '-';
    const parts = value.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'dd/MM/yyyy');
};

export default function KanbanBoard({ tasks, teamMembers, onStatusChange }: KanbanBoardProps) {
    const router = useRouter();
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<Task['status'] | null>(null);
    const getTaskOwnerNames = (task: Task): string[] => {
        const ownerNamesFromIds = (task.assignedEmployeeIds || [])
            .map(ownerId => teamMembers.find(member => member.id === ownerId)?.name)
            .filter((name): name is string => Boolean(name));
        const fallbackOwner = task.responsible ? [task.responsible] : [];
        return Array.from(new Set([...ownerNamesFromIds, ...fallbackOwner].map(name => name.trim()).filter(Boolean)));
    };

    const isOverdue = (task: Task): boolean => {
        if (task.status === 'completed') return false;
        if (!task.planEndDate) return false;
        const endDate = new Date(task.planEndDate);
        endDate.setHours(23, 59, 59);
        return isPast(endDate);
    };

    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
    };

    const handleDragEnd = () => {
        setDraggedTask(null);
        setDragOverColumn(null);
    };

    const handleDragOver = (e: React.DragEvent, status: Task['status']) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(prev => (prev === status ? prev : status));
    };

    const handleDrop = (e: React.DragEvent, targetStatus: Task['status']) => {
        e.preventDefault();
        if (draggedTask && draggedTask.status !== targetStatus) {
            onStatusChange(draggedTask.id, targetStatus);
        }
        setDraggedTask(null);
        setDragOverColumn(null);
    };

    return (
        <div className="flex gap-5 h-full overflow-x-auto pb-4">
            {STATUS_COLUMNS.map(col => {
                const columnTasks = tasks.filter(t => t.status === col.key);
                const isDragTarget = dragOverColumn === col.key;
                return (
                    <div
                        key={col.key}
                        className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl transition-all duration-200 ${isDragTarget
                                ? 'bg-[#cce5ff]/50 ring-2 ring-[#0073ea] ring-dashed shadow-lg'
                                : 'bg-[#f5f6f8]'
                            }`}
                        onDragOver={(e) => handleDragOver(e, col.key)}
                        onDrop={(e) => handleDrop(e, col.key)}
                    >
                        {/* Column Header */}
                        <div
                            className="px-4 py-3 rounded-t-xl flex items-center gap-2 shrink-0"
                            style={{ borderBottom: `3px solid ${col.color}` }}
                        >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }}></div>
                            <h3 className="font-bold text-[14px] text-[#323338]">{col.label}</h3>
                            <span className="ml-auto bg-white rounded-full px-2 py-0.5 text-[12px] font-bold text-[#676879] shadow-sm">
                                {columnTasks.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[200px]">
                            {columnTasks.map(task => {
                                const overdue = isOverdue(task);
                                const ownerNames = getTaskOwnerNames(task);
                                const primaryOwnerName = ownerNames[0] || '';
                                const member = teamMembers.find(m => m.name === primaryOwnerName);
                                const startDateLabel = formatDateDisplay(task.planStartDate);
                                const endDateLabel = formatDateDisplay(task.planEndDate);
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-white rounded-lg border shadow-sm p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group ${overdue ? 'border-[#e2445c]/50 bg-[#fff8f8]' : 'border-[#d0d4e4]'
                                            } ${draggedTask?.id === task.id ? 'opacity-60' : ''}`}
                                    >
                                        {/* Top: Priority dot + Category */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <GripVertical className="w-3.5 h-3.5 text-[#d0d4e4] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            {task.priority && (
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getPriorityDotColor(task.priority) }}></div>
                                            )}
                                            <span className="text-[11px] text-[#a0a2b1] truncate">{task.category}</span>
                                            {overdue && <AlertTriangle className="w-3 h-3 text-[#e2445c] ml-auto shrink-0" />}
                                        </div>

                                        {/* Task name */}
                                        <div
                                            onClick={() => router.push(`/tasks/${task.id}`)}
                                            className="text-[14px] font-medium text-[#323338] leading-snug mb-3 cursor-pointer hover:text-[#0073ea] transition-colors line-clamp-2"
                                        >
                                            {task.name}
                                        </div>

                                        {/* Bottom: avatar + progress */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                {member?.avatar ? (
                                                    <img src={member.avatar} alt={primaryOwnerName} className="w-6 h-6 rounded-full object-cover border border-white" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-[#e6e9ef] flex items-center justify-center text-[10px] font-medium text-[#323338]">
                                                        {primaryOwnerName ? primaryOwnerName.substring(0, 2).toUpperCase() : '—'}
                                                    </div>
                                                )}
                                                <span className="text-[11px] text-[#676879] truncate max-w-[100px]">
                                                    {ownerNames.length === 0
                                                        ? 'Unassigned'
                                                        : ownerNames.length === 1
                                                            ? ownerNames[0]
                                                            : `${ownerNames[0]} +${ownerNames.length - 1}`}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <div className="w-12 bg-[#e6e9ef] h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-[#00c875] h-full rounded-full transition-all" style={{ width: `${task.progress}%` }}></div>
                                                </div>
                                                <span className="text-[11px] text-[#676879] font-medium">{task.progress}%</span>
                                            </div>
                                        </div>

                                        {/* Dates + Open button on hover */}
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#e6e9ef]">
                                            <div className="flex items-center gap-1 text-[11px] text-[#a0a2b1]">
                                                <Clock className="w-3 h-3" />
                                                <span className={overdue ? 'text-[#e2445c] font-medium' : ''}>
                                                    {startDateLabel} - {endDateLabel}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => router.push(`/tasks/${task.id}`)}
                                                className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[11px] text-[#0073ea] font-medium hover:underline transition-opacity"
                                            >
                                                Open <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {columnTasks.length === 0 && (
                                <div className="text-center py-10 text-[#a0a2b1] text-[13px]">
                                    {isDragTarget ? 'Drop here' : 'No tasks'}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
