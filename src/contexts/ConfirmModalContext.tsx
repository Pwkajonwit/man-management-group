'use client';

import React, { createContext, useCallback, useContext, useState, useRef } from 'react';
import ConfirmModal, { ConfirmModalVariant } from '@/components/ConfirmModal';

interface ModalOptions {
    title?: string;
    message: string;
    description?: string;
    variant?: ConfirmModalVariant;
    confirmLabel?: string;
    cancelLabel?: string;
}

interface ConfirmModalContextValue {
    /** Show a confirm modal and return a promise that resolves to true (confirmed) or false (cancelled). */
    confirm: (options: ModalOptions) => Promise<boolean>;
    /** Show an alert/info modal (single dismiss button). Returns a promise that resolves when dismissed. */
    alert: (message: string, options?: Omit<ModalOptions, 'message'>) => Promise<void>;
    /** Show a success modal. Returns a promise that resolves when dismissed. */
    success: (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => Promise<void>;
    /** Show an error modal. Returns a promise that resolves when dismissed. */
    error: (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => Promise<void>;
    /** Show a warning modal. Returns a promise that resolves when dismissed. */
    warning: (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => Promise<void>;
}

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null);

export function useConfirmModal(): ConfirmModalContextValue {
    const ctx = useContext(ConfirmModalContext);
    if (!ctx) {
        throw new Error('useConfirmModal must be used within a ConfirmModalProvider');
    }
    return ctx;
}

interface ModalState extends ModalOptions {
    open: boolean;
    loading: boolean;
}

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ModalState>({
        open: false,
        message: '',
        loading: false,
    });

    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const openModal = useCallback((options: ModalOptions): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({
                open: true,
                loading: false,
                ...options,
            });
        });
    }, []);

    const handleConfirm = useCallback(() => {
        resolveRef.current?.(true);
        resolveRef.current = null;
        setState((prev) => ({ ...prev, open: false }));
    }, []);

    const handleCancel = useCallback(() => {
        resolveRef.current?.(false);
        resolveRef.current = null;
        setState((prev) => ({ ...prev, open: false }));
    }, []);

    const confirm = useCallback(
        (options: ModalOptions) => openModal({ variant: 'confirm', ...options }),
        [openModal]
    );

    const alertFn = useCallback(
        async (message: string, options?: Omit<ModalOptions, 'message'>) => {
            await openModal({ variant: 'alert', message, ...options });
        },
        [openModal]
    );

    const success = useCallback(
        async (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => {
            await openModal({ variant: 'success', message, ...options });
        },
        [openModal]
    );

    const error = useCallback(
        async (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => {
            await openModal({ variant: 'error', message, ...options });
        },
        [openModal]
    );

    const warning = useCallback(
        async (message: string, options?: Omit<ModalOptions, 'message' | 'variant'>) => {
            await openModal({ variant: 'warning', message, ...options });
        },
        [openModal]
    );

    const contextValue: ConfirmModalContextValue = {
        confirm,
        alert: alertFn,
        success,
        error,
        warning,
    };

    return (
        <ConfirmModalContext.Provider value={contextValue}>
            {children}
            <ConfirmModal
                open={state.open}
                title={state.title}
                message={state.message}
                description={state.description}
                variant={state.variant}
                confirmLabel={state.confirmLabel}
                cancelLabel={state.cancelLabel}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                loading={state.loading}
            />
        </ConfirmModalContext.Provider>
    );
}
