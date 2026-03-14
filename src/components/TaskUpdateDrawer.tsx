import React from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { Task } from '@/types/construction';

interface TaskUpdateDrawerProps {
    selectedTask: Task | null;
    onClose: () => void;
    taskUpdateText: string;
    setTaskUpdateText: (val: string) => void;
    handleAddUpdate: () => void | Promise<void>;
    taskUpdates: Record<string, { id: string, text: string, author: string, date: string }[]>;
}

export default function TaskUpdateDrawer({
    selectedTask,
    onClose,
    taskUpdateText,
    setTaskUpdateText,
    handleAddUpdate,
    taskUpdates
}: TaskUpdateDrawerProps) {
    if (!selectedTask) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                onClick={onClose}
            ></div>
            {/* Drawer */}
            <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] bg-white z-50 shadow-2xl flex flex-col transition-transform transform translate-x-0 border-l border-[#d0d4e4]">
                {/* Header */}
                <div className="h-[64px] sm:h-[70px] px-4 sm:px-6 border-b border-[#d0d4e4] flex items-center justify-between bg-white shrink-0">
                    <h2 className="text-xl font-bold text-[#323338] truncate pr-4">{selectedTask.name}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[#f5f6f8] rounded-md text-[#676879] transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                {/* Tabs (Updates) */}
                <div className="px-4 sm:px-6 pt-3 border-b border-[#d0d4e4] flex items-center gap-6 shrink-0 bg-white">
                    <div className="pb-3 border-b-[3px] border-[#0073ea] text-[#0073ea] font-medium text-[15px]">
                        Updates
                    </div>
                </div>
                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f5f6f8] flex flex-col">
                    {/* Input Box */}
                    <div className="bg-white rounded-lg border border-[#0073ea] shadow-sm mb-6 overflow-hidden">
                        <textarea
                            placeholder="Write an update..."
                            value={taskUpdateText}
                            onChange={(e) => setTaskUpdateText(e.target.value)}
                            className="w-full p-4 outline-none resize-none h-[100px] text-[15px] text-[#323338] placeholder:text-[#a0a2b1]"
                        ></textarea>
                        <div className="px-4 py-3 bg-[#f5f6f8] border-t border-[#d0d4e4] flex justify-end">
                            <button
                                onClick={handleAddUpdate}
                                disabled={taskUpdateText.trim() === ""}
                                className="bg-[#0073ea] text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-[#0060c0] transition-colors disabled:bg-[#cce5ff] disabled:text-[#676879]/50"
                            >
                                Update
                            </button>
                        </div>
                    </div>

                    {/* List of Updates */}
                    <div className="flex-1 space-y-4">
                        {(taskUpdates[selectedTask.id] || []).length > 0 ? (
                            taskUpdates[selectedTask.id].map(update => (
                                <div key={update.id} className="bg-white rounded-xl border border-[#d0d4e4] p-5 shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-[#00c875] text-white flex items-center justify-center font-bold text-[15px]">
                                            {update.author.substring(0, 1)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#323338] text-[15px]">{update.author}</div>
                                            <div className="flex items-center gap-2 text-[#676879] text-[13px] mt-0.5">
                                                <span className="flex items-center gap-1">⌚ {format(new Date(update.date), 'MMM d, h:mm a')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[#323338] text-[15px] whitespace-pre-wrap leading-relaxed">
                                        {update.text}
                                    </div>
                                </div>
                            ))
                        ).reverse() : (
                            <div className="text-center text-[#676879] py-10">
                                <div className="text-4xl mb-4 opacity-50">☕</div>
                                <div className="text-[15px] font-medium text-[#323338] mb-1">No updates yet</div>
                                <div className="text-[13px]">Be the first to write an update!</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
