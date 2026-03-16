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
            setAuthError('กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน');
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
            const message = error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ';
            setAuthError(message);
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleLinePhoneBinding = async () => {
        const phone = linePhone.trim();
        if (!phone) {
            setLineBindingError('กรุณากรอกเบอร์โทร');
            return;
        }

        try {
            setLineBindingSubmitting(true);
            setLineBindingError('');
            await bindLinePhone(phone);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'ผูกเบอร์โทรไม่สำเร็จ';
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
                            เข้าถึงอย่างปลอดภัย
                        </div>
                        <h1 className="mt-3 text-[24px] leading-tight font-bold text-white">เข้าสู่ระบบจัดการงาน</h1>
                        <p className="mt-1 text-[12px] text-[#c6d5e8]">
                            สำหรับผู้ดูแลระบบและพนักงานของระบบจัดการงาน
                        </p>
                    </header>

                    <main className="px-7 py-6 space-y-3">
                        {allowLineAuth && (
                            <div className="rounded-xl border border-[#d6e2ef] bg-[#f6f9fd] p-3 space-y-2">
                                <p className="text-[12px] font-semibold text-[#1d2936]">เข้าใช้งานด้วย LINE</p>

                                {requiresLinePhoneBinding ? (
                                    <>
                                        <p className="text-[12px] text-[#4f5b68]">
                                            บัญชี LINE <span className="font-semibold">{pendingLineProfile?.displayName || '-'}</span> ยังไม่ได้ผูกกับระบบ
                                            กรุณากรอกเบอร์โทรเพื่อเชื่อมกับผู้ใช้ในระบบ
                                        </p>
                                        <input
                                            type="text"
                                            value={linePhone}
                                            onChange={e => setLinePhone(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && !lineBindingSubmitting && handleLinePhoneBinding()}
                                            placeholder="เบอร์โทร"
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
                                                {lineBindingSubmitting ? 'กำลังผูกบัญชี...' : 'ผูกเบอร์โทร'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={loginLine}
                                                className="h-10 px-4 inline-flex items-center justify-center rounded-lg border border-[#c5d3e2] bg-white text-[#1f2f40] text-[13px] font-semibold hover:bg-[#eef3f8]"
                                            >
                                                เปลี่ยนบัญชี LINE
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={loginLine}
                                        className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-[#0b63ce] bg-[#eaf2fd] text-[#0b63ce] text-[14px] font-semibold hover:bg-[#dfeaf9]"
                                    >
                                        {lineOnly ? 'ดำเนินการต่อด้วย LINE' : 'เข้าสู่ระบบด้วย LINE'}
                                    </button>
                                )}
                            </div>
                        )}

                        {!lineOnly && (
                            <>
                                <div className="flex items-center justify-between">
                                    <p className="text-[13px] font-semibold text-[#1d2936]">
                                        {authMode === 'login' ? 'เข้าสู่ระบบด้วยชื่อผู้ใช้ / รหัสผ่าน' : 'สร้างผู้ใช้ด้วยชื่อผู้ใช้ / รหัสผ่าน'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode(prev => (prev === 'login' ? 'register' : 'login'));
                                            setAuthError('');
                                        }}
                                        className="text-[12px] text-[#0b63ce] font-semibold hover:underline"
                                    >
                                        {authMode === 'login' ? 'สร้างบัญชี' : 'กลับไปหน้าเข้าสู่ระบบ'}
                                    </button>
                                </div>

                                {authMode === 'register' && (
                                    <input
                                        type="text"
                                        value={credentialDisplayName}
                                        onChange={e => setCredentialDisplayName(e.target.value)}
                                        placeholder="ชื่อที่แสดง"
                                        className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                    />
                                )}

                                <input
                                    type="text"
                                    value={credentialUser}
                                    onChange={e => setCredentialUser(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                                    placeholder="ชื่อผู้ใช้หรืออีเมล เช่น admin"
                                    className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                                />
                                <input
                                    type="password"
                                    value={credentialPassword}
                                    onChange={e => setCredentialPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                                    placeholder="รหัสผ่าน"
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
                                    {authMode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}
                                </button>
                            </>
                        )}

                        <div className="rounded-lg bg-[#f5f8fc] border border-[#dde5ef] px-3 py-2">
                            {!lineOnly && (
                                <p className="text-[11px] text-[#4f5b68]">
                                    หมายเหตุ : การเข้าสู่ระบบด้วยชื่อผู้ใช้/รหัสผ่าน จะต้องมีบัญชีที่ถูกสร้างไว้ล่วงหน้าในระบบโดยผู้ดูแลระบบเท่านั้น ไม่สามารถสมัครได้ด้วยตนเองผ่านหน้านี้
                                </p>
                            )}
                            {allowLineAuth && (
                                <p className="mt-1 text-[11px] text-[#6b7785]">
                                    {lineOnly
                                        ? 'หน้านี้ใช้การเข้าสู่ระบบด้วย LINE เท่านั้น หากเป็นการเข้าใช้งานครั้งแรก กรุณาผูกบัญชีด้วยเบอร์โทรที่อยู่ในระบบ'
                                        : 'หน้านี้รองรับทั้งการเข้าสู่ระบบด้วย LINE และการผูกเบอร์โทร'}
                                </p>
                            )}
                        </div>
                    </main>
                </div>

      
            </div>
        </div>
    );
}
