'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Camera, ImagePlus, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { SystemUserAccount, SystemUserRole, Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';

interface UserManagementViewProps {
    teamMembers: TeamMember[];
    systemUsers: SystemUserAccount[];
    tasks: Task[];
    branchOptions: Array<{ id: string; label: string }>;
    departmentOptions: Array<{ id: string; label: string; branchId?: string }>;
    onAddMember: (member: TeamMember) => Promise<void> | void;
    onUpdateMember: (memberId: string, patch: Partial<TeamMember>) => Promise<void> | void;
    onDeleteMember: (memberId: string) => Promise<void> | void;
    onAddSystemUser: (payload: {
        id?: string;
        username: string;
        email: string;
        displayName: string;
        authProvider: SystemUserAccount['authProvider'];
        password?: string;
        role?: SystemUserRole;
        phone?: string;
        lineUserId?: string;
    }) => Promise<void> | void;
    onUpdateSystemUser: (userId: string, patch: Partial<SystemUserAccount> & { password?: string }) => Promise<void> | void;
    onDeleteSystemUser: (userId: string) => Promise<void> | void;
}

type MemberType = 'team' | 'crew';
type MemberTab = MemberType | 'system';

const getMemberType = (member: TeamMember): MemberType => (
    member.memberType === 'crew' ? 'crew' : 'team'
);

const getMemberTypeLabel = (memberType: MemberType): string => (
    memberType === 'crew' ? 'พนักงานชั่วคราว' : 'พนักงานประจำ'
);

const getMemberTypeBadgeClass = (memberType: MemberType): string => (
    memberType === 'crew'
        ? 'bg-[#fff3e0] text-[#ad6800] border-[#ffd69b]'
        : 'bg-[#eef4ff] text-[#0052cc] border-[#c9ddff]'
);

const normalizeMemberName = (name: string): string => name.trim().toLowerCase();

const SYSTEM_ROLE_OPTIONS: Array<{ value: SystemUserRole; label: string }> = [
    { value: 'super_admin', label: 'ผู้ดูแลระบบ' },
    { value: 'branch_manager', label: 'ผู้จัดการสาขา' },
    { value: 'department_manager', label: 'ผู้จัดการแผนก' },
    { value: 'staff', label: 'พนักงาน' },
    { value: 'viewer', label: 'ผู้ดูข้อมูล' },
];

const getSystemRoleLabel = (role?: SystemUserRole): string => (
    SYSTEM_ROLE_OPTIONS.find((option) => option.value === role)?.label || 'พนักงาน'
);

export default function UserManagementView({
    teamMembers,
    systemUsers,
    tasks,
    branchOptions,
    departmentOptions,
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
    const [newMemberBranchId, setNewMemberBranchId] = useState('');
    const [newMemberDepartmentId, setNewMemberDepartmentId] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberLineUserId, setNewMemberLineUserId] = useState('');
    const [newMemberCapacity, setNewMemberCapacity] = useState('48');
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
    const [newSystemPassword, setNewSystemPassword] = useState('');
    const [newSystemRole, setNewSystemRole] = useState<SystemUserRole>('staff');
    const [editingSystemUserId, setEditingSystemUserId] = useState<string | null>(null);
    const [editingSystemData, setEditingSystemData] = useState<Partial<SystemUserAccount>>({});
    const [editingSystemPassword, setEditingSystemPassword] = useState('');
    const [systemLineActionUserId, setSystemLineActionUserId] = useState<string | null>(null);
    const [systemLineCopiedUserId, setSystemLineCopiedUserId] = useState<string | null>(null);

    const newAvatarRef = useRef<HTMLInputElement>(null);
    const editAvatarRef = useRef<HTMLInputElement>(null);

    const branchLabelById = useMemo(
        () => new Map(branchOptions.map((option) => [option.id, option.label])),
        [branchOptions]
    );
    const departmentLabelById = useMemo(
        () => new Map(departmentOptions.map((option) => [option.id, option.label])),
        [departmentOptions]
    );
    const getMemberBranchLabel = (member: Partial<TeamMember>) => (
        branchLabelById.get(member.branchId || '') || member.position || member.branchId || '-'
    );
    const getMemberDepartmentLabel = (member: Partial<TeamMember>) => (
        departmentLabelById.get(member.departmentId || '') || member.department || member.departmentId || '-'
    );
    const getDepartmentOptionsForBranch = (branchId?: string) => (
        departmentOptions.filter((option) => !option.branchId || option.branchId === branchId)
    );

    const newMemberDepartmentOptions = useMemo(
        () => departmentOptions.filter((option) => !option.branchId || option.branchId === newMemberBranchId),
        [departmentOptions, newMemberBranchId]
    );
    const editingMemberDepartmentOptions = useMemo(
        () => departmentOptions.filter((option) => !option.branchId || option.branchId === editingData.branchId),
        [departmentOptions, editingData.branchId]
    );

    useEffect(() => {
        if (!newMemberBranchId && branchOptions.length > 0) {
            setNewMemberBranchId(branchOptions[0].id);
            return;
        }
        if (!newMemberDepartmentOptions.some((option) => option.id === newMemberDepartmentId)) {
            setNewMemberDepartmentId(newMemberDepartmentOptions[0]?.id || '');
        }
    }, [branchOptions, newMemberBranchId, newMemberDepartmentId, newMemberDepartmentOptions]);

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
            const memberBranchLabel = branchLabelById.get(member.branchId || '') || member.position || member.branchId || '';
            const memberDepartmentLabel = departmentLabelById.get(member.departmentId || '') || member.department || member.departmentId || '';
            return (
                member.name.toLowerCase().includes(q)
                || memberBranchLabel.toLowerCase().includes(q)
                || memberDepartmentLabel.toLowerCase().includes(q)
                || (member.phone || '').toLowerCase().includes(q)
                || getMemberTypeLabel(getMemberType(member)).toLowerCase().includes(q)
            );
        });
    }, [searchQuery, teamMembers, memberTab, branchLabelById, departmentLabelById]);

    const filteredSystemUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (memberTab !== 'system') return [];
        return systemUsers.filter((user) => (
            user.displayName.toLowerCase().includes(q)
            || user.username.toLowerCase().includes(q)
            || user.email.toLowerCase().includes(q)
            || user.authProvider.toLowerCase().includes(q)
            || getSystemRoleLabel(user.role).toLowerCase().includes(q)
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
        if (!newMemberBranchId || !newMemberDepartmentId) {
            void modal.alert('กรุณาเลือกสาขาและแผนก', { variant: 'warning' });
            return;
        }
        const normalizedName = normalizeMemberName(newMemberName);
        const duplicated = teamMembers.some((member) => normalizeMemberName(member.name) === normalizedName);
        if (duplicated) {
            void modal.alert('มีชื่อพนักงานนี้อยู่แล้ว โปรดใช้ชื่ออื่น', { variant: 'warning' });
            return;
        }

        const branchLabel = branchLabelById.get(newMemberBranchId) || newMemberBranchId;
        const departmentLabel = departmentLabelById.get(newMemberDepartmentId) || newMemberDepartmentId;

        const newMember: TeamMember = {
            id: `u-${Date.now()}`,
            name: newMemberName.trim(),
            memberType: newMemberType,
            branchId: newMemberBranchId,
            departmentId: newMemberDepartmentId,
            position: branchLabel,
            department: departmentLabel,
            phone: newMemberPhone.trim() || '-',
            lineUserId: newMemberLineUserId.trim() || undefined,
            capacityHoursPerWeek: Number.parseInt(newMemberCapacity, 10) || 48,
            avatar: newMemberAvatar || undefined,
        };

        void onAddMember(newMember);
        setNewMemberName('');
        setNewMemberBranchId(branchOptions[0]?.id || '');
        setNewMemberDepartmentId('');
        setNewMemberPhone('');
        setNewMemberLineUserId('');
        setNewMemberCapacity('48');
        setNewMemberType('team');
        setNewMemberAvatar('');
        setIsAddModalOpen(false);
    };

    const startEditingMember = (member: TeamMember) => {
        const nextBranchId = member.branchId || branchOptions[0]?.id || '';
        const nextDepartmentOptions = getDepartmentOptionsForBranch(nextBranchId);
        const nextDepartmentId = nextDepartmentOptions.some((option) => option.id === member.departmentId)
            ? (member.departmentId || '')
            : (nextDepartmentOptions[0]?.id || '');
        setEditingMemberId(member.id);
        setEditingData({
            ...member,
            branchId: nextBranchId,
            departmentId: nextDepartmentId,
        });
    };

    const saveEditingMember = () => {
        if (!editingMemberId || !editingData.name?.trim()) return;
        const normalizedName = normalizeMemberName(editingData.name);
        const duplicated = teamMembers.some(
            (member) => member.id !== editingMemberId && normalizeMemberName(member.name) === normalizedName
        );
        if (duplicated) {
            alert('มีชื่อพนักงานนี้อยู่แล้ว โปรดใช้ชื่ออื่น');
            return;
        }
        const branchId = editingData.branchId || branchOptions[0]?.id || '';
        const departmentOptionsForBranch = getDepartmentOptionsForBranch(branchId);
        const departmentId = departmentOptionsForBranch.some((option) => option.id === editingData.departmentId)
            ? (editingData.departmentId || '')
            : (departmentOptionsForBranch[0]?.id || '');
        if (!branchId || !departmentId) {
            void modal.alert('กรุณาเลือกสาขาและแผนก', { variant: 'warning' });
            return;
        }
        const patch: Partial<TeamMember> = {
            ...editingData,
            name: editingData.name.trim(),
            memberType: editingData.memberType === 'crew' ? 'crew' : 'team',
            branchId,
            departmentId,
            position: branchLabelById.get(branchId) || branchId,
            department: departmentLabelById.get(departmentId) || departmentId,
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

    const AvatarDisplay = ({ member, size = 40, className = '' }: { member: TeamMember | { name: string; avatar?: string }; size?: number; className?: string }) => {
        const [imageFailed, setImageFailed] = useState(false);
        return member.avatar && !imageFailed ? (
            <img
                src={member.avatar}
                alt={member.name}
                referrerPolicy="no-referrer"
                className={`rounded-full object-cover border-2 border-white shadow-sm ${className}`}
                style={{ width: size, height: size }}
                onError={() => setImageFailed(true)}
            />
        ) : (
            <div
                className={`rounded-full bg-[#cce5ff] border border-[#0052cc]/20 flex items-center justify-center text-[#0052cc] font-medium shrink-0 ${className}`}
                style={{ width: size, height: size, fontSize: size * 0.35 }}
            >
                {member.name.substring(0, 2).toUpperCase()}
            </div>
        );
    };

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
            console.error('Failed to copy LINE user ID:', error);
            void modal.error('คัดลอกไอดีผู้ใช้ LINE ไม่สำเร็จ โปรดลองอีกครั้ง');
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
            console.error('Failed to copy system user LINE user ID:', error);
            void modal.error('คัดลอกไอดีผู้ใช้ LINE ไม่สำเร็จ โปรดลองอีกครั้ง');
        } finally {
            setSystemLineActionUserId(null);
        }
    };

    const handleAddSystemUserSubmit = async () => {
        const displayName = newSystemDisplayName.trim();
        const username = newSystemUsername.trim().toLowerCase();
        const email = newSystemEmail.trim().toLowerCase();
        if (!displayName || !username || !email) {
            void modal.alert('กรุณากรอกชื่อที่แสดง ชื่อผู้ใช้ และอีเมล', { variant: 'warning' });
            return;
        }
        if (newSystemProvider === 'password' && newSystemPassword.trim().length < 6) {
            void modal.alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', { variant: 'warning' });
            return;
        }

        const duplicated = systemUsers.some((user) =>
            user.username.toLowerCase() === username || user.email.toLowerCase() === email
        );
        if (duplicated) {
            void modal.alert('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว', { variant: 'warning' });
            return;
        }

        await Promise.resolve(onAddSystemUser({
            displayName,
            username,
            email,
            authProvider: newSystemProvider,
            password: newSystemProvider === 'password' ? newSystemPassword.trim() : '',
            role: newSystemRole,
            phone: newSystemPhone.trim(),
            lineUserId: newSystemLineUserId.trim(),
        }));

        setNewSystemDisplayName('');
        setNewSystemUsername('');
        setNewSystemEmail('');
        setNewSystemPhone('');
        setNewSystemLineUserId('');
        setNewSystemProvider('password');
        setNewSystemPassword('');
        setNewSystemRole('staff');
        setIsAddModalOpen(false);
    };

    const startEditingSystemUser = (user: SystemUserAccount) => {
        setEditingSystemUserId(user.id);
        setEditingSystemData({
            ...user,
            role: user.role || 'staff',
        });
        setEditingSystemPassword('');
    };

    const cancelEditingSystemUser = () => {
        setEditingSystemUserId(null);
        setEditingSystemData({});
        setEditingSystemPassword('');
    };

    const saveEditingSystemUser = async () => {
        if (!editingSystemUserId) return;
        const displayName = (editingSystemData.displayName || '').trim();
        const username = (editingSystemData.username || '').trim().toLowerCase();
        const email = (editingSystemData.email || '').trim().toLowerCase();
        if (!displayName || !username || !email) {
            void modal.alert('กรุณากรอกชื่อที่แสดง ชื่อผู้ใช้ และอีเมล', { variant: 'warning' });
            return;
        }

        const duplicated = systemUsers.some((user) =>
            user.id !== editingSystemUserId
            && (user.username.toLowerCase() === username || user.email.toLowerCase() === email)
        );
        if (duplicated) {
            void modal.alert('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว', { variant: 'warning' });
            return;
        }

        if (editingSystemData.authProvider !== 'line' && editingSystemPassword.trim() && editingSystemPassword.trim().length < 6) {
            void modal.alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', { variant: 'warning' });
            return;
        }

        await Promise.resolve(onUpdateSystemUser(editingSystemUserId, {
            displayName,
            username,
            email,
            phone: (editingSystemData.phone || '').trim(),
            lineUserId: (editingSystemData.lineUserId || '').trim(),
            authProvider: editingSystemData.authProvider === 'line' ? 'line' : 'password',
            role: editingSystemData.role || 'staff',
            lastLoginAt: editingSystemData.lastLoginAt,
            password: editingSystemData.authProvider === 'line' ? '' : editingSystemPassword.trim(),
        }));
        setEditingSystemUserId(null);
        setEditingSystemData({});
        setEditingSystemPassword('');
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
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">พนักงาน</div>
                            <div className="text-2xl font-black text-[#323338] mt-1">{summary.members}</div>
                            <div className="text-[11px] text-[#676879] mt-1">พนักงานประจำ {summary.teamCount} • พนักงานชั่วคราว {summary.crewCount} • ผู้ใช้ระบบ {summary.systemUsers}</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ขีดจำกัดชั่วโมงรวม</div>
                            <div className="text-2xl font-black text-[#00c875] mt-1">{summary.totalCapacity} ชม.</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ชั่วโมงที่มอบหมาย</div>
                            <div className="text-2xl font-black text-[#0073ea] mt-1">{summary.totalAssigned} ชม.</div>
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
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-semibold text-[#323338]">รายการผู้ใช้</h2>
                                    <button onClick={() => setIsAddModalOpen(true)} className="bg-[#0073ea] hover:bg-[#0060c0] text-white px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                                        <Plus className="w-4 h-4" /> เพิ่มพนักงาน / ผู้ใช้ระบบ
                                    </button>
                                </div>
                                <div className="relative w-full lg:w-[320px]">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#a0a2b1]" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="ค้นหาผู้ใช้..."
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#d0d4e4] bg-white w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('team')}
                                    className={memberTab === 'team' ? 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors bg-[#0073ea] text-white' : 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors text-[#676879] hover:bg-[#f5f6f8]'}
                                >
                                    พนักงานประจำ ({summary.teamCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('crew')}
                                    className={memberTab === 'crew' ? 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors bg-[#fdab3d] text-white' : 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors text-[#676879] hover:bg-[#f5f6f8]'}
                                >
                                    พนักงานชั่วคราว ({summary.crewCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('system')}
                                    className={memberTab === 'system' ? 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors bg-[#334155] text-white' : 'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors text-[#676879] hover:bg-[#f5f6f8]'}
                                >
                                    ผู้ใช้ระบบ ({summary.systemUsers})
                                </button>
                            </div>
                        </div>

                        {memberTab === 'system' ? (
                            <div className="divide-y divide-[#e6e9ef]">
                                {filteredSystemUsers.map((user) => {
                                    const currentRoleLabel = getSystemRoleLabel(user.role);
                                    const providerBadgeClass = user.authProvider === 'password'
                                        ? 'inline-flex items-center rounded-full border border-[#c9ddff] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold text-[#0052cc]'
                                        : 'inline-flex items-center rounded-full border border-[#b8ebd2] bg-[#e6faef] px-2 py-0.5 text-[10px] font-bold text-[#008a59]';

                                    return (
                                        <div key={user.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-[#f8fafc]">
                                            <div className="flex items-start gap-4 min-w-0 flex-1">
                                                <div className="w-[44px] h-[44px] bg-[#eef4ff] text-[#0052cc] rounded-full flex items-center justify-center font-bold text-[18px] shrink-0 uppercase">
                                                    {(user.displayName || user.username || 'U').charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-2">
                                                    <div className="space-y-2 min-w-0 flex flex-col justify-center">
                                                {editingSystemUserId === user.id ? (
                                                    <>
                                                        <input value={editingSystemData.displayName || ''} onChange={(e) => setEditingSystemData({ ...editingSystemData, displayName: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ชื่อที่แสดง" />
                                                        <input value={editingSystemData.username || ''} onChange={(e) => setEditingSystemData({ ...editingSystemData, username: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ชื่อผู้ใช้" />
                                                        <input value={editingSystemData.email || ''} onChange={(e) => setEditingSystemData({ ...editingSystemData, email: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="อีเมล" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-[15px] font-semibold text-[#323338] truncate">{user.displayName || '-'}</div>
                                                        <div className="text-[13px] text-[#676879] truncate">{user.username || '-'}</div>
                                                        <div className="text-[13px] text-[#676879] truncate">{user.email || '-'}</div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="space-y-2 min-w-0 text-[13px] text-[#676879]">
                                                {editingSystemUserId === user.id ? (
                                                    <>
                                                        <input value={editingSystemData.phone || ''} onChange={(e) => setEditingSystemData({ ...editingSystemData, phone: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="เบอร์โทร" />
                                                        <input value={editingSystemData.lineUserId || ''} onChange={(e) => setEditingSystemData({ ...editingSystemData, lineUserId: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ไอดีผู้ใช้ LINE" />
                                                        <input type="password" value={editingSystemPassword} onChange={(e) => setEditingSystemPassword(e.target.value)} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none disabled:bg-[#f5f6f8] disabled:text-[#98a2b3]" placeholder={editingSystemData.authProvider === 'line' ? 'รหัสผ่าน (เฉพาะผู้ใช้/รหัสผ่าน)' : 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)'} disabled={editingSystemData.authProvider === 'line'} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>เบอร์โทร: {user.phone || '-'}</div>
                                                        <div>LINE: {user.lineUserId || '-'}</div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="space-y-2 min-w-0 text-[13px] text-[#676879]">
                                                {editingSystemUserId === user.id ? (
                                                    <>
                                                        <select value={editingSystemData.role || 'staff'} onChange={(e) => setEditingSystemData({ ...editingSystemData, role: e.target.value as SystemUserRole })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none">
                                                            {SYSTEM_ROLE_OPTIONS.map((option) => (
                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                        <select value={editingSystemData.authProvider === 'line' ? 'line' : 'password'} onChange={(e) => {
                                                            const nextProvider = e.target.value as SystemUserAccount['authProvider'];
                                                            setEditingSystemData({ ...editingSystemData, authProvider: nextProvider });
                                                            if (nextProvider === 'line') {
                                                                setEditingSystemPassword('');
                                                            }
                                                        }} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none">
                                                            <option value="password">ผู้ใช้/รหัสผ่าน</option>
                                                            <option value="line">LINE</option>
                                                        </select>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>หน้าที่: {currentRoleLabel}</div>
                                                        <div><span className={providerBadgeClass}>{user.authProvider === 'password' ? 'ผู้ใช้/รหัสผ่าน' : 'LINE'}</span></div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="space-y-2 text-[13px] text-[#676879] flex flex-col justify-center">
                                                <div>เข้าสู่ระบบล่าสุด: <span className="font-medium text-[#323338]">{formatDateTime(user.lastLoginAt)}</span></div>
                                                <div>วันที่สร้าง: {formatDateTime(user.createdAt)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
                                                {editingSystemUserId === user.id ? (
                                                    <>
                                                        <button type="button" onClick={() => void saveEditingSystemUser()} className="text-[#00c875] p-1.5 hover:bg-[#e6faef] rounded-md transition-all"><Check className="w-4 h-4" /></button>
                                                        <button type="button" onClick={cancelEditingSystemUser} className="text-[#676879] p-1.5 hover:bg-[#e6e9ef] rounded-md transition-all"><X className="w-4 h-4" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => startEditingSystemUser(user)} className="text-[#676879] p-1.5 hover:bg-[#e6e9ef] rounded-md transition-all"><Edit2 className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => void deleteSystemUser(user)} className="text-[#e2445c] p-1.5 hover:bg-[#ffebef] rounded-md transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredSystemUsers.length === 0 && <div className="p-8 text-center text-[#676879]">ไม่พบผู้ใช้ระบบ</div>}
                            </div>
                        ) : (
                            <div className="divide-y divide-[#e6e9ef]">
                                {filteredTeamMembers.map((member) => {
                                    const load = loadByMemberName.get(member.name) || { taskCount: 0, assignedHours: 0 };
                                    const capacity = member.capacityHoursPerWeek ?? 40;
                                    const overloaded = load.assignedHours > capacity;

                                    return (
                                        <div key={member.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-[#f8fafc]">
                                            <div className="flex items-start gap-4 min-w-0 flex-1">
                                                <AvatarDisplay member={editingMemberId === member.id ? { name: editingData.name || member.name, avatar: editingData.avatar || member.avatar } : member} size={44} />
                                                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-2">
                                                    {editingMemberId === member.id ? (
                                                        <>
                                                            <input value={editingData.name || ''} onChange={(e) => setEditingData({ ...editingData, name: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ชื่อ" />
                                                            <select value={editingData.memberType === 'crew' ? 'crew' : 'team'} onChange={(e) => setEditingData({ ...editingData, memberType: e.target.value as MemberType })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none">
                                                                <option value="team">พนักงานประจำ</option>
                                                                <option value="crew">พนักงานชั่วคราว</option>
                                                            </select>
                                                            <select
                                                                value={editingData.branchId || ''}
                                                                onChange={(e) => {
                                                                    const nextBranchId = e.target.value;
                                                                    const nextDepartmentOptions = getDepartmentOptionsForBranch(nextBranchId);
                                                                    setEditingData({
                                                                        ...editingData,
                                                                        branchId: nextBranchId,
                                                                        departmentId: nextDepartmentOptions.some((option) => option.id === editingData.departmentId)
                                                                            ? editingData.departmentId
                                                                            : (nextDepartmentOptions[0]?.id || ''),
                                                                    });
                                                                }}
                                                                className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none"
                                                            >
                                                                {branchOptions.map((option) => (
                                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                            <select value={editingData.departmentId || ''} onChange={(e) => setEditingData({ ...editingData, departmentId: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none">
                                                                {editingMemberDepartmentOptions.map((option) => (
                                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                            <input value={editingData.phone || ''} onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="เบอร์โทร" />
                                                            <input value={editingData.lineUserId || ''} onChange={(e) => setEditingData({ ...editingData, lineUserId: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ไอดีผู้ใช้ LINE" />
                                                            <input type="number" min="1" max="168" value={String(editingData.capacityHoursPerWeek ?? capacity)} onChange={(e) => setEditingData({ ...editingData, capacityHoursPerWeek: Number.parseInt(e.target.value, 10) || 40 })} className="w-full bg-white border border-[#0073ea] rounded px-3 py-2 text-[13px] outline-none" placeholder="ชั่วโมงทำงาน / สัปดาห์" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                <div className="text-[14px] font-semibold text-[#323338] truncate">{member.name}</div>
                                                                <div className="text-[12px] text-[#0073ea] font-medium mt-0.5">{getMemberTypeLabel(getMemberType(member))}</div>
                                                            </div>
                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                <div className="text-[13px] text-[#323338] truncate font-medium">{getMemberBranchLabel(member)}</div>
                                                                <div className="text-[12px] text-[#676879] truncate mt-0.5">{getMemberDepartmentLabel(member)}</div>
                                                            </div>
                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                <div className="text-[12px] text-[#676879] truncate">เบอร์โทร: <span className="text-[13px] text-[#323338] font-medium">{member.phone || '-'}</span></div>
                                                                <div className="text-[12px] text-[#676879] truncate mt-0.5">LINE: <span className="text-[13px] text-[#00b900] font-medium">{member.lineUserId || '-'}</span></div>
                                                            </div>
                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                <div className="text-[12px] text-[#676879] truncate">กำลังรับงาน: <span className="text-[#323338] font-medium">{capacity} ชม./สัปดาห์</span></div>
                                                                <div className={overloaded ? 'text-[12px] font-semibold truncate text-[#e2445c] mt-0.5' : 'text-[12px] font-medium truncate text-[#0052cc] mt-0.5'}>สัปดาห์นี้รับแล้ว: {load.assignedHours} ชม. ({load.taskCount} งาน)</div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
                                                {editingMemberId === member.id ? (
                                                    <>
                                                        <button type="button" onClick={saveEditingMember} className="text-[#00c875] p-2 hover:bg-[#e6faef] rounded-md transition-all"><Check className="w-5 h-5" /></button>
                                                        <button type="button" onClick={cancelEditingMember} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all"><X className="w-5 h-5" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => startEditingMember(member)} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all"><Edit2 className="w-5 h-5" /></button>
                                                        <button type="button" onClick={() => openDeleteModal(member)} className="text-[#e2445c] p-2 hover:bg-[#ffebef] rounded-md transition-all"><Trash2 className="w-5 h-5" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredTeamMembers.length === 0 && <div className="p-8 text-center text-[#676879]">ไม่พบพนักงาน</div>}
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
                                ลบพนักงาน <span className="font-semibold">{pendingDeleteMember.name}</span> หรือไม่?
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
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#e6e9ef] flex items-center justify-between bg-[#fdfdfe]">
                            <h3 className="text-[18px] font-bold text-[#323338]">เพิ่มผู้ใช้ระบบ หรือพนักงานใหม่</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-[#676879] hover:bg-[#f5f6f8] p-1.5 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-5 overflow-y-auto">
                            <div className="flex gap-2 p-1 bg-[#f5f6f8] rounded-lg mb-6 w-fit mx-auto border border-[#e6e9ef]">
                                <button type="button" onClick={() => setMemberTab('team')} className={memberTab !== 'system' ? "px-5 py-1.5 rounded-md bg-white shadow-sm text-sm font-semibold text-[#0073ea]" : "px-5 py-1.5 rounded-md text-sm font-semibold text-[#676879] hover:bg-black/5 transition-colors"}>พนักงาน (ช่าง/ทีม)</button>
                                <button type="button" onClick={() => setMemberTab('system')} className={memberTab === 'system' ? "px-5 py-1.5 rounded-md bg-white shadow-sm text-sm font-semibold text-[#0073ea]" : "px-5 py-1.5 rounded-md text-sm font-semibold text-[#676879] hover:bg-black/5 transition-colors"}>ผู้ดูแลระบบ (แอดมิน)</button>
                            </div>

                            {memberTab !== 'system' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-center mb-4">
                                        <div className="shrink-0 relative">
                                            <input type="file" accept="image/*" ref={newAvatarRef} onChange={handleNewAvatarUpload} className="hidden" />
                                            <button onClick={() => newAvatarRef.current?.click()} className="relative group" title="อัปโหลดรูปภาพ">
                                                {newMemberAvatar ? (
                                                    <div className="relative">
                                                        <img src={newMemberAvatar} alt="รูปพนักงานใหม่" className="w-[80px] h-[80px] rounded-full object-cover border-2 border-[#0073ea] shadow-sm" />
                                                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Camera className="w-6 h-6 text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-[80px] h-[80px] rounded-full bg-[#fdfdfe] border-2 border-dashed border-[#a0a2b1] flex items-center justify-center text-[#a0a2b1] hover:border-[#0073ea] hover:bg-[#f5f6f8] transition-colors shadow-sm">
                                                        <ImagePlus className="w-8 h-8" />
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ประเภทพนักงาน</label>
                                            <select value={newMemberType} onChange={(e) => setNewMemberType(e.target.value as MemberType)} className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm">
                                                <option value="team">พนักงานประจำ</option>
                                                <option value="crew">พนักงานชั่วคราว</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ชื่อ - นามสกุล</label>
                                            <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="ชื่อพนักงาน" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">สาขาหน่วยงาน</label>
                                            <select value={newMemberBranchId} onChange={(e) => setNewMemberBranchId(e.target.value)} className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm">
                                                {branchOptions.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">แผนก / รหัสสายงาน</label>
                                            <select value={newMemberDepartmentId} onChange={(e) => setNewMemberDepartmentId(e.target.value)} className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm">
                                                {newMemberDepartmentOptions.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">เบอร์โทรศัพท์ติดต่อ (ถ้ามี)</label>
                                            <input value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="ตัวอย่าง: 08x-xxxxxxx" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ไอดี LINE (เพื่อรับการแจ้งเตือน)</label>
                                            <input value={newMemberLineUserId} onChange={(e) => setNewMemberLineUserId(e.target.value)} placeholder="LINE User ID (U...)" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5 md:col-span-2">
                                            <label className="text-[12px] font-medium text-[#323338]">ความสามารถในการรับงาน (ชั่วโมง/สัปดาห์)</label>
                                            <input type="number" min="1" max="168" value={newMemberCapacity} onChange={(e) => setNewMemberCapacity(e.target.value)} placeholder="ค่าเริ่มต้น: 48" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ชื่อ-นามสกุล ที่แสดง</label>
                                            <input value={newSystemDisplayName} onChange={(e) => setNewSystemDisplayName(e.target.value)} placeholder="ชื่อบุคคล หรือ นิติบุคคล" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ชื่อผู้เข้าใช้ (Username)</label>
                                            <input value={newSystemUsername} onChange={(e) => setNewSystemUsername(e.target.value)} placeholder="Username" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">อีเมลหลัก</label>
                                            <input value={newSystemEmail} onChange={(e) => setNewSystemEmail(e.target.value)} placeholder="test@example.com" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">เบอร์โทรศัพท์ติดต่อ</label>
                                            <input value={newSystemPhone} onChange={(e) => setNewSystemPhone(e.target.value)} placeholder="08x-xxxxxxx" className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ประเภทการล็อกอิน</label>
                                            <select value={newSystemProvider} onChange={(e) => {
                                                const nextProvider = e.target.value as SystemUserAccount['authProvider'];
                                                setNewSystemProvider(nextProvider);
                                                if (nextProvider === 'line') {
                                                    setNewSystemPassword('');
                                                }
                                            }} className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm">
                                                <option value="password">ใช้ชื่อผู้ใช้และรหัสผ่าน (ปกติ)</option>
                                                <option value="line">ใช้การล็อกอินผ่านบัญชีไลน์ (LINE)</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">รหัสผ่านเข้าใช้งาน</label>
                                            <input type="password" value={newSystemPassword} onChange={(e) => setNewSystemPassword(e.target.value)} placeholder={newSystemProvider === 'password' ? 'ไม่ต่ำกว่า 6 ตัวอักษร' : 'ไม่ต้องระบุ (ใช้การล็อกอินผ่านไลน์)'} disabled={newSystemProvider !== 'password'} className="w-full bg-[#fdfdfe] border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] disabled:bg-[#f5f6f8] disabled:text-[#a0a2b1] shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="bg-[#f5f6f8] rounded-xl p-4 border border-[#e6e9ef] grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">สิทธิ์การจัดการในระบบ</label>
                                            <select value={newSystemRole} onChange={(e) => setNewSystemRole(e.target.value as SystemUserRole)} className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm">
                                                {SYSTEM_ROLE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[12px] font-medium text-[#323338]">ไอดี LINE ส่วนตัวรับออโต้รีพอร์ต</label>
                                            <input value={newSystemLineUserId} onChange={(e) => setNewSystemLineUserId(e.target.value)} placeholder="LINE User ID (U...)" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[13px] shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-[#e6e9ef] bg-[#fdfdfe] flex items-center justify-end gap-3">
                            <button onClick={() => setIsAddModalOpen(false)} className="px-5 py-2 rounded-lg text-[13px] font-medium bg-white border border-[#d0d4e4] text-[#323338] hover:bg-[#f5f6f8] transition-colors shadow-sm">
                                ยกเลิก
                            </button>
                            {memberTab !== 'system' ? (
                                <button onClick={handleAddMember} disabled={!newMemberName.trim()} className="bg-[#0073ea] hover:bg-[#0060c0] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-[13px] font-medium transition-colors shadow-sm">
                                    บันทึกข้อมูลพนักงาน
                                </button>
                            ) : (
                                <button type="button" onClick={() => void handleAddSystemUserSubmit()} disabled={!newSystemDisplayName.trim() || !newSystemUsername.trim() || !newSystemEmail.trim() || (newSystemProvider === 'password' && newSystemPassword.trim().length < 6)} className="bg-[#334155] hover:bg-[#1f2937] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-[13px] font-medium transition-colors shadow-sm">
                                    บันทึกบัญชีผู้ดูแลระบบ
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

