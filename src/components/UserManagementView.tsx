'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Camera, ImagePlus, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { SystemUserAccount, SystemUserRole, Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';

interface UserManagementViewProps {
    teamMembers: TeamMember[];
    systemUsers: SystemUserAccount[];
    tasks: Task[];
    onAddMember: (member: TeamMember) => Promise<void> | void;
    onUpdateMember: (memberId: string, patch: Partial<TeamMember>) => Promise<void> | void;
    onDeleteMember: (memberId: string) => Promise<void> | void;
    onAddSystemUser: (payload: {
        id?: string;
        username: string;
        email: string;
        displayName: string;
        authProvider: SystemUserAccount['authProvider'];
        role?: SystemUserRole;
        branchIds?: string[];
        departmentIds?: string[];
        phone?: string;
        lineUserId?: string;
    }) => Promise<void> | void;
    onUpdateSystemUser: (userId: string, patch: Partial<SystemUserAccount>) => Promise<void> | void;
    onDeleteSystemUser: (userId: string) => Promise<void> | void;
}

type MemberType = 'team' | 'crew';
type MemberTab = MemberType | 'system';

const getMemberType = (member: TeamMember): MemberType => (
    member.memberType === 'crew' ? 'crew' : 'team'
);

const getMemberTypeLabel = (memberType: MemberType): string => (
    memberType === 'crew' ? 'ทีมช่าง' : 'ทีมงาน'
);

const getMemberTypeBadgeClass = (memberType: MemberType): string => (
    memberType === 'crew'
        ? 'bg-[#fff3e0] text-[#ad6800] border-[#ffd69b]'
        : 'bg-[#eef4ff] text-[#0052cc] border-[#c9ddff]'
);

const normalizeMemberName = (name: string): string => name.trim().toLowerCase();
const SYSTEM_ROLE_OPTIONS: Array<{ value: SystemUserRole; label: string }> = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'branch_manager', label: 'Branch Manager' },
    { value: 'department_manager', label: 'Dept Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'viewer', label: 'Viewer' },
];

function parseCsvList(input: string): string[] {
    return Array.from(
        new Set(
            input
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function toCsvList(values?: string[]): string {
    return (values || []).join(', ');
}

function roleLabel(role?: SystemUserRole): string {
    return SYSTEM_ROLE_OPTIONS.find((item) => item.value === role)?.label || 'Staff';
}

function toScopeList(values?: string[], fallback?: string): string[] {
    const normalized = parseCsvList(toCsvList(values));
    if (normalized.length > 0) return normalized;
    if (fallback && fallback.trim()) return [fallback.trim()];
    return [];
}

export default function UserManagementView({
    teamMembers,
    systemUsers,
    tasks,
    onAddMember,
    onUpdateMember,
    onDeleteMember,
    onAddSystemUser,
    onUpdateSystemUser,
    onDeleteSystemUser,
}: UserManagementViewProps) {
    const modal = useConfirmModal();
    const [searchQuery, setSearchQuery] = useState('');
    const [memberTab, setMemberTab] = useState<MemberTab>('team');
    const [lineActionMemberId, setLineActionMemberId] = useState<string | null>(null);
    const [lineCopiedMemberId, setLineCopiedMemberId] = useState<string | null>(null);

    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPosition, setNewMemberPosition] = useState('');
    const [newMemberDepartment, setNewMemberDepartment] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberCapacity, setNewMemberCapacity] = useState('40');
    const [newMemberType, setNewMemberType] = useState<MemberType>('team');
    const [newMemberAvatar, setNewMemberAvatar] = useState('');

    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<TeamMember>>({});
    const [pendingDeleteMember, setPendingDeleteMember] = useState<TeamMember | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);
    const [newSystemDisplayName, setNewSystemDisplayName] = useState('');
    const [newSystemUsername, setNewSystemUsername] = useState('');
    const [newSystemEmail, setNewSystemEmail] = useState('');
    const [newSystemPhone, setNewSystemPhone] = useState('');
    const [newSystemLineUserId, setNewSystemLineUserId] = useState('');
    const [newSystemProvider, setNewSystemProvider] = useState<SystemUserAccount['authProvider']>('password');
    const [newSystemRole, setNewSystemRole] = useState<SystemUserRole>('staff');
    const [newSystemBranchIds, setNewSystemBranchIds] = useState('');
    const [newSystemDepartmentIds, setNewSystemDepartmentIds] = useState('');
    const [editingSystemUserId, setEditingSystemUserId] = useState<string | null>(null);
    const [editingSystemData, setEditingSystemData] = useState<Partial<SystemUserAccount>>({});
    const [systemLineActionUserId, setSystemLineActionUserId] = useState<string | null>(null);
    const [systemLineCopiedUserId, setSystemLineCopiedUserId] = useState<string | null>(null);

    const newAvatarRef = useRef<HTMLInputElement>(null);
    const editAvatarRef = useRef<HTMLInputElement>(null);

    const loadByMemberName = useMemo(() => {
        const loadMap = new Map<string, { taskCount: number; assignedHours: number }>();
        teamMembers.forEach((member) => {
            const ownedTasks = tasks.filter((task) => getTaskOwnerNames(task, teamMembers).includes(member.name));
            const openTasks = ownedTasks.filter((task) => task.status !== 'completed' && task.progress < 100);
            const assignedHours = openTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 8), 0);
            loadMap.set(member.name, { taskCount: openTasks.length, assignedHours });
        });
        return loadMap;
    }, [tasks, teamMembers]);

    const filteredTeamMembers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return teamMembers.filter((member) => {
            if (memberTab === 'system') return false;
            if (getMemberType(member) !== memberTab) return false;
            if (!q) return true;
            return (
                member.name.toLowerCase().includes(q)
                || (member.position || '').toLowerCase().includes(q)
                || (member.department || '').toLowerCase().includes(q)
                || (member.phone || '').toLowerCase().includes(q)
                || getMemberTypeLabel(getMemberType(member)).toLowerCase().includes(q)
            );
        });
    }, [searchQuery, teamMembers, memberTab]);

    const filteredSystemUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (memberTab !== 'system') return [];
        return systemUsers.filter((user) => (
            user.displayName.toLowerCase().includes(q)
            || user.username.toLowerCase().includes(q)
            || user.email.toLowerCase().includes(q)
            || user.authProvider.toLowerCase().includes(q)
            || (user.role || '').toLowerCase().includes(q)
            || (user.branchIds || []).some((branchId) => branchId.toLowerCase().includes(q))
            || (user.departmentIds || []).some((departmentId) => departmentId.toLowerCase().includes(q))
            || (user.phone || '').toLowerCase().includes(q)
            || (user.lineUserId || '').toLowerCase().includes(q)
        ));
    }, [memberTab, searchQuery, systemUsers]);

    const summary = useMemo(() => {
        const totalCapacity = teamMembers.reduce((sum, member) => sum + (member.capacityHoursPerWeek ?? 40), 0);
        const totalAssigned = teamMembers.reduce((sum, member) => sum + (loadByMemberName.get(member.name)?.assignedHours || 0), 0);
        const lineLinked = teamMembers.filter((member) => Boolean(member.lineUserId)).length;
        const teamCount = teamMembers.filter((member) => getMemberType(member) === 'team').length;
        const crewCount = teamMembers.filter((member) => getMemberType(member) === 'crew').length;
        const overloaded = teamMembers.filter((member) => {
            const assigned = loadByMemberName.get(member.name)?.assignedHours || 0;
            const capacity = member.capacityHoursPerWeek ?? 40;
            return assigned > capacity;
        }).length;

        return {
            members: teamMembers.length,
            systemUsers: systemUsers.length,
            totalCapacity,
            totalAssigned,
            lineLinked,
            teamCount,
            crewCount,
            overloaded,
        };
    }, [loadByMemberName, teamMembers, systemUsers.length]);

    const pendingDeleteImpactCount = useMemo(() => {
        if (!pendingDeleteMember) return 0;
        return tasks.filter((task) =>
            task.responsible === pendingDeleteMember.name || (task.assignedEmployeeIds || []).includes(pendingDeleteMember.id)
        ).length;
    }, [pendingDeleteMember, tasks]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleNewAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setNewMemberAvatar(base64);
        } catch (err) {
            console.error('Error reading file:', err);
        }
        e.target.value = '';
    };

    const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setEditingData({ ...editingData, avatar: base64 });
        } catch (err) {
            console.error('Error reading file:', err);
        }
        e.target.value = '';
    };

    const handleAvatarChangeForMember = async (memberId: string, file: File) => {
        try {
            const base64 = await fileToBase64(file);
            await Promise.resolve(onUpdateMember(memberId, { avatar: base64 }));
        } catch (err) {
            console.error('Error reading file:', err);
        }
    };

    const handleAddMember = () => {
        if (!newMemberName.trim()) return;
        const normalizedName = normalizeMemberName(newMemberName);
        const duplicated = teamMembers.some((member) => normalizeMemberName(member.name) === normalizedName);
        if (duplicated) {
            void modal.alert('มีชื่อสมาชิกนี้อยู่แล้ว โปรดใช้ชื่ออื่น', { variant: 'warning' });
            return;
        }

        const newMember: TeamMember = {
            id: `u-${Date.now()}`,
            name: newMemberName.trim(),
            memberType: newMemberType,
            position: newMemberPosition.trim() || 'Staff',
            department: newMemberDepartment.trim() || 'General',
            phone: newMemberPhone.trim() || '-',
            capacityHoursPerWeek: Number.parseInt(newMemberCapacity, 10) || 40,
            avatar: newMemberAvatar || undefined,
        };

        void onAddMember(newMember);
        setNewMemberName('');
        setNewMemberPosition('');
        setNewMemberDepartment('');
        setNewMemberPhone('');
        setNewMemberCapacity('40');
        setNewMemberType('team');
        setNewMemberAvatar('');
    };

    const startEditingMember = (member: TeamMember) => {
        setEditingMemberId(member.id);
        setEditingData({ ...member });
    };

    const saveEditingMember = () => {
        if (!editingMemberId || !editingData.name?.trim()) return;
        const normalizedName = normalizeMemberName(editingData.name);
        const duplicated = teamMembers.some(
            (member) => member.id !== editingMemberId && normalizeMemberName(member.name) === normalizedName
        );
        if (duplicated) {
            alert('มีชื่อสมาชิกนี้อยู่แล้ว โปรดใช้ชื่ออื่น');
            return;
        }
        const patch: Partial<TeamMember> = {
            ...editingData,
            name: editingData.name.trim(),
            memberType: editingData.memberType === 'crew' ? 'crew' : 'team',
        };
        void onUpdateMember(editingMemberId, patch);
        setEditingMemberId(null);
    };

    const cancelEditingMember = () => {
        setEditingMemberId(null);
        setEditingData({});
    };

    const openDeleteModal = (member: TeamMember) => {
        setPendingDeleteMember(member);
    };

    const closeDeleteModal = () => {
        if (isDeletingMember) return;
        setPendingDeleteMember(null);
    };

    const confirmDeleteMember = async () => {
        if (!pendingDeleteMember || isDeletingMember) return;
        try {
            setIsDeletingMember(true);
            await Promise.resolve(onDeleteMember(pendingDeleteMember.id));
            setPendingDeleteMember(null);
        } finally {
            setIsDeletingMember(false);
        }
    };

    const AvatarDisplay = ({ member, size = 40, className = '' }: { member: TeamMember | { name: string; avatar?: string }; size?: number; className?: string }) => (
        member.avatar ? (
            <img
                src={member.avatar}
                alt={member.name}
                referrerPolicy="no-referrer"
                className={`rounded-full object-cover border-2 border-white shadow-sm ${className}`}
                style={{ width: size, height: size }}
            />
        ) : (
            <div
                className={`rounded-full bg-[#cce5ff] border border-[#0052cc]/20 flex items-center justify-center text-[#0052cc] font-medium shrink-0 ${className}`}
                style={{ width: size, height: size, fontSize: size * 0.35 }}
            >
                {member.name.substring(0, 2).toUpperCase()}
            </div>
        )
    );

    const copyText = async (text: string) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    };

    const handleLineBadgeClick = async (member: TeamMember) => {
        if (!member.lineUserId || lineActionMemberId) return;

        try {
            setLineActionMemberId(member.id);
            await copyText(member.lineUserId);
            setLineCopiedMemberId(member.id);
            window.setTimeout(() => {
                setLineCopiedMemberId((current) => (current === member.id ? null : current));
            }, 1200);
        } catch (error) {
            console.error('Failed to copy LINE User ID:', error);
            void modal.error('คัดลอก LINE User ID ไม่สำเร็จ โปรดลองอีกครั้ง');
        } finally {
            setLineActionMemberId(null);
        }
    };

    const handleSystemLineBadgeClick = async (user: SystemUserAccount) => {
        if (!user.lineUserId || systemLineActionUserId) return;

        try {
            setSystemLineActionUserId(user.id);
            await copyText(user.lineUserId);
            setSystemLineCopiedUserId(user.id);
            window.setTimeout(() => {
                setSystemLineCopiedUserId((current) => (current === user.id ? null : current));
            }, 1200);
        } catch (error) {
            console.error('Failed to copy system user LINE User ID:', error);
            void modal.error('คัดลอก LINE User ID ไม่สำเร็จ โปรดลองอีกครั้ง');
        } finally {
            setSystemLineActionUserId(null);
        }
    };

    const handleAddSystemUserSubmit = async () => {
        const displayName = newSystemDisplayName.trim();
        const username = newSystemUsername.trim().toLowerCase();
        const email = newSystemEmail.trim().toLowerCase();
        const branchIds = parseCsvList(newSystemBranchIds);
        const departmentIds = parseCsvList(newSystemDepartmentIds);
        if (!displayName || !username || !email) {
            void modal.alert('โปรดระบุชื่อแสดง ชื่อผู้ใช้ และอีเมล', { variant: 'warning' });
            return;
        }

        const duplicated = systemUsers.some((user) =>
            user.username.toLowerCase() === username || user.email.toLowerCase() === email
        );
        if (duplicated) {
            void modal.alert('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว', { variant: 'warning' });
            return;
        }

        await Promise.resolve(onAddSystemUser({
            displayName,
            username,
            email,
            authProvider: newSystemProvider,
            role: newSystemRole,
            branchIds,
            departmentIds,
            phone: newSystemPhone.trim(),
            lineUserId: newSystemLineUserId.trim(),
        }));

        setNewSystemDisplayName('');
        setNewSystemUsername('');
        setNewSystemEmail('');
        setNewSystemPhone('');
        setNewSystemLineUserId('');
        setNewSystemProvider('password');
        setNewSystemRole('staff');
        setNewSystemBranchIds('');
        setNewSystemDepartmentIds('');
    };

    const startEditingSystemUser = (user: SystemUserAccount) => {
        setEditingSystemUserId(user.id);
        setEditingSystemData({ ...user });
    };

    const cancelEditingSystemUser = () => {
        setEditingSystemUserId(null);
        setEditingSystemData({});
    };

    const saveEditingSystemUser = async () => {
        if (!editingSystemUserId) return;
        const displayName = (editingSystemData.displayName || '').trim();
        const username = (editingSystemData.username || '').trim().toLowerCase();
        const email = (editingSystemData.email || '').trim().toLowerCase();
        if (!displayName || !username || !email) {
            void modal.alert('โปรดระบุชื่อแสดง ชื่อผู้ใช้ และอีเมล', { variant: 'warning' });
            return;
        }

        const duplicated = systemUsers.some((user) =>
            user.id !== editingSystemUserId
            && (user.username.toLowerCase() === username || user.email.toLowerCase() === email)
        );
        if (duplicated) {
            void modal.alert('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว', { variant: 'warning' });
            return;
        }

        const branchIds = toScopeList(editingSystemData.branchIds, editingSystemData.branchId);
        const departmentIds = toScopeList(editingSystemData.departmentIds, editingSystemData.departmentId);

        await Promise.resolve(onUpdateSystemUser(editingSystemUserId, {
            displayName,
            username,
            email,
            phone: (editingSystemData.phone || '').trim(),
            lineUserId: (editingSystemData.lineUserId || '').trim(),
            authProvider: editingSystemData.authProvider === 'line' ? 'line' : 'password',
            role: (editingSystemData.role || 'staff') as SystemUserRole,
            branchIds,
            departmentIds,
            branchId: branchIds[0],
            departmentId: departmentIds[0],
            lastLoginAt: editingSystemData.lastLoginAt,
        }));
        setEditingSystemUserId(null);
        setEditingSystemData({});
    };

    const deleteSystemUser = async (user: SystemUserAccount) => {
        const confirmed = await modal.confirm({
            title: 'ยืนยันการลบ',
            message: `ลบผู้ใช้ระบบ "${user.displayName}" หรือไม่?`,
            confirmLabel: 'ลบ',
        });
        if (!confirmed) return;
        await Promise.resolve(onDeleteSystemUser(user.id));
    };

    const formatDateTime = (isoValue?: string) => {
        if (!isoValue) return '-';
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return isoValue;
        return date.toLocaleString('th-TH');
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">การจัดการผู้ใช้</h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">สมาชิก</div>
                            <div className="text-2xl font-black text-[#323338] mt-1">{summary.members}</div>
                            <div className="text-[11px] text-[#676879] mt-1">ทีม {summary.teamCount} • ช่าง {summary.crewCount} • ผู้ใช้/รหัสผ่าน {summary.systemUsers}</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ขีดจำกัดชั่วโมงรวม</div>
                            <div className="text-2xl font-black text-[#00c875] mt-1">{summary.totalCapacity}h</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ชั่วโมงที่มอบหมาย</div>
                            <div className="text-2xl font-black text-[#0073ea] mt-1">{summary.totalAssigned}h</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">เชื่อมโยง LINE แล้ว</div>
                            <div className="text-2xl font-black text-[#00c875] mt-1">{summary.lineLinked}</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ทำงานเกินชั่วโมง</div>
                            <div className="text-2xl font-black text-[#e2445c] mt-1">{summary.overloaded}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-[#d0d4e4] overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-[#d0d4e4] bg-[#f5f6f8] space-y-4">
                            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                                <h2 className="text-xl font-semibold text-[#323338]">พนักงานและผู้รับเหมาในระบบ</h2>
                                <div className="relative w-full lg:w-[320px]">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#a0a2b1]" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="ค้นหาชื่อ, บทบาท, ชื่อผู้ใช้, อีเมล..."
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#d0d4e4] bg-white w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('team')}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${memberTab === 'team' ? 'bg-[#0073ea] text-white' : 'text-[#676879] hover:bg-[#f5f6f8]'}`}
                                >
                                    ผู้รับผิดชอบ ({summary.teamCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('crew')}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${memberTab === 'crew' ? 'bg-[#fdab3d] text-white' : 'text-[#676879] hover:bg-[#f5f6f8]'}`}
                                >
                                    ทีมช่าง ({summary.crewCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('system')}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${memberTab === 'system' ? 'bg-[#334155] text-white' : 'text-[#676879] hover:bg-[#f5f6f8]'}`}
                                >
                                    ผู้ใช้ระบบ ({summary.systemUsers})
                                </button>
                            </div>

                            {memberTab !== 'system' && (
                                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-start">
                                <div className="shrink-0">
                                    <input type="file" accept="image/*" ref={newAvatarRef} onChange={handleNewAvatarUpload} className="hidden" />
                                    <button onClick={() => newAvatarRef.current?.click()} className="relative group" title="Upload Photo">
                                        {newMemberAvatar ? (
                                            <div className="relative">
                                                <img src={newMemberAvatar} alt="New member" className="w-[42px] h-[42px] rounded-full object-cover border-2 border-[#0073ea] shadow-sm" />
                                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-[42px] h-[42px] rounded-full bg-[#e6e9ef] border-2 border-dashed border-[#a0a2b1] flex items-center justify-center text-[#a0a2b1] hover:border-[#0073ea] hover:text-[#0073ea] transition-colors">
                                                <ImagePlus className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>
                                </div>

                                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                                    <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="ชื่อ" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <select
                                        value={newMemberType}
                                        onChange={(e) => setNewMemberType(e.target.value as MemberType)}
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]"
                                    >
                                        <option value="team">ทีมงาน</option>
                                        <option value="crew">ทีมช่าง</option>
                                    </select>
                                    <input value={newMemberPosition} onChange={(e) => setNewMemberPosition(e.target.value)} placeholder="ตำแหน่ง" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input value={newMemberDepartment} onChange={(e) => setNewMemberDepartment(e.target.value)} placeholder="แผนก" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="เบอร์โทร" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input type="number" min="1" max="168" value={newMemberCapacity} onChange={(e) => setNewMemberCapacity(e.target.value)} placeholder="ชั่วโมงทำงาน/สัปดาห์" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                </div>
                                <button onClick={handleAddMember} disabled={!newMemberName.trim()} className="bg-[#0073ea] hover:bg-[#0060c0] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 h-[42px] w-full lg:w-auto">
                                    <Plus className="w-4 h-4" /> เพิ่ม
                                </button>
                                </div>
                            )}

                            {memberTab === 'system' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 items-center">
                                    <input
                                        value={newSystemDisplayName}
                                        onChange={(e) => setNewSystemDisplayName(e.target.value)}
                                        placeholder="ชื่อแสดง"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <input
                                        value={newSystemUsername}
                                        onChange={(e) => setNewSystemUsername(e.target.value)}
                                        placeholder="ชื่อผู้ใช้"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <input
                                        value={newSystemEmail}
                                        onChange={(e) => setNewSystemEmail(e.target.value)}
                                        placeholder="อีเมล"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <input
                                        value={newSystemPhone}
                                        onChange={(e) => setNewSystemPhone(e.target.value)}
                                        placeholder="เบอร์โทร"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <input
                                        value={newSystemLineUserId}
                                        onChange={(e) => setNewSystemLineUserId(e.target.value)}
                                        placeholder="LINE User ID"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <select
                                        value={newSystemProvider}
                                        onChange={(e) => setNewSystemProvider(e.target.value as SystemUserAccount['authProvider'])}
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    >
                                        <option value="password">User/Pass</option>
                                        <option value="line">LINE</option>
                                    </select>
                                    <select
                                        value={newSystemRole}
                                        onChange={(e) => setNewSystemRole(e.target.value as SystemUserRole)}
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    >
                                        {SYSTEM_ROLE_OPTIONS.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        value={newSystemBranchIds}
                                        onChange={(e) => setNewSystemBranchIds(e.target.value)}
                                        placeholder="Branch IDs (comma separated)"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <input
                                        value={newSystemDepartmentIds}
                                        onChange={(e) => setNewSystemDepartmentIds(e.target.value)}
                                        placeholder="Department IDs (comma separated)"
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void handleAddSystemUserSubmit()}
                                        disabled={!newSystemDisplayName.trim() || !newSystemUsername.trim() || !newSystemEmail.trim()}
                                        className="bg-[#334155] hover:bg-[#1f2937] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-[13px] font-medium"
                                    >
                                        เพิ่มผู้ใช้
                                    </button>
                                </div>
                            )}
                        </div>

                        {memberTab === 'system' ? (
                            <div className="divide-y divide-[#e6e9ef]">
                                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.3fr_1fr_1.2fr_0.9fr_0.9fr_1.3fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wider text-[#676879]">
                                    <div>ชื่อแสดง</div>
                                    <div>ชื่อผู้ใช้</div>
                                    <div>อีเมล</div>
                                    <div>เบอร์โทร</div>
                                    <div>LINE User ID</div>
                                    <div>Role</div>
                                    <div>Scope</div>
                                    <div>ผู้ให้บริการ</div>
                                    <div>เข้าสู่ระบบล่าสุด</div>
                                    <div>สร้างเมื่อ</div>
                                    <div className="text-right">จัดการ</div>
                                </div>
                                {filteredSystemUsers.map((user) => (
                                    <div key={user.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.3fr_1fr_1.2fr_0.9fr_0.9fr_1.3fr_1fr_1fr_auto] gap-2 px-4 py-3 hover:bg-[#f8fafc] transition-colors items-center">
                                        <div className="min-w-0">
                                            {editingSystemUserId === user.id ? (
                                                <input
                                                    value={editingSystemData.displayName || ''}
                                                    onChange={(e) => setEditingSystemData({ ...editingSystemData, displayName: e.target.value })}
                                                    className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                    placeholder="ชื่อแสดง"
                                                />
                                            ) : (
                                                <div className="text-[13px] font-semibold text-[#323338] truncate">{user.displayName || '-'}</div>
                                            )}
                                        </div>
                                        {editingSystemUserId === user.id ? (
                                            <input
                                                value={editingSystemData.username || ''}
                                                onChange={(e) => setEditingSystemData({ ...editingSystemData, username: e.target.value })}
                                                className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                placeholder="ชื่อผู้ใช้"
                                            />
                                        ) : (
                                            <div className="text-[12px] text-[#323338] truncate">{user.username || '-'}</div>
                                        )}
                                        {editingSystemUserId === user.id ? (
                                            <input
                                                value={editingSystemData.email || ''}
                                                onChange={(e) => setEditingSystemData({ ...editingSystemData, email: e.target.value })}
                                                className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                placeholder="อีเมล"
                                            />
                                        ) : (
                                            <div className="text-[12px] text-[#323338] truncate">{user.email || '-'}</div>
                                        )}
                                        {editingSystemUserId === user.id ? (
                                            <input
                                                value={editingSystemData.phone || ''}
                                                onChange={(e) => setEditingSystemData({ ...editingSystemData, phone: e.target.value })}
                                                className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                placeholder="เบอร์โทร"
                                            />
                                        ) : (
                                            <div className="text-[12px] text-[#323338] truncate">{user.phone || '-'}</div>
                                        )}
                                        <div className="min-w-0">
                                            {editingSystemUserId === user.id ? (
                                                <input
                                                    value={editingSystemData.lineUserId || ''}
                                                    onChange={(e) => setEditingSystemData({ ...editingSystemData, lineUserId: e.target.value })}
                                                    className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                    placeholder="LINE User ID"
                                                />
                                            ) : user.lineUserId ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleSystemLineBadgeClick(user)}
                                                        disabled={systemLineActionUserId === user.id}
                                                        title="LINE linked"
                                                        className="inline-flex items-center gap-1 rounded-full bg-[#e6faef] text-[#00a66a] border border-[#b8ebd2] px-2 py-0.5 text-[10px] font-bold hover:bg-[#d9f5e8] disabled:opacity-60"
                                                    >
                                                    {systemLineActionUserId === user.id ? (
                                                        <>
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            ...
                                                        </>
                                                    ) : systemLineCopiedUserId === user.id ? (
                                                        <>
                                                            <Check className="w-3 h-3" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            LINE
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="text-[12px] text-[#676879]">-</div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            {editingSystemUserId === user.id ? (
                                                <select
                                                    value={(editingSystemData.role || 'staff') as SystemUserRole}
                                                    onChange={(e) => setEditingSystemData({ ...editingSystemData, role: e.target.value as SystemUserRole })}
                                                    className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                >
                                                    {SYSTEM_ROLE_OPTIONS.map((item) => (
                                                        <option key={item.value} value={item.value}>{item.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-[12px] text-[#323338] font-medium truncate">{roleLabel(user.role)}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            {editingSystemUserId === user.id ? (
                                                <div className="space-y-1">
                                                    <input
                                                        value={toCsvList(toScopeList(editingSystemData.branchIds, editingSystemData.branchId))}
                                                        onChange={(e) => setEditingSystemData({ ...editingSystemData, branchIds: parseCsvList(e.target.value) })}
                                                        className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                        placeholder="Branches: b1, b2"
                                                    />
                                                    <input
                                                        value={toCsvList(toScopeList(editingSystemData.departmentIds, editingSystemData.departmentId))}
                                                        onChange={(e) => setEditingSystemData({ ...editingSystemData, departmentIds: parseCsvList(e.target.value) })}
                                                        className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                        placeholder="Departments: d1, d2"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-[#676879] leading-4">
                                                    <div className="truncate">B: {toCsvList(toScopeList(user.branchIds, user.branchId)) || '-'}</div>
                                                    <div className="truncate">D: {toCsvList(toScopeList(user.departmentIds, user.departmentId)) || '-'}</div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            {editingSystemUserId === user.id ? (
                                                <select
                                                    value={editingSystemData.authProvider === 'line' ? 'line' : 'password'}
                                                    onChange={(e) => setEditingSystemData({ ...editingSystemData, authProvider: e.target.value as SystemUserAccount['authProvider'] })}
                                                    className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-[12px] outline-none"
                                                >
                                                    <option value="password">User/Pass</option>
                                                    <option value="line">LINE</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${user.authProvider === 'password' ? 'bg-[#eef4ff] text-[#0052cc] border-[#c9ddff]' : 'bg-[#e6faef] text-[#008a59] border-[#b8ebd2]'}`}>
                                                    {user.authProvider === 'password' ? 'User/Pass' : 'LINE'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[12px] text-[#676879] truncate">{formatDateTime(user.lastLoginAt)}</div>
                                        <div className="text-[12px] text-[#676879] truncate">{formatDateTime(user.createdAt)}</div>
                                        <div className="flex items-center justify-end gap-1.5">
                                            {editingSystemUserId === user.id ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => void saveEditingSystemUser()}
                                                        className="text-[#00c875] p-1.5 hover:bg-[#e6faef] rounded-md transition-all"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditingSystemUser}
                                                        className="text-[#676879] p-1.5 hover:bg-[#e6e9ef] rounded-md transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditingSystemUser(user)}
                                                        className="text-[#676879] p-1.5 hover:bg-[#e6e9ef] rounded-md transition-all"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void deleteSystemUser(user)}
                                                        className="text-[#e2445c] p-1.5 hover:bg-[#ffebef] rounded-md transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {filteredSystemUsers.length === 0 && (
                                    <div className="p-8 text-center text-[#676879]">ไม่พบผู้ใช้ระบบ</div>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-[#e6e9ef]">
                                {filteredTeamMembers.map((member) => {
                                    const load = loadByMemberName.get(member.name) || { taskCount: 0, assignedHours: 0 };
                                    const capacity = member.capacityHoursPerWeek ?? 40;
                                    const overloaded = load.assignedHours > capacity;

                                    return (
                                        <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-[#f8fafc] transition-colors group gap-3">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {editingMemberId === member.id ? (
                                                    <div className="shrink-0">
                                                        <input type="file" accept="image/*" ref={editAvatarRef} onChange={handleEditAvatarUpload} className="hidden" />
                                                        <button onClick={() => editAvatarRef.current?.click()} className="relative group/avatar" title="เปลี่ยนรูป">
                                                            {(editingData.avatar || member.avatar) ? (
                                                                <div className="relative">
                                                                    <img src={editingData.avatar || member.avatar} alt={member.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border-2 border-[#0073ea] shadow-sm" />
                                                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Camera className="w-3.5 h-3.5 text-white" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-[#e6e9ef] border-2 border-dashed border-[#0073ea] flex items-center justify-center text-[#0073ea]"><Camera className="w-4 h-4" /></div>
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="shrink-0 relative group/avatar">
                                                        <input type="file" accept="image/*" className="hidden" id={`avatar-upload-${member.id}`} onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) await handleAvatarChangeForMember(member.id, file);
                                                            e.target.value = '';
                                                        }} />
                                                        <label htmlFor={`avatar-upload-${member.id}`} className="cursor-pointer block relative">
                                                            <AvatarDisplay member={member} size={40} />
                                                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-white" /></div>
                                                        </label>
                                                    </div>
                                                )}

                                                {editingMemberId === member.id ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-6 flex-1 px-2 gap-2 items-center">
                                                        <input value={editingData.name || ''} onChange={(e) => setEditingData({ ...editingData, name: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="ชื่อ" />
                                                        <select
                                                            value={editingData.memberType === 'crew' ? 'crew' : 'team'}
                                                            onChange={(e) => setEditingData({ ...editingData, memberType: e.target.value as MemberType })}
                                                            className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none"
                                                        >
                                                            <option value="team">ทีมงาน</option>
                                                            <option value="crew">ทีมช่าง</option>
                                                        </select>
                                                        <input value={editingData.position || ''} onChange={(e) => setEditingData({ ...editingData, position: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="ตำแหน่ง" />
                                                        <input value={editingData.department || ''} onChange={(e) => setEditingData({ ...editingData, department: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="แผนก" />
                                                        <input value={editingData.phone || ''} onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="เบอร์โทร" />
                                                        <input type="number" min="1" max="168" value={editingData.capacityHoursPerWeek ?? 40} onChange={(e) => setEditingData({ ...editingData, capacityHoursPerWeek: Number.parseInt(e.target.value, 10) || 40 })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="ชั่วโมงทำงาน" />
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-7 flex-1 px-2 gap-2 items-center min-w-0">
                                                        <div className="font-medium text-[#323338] min-w-0 flex items-center gap-2">
                                                            <span className="truncate">{member.name}</span>
                                                            {member.lineUserId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleLineBadgeClick(member)}
                                                                    disabled={lineActionMemberId === member.id}
                                                                    title={member.lineUserId ? 'เชื่อมโยง LINE แล้ว' : 'ยังไม่เชื่อมโยง LINE'}
                                                                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#e6faef] text-[#00a66a] border border-[#b8ebd2] px-2 py-0.5 text-[10px] font-bold hover:bg-[#d9f5e8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                                                >
                                                                    {lineActionMemberId === member.id ? (
                                                                        <>
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ...
                                                                        </>
                                                                    ) : lineCopiedMemberId === member.id ? (
                                                                        <>
                                                                            <Check className="w-3 h-3" />
                                                                            คัดลอกแล้ว
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            LINE
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getMemberTypeBadgeClass(getMemberType(member))}`}>
                                                                {getMemberTypeLabel(getMemberType(member))}
                                                            </span>
                                                        </div>
                                                        <div className="text-[#676879] text-sm truncate">{member.position}</div>
                                                        <div className="text-[#676879] text-sm truncate">{member.department}</div>
                                                        <div className="text-[#676879] text-sm truncate">{member.phone}</div>
                                                        <div className="text-[#676879] text-sm truncate">{capacity} ชม./สัปดาห์</div>
                                                        <div className={`text-sm font-semibold truncate ${overloaded ? 'text-[#e2445c]' : 'text-[#0052cc]'}`}>
                                                            {load.assignedHours} ชม. • กำลังทำ {load.taskCount} งาน
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                                {editingMemberId === member.id ? (
                                                    <>
                                                        <button onClick={saveEditingMember} className="text-[#00c875] p-2 hover:bg-[#e6faef] rounded-md transition-all"><Check className="w-5 h-5" /></button>
                                                        <button onClick={cancelEditingMember} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all"><X className="w-5 h-5" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEditingMember(member)} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100"><Edit2 className="w-5 h-5" /></button>
                                                        <button onClick={() => openDeleteModal(member)} className="text-[#e2445c] p-2 hover:bg-[#ffebef] rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredTeamMembers.length === 0 && (
                                    <div className="p-8 text-center text-[#676879]">
                                        {memberTab === 'team' ? 'ไม่พบผู้รับผิดชอบ' : 'ไม่พบทีมช่าง'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {pendingDeleteMember && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-xl border border-[#d0d4e4] shadow-2xl">
                        <div className="px-5 py-4 border-b border-[#e6e9ef]">
                            <h3 className="text-[18px] font-bold text-[#323338]">ยืนยันการลบ</h3>
                        </div>
                        <div className="px-5 py-4 text-[14px] text-[#323338] space-y-2">
                            <p>
                                ลบสมาชิก <span className="font-semibold">{pendingDeleteMember.name}</span> หรือไม่?
                            </p>
                            <p className="text-[#676879] text-[13px]">
                                งานที่เกี่ยวข้องจะถูกอัปเดตเพื่อลบผู้รับผิดชอบคนนี้ออก
                            </p>
                            <p className="text-[#676879] text-[13px]">
                                จำนวนงานที่ได้รับผลกระทบ: <span className="font-semibold text-[#323338]">{pendingDeleteImpactCount}</span>
                            </p>
                        </div>
                        <div className="px-5 py-4 border-t border-[#e6e9ef] flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isDeletingMember}
                                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef] disabled:opacity-60"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDeleteMember()}
                                disabled={isDeletingMember}
                                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#e2445c] text-white hover:bg-[#c9344b] disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                                {isDeletingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                ลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


