'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ConfirmModalVariant = 'confirm' | 'alert' | 'success' | 'error' | 'warning';

export interface ConfirmModalProps {
    open: boolean;
    title?: string;
    message: string;
    /** Additional description below the message */
    description?: string;
    variant?: ConfirmModalVariant;
    confirmLabel?: string;
    cancelLabel?: string;
    /** For 'alert' / 'success' / 'error' variants, only show a single dismiss button */
    onConfirm?: () => void;
    onCancel: () => void;
    /** If true, show a loading spinner on the confirm button */
    loading?: boolean;
}

const variantConfig: Record<ConfirmModalVariant, {
    icon: React.ReactNode;
    iconBg: string;
    confirmColor: string;
    confirmHover: string;
    defaultTitle: string;
}> = {
    confirm: {
        icon: <AlertTriangle className="w-6 h-6 text-[#B45309]" />,
        iconBg: 'bg-[#FFF7ED]',
        confirmColor: 'bg-[#e2445c]',
        confirmHover: 'hover:bg-[#c9344b]',
        defaultTitle: 'ยืนยันการดำเนินการ',
    },
    alert: {
        icon: <Info className="w-6 h-6 text-[#0073ea]" />,
        iconBg: 'bg-[#EEF3F8]',
        confirmColor: 'bg-[#0073ea]',
        confirmHover: 'hover:bg-[#0060c0]',
        defaultTitle: 'แจ้งเตือน',
    },
    success: {
        icon: <CheckCircle2 className="w-6 h-6 text-[#00c875]" />,
        iconBg: 'bg-[#e6faef]',
        confirmColor: 'bg-[#00c875]',
        confirmHover: 'hover:bg-[#00a66a]',
        defaultTitle: 'สำเร็จ',
    },
    error: {
        icon: <XCircle className="w-6 h-6 text-[#e2445c]" />,
        iconBg: 'bg-[#ffebef]',
        confirmColor: 'bg-[#e2445c]',
        confirmHover: 'hover:bg-[#c9344b]',
        defaultTitle: 'เกิดข้อผิดพลาด',
    },
    warning: {
        icon: <AlertTriangle className="w-6 h-6 text-[#fdab3d]" />,
        iconBg: 'bg-[#FFF7ED]',
        confirmColor: 'bg-[#fdab3d]',
        confirmHover: 'hover:bg-[#e09a30]',
        defaultTitle: 'คำเตือน',
    },
};

export default function ConfirmModal({
    open,
    title,
    message,
    description,
    variant = 'confirm',
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const config = variantConfig[variant];
    const isAlertMode = variant === 'alert' || variant === 'success' || variant === 'error';

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onCancel]);

    useEffect(() => {
        if (open) {
            dialogRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;

    const resolvedTitle = title || config.defaultTitle;
    const resolvedConfirmLabel = confirmLabel || (isAlertMode ? 'ตกลง' : 'ยืนยัน');
    const resolvedCancelLabel = cancelLabel || 'ยกเลิก';

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]" />

            {/* Modal */}
            <div
                ref={dialogRef}
                tabIndex={-1}
                className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-[#d0d4e4] animate-[modalSlideUp_200ms_ease-out] outline-none"
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onCancel}
                    className="absolute top-3 right-3 p-1.5 text-[#676879] hover:text-[#323338] hover:bg-[#f5f6f8] rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Body */}
                <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                        {config.icon}
                    </div>
                    <h3 className="text-[17px] font-bold text-[#323338] mb-2">{resolvedTitle}</h3>
                    <p className="text-[14px] text-[#323338] leading-relaxed whitespace-pre-wrap">{message}</p>
                    {description && (
                        <p className="text-[13px] text-[#676879] mt-2 leading-relaxed">{description}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex items-center justify-center gap-3">
                    {!isAlertMode && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 max-w-[160px] px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef] border border-[#d0d4e4] transition-colors disabled:opacity-60"
                        >
                            {resolvedCancelLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (isAlertMode) {
                                onCancel();
                            } else {
                                onConfirm?.();
                            }
                        }}
                        disabled={loading}
                        className={`flex-1 max-w-[160px] px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white ${config.confirmColor} ${config.confirmHover} transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2`}
                    >
                        {loading && (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {resolvedConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
