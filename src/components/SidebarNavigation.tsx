'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    MessageSquare,
    Users,
    Settings2,
    GitBranch,
    LayoutGrid,
    LogOut,
    Plus,
    Check,
    X,
    ChevronDown,
    Eye,
    EyeOff,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarNavigationProps {
    mobile?: boolean;
    onNavigate?: () => void;
}

export default function SidebarNavigation({ mobile = false, onNavigate }: SidebarNavigationProps) {
    const pathname = usePathname();
    const router = useRouter();
    const {
        projects,
        activeProjectId,
        setActiveProjectId,
        createWorkspace,
        scopeBranchId,
        setScopeBranchId,
        scopeDepartmentId,
        setScopeDepartmentId,
        scopeBranchOptions,
        scopeDepartmentOptions,
        canSelectScope,
    } = useAppContext();
    const { user, logoutUser } = useAuth();

    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [newWorkspaceCode, setNewWorkspaceCode] = useState('');
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);
    const [collapseWorkspaces, setCollapseWorkspaces] = useState(false);
    const [hideCompletedWorkspaces, setHideCompletedWorkspaces] = useState(true);

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: BarChart3, match: '/dashboard' },
        { href: '/my-work', label: 'My Work Tracker', icon: MessageSquare, match: '/my-work' },
        { href: '/users', label: 'Users Management', icon: Users, match: '/users' },
        { href: '/settings', label: 'Settings', icon: Settings2, match: '/settings' },
        { href: '/settings/scope', label: 'Branch/Department', icon: GitBranch, match: '/settings/scope', includeChildren: true },
    ];

    const handleCreateWorkspace = async () => {
        const name = newWorkspaceName.trim();
        const code = newWorkspaceCode.trim();
        if (!name || creatingWorkspace) return;

        try {
            setCreatingWorkspace(true);
            await createWorkspace(name, code);
            setNewWorkspaceName('');
            setNewWorkspaceCode('');
            setShowCreateWorkspace(false);
            router.push('/workspaces');
            onNavigate?.();
        } catch (error) {
            console.error('Failed to create workspace:', error);
            alert('Cannot create workspace. Please try again.');
        } finally {
            setCreatingWorkspace(false);
        }
    };

    const hiddenByStatusCount = projects.filter((project) => project.status === 'completed').length;
    const visibleProjects = projects.filter((project) => {
        if (hideCompletedWorkspaces) return project.status !== 'completed';
        return true;
    });

    useEffect(() => {
        if (!hideCompletedWorkspaces) return;
        if (!activeProjectId) return;
        const activeProject = projects.find((project) => project.id === activeProjectId);
        if (!activeProject) return;
        if (activeProject.status !== 'completed') return;

        const fallbackProject = projects.find(
            (project) => project.id !== activeProjectId && project.status !== 'completed'
        );

        if (fallbackProject) {
            setActiveProjectId(fallbackProject.id);
        }
    }, [activeProjectId, hideCompletedWorkspaces, projects, setActiveProjectId]);

    return (
        <div className={`${mobile ? 'w-[88vw] max-w-[340px] h-full flex' : 'w-[280px] hidden md:flex'} relative overflow-hidden overflow-x-hidden border-r border-[#20364d] bg-gradient-to-b from-[#0f2235] via-[#14293f] to-[#0d1c2c] text-[#e7eef7] flex-col shrink-0`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(112,170,224,0.22),transparent_34%),radial-gradient(circle_at_84%_4%,rgba(130,198,226,0.16),transparent_38%)]" />

            <div className="relative z-10 px-5 pt-5 pb-4 border-b border-white/12">
                <div className="flex items-center gap-3">
                    <div className="min-w-0">
                        <p className="text-[17px] font-bold tracking-tight text-white truncate">Powertec</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#9cb3c8]">Task Management</p>
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-4">
                {canSelectScope && (
                    <div className="mx-4 mb-5 rounded-2xl border border-white/12 bg-[#10273c]/75 backdrop-blur-sm p-3.5 overflow-hidden">
                        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#9eb4ca] mb-2">Scope</p>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#87a0b7] mb-1">Branch</label>
                                <select
                                    value={scopeBranchId}
                                    onChange={(e) => setScopeBranchId(e.target.value)}
                                    className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#385773] bg-[#091a2a] text-[#e7eef7] outline-none focus:ring-1 focus:ring-[#57a2eb] focus:border-[#57a2eb]"
                                >
                                    {scopeBranchOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.12em] text-[#87a0b7] mb-1">Department</label>
                                <select
                                    value={scopeDepartmentId}
                                    onChange={(e) => setScopeDepartmentId(e.target.value)}
                                    className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#385773] bg-[#091a2a] text-[#e7eef7] outline-none focus:ring-1 focus:ring-[#57a2eb] focus:border-[#57a2eb]"
                                >
                                    {scopeDepartmentOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                <div className="px-4 mb-5">
                    <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#97acc2] px-2 mb-1.5">Navigation</p>
                    {navItems.map((item) => {
                        const isActive = item.match
                            ? pathname === item.match
                            || (item.includeChildren && pathname.startsWith(`${item.match}/`))
                            || (item.match === '/workspaces' && pathname.startsWith('/tasks/'))
                            : false;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onNavigate}
                                className={`flex min-w-0 items-center gap-3 text-[14px] font-medium px-3 py-2.5 rounded-xl cursor-pointer transition-all mt-1 ${isActive
                                    ? 'bg-[#1f4368] text-white shadow-[inset_0_0_0_1px_rgba(157,196,235,0.22)]'
                                    : 'text-[#d6e2ef] hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[#9fd0ff]' : 'text-[#9cb3c8]'}`} />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#83c2ff]" />}
                            </Link>
                        );
                    })}
                </div>

                <div className="mx-4 mt-6 rounded-2xl border border-white/12 bg-[#10273c]/75 backdrop-blur-sm p-3.5 overflow-hidden">
                    <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#9eb4ca]">Workspaces</p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setHideCompletedWorkspaces((prev) => !prev)}
                                className="p-1.5 rounded-lg text-[#b8cce0] hover:bg-white/10 hover:text-white transition-colors"
                                title={hideCompletedWorkspaces ? 'Hidden mode is on (click to show all)' : 'Showing all workspaces (click to hide completed)'}
                            >
                                {hideCompletedWorkspaces ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => {
                                    setCollapseWorkspaces(false);
                                    setShowCreateWorkspace((prev) => !prev);
                                }}
                                className="p-1.5 rounded-lg text-[#b8cce0] hover:bg-white/10 hover:text-white transition-colors"
                                title="Create Workspace"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setCollapseWorkspaces((prev) => !prev)}
                                className="p-1.5 rounded-lg text-[#b8cce0] hover:bg-white/10 hover:text-white transition-colors"
                                title={collapseWorkspaces ? 'Expand workspaces' : 'Collapse workspaces'}
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform ${collapseWorkspaces ? '-rotate-90' : ''}`} />
                            </button>
                        </div>
                    </div>
                    <p className="text-[11px] text-[#87a0b7] mb-2.5">
                        {visibleProjects.length} visible
                        {hideCompletedWorkspaces
                            ? ` | ${hiddenByStatusCount} completed hidden`
                            : ` | ${projects.length} total`}
                    </p>

                    {!collapseWorkspaces && showCreateWorkspace && (
                        <div className="mb-3 p-2.5 bg-[#0f2235] border border-[#33506a] rounded-xl">
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleCreateWorkspace();
                                    if (e.key === 'Escape') {
                                        setShowCreateWorkspace(false);
                                        setNewWorkspaceName('');
                                        setNewWorkspaceCode('');
                                    }
                                }}
                                placeholder="Workspace name..."
                                className="w-full text-[13px] px-2.5 py-2 rounded-lg border border-[#385773] bg-[#091a2a] text-[#e7eef7] placeholder:text-[#7893ab] outline-none focus:ring-1 focus:ring-[#57a2eb] focus:border-[#57a2eb]"
                                autoFocus
                            />
                            <input
                                type="text"
                                value={newWorkspaceCode}
                                onChange={(e) => setNewWorkspaceCode(e.target.value)}
                                placeholder="Project No. (e.g. PJ-001)"
                                className="w-full mt-2 text-[13px] px-2.5 py-2 rounded-lg border border-[#385773] bg-[#091a2a] text-[#e7eef7] placeholder:text-[#7893ab] outline-none focus:ring-1 focus:ring-[#57a2eb] focus:border-[#57a2eb]"
                            />
                            <div className="flex items-center justify-end gap-1 mt-2">
                                <button
                                    onClick={() => {
                                        setShowCreateWorkspace(false);
                                        setNewWorkspaceName('');
                                        setNewWorkspaceCode('');
                                    }}
                                    className="p-1.5 rounded-md text-[#afc4d7] hover:bg-white/10"
                                    title="Cancel"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => void handleCreateWorkspace()}
                                    disabled={!newWorkspaceName.trim() || creatingWorkspace}
                                    className="p-1.5 rounded-md text-white bg-[#2375cb] hover:bg-[#1f66ae] disabled:bg-[#4b5e72]"
                                    title="Create"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!collapseWorkspaces && (
                        <div className="space-y-1 overflow-x-hidden">
                            {visibleProjects.map((p) => {
                                const isWorkspaceRoute = pathname === '/workspaces' || pathname.startsWith('/tasks/');
                                const isActive = activeProjectId === p.id && isWorkspaceRoute;

                                return (
                                    <div key={p.id} className="min-w-0">
                                        <Link
                                            href="/workspaces"
                                            onClick={() => {
                                                setActiveProjectId(p.id);
                                                onNavigate?.();
                                            }}
                                            className={`min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer text-[13px] transition-colors ${isActive
                                                ? 'bg-[#1f4368] text-white border border-[#395f84]'
                                                : 'text-[#d6e2ef] hover:bg-white/10'
                                                }`}
                                            title={p.code ? `${p.code} - ${p.name}` : p.name}
                                        >
                                            <LayoutGrid className={`w-[16px] h-[16px] shrink-0 ${isActive ? 'text-[#9fd0ff]' : 'text-[#9cb3c8]'}`} />
                                            <span className="min-w-0 flex-1 truncate">{p.code ? `${p.code} - ${p.name}` : p.name}</span>
                                            {activeProjectId === p.id && (
                                                <span className="ml-2 shrink-0 w-1.5 h-1.5 rounded-full bg-[#83c2ff]" />
                                            )}
                                        </Link>
                                    </div>
                                );
                            })}
                            {visibleProjects.length === 0 && (
                                <div className="rounded-lg border border-dashed border-[#3b5772] bg-[#0d1e2e] px-3 py-2 text-[11px] text-[#8fa6bc]">
                                    No visible workspaces
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="relative z-10 border-t border-white/12 p-4 bg-[#0b1826]/70 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                    {user?.pictureUrl ? (
                        <img
                            src={user.pictureUrl}
                            alt={user.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-[#8fb0cf]/70 shadow-sm"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-[#27405a] border border-[#7f9bb8]/70 flex items-center justify-center text-[12px] font-semibold text-[#e6eef7]">
                            {user?.displayName?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-[#e6eef7] truncate">{user?.displayName}</div>
                        <div className="text-[10px] uppercase tracking-[0.08em] text-[#95abc1]">Authenticated User</div>
                    </div>
                    <button
                        onClick={logoutUser}
                        className="p-1.5 text-[#afc4d7] hover:text-[#ffd5dc] hover:bg-[#5a2435]/80 rounded-lg transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
