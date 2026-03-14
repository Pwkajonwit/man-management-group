'use client';

import React, { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/LoginPage';
import SidebarNavigation from '@/components/SidebarNavigation';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { hasAdminAccess } from '@/lib/rbac';

export default function AdminGate({ children }: { children: React.ReactNode }) {
    const { loading, isAuthenticated, user, logoutUser } = useAuth();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    if (loading) return <LinearLoadingScreen message="Preparing workspace..." />;

    if (!isAuthenticated) return <LoginPage />;
    if (!hasAdminAccess(user?.role)) {
        return (
            <div className="min-h-dvh bg-[#f5f6f8] flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-xl border border-[#d0d4e4] bg-white p-5 text-center">
                    <p className="text-[16px] font-semibold text-[#323338]">Access denied</p>
                    <p className="text-[13px] text-[#676879] mt-1">
                        Your account does not have permission to open admin workspace.
                    </p>
                    <button
                        type="button"
                        onClick={logoutUser}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[#d0d4e4] bg-white px-4 py-2 text-[13px] font-semibold text-[#323338] hover:bg-[#f5f6f8]"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh bg-white text-[#323338]">
            <SidebarNavigation />
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="md:hidden h-14 bg-white border-b border-[#d0d4e4] px-4 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-[#f5f6f8] text-[#323338]"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="font-bold text-[15px] tracking-tight">WorkOS Admin</div>
                    <div className="w-9" />
                </div>
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
                    {children}
                </div>
            </div>

            {mobileSidebarOpen && (
                <div className="fixed inset-0 z-[120] md:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-label="Close menu backdrop"
                    />
                    <div className="relative h-full">
                        <div className="absolute left-0 top-0 h-full shadow-2xl">
                            <SidebarNavigation mobile onNavigate={() => setMobileSidebarOpen(false)} />
                            <button
                                type="button"
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-[#d0d4e4] flex items-center justify-center text-[#676879]"
                                aria-label="Close menu"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
