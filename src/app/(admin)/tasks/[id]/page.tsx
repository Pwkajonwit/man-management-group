'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, addDays, isPast } from 'date-fns';
import {
    ArrowLeft, CheckSquare, Square, Plus, Trash2, Paperclip, FileText,
    Image as ImageIcon, File, Clock,
    MessageSquare, Download, AlertTriangle, Users
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Task } from '@/types/construction';
import { getPriorityLabel, getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import {
    DEFAULT_BRANCH_ID,
    DEFAULT_DEPARTMENT_ID,
    isLegacyDefaultBranchId,
    isLegacyDefaultDepartmentId,
} from '@/lib/scope';

const getPriorityColor = (p?: string) => {
    switch (p) {
        case 'urgent': return 'bg-[#e2445c] text-white';
        case 'high': return 'bg-[#fdab3d] text-white';
        case 'medium': return 'bg-[#579bfc] text-white';
        case 'low': return 'bg-[#c4c4c4] text-white';
        default: return 'bg-[#e6e9ef] text-[#676879]';
    }
};
const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#579bfc]" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-[#e2445c]" />;
    return <File className="w-5 h-5 text-[#676879]" />;
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const activityLabel = (action: string) => {
    switch (action) {
        case 'status_changed': return 'changed status';
        case 'owner_changed': return 'changed owner';
        case 'priority_changed': return 'changed priority';
        case 'timeline_changed': return 'changed timeline';
        case 'scope_changed': return 'changed scope';
        case 'subtask_added': return 'added subtask';
        case 'file_attached': return 'attached file';
        case 'file_removed': return 'removed file';
        default: return action;
    }
};

export default function TaskDetailPage() {
    const params = useParams();
    const router = useRouter();
    const taskId = params.id as string;

    const {
        tasks, teamMembers, projects,
        subtasks, addSubTask, toggleSubTask, deleteSubTask,
        attachments, addAttachment, deleteAttachment,
        activityLog,
        taskUpdates, addTaskUpdate,
        subscribeTaskDetails,
        handleUpdateTaskStatus, handleUpdateTaskPriority,
        handleUpdateTaskOwners, handleUpdateTaskDescription,
        handleUpdateTaskProgress, handleUpdateTaskTimeline,
        taskScopeBranchOptions, taskScopeDepartmentOptions,
    } = useAppContext();

    const task = tasks.find(t => t.id === taskId);
    const project = task ? projects.find(p => p.id === task.projectId) : null;
    const taskSubtasks = subtasks[taskId] || [];
    const taskAttachments = attachments[taskId] || [];
    const taskActivity = activityLog[taskId] || [];
    const taskComments = taskUpdates[taskId] || [];

    // Subscribe to subtasks/attachments/activityLog for THIS task only
    useEffect(() => {
        if (!taskId) return;
        const unsubscribe = subscribeTaskDetails(taskId);
        return () => unsubscribe();
    }, [taskId, subscribeTaskDetails]);

    const [newSubtaskName, setNewSubtaskName] = useState('');
    const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'updates'>('details');
    const [editingDescription, setEditingDescription] = useState(false);
    const [descDraft, setDescDraft] = useState('');
    const [updateText, setUpdateText] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!task) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#f5f6f8]">
                <div className="text-center">
                    <div className="text-5xl mb-4">?</div>
                    <h2 className="text-xl font-bold text-[#323338] mb-2">ไม่พบงาน</h2>
                    <button onClick={() => router.push('/workspaces')} className="px-4 py-2 bg-[#0073ea] text-white rounded-lg text-sm font-medium hover:bg-[#0060c0] transition-colors">
                        กลับไปยังหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    const completedSubtasks = taskSubtasks.filter(st => st.completed).length;
    const subtaskProgress = taskSubtasks.length > 0 ? Math.round((completedSubtasks / taskSubtasks.length) * 100) : 0;
    const ownerNames = Array.from(new Set([
        ...((task.assignedEmployeeIds || []).map(ownerId => teamMembers.find(m => m.id === ownerId)?.name).filter((name): name is string => Boolean(name))),
        ...(task.responsible ? [task.responsible] : []),
    ]));
    const taskOverdue = (() => {
        if (task.status === 'completed' || !task.planEndDate) return false;
        const endDate = new Date(task.planEndDate);
        endDate.setHours(23, 59, 59, 999);
        return isPast(endDate);
    })();
    const taskDueSoon = (() => {
        if (task.status === 'completed' || !task.planEndDate) return false;
        const endDate = new Date(task.planEndDate);
        endDate.setHours(23, 59, 59, 999);
        return !isPast(endDate) && endDate <= addDays(new Date(), 2);
    })();
    const branchLabelById = new Map(taskScopeBranchOptions.map((option) => [option.id, option.label]));
    const departmentLabelById = new Map(taskScopeDepartmentOptions.map((option) => [option.id, option.label]));
    const currentBranchId = (() => {
        const sourceBranchId = task.branchId || project?.branchId || DEFAULT_BRANCH_ID;
        if (!isLegacyDefaultBranchId(sourceBranchId)) return sourceBranchId;
        return taskScopeBranchOptions[0]?.id || sourceBranchId;
    })();
    const currentDepartmentId = (() => {
        const sourceDepartmentId = task.departmentId || project?.departmentId || DEFAULT_DEPARTMENT_ID;
        if (!isLegacyDefaultDepartmentId(sourceDepartmentId)) return sourceDepartmentId;
        return taskScopeDepartmentOptions.find((option) => !option.branchId || option.branchId === currentBranchId)?.id
            || taskScopeDepartmentOptions[0]?.id
            || sourceDepartmentId;
    })();
    const handleAddSubTask = () => {
        if (newSubtaskName.trim()) {
            addSubTask(taskId, newSubtaskName);
            setNewSubtaskName('');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        try {
            for (let i = 0; i < files.length; i++) {
                await addAttachment(taskId, files[i]);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'File upload failed.';
            alert(message);
        }
        e.target.value = '';
    };

    const handleAddComment = async () => {
        if (!updateText.trim()) return;
        await addTaskUpdate(taskId, updateText);
        setUpdateText('');
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8] overflow-hidden">
            {/* Header */}
            <header className="min-h-[64px] bg-white flex flex-wrap items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-3 shrink-0">
                <button
                    onClick={() => router.push('/workspaces')}
                    className="p-2 hover:bg-[#f5f6f8] rounded-lg text-[#676879] transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#676879] mb-0.5">{project?.name} / {task.category}</div>
                    <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#323338] truncate">{task.name}</h1>
                </div>
                <div className={`px-3 py-1 rounded text-[12px] font-medium ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                </div>
                <div className={`px-3 py-1 rounded text-[12px] font-medium ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                </div>
            </header>

            {/* Tabs */}
            <div className="px-4 sm:px-6 lg:px-8 bg-white border-b border-[#d0d4e4] flex items-center gap-4 sm:gap-6 text-[14px] shrink-0 overflow-x-auto">
                {(['details', 'activity', 'updates'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-3 border-b-[3px] font-medium transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-[#676879] hover:text-[#323338]'
                            }`}
                    >
                        {tab === 'details' ? 'รายละเอียด' : tab === 'activity' ? 'บันทึกกิจกรรม' : `อัปเดต (${taskComments.length})`}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6">

                    {activeTab === 'details' && (
                        <>
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">สรุปอย่างย่อ</div>
                                        <div className="mt-1 text-[14px] font-semibold text-[#323338]">{task.name}</div>
                                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            {ownerNames.length > 0 ? ownerNames.map((name) => (
                                                <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#eef4ff] text-[#0052cc] text-[11px] font-semibold">
                                                    <Users className="w-3 h-3" /> {name}
                                                </span>
                                            )) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#f0f1f4] text-[#676879] text-[11px] font-semibold">ยังไม่ระบุ</span>
                                            )}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center rounded-full border border-[#d8e3f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#33495f]">
                                                สาขา: {branchLabelById.get(currentBranchId) || currentBranchId}
                                            </span>
                                            <span className="inline-flex items-center rounded-full border border-[#d8e3f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#33495f]">
                                                แผนก: {departmentLabelById.get(currentDepartmentId) || currentDepartmentId}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="min-w-[180px] rounded-xl border border-[#e6e9ef] bg-[#f8fafc] px-3 py-2 text-right">
                                        <div className={`text-[12px] font-bold ${taskOverdue ? 'text-[#e2445c]' : taskDueSoon ? 'text-[#fdab3d]' : 'text-[#00a66a]'}`}>
                                            {taskOverdue ? 'เกินกำหนด' : taskDueSoon ? 'ใกล้กำหนด' : 'ตามแผน'}
                                        </div>
                                        <div className="text-[12px] text-[#676879] mt-1">ครบกำหนด: {task.planEndDate}</div>
                                        <div className="text-[12px] text-[#676879] mt-0.5">ระยะเวลา: {task.planDuration} วัน</div>
                                    </div>
                                </div>
                                {taskOverdue && (
                                    <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#e2445c] bg-[#fff1f3] border border-[#ffd5db] rounded-full px-2.5 py-1">
                                        <AlertTriangle className="w-3.5 h-3.5" /> งานนี้เกินกำหนดเวลาแล้ว
                                    </div>
                                )}
                            </div>

                            {/* Quick Info Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                {/* Owner */}
                                <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                    <div className="text-[11px] text-[#676879] uppercase font-bold tracking-wider mb-2">ผู้รับผิดชอบ</div>
                                    <div className="space-y-1 max-h-[140px] overflow-y-auto rounded-lg border border-[#d0d4e4] bg-[#f5f6f8] p-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateTaskOwners(taskId, [])}
                                            className="w-full text-left text-[12px] px-2 py-1 rounded hover:bg-white text-[#676879] italic"
                                        >
                                            ยังไม่ระบุ
                                        </button>
                                        {[
                                            {
                                                label: 'สมาชิกทีม',
                                                members: teamMembers.filter((member) => member.memberType !== 'crew'),
                                            },
                                            {
                                                label: 'ทีมช่าง',
                                                members: teamMembers.filter((member) => member.memberType === 'crew'),
                                            },
                                        ].filter((group) => group.members.length > 0).map((group) => (
                                            <div key={group.label} className="pt-1 first:pt-0">
                                                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#a0a2b1]">
                                                    {group.label}
                                                </div>
                                                {group.members.map((member) => {
                                                    const selected = ownerNames.includes(member.name);
                                                    return (
                                                        <label
                                                            key={member.id}
                                                            className={`flex items-center gap-2 text-[12px] px-2 py-1 rounded cursor-pointer ${selected ? 'bg-[#cce5ff] text-[#0052cc]' : 'hover:bg-white text-[#323338]'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={() => {
                                                                    const nextOwners = selected
                                                                        ? ownerNames.filter(owner => owner !== member.name)
                                                                        : [...ownerNames, member.name];
                                                                    handleUpdateTaskOwners(taskId, nextOwners);
                                                                }}
                                                                className="accent-[#0073ea]"
                                                            />
                                                            <span className="truncate">{member.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-1 text-[11px] text-[#676879]">เลือก {ownerNames.length} รายการ</div>
                                </div>

                                {/* Status */}
                                <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                    <div className="text-[11px] text-[#676879] uppercase font-bold tracking-wider mb-2">สถานะ</div>
                                    <select
                                        value={task.status}
                                        onChange={e => handleUpdateTaskStatus(taskId, e.target.value as Task['status'])}
                                        className="w-full bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-1.5 text-[13px] outline-none cursor-pointer"
                                    >
                                        <option value="not-started">{getStatusLabel('not-started')}</option>
                                        <option value="in-progress">{getStatusLabel('in-progress')}</option>
                                        <option value="completed">{getStatusLabel('completed')}</option>
                                        <option value="delayed">{getStatusLabel('delayed')}</option>
                                    </select>
                                </div>

                                {/* Priority */}
                                <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                    <div className="text-[11px] text-[#676879] uppercase font-bold tracking-wider mb-2">ความสำคัญ</div>
                                    <select
                                        value={task.priority || ''}
                                        onChange={e => handleUpdateTaskPriority(taskId, e.target.value as Task['priority'] | '')}
                                        className="w-full bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-1.5 text-[13px] outline-none cursor-pointer"
                                    >
                                        <option value="">{getPriorityLabel('')}</option>
                                        <option value="urgent">{getPriorityLabel('urgent')}</option>
                                        <option value="high">{getPriorityLabel('high')}</option>
                                        <option value="medium">{getPriorityLabel('medium')}</option>
                                        <option value="low">{getPriorityLabel('low')}</option>
                                    </select>
                                </div>

                                {/* Progress */}
                                <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                    <div className="text-[11px] text-[#676879] uppercase font-bold tracking-wider mb-2">ความคืบหน้า</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number" min="0" max="100"
                                            value={task.progress}
                                            onChange={e => handleUpdateTaskProgress(taskId, e.target.value)}
                                            className="w-16 bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-1.5 text-[13px] text-center outline-none"
                                        />
                                        <span className="text-[13px] text-[#676879]">%</span>
                                    </div>
                                    <div className="w-full bg-[#e6e9ef] h-2 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-[#00c875] h-full rounded-full transition-all" style={{ width: `${task.progress}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                                <div className="text-[13px] font-bold text-[#323338] mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#676879]" /> กำหนดเวลา
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-[11px] text-[#676879] uppercase font-bold">วันที่เริ่ม</label>
                                        <input type="date" value={task.planStartDate}
                                            onChange={e => handleUpdateTaskTimeline(taskId, 'planStartDate', e.target.value)}
                                            className="block w-full mt-1 bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-[#676879] sm:mt-5">-&gt;</span>
                                    <div>
                                        <label className="text-[11px] text-[#676879] uppercase font-bold">วันที่สิ้นสุด</label>
                                        <input type="date" value={task.planEndDate}
                                            onChange={e => handleUpdateTaskTimeline(taskId, 'planEndDate', e.target.value)}
                                            className="block w-full mt-1 bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none cursor-pointer"
                                        />
                                    </div>
                                    <div className="bg-[#f5f6f8] rounded-lg px-4 py-2 sm:mt-5 text-[13px] text-[#676879]">
                                        {task.planDuration} วัน
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                                <div className="text-[13px] font-bold text-[#323338] mb-3">คำอธิบาย</div>
                                {editingDescription ? (
                                    <div>
                                        <textarea
                                            value={descDraft}
                                            onChange={e => setDescDraft(e.target.value)}
                                            className="w-full bg-[#f5f6f8] border border-[#0073ea] rounded-lg p-3 text-[14px] outline-none resize-none h-[120px]"
                                            placeholder="เพิ่มคำอธิบาย..."
                                            autoFocus
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => { handleUpdateTaskDescription(taskId, descDraft); setEditingDescription(false); }}
                                                className="px-4 py-1.5 bg-[#0073ea] text-white rounded-lg text-[13px] font-medium hover:bg-[#0060c0]">Save</button>
                                            <button onClick={() => setEditingDescription(false)}
                                                className="px-4 py-1.5 bg-[#e6e9ef] text-[#323338] rounded-lg text-[13px] font-medium hover:bg-[#d0d4e4]">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => { setDescDraft(task.description || ''); setEditingDescription(true); }}
                                        className="text-[14px] text-[#323338] leading-relaxed min-h-[60px] cursor-pointer hover:bg-[#f5f6f8] rounded-lg p-3 -m-3 transition-colors"
                                    >
                                        {task.description || <span className="text-[#a0a2b1] italic">คลิกเพื่อเพิ่มคำอธิบาย...</span>}
                                    </div>
                                )}
                            </div>

                            {/* Sub-Tasks */}
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                                <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                                    <div className="text-[13px] font-bold text-[#323338] flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4 text-[#00c875]" />
                                        Sub-Tasks
                                        {taskSubtasks.length > 0 && (
                                            <span className="text-[12px] font-normal text-[#676879]">
                                                ({completedSubtasks}/{taskSubtasks.length})
                                            </span>
                                        )}
                                    </div>
                                    {taskSubtasks.length > 0 && (
                                        <span className="text-[12px] font-bold text-[#0073ea]">{subtaskProgress}%</span>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {taskSubtasks.length > 0 && (
                                    <div className="w-full bg-[#e6e9ef] h-2 rounded-full mb-4 overflow-hidden">
                                        <div className="bg-[#00c875] h-full rounded-full transition-all duration-300" style={{ width: `${subtaskProgress}%` }}></div>
                                    </div>
                                )}

                                {/* List */}
                                <div className="space-y-1">
                                    {taskSubtasks.map(st => (
                                        <div key={st.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#f5f6f8] group transition-colors">
                                            <button onClick={() => toggleSubTask(taskId, st.id)} className="shrink-0">
                                                {st.completed ? (
                                                    <CheckSquare className="w-5 h-5 text-[#00c875]" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-[#d0d4e4] hover:text-[#0073ea] transition-colors" />
                                                )}
                                            </button>
                                            <span className={`flex-1 text-[14px] ${st.completed ? 'line-through text-[#a0a2b1]' : 'text-[#323338]'}`}>
                                                {st.name}
                                            </span>
                                            <button
                                                onClick={() => deleteSubTask(taskId, st.id)}
                                                className="text-[#e2445c] p-1 hover:bg-[#ffebef] rounded transition-all sm:opacity-0 sm:group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add new subtask */}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e6e9ef]">
                                    <Plus className="w-4 h-4 text-[#676879] shrink-0" />
                                    <input
                                        type="text"
                                        value={newSubtaskName}
                                        onChange={e => setNewSubtaskName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSubTask()}
                                        placeholder="เพิ่มงานย่อย..."
                                        className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a0a2b1]"
                                    />
                                    <button onClick={handleAddSubTask} disabled={!newSubtaskName.trim()}
                                        className="px-3 py-1 bg-[#0073ea] text-white rounded text-[12px] font-medium hover:bg-[#0060c0] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed transition-colors">
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* File Attachments */}
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                                <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                                    <div className="text-[13px] font-bold text-[#323338] flex items-center gap-2">
                                        <Paperclip className="w-4 h-4 text-[#676879]" />
                                        Attachments
                                        {taskAttachments.length > 0 && (
                                            <span className="text-[12px] font-normal text-[#676879]">({taskAttachments.length})</span>
                                        )}
                                    </div>
                                    <div>
                                        <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                        <button onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f6f8] hover:bg-[#d0d4e4] border border-[#d0d4e4] rounded-lg text-[12px] font-medium text-[#323338] transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> อัปโหลด
                                        </button>
                                    </div>
                                </div>

                                {taskAttachments.length === 0 ? (
                                    <div className="text-center py-8 text-[#a0a2b1]">
                                        <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <div className="text-[13px]">ยังไม่มีไฟล์แนบ</div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {taskAttachments.map(att => (
                                            <div key={att.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-2 px-3 rounded-lg bg-[#f5f6f8] hover:bg-[#e6e9ef] group transition-colors">
                                                {getFileIcon(att.type)}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[13px] font-medium text-[#323338] truncate">{att.name}</div>
                                                    <div className="text-[11px] text-[#a0a2b1]">{formatBytes(att.size)} | {att.uploadedBy} | {format(new Date(att.createdAt), 'MMM d, h:mm a')}</div>
                                                </div>
                                                {att.url || att.data ? (
                                                    <a href={att.url || att.data} download={att.name} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white rounded transition-colors text-[#676879]">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="p-1.5 text-[#a0a2b1]" title="No file URL">
                                                        <Download className="w-4 h-4" />
                                                    </span>
                                                )}
                                                <button onClick={() => deleteAttachment(taskId, att.id)}
                                                    className="p-1.5 text-[#e2445c] hover:bg-[#ffebef] rounded transition-all sm:opacity-0 sm:group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'activity' && (
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                            <div className="text-[13px] font-bold text-[#323338] mb-4 flex items-center gap-2">
                                บันทึกกิจกรรม
                            </div>
                            {taskActivity.length === 0 ? (
                                <div className="text-center py-10 text-[#a0a2b1]">
                                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <div className="text-[14px] font-medium text-[#323338]">ยังไม่มีกิจกรรม</div>
                                    <div className="text-[13px]">การเปลี่ยนแปลงในงานนี้จะแสดงที่นี่</div>
                                </div>
                            ) : (
                                <div className="relative pl-6">
                                    {/* Timeline line */}
                                    <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-[#e6e9ef]"></div>
                                    <div className="space-y-4">
                                        {[...taskActivity].reverse().map(entry => (
                                            <div key={entry.id} className="relative flex items-start gap-4">
                                                {/* Dot */}
                                                <div className="absolute left-[-18px] top-1.5 w-3 h-3 rounded-full bg-[#0073ea] border-2 border-white shadow-sm z-10"></div>
                                                <div className="flex-1 bg-[#f5f6f8] rounded-lg p-3">
                                                    <div className="flex items-center gap-2 text-[13px]">
                                                        <span className="font-medium text-[#323338]">{entry.user}</span>
                                                        <span className="text-[#676879]">{activityLabel(entry.action)}</span>
                                                    </div>
                                                    {entry.oldValue && entry.newValue && (
                                                        <div className="flex items-center gap-2 mt-1.5 text-[12px]">
                                                            <span className="bg-[#ffebef] text-[#e2445c] px-2 py-0.5 rounded font-medium">{entry.oldValue}</span>
                                                            <span className="text-[#676879]">-&gt;</span>
                                                            <span className="bg-[#e6faef] text-[#00c875] px-2 py-0.5 rounded font-medium">{entry.newValue}</span>
                                                        </div>
                                                    )}
                                                    {!entry.oldValue && entry.newValue && (
                                                        <div className="mt-1.5 text-[12px] text-[#676879]">&quot;{entry.newValue}&quot;</div>
                                                    )}
                                                    <div className="text-[11px] text-[#a0a2b1] mt-1.5">
                                                        {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'updates' && (
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-5">
                            <div className="text-[13px] font-bold text-[#323338] mb-4">อัปเดตและความคิดเห็น</div>
                            {/* Input */}
                            <div className="border border-[#0073ea] rounded-lg overflow-hidden mb-6">
                                <textarea
                                    value={updateText}
                                    onChange={e => setUpdateText(e.target.value)}
                                    placeholder="เขียนอัปเดต..."
                                    className="w-full p-4 outline-none resize-none h-[80px] text-[14px] placeholder:text-[#a0a2b1]"
                                />
                                <div className="px-4 py-2 bg-[#f5f6f8] border-t border-[#d0d4e4] flex justify-end">
                                    <button onClick={handleAddComment} disabled={!updateText.trim()}
                                        className="bg-[#0073ea] text-white px-4 py-1.5 rounded text-[13px] font-medium hover:bg-[#0060c0] disabled:bg-[#d0d4e4] transition-colors">
                                        Update
                                    </button>
                                </div>
                            </div>
                            {/* Comments list */}
                            <div className="space-y-4">
                                {taskComments.length === 0 ? (
                                    <div className="text-center py-8 text-[#a0a2b1]">
                                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <div className="text-[14px] font-medium text-[#323338]">ยังไม่มีอัปเดต</div>
                                        <div className="text-[13px]">เป็นคนแรกที่เขียนอัปเดต!</div>
                                    </div>
                                ) : (
                                    [...taskComments].reverse().map(upd => (
                                        <div key={upd.id} className="bg-[#f5f6f8] rounded-xl p-4 border border-[#e6e9ef]">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-[#00c875] text-white flex items-center justify-center font-bold text-[13px]">
                                                    {upd.author.substring(0, 1)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[13px] text-[#323338]">{upd.author}</div>
                                                    <div className="text-[11px] text-[#676879]">{format(new Date(upd.date), 'MMM d, h:mm a')}</div>
                                                </div>
                                            </div>
                                            <div className="text-[14px] text-[#323338] whitespace-pre-wrap leading-relaxed">{upd.text}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


