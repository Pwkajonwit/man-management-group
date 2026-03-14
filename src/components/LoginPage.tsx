'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LoginPageProps {
    allowLineAuth?: boolean;
    lineOnly?: boolean;
    autoLineLogin?: boolean;
}

export default function LoginPage({
    allowLineAuth = false,
    lineOnly = false,
    autoLineLogin = false,
}: LoginPageProps) {
    const {
        loginLine,
        pendingLineProfile,
        requiresLinePhoneBinding,
        bindLinePhone,
        loginWithPassword,
        registerWithPassword,
    } = useAuth();

    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [credentialUser, setCredentialUser] = useState('');
    const [credentialPassword, setCredentialPassword] = useState('');
    const [credentialDisplayName, setCredentialDisplayName] = useState('');
    const [authError, setAuthError] = useState('');
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [linePhone, setLinePhone] = useState('');
    const [lineBindingError, setLineBindingError] = useState('');
    const [lineBindingSubmitting, setLineBindingSubmitting] = useState(false);
    const hasAutoStartedLine = useRef(false);

    useEffect(() => {
        if (!allowLineAuth || !lineOnly || !autoLineLogin) return;
        if (requiresLinePhoneBinding || hasAutoStartedLine.current) return;

        hasAutoStartedLine.current = true;
        loginLine();
    }, [allowLineAuth, lineOnly, autoLineLogin, requiresLinePhoneBinding, loginLine]);

    const handleCredentialSubmit = async () => {
        const user = credentialUser.trim();
        const password = credentialPassword;

        if (!user || !password) {
            setAuthError('Please enter User/Email and Password.');
            return;
        }

        try {
            setAuthSubmitting(true);
            setAuthError('');

            if (authMode === 'login') {
                await loginWithPassword(user, password);
            } else {
                await registerWithPassword(user, password, credentialDisplayName.trim() || user);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Authentication failed.';
            setAuthError(message);
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleLinePhoneBinding = async () => {
        const phone = linePhone.trim();
        if (!phone) {
            setLineBindingError('Please enter your phone number.');
            return;
        }

        try {
            setLineBindingSubmitting(true);
            setLineBindingError('');
            await bindLinePhone(phone);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Phone binding failed.';
            setLineBindingError(message);
        } finally {
            setLineBindingSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#eef2f6] flex items-center justify-center p-4">
            <div className="w-full max-w-[460px]">
                <div className="rounded-2xl border border-[#c9d1dd] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] overflow-hidden">
                    <header className="px-7 py-6 bg-[#0f2740] border-b border-[#0a1d31]">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#dce7f5] text-[11px] font-semibold tracking-wide uppercase">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Secure Access
                        </div>
                        <h1 className="mt-3 text-[24px] leading-tight font-bold text-white">WorkOS Access Portal</h1>
                        <p className="mt-1 text-[12px] text-[#c6d5e8]">
                            Official sign-in for the Task Management System
                        </p>
                    </header>

                    <main className="px-7 py-6 space-y-3">
                        {allowLineAuth && (
                            <div className="rounded-xl border border-[#d6e2ef] bg-[#f6f9fd] p-3 space-y-2">
                                <p className="text-[12px] font-semibold text-[#1d2936]">LINE Access</p>

                                {requiresLinePhoneBinding ? (
                                    <>
                                        <p className="text-[12px] text-[#4f5b68]">
                                            LINE account <span className="font-semibold">{pendingLineProfile?.displayName || '-'}</span> is not linked yet.
                                            Enter phone number to bind with system user.
                                        </p>
                                        <input
                                            type="text"
                                            value={linePhone}
                                            onChange={e => setLinePhone(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && !lineBindingSubmitting && handleLinePhoneBinding()}
                                            placeholder="Phone number"
                                            className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                        />
                                        {lineBindingError && <p className="text-[12px] text-[#c6314a]">{lineBindingError}</p>}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleLinePhoneBinding}
                                                disabled={lineBindingSubmitting}
                                                className="h-10 px-4 inline-flex items-center justify-center gap-2 bg-[#0b63ce] hover:bg-[#0a56b4] text-white font-semibold rounded-lg text-[13px] disabled:bg-[#a0a2b1] disabled:cursor-not-allowed"
                                            >
                                                {lineBindingSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {lineBindingSubmitting ? 'Binding...' : 'Bind Phone'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={loginLine}
                                                className="h-10 px-4 inline-flex items-center justify-center rounded-lg border border-[#c5d3e2] bg-white text-[#1f2f40] text-[13px] font-semibold hover:bg-[#eef3f8]"
                                            >
                                                Change LINE
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={loginLine}
                                        className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-[#0b63ce] bg-[#eaf2fd] text-[#0b63ce] text-[14px] font-semibold hover:bg-[#dfeaf9]"
                                    >
                                        {lineOnly ? 'Continue with LINE' : 'Sign In with LINE'}
                                    </button>
                                )}
                            </div>
                        )}

                        {!lineOnly && (
                            <>
                                <div className="flex items-center justify-between">
                                    <p className="text-[13px] font-semibold text-[#1d2936]">
                                        {authMode === 'login' ? 'Sign in with User / Password' : 'Create User / Password'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode(prev => (prev === 'login' ? 'register' : 'login'));
                                            setAuthError('');
                                        }}
                                        className="text-[12px] text-[#0b63ce] font-semibold hover:underline"
                                    >
                                        {authMode === 'login' ? 'Create account' : 'Back to login'}
                                    </button>
                                </div>

                                {authMode === 'register' && (
                                    <input
                                        type="text"
                                        value={credentialDisplayName}
                                        onChange={e => setCredentialDisplayName(e.target.value)}
                                        placeholder="Display name"
                                        className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                    />
                                )}

                                <input
                                    type="text"
                                    value={credentialUser}
                                    onChange={e => setCredentialUser(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                                    placeholder="User or email (e.g. admin)"
                                    className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                />
                                <input
                                    type="password"
                                    value={credentialPassword}
                                    onChange={e => setCredentialPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                                    placeholder="Password"
                                    className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                />

                                {authError && <p className="text-[12px] text-[#c6314a]">{authError}</p>}

                                <button
                                    type="button"
                                    onClick={handleCredentialSubmit}
                                    disabled={authSubmitting}
                                    className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[#0b63ce] hover:bg-[#0a56b4] text-white font-semibold rounded-xl text-[14px] disabled:bg-[#a0a2b1] disabled:cursor-not-allowed"
                                >
                                    {authSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            </>
                        )}

                        <div className="rounded-lg bg-[#f5f8fc] border border-[#dde5ef] px-3 py-2">
                            {!lineOnly && (
                                <p className="text-[11px] text-[#4f5b68]">
                                    Tip: username only will be stored as <code className="font-mono">username@workos.local</code>
                                </p>
                            )}
                            {allowLineAuth && (
                                <p className="mt-1 text-[11px] text-[#6b7785]">
                                    {lineOnly
                                        ? 'This page uses LINE login only. If first login, please bind with your phone number in system.'
                                        : 'LINE login and phone binding are available on this page.'}
                                </p>
                            )}
                        </div>
                    </main>
                </div>

      
            </div>
        </div>
    );
}
