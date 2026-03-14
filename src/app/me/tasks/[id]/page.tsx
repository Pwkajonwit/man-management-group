'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { addDays, isPast } from 'date-fns';
import {
    AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3,
    CheckSquare, Square, Paperclip, FileText, Image as ImageIcon, File, Download, MessageSquare, Plus
} from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { isTaskAssignedToCurrentUser } from '@/utils/taskOwnerUtils';
import { Task } from '@/types/construction';
import { useAuth } from '@/contexts/AuthContext';

function isOverdue(task: Task): boolean {
    if (task.status === 'completed' || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return isPast(endDate);
}

function isDueSoon(task: Task): boolean {
    if (task.status === 'completed' || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return !isPast(endDate) && endDate <= addDays(new Date(), 2);
}

function getFileIcon(type: string) {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-[#1f6feb]" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-[#315a8f]" />;
    return <File className="w-4 h-4 text-[#64748b]" />;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getStatusActionClass(buttonStatus: Task['status'], currentStatus: Task['status']): string {
    const isActive = buttonStatus === currentStatus;
    if (buttonStatus === 'not-started') {
        return isActive
            ? 'bg-[#334155] text-white border-[#334155] shadow-[0_4px_12px_rgba(51,65,85,0.24)]'
            : 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1] hover:bg-[#e8eef6]';
    }
    if (buttonStatus === 'in-progress') {
        return isActive
            ? 'bg-[#1f6feb] text-white border-[#1a5fcb] shadow-[0_4px_12px_rgba(31,111,235,0.3)]'
            : 'bg-[#eef4ff] text-[#1e4f9a] border-[#c8d8f3] hover:bg-[#e2ecff]';
    }
    if (buttonStatus === 'completed') {
        return isActive
            ? 'bg-[#1e3a8a] text-white border-[#1d3577] shadow-[0_4px_12px_rgba(30,58,138,0.28)]'
            : 'bg-[#e8eefc] text-[#1e3a8a] border-[#c9d5f3] hover:bg-[#dde7fb]';
    }
    return isActive
        ? 'bg-[#b91c1c] text-white border-[#9f1a1a] shadow-[0_4px_12px_rgba(185,28,28,0.24)]'
        : 'bg-[#fff1f2] text-[#9f1239] border-[#fecdd3] hover:bg-[#ffe6ea]';
}

export default function UserTaskDetailPage() {
    const router = useRouter();
    const { user } = useAuth();
    const params = useParams<{ id: string }>();
    const taskId = Array.isArray(params.id) ? params.id[0] : params.id;
    const {
        tasks,
        projects,
        teamMembers,
        subtasks,
        attachments,
        taskUpdates,
        subscribeTaskDetails,
        addSubTask,
        toggleSubTask,
        addTaskUpdate,
        currentUserName,
        loading,
        handleUpdateTaskStatus,
        handleUpdateTaskProgress,
    } = useAppContext();

    useEffect(() => {
        if (!taskId) return;
        const unsubscribe = subscribeTaskDetails(taskId);
        return () => unsubscribe();
    }, [taskId, subscribeTaskDetails]);

    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [newUpdateText, setNewUpdateText] = useState('');
    const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<Task['status'] | null>(null);
    const [isSubmittingStatusChange, setIsSubmittingStatusChange] = useState(false);
    const sortedTaskUpdates = useMemo(() => {
        const updates = taskId ? (taskUpdates[taskId] || []) : [];
        return [...updates].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [taskId, taskUpdates]);

    if (loading) return <LinearLoadingScreen message="กำลังโหลดรายละเอียดงาน..." />;

    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
        return (
            <div className="min-h-screen bg-[#f5f6f8] p-4 flex items-center justify-center">
                <div className="bg-white border border-[#d0d4e4] rounded-xl p-5 text-center max-w-sm w-full">
                    <p className="text-[15px] font-semibold text-[#323338]">ไม่พบงาน</p>
                    <Link
                        href="/me"
                        className="mt-3 inline-flex px-3 py-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-semibold"
                    >
                        กลับไปที่งานของฉัน
                    </Link>
                </div>
            </div>
        );
    }

    const isOwner = isTaskAssignedToCurrentUser(task, teamMembers, currentUserName, user?.lineUserId, user?.uid);
    if (!isOwner) {
        return (
            <div className="min-h-screen bg-[#f5f6f8] p-4 flex items-center justify-center">
                <div className="bg-white border border-[#d0d4e4] rounded-xl p-5 text-center max-w-sm w-full">
                    <p className="text-[15px] font-semibold text-[#323338]">ไม่มีสิทธิ์ในการเข้าถึงงานนี้</p>
                    <Link
                        href="/me"
                        className="mt-3 inline-flex px-3 py-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-semibold"
                    >
                        กลับไปที่งานของฉัน
                    </Link>
                </div>
            </div>
        );
    }

    const project = projects.find((item) => item.id === task.projectId);
    const isProjectCompleted = project?.status === 'completed';

    if (isProjectCompleted) {
        return (
            <div className="min-h-screen bg-[#f5f6f8] p-4 flex items-center justify-center">
                <div className="bg-white border border-[#d0d4e4] rounded-xl p-5 text-center max-w-sm w-full">
                    <p className="text-[15px] font-semibold text-[#323338]">โครงการเสร็จสมบูรณ์แล้ว</p>
                    <p className="mt-1 text-[13px] text-[#676879]">รายละเอียดงานถูกซ่อนสำหรับโครงการที่เสร็จสมบูรณ์แล้ว</p>
                    <Link
                        href="/me"
                        className="mt-3 inline-flex px-3 py-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-semibold"
                    >
                        กลับไปที่งานของฉัน
                    </Link>
                </div>
            </div>
        );
    }

    const overdue = isOverdue(task);
    const dueSoon = isDueSoon(task);
    const taskSubtasks = subtasks[taskId] || [];
    const completedSubtasks = taskSubtasks.filter((item) => item.completed).length;
    const taskAttachments = attachments[taskId] || [];

    const handleAddSubtask = async () => {
        const name = newSubtaskName.trim();
        if (!name || isSubmittingSubtask) return;
        try {
            setIsSubmittingSubtask(true);
            await Promise.resolve(addSubTask(task.id, name));
            setNewSubtaskName('');
        } finally {
            setIsSubmittingSubtask(false);
        }
    };

    const handleToggleSubtask = (subtaskId: string) => {
        void Promise.resolve(toggleSubTask(task.id, subtaskId));
    };

    const handleAddUpdate = async () => {
        const text = newUpdateText.trim();
        if (!text || isSubmittingUpdate) return;
        try {
            setIsSubmittingUpdate(true);
            await addTaskUpdate(task.id, text);
            setNewUpdateText('');
        } finally {
            setIsSubmittingUpdate(false);
        }
    };

    const requestStatusChange = (nextStatus: Task['status']) => {
        if (nextStatus === task.status) return;
        setPendingStatusChange(nextStatus);
    };

    const cancelStatusChange = () => {
        if (isSubmittingStatusChange) return;
        setPendingStatusChange(null);
    };

    const confirmStatusChange = async () => {
        if (!pendingStatusChange || isSubmittingStatusChange) return;
        try {
            setIsSubmittingStatusChange(true);
            await Promise.resolve(handleUpdateTaskStatus(task.id, pendingStatusChange));
            setPendingStatusChange(null);
        } finally {
            setIsSubmittingStatusChange(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7faff_0%,#eef3f8_45%,#e8eef5_100%)]">
            <header className="sticky top-0 z-20  bg-gradient-to-r from-[#00675e] via-[#1b8930] to-[#066a5b] p-4  border-b border-[#2a4a68] shadow-[0_6px_18px_rgba(14,33,52,0.35)]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/me')}
                        className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
                        aria-label="กลับ"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <p className="text-[11px] text-white/85 truncate">{project?.name || 'ไม่มีโครงการ'}</p>
                        <h1 className="text-[15px] font-bold text-white truncate">{task.name}</h1>
                    </div>
                </div>
            </header>

            <main className="p-4 space-y-3 max-w-md mx-auto">
                <div className="bg-white border border-[#d0d4e4] rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${getStatusColor(task.status)}`}>
                            {getStatusLabel(task.status)}
                        </span>
                        <div className="text-[11px] text-[#676879]">{task.category || 'ไม่มีหมวดหมู่'}</div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[12px]">
                            <div className="text-[#676879] flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" /> {task.planEndDate}
                            </div>
                        {overdue ? (
                            <div className="text-[#e2445c] font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> เกินกำหนด
                            </div>
                        ) : dueSoon ? (
                            <div className="text-[#fdab3d] font-semibold flex items-center gap-1">
                                <Clock3 className="w-3.5 h-3.5" /> ใกล้ถึงกำหนด
                            </div>
                        ) : (
                            <div className="text-[#1e4f9a] font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> ตามกำหนด
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-[#d0d7e3] rounded-xl p-3.5 shadow-[0_2px_10px_rgba(16,39,61,0.06)]">
                    <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider mb-2">อัปเดตสถานะ</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => requestStatusChange('not-started')}
                            className={`text-[12px] px-2 py-2 rounded-lg border font-semibold transition-all ${getStatusActionClass('not-started', task.status)}`}
                        >
                            ยังไม่เริ่ม
                        </button>
                        <button
                            onClick={() => requestStatusChange('in-progress')}
                            className={`text-[12px] px-2 py-2 rounded-lg border font-semibold transition-all ${getStatusActionClass('in-progress', task.status)}`}
                        >
                            กำลังดำเนินการ
                        </button>
                        <button
                            onClick={() => requestStatusChange('completed')}
                            className={`text-[12px] px-2 py-2 rounded-lg border font-semibold transition-all ${getStatusActionClass('completed', task.status)}`}
                        >
                            เสร็จสิ้น
                        </button>
                        <button
                            onClick={() => requestStatusChange('delayed')}
                            className={`text-[12px] px-2 py-2 rounded-lg border font-semibold transition-all ${getStatusActionClass('delayed', task.status)}`}
                        >
                            ติดปัญหา
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-[#d0d4e4] rounded-xl p-3.5">
                    <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider">ความคืบหน้า</p>
                        <p className="text-[12px] font-bold text-[#323338]">{task.progress}%</p>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={task.progress}
                        onChange={(event) => handleUpdateTaskProgress(task.id, event.target.value)}
                        className="w-full mt-3 accent-[#1f6feb]"
                    />
                </div>

                <div className="bg-white border border-[#d0d4e4] rounded-xl p-3.5">
                    <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider mb-2">รายละเอียด</p>
                    <p className="text-[13px] text-[#323338] whitespace-pre-wrap">
                        {task.description || 'ไม่มีรายละเอียด'}
                    </p>
                </div>

                <div className="bg-white border border-[#d0d7e3] rounded-xl p-3.5 shadow-[0_2px_10px_rgba(16,39,61,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-[#1f6feb]" /> งานย่อย
                        </p>
                        <p className="text-[11px] font-semibold text-[#323338]">
                            {completedSubtasks}/{taskSubtasks.length}
                        </p>
                    </div>
                    {taskSubtasks.length === 0 ? (
                        <p className="text-[12px] text-[#a0a2b1]">ไม่มีงานย่อย</p>
                    ) : (
                        <div className="space-y-1.5">
                            {taskSubtasks.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleToggleSubtask(item.id)}
                                    className="w-full flex items-center gap-2.5 text-[13px] text-left px-1 py-1 rounded-md hover:bg-[#f5f6f8] transition-colors"
                                >
                                    {item.completed ? (
                                        <CheckSquare className="w-4 h-4 text-[#1f6feb] shrink-0" />
                                    ) : (
                                        <Square className="w-4 h-4 text-[#a0a2b1] shrink-0" />
                                    )}
                                    <span className={item.completed ? 'line-through text-[#a0a2b1]' : 'text-[#323338]'}>
                                        {item.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                        <input
                            type="text"
                            value={newSubtaskName}
                            onChange={(event) => setNewSubtaskName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleAddSubtask();
                                }
                            }}
                            placeholder="เพิ่มงานย่อย"
                            className="flex-1 h-9 rounded-lg border border-[#d0d4e4] px-2.5 text-[13px] text-[#323338] outline-none focus:border-[#0073ea] focus:ring-2 focus:ring-[#0073ea]/20"
                        />
                        <button
                            type="button"
                            onClick={() => void handleAddSubtask()}
                            disabled={isSubmittingSubtask || newSubtaskName.trim() === ''}
                            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1f6feb] hover:bg-[#1a5fcb] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            เพิ่ม
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-[#d0d7e3] rounded-xl p-3.5 shadow-[0_2px_10px_rgba(16,39,61,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#1f6feb]" /> อัปเดตและความคิดเห็น
                        </p>
                        <p className="text-[11px] font-semibold text-[#323338]">{sortedTaskUpdates.length}</p>
                    </div>

                    <textarea
                        value={newUpdateText}
                        onChange={(event) => setNewUpdateText(event.target.value)}
                        placeholder="เขียนอัปเดตหรือความคิดเห็น..."
                        className="w-full min-h-[88px] rounded-lg border border-[#d0d4e4] px-2.5 py-2 text-[13px] text-[#323338] outline-none resize-y focus:border-[#0073ea] focus:ring-2 focus:ring-[#0073ea]/20"
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={() => void handleAddUpdate()}
                            disabled={isSubmittingUpdate || newUpdateText.trim() === ''}
                            className="h-9 px-3 rounded-lg bg-[#1f6feb] hover:bg-[#1a5fcb] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            โพสต์อัปเดต
                        </button>
                    </div>

                    {sortedTaskUpdates.length === 0 ? (
                        <p className="mt-3 text-[12px] text-[#a0a2b1]">ยังไม่มีอัปเดต</p>
                    ) : (
                        <div className="mt-3 space-y-2.5">
                            {sortedTaskUpdates.map((update) => (
                                <div key={update.id} className="rounded-lg border border-[#dbe4ef] bg-[#f7faff] px-2.5 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[12px] font-semibold text-[#323338] truncate">{update.author || currentUserName}</p>
                                        <p className="text-[11px] text-[#8f93a4] whitespace-nowrap">
                                            {new Date(update.date).toLocaleString()}
                                        </p>
                                    </div>
                                    <p className="mt-1 text-[13px] text-[#323338] whitespace-pre-wrap break-words">{update.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white border border-[#d0d7e3] rounded-xl p-3.5 shadow-[0_2px_10px_rgba(16,39,61,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-semibold text-[#676879] uppercase tracking-wider flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-[#4a6786]" /> ไฟล์แนบ
                        </p>
                        <p className="text-[11px] font-semibold text-[#323338]">{taskAttachments.length}</p>
                    </div>
                    {taskAttachments.length === 0 ? (
                        <p className="text-[12px] text-[#a0a2b1]">ไม่มีไฟล์แนบ</p>
                    ) : (
                        <div className="space-y-2">
                            {taskAttachments.map((item) => (
                                <div key={item.id} className="flex items-center gap-2.5 bg-[#f4f8fd] rounded-lg border border-[#dbe4ef] px-2.5 py-2">
                                    {getFileIcon(item.type)}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] text-[#323338] truncate">{item.name}</p>
                                        <p className="text-[11px] text-[#a0a2b1]">
                                            {formatBytes(item.size)} | {new Date(item.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    {item.url || item.data ? (
                                        <a
                                            href={item.url || item.data}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={item.name}
                                            className="p-1.5 rounded-md hover:bg-white text-[#676879]"
                                            title="ดาวน์โหลดไฟล์แนบ"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    ) : (
                                        <span className="p-1.5 text-[#a0a2b1]" title="ไฟล์ไม่พร้อมใช้งาน">
                                            <Download className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {pendingStatusChange && (
                <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4">
                    <div className="w-full max-w-sm rounded-xl border border-[#d0d7e3] bg-white shadow-[0_18px_42px_rgba(15,33,53,0.25)]">
                        <div className="px-4 py-3 border-b border-[#e4ebf4]">
                            <h3 className="text-[15px] font-bold text-[#1f3147]">ยืนยันการเปลี่ยนสถานะ</h3>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                            <p className="text-[13px] text-[#42586f] leading-relaxed">
                                เปลี่ยนสถานะสำหรับ <span className="font-semibold text-[#1f3147]">{task.name}</span> ใช่หรือไม่?
                            </p>
                            <div className="text-[12px] text-[#5f7084]">
                                สถานะใหม่:{' '}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border border-[#d2ddea] ${getStatusColor(pendingStatusChange)}`}>
                                    {getStatusLabel(pendingStatusChange)}
                                </span>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-[#e4ebf4] flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancelStatusChange}
                                disabled={isSubmittingStatusChange}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#f1f5fa] border border-[#d3ddeb] text-[#24425f] hover:bg-[#e6edf6] disabled:opacity-60"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmStatusChange()}
                                disabled={isSubmittingStatusChange}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[#1f6feb] hover:bg-[#1a5fcb] disabled:opacity-60"
                            >
                                {isSubmittingStatusChange ? 'กำลังอัปเดต...' : 'ยืนยัน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

