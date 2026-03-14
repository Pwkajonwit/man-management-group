'use client';

import React, { useCallback, useEffect, useState } from 'react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import UserManagementView from '@/components/UserManagementView';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';
import {
    deleteTeamMember as fbDeleteTeamMember,
    deleteSystemUserAccount as fbDeleteSystemUserAccount,
    subscribeSystemUserAccounts,
    updateTeamMember as fbUpdateTeamMember,
    upsertSystemUserAccount,
    upsertTeamMember,
    updateTask as fbUpdateTask,
} from '@/lib/firestore';
import { SystemUserAccount, TeamMember } from '@/types/construction';
import {
    DEFAULT_BRANCH_ID,
    DEFAULT_DEPARTMENT_ID,
    DEFAULT_ORG_ID,
    DEFAULT_SYSTEM_USER_ROLE,
} from '@/lib/scope';

export default function UsersPage() {
    const {
        teamMembers,
        setTeamMembers,
        tasks,
        setTasks,
        loading,
        dataSource,
        scopeBranchId,
        scopeDepartmentId,
    } = useAppContext();
    const { user } = useAuth();
    const modal = useConfirmModal();
    const [systemUsers, setSystemUsers] = useState<SystemUserAccount[]>([]);
    const orgScopeId = user?.orgId || DEFAULT_ORG_ID;
    const branchScopeId = scopeBranchId !== 'all'
        ? scopeBranchId
        : (user?.branchIds?.[0] || user?.branchId || DEFAULT_BRANCH_ID);
    const departmentScopeId = scopeDepartmentId !== 'all'
        ? scopeDepartmentId
        : (user?.departmentIds?.[0] || user?.departmentId || DEFAULT_DEPARTMENT_ID);
    const normalizeIdList = useCallback((values: string[] | undefined, fallback: string) => {
        const normalized = Array.from(
            new Set((values || []).map((item) => item.trim()).filter(Boolean))
        );
        return normalized.length > 0 ? normalized : [fallback];
    }, []);

    useEffect(() => {
        if (dataSource !== 'firebase') return;

        const unsubscribe = subscribeSystemUserAccounts((users) => {
            setSystemUsers(users);
        });
        return () => unsubscribe();
    }, [dataSource]);

    const handleAddMember = useCallback(async (member: TeamMember) => {
        const scopedMember: TeamMember = {
            ...member,
            orgId: member.orgId || orgScopeId,
            branchId: member.branchId || branchScopeId,
            departmentId: member.departmentId || departmentScopeId,
        };
        setTeamMembers(prev => [...prev, scopedMember]);

        if (dataSource !== 'firebase') return;

        try {
            const { id, ...payload } = scopedMember;
            await upsertTeamMember(id, payload);
        } catch (error) {
            console.error('Failed to add team member:', error);
            setTeamMembers(prev => prev.filter(m => m.id !== scopedMember.id));
            void modal.error('ไม่สามารถเพิ่มสมาชิกทีมได้ โปรดลองอีกครั้ง');
        }
    }, [branchScopeId, dataSource, departmentScopeId, modal, orgScopeId, setTeamMembers]);

    const handleUpdateMember = useCallback(async (memberId: string, patch: Partial<TeamMember>) => {
        const currentMember = teamMembers.find(m => m.id === memberId);
        if (!currentMember) return;

        const updatedMember: TeamMember = { ...currentMember, ...patch };
        const oldName = currentMember.name;
        const newName = updatedMember.name;
        const nameChanged = oldName !== newName;
        const affectedTaskIds = tasks.filter(t => t.responsible === oldName).map(t => t.id);

        setTeamMembers(prev => prev.map(m => (m.id === memberId ? updatedMember : m)));
        if (nameChanged) {
            setTasks(prev => prev.map(t => (t.responsible === oldName ? { ...t, responsible: newName } : t)));
        }

        if (dataSource !== 'firebase') return;

        try {
            const memberPatch = { ...patch };
            delete memberPatch.id;
            await fbUpdateTeamMember(memberId, memberPatch);

            if (nameChanged && affectedTaskIds.length > 0) {
                await Promise.all(
                    affectedTaskIds.map(taskId => fbUpdateTask(taskId, { responsible: newName }))
                );
            }
        } catch (error) {
            console.error('Failed to update team member:', error);
            setTeamMembers(prev => prev.map(m => (m.id === memberId ? currentMember : m)));
            if (nameChanged) {
                setTasks(prev => prev.map(t => (t.responsible === newName ? { ...t, responsible: oldName } : t)));
            }
            void modal.error('ไม่สามารถอัปเดตสมาชิกทีมได้ โปรดลองอีกครั้ง');
        }
    }, [dataSource, modal, setTasks, setTeamMembers, tasks, teamMembers]);

    const handleDeleteMember = useCallback(async (memberId: string) => {
        const memberToDelete = teamMembers.find(m => m.id === memberId);
        if (!memberToDelete) return;

        const ownerName = memberToDelete.name;
        const affectedTasks = tasks
            .filter(t => t.responsible === ownerName || (t.assignedEmployeeIds || []).includes(memberId))
            .map((task) => {
                const remainingOwnerIds = (task.assignedEmployeeIds || []).filter(ownerId => ownerId !== memberId);
                const nextPrimaryOwner = remainingOwnerIds
                    .map(ownerId => teamMembers.find(member => member.id === ownerId)?.name)
                    .find((name): name is string => Boolean(name)) || '';
                const nextResponsible = task.responsible === ownerName ? nextPrimaryOwner : task.responsible || '';
                return {
                    taskId: task.id,
                    patch: {
                        responsible: nextResponsible,
                        assignedEmployeeIds: remainingOwnerIds,
                    },
                    previous: {
                        responsible: task.responsible || '',
                        assignedEmployeeIds: task.assignedEmployeeIds || [],
                    },
                };
            });

        const patchByTaskId = new Map(affectedTasks.map(item => [item.taskId, item.patch]));
        const previousByTaskId = new Map(affectedTasks.map(item => [item.taskId, item.previous]));

        setTeamMembers(prev => prev.filter(m => m.id !== memberId));
        if (affectedTasks.length > 0) {
            setTasks(prev => prev.map(task => {
                const patch = patchByTaskId.get(task.id);
                return patch ? { ...task, ...patch } : task;
            }));
        }

        if (dataSource !== 'firebase') return;

        try {
            await fbDeleteTeamMember(memberId);

            if (affectedTasks.length > 0) {
                await Promise.all(
                    affectedTasks.map(item => fbUpdateTask(item.taskId, item.patch))
                );
            }
        } catch (error) {
            console.error('Failed to delete team member:', error);
            setTeamMembers(prev => [...prev, memberToDelete]);
            if (affectedTasks.length > 0) {
                setTasks(prev => prev.map(task => {
                    const previous = previousByTaskId.get(task.id);
                    return previous ? { ...task, ...previous } : task;
                }));
            }
            void modal.error('ไม่สามารถลบสมาชิกทีมได้ โปรดลองอีกครั้ง');
        }
    }, [dataSource, modal, setTasks, setTeamMembers, tasks, teamMembers]);

    const handleAddSystemUser = useCallback(async (payload: {
        id?: string;
        username: string;
        email: string;
        displayName: string;
        authProvider: SystemUserAccount['authProvider'];
        role?: SystemUserAccount['role'];
        branchIds?: string[];
        departmentIds?: string[];
        phone?: string;
        lineUserId?: string;
    }) => {
        if (dataSource !== 'firebase') {
            void modal.alert('การจัดการผู้ใช้ระบบมีให้ใช้งานในโหมด Firebase เท่านั้น', { variant: 'warning' });
            return;
        }

        const id = payload.id?.trim() || `su-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const branchIds = normalizeIdList(payload.branchIds, branchScopeId);
        const departmentIds = normalizeIdList(payload.departmentIds, departmentScopeId);
        try {
            await upsertSystemUserAccount(id, {
                username: payload.username.trim(),
                email: payload.email.trim().toLowerCase(),
                displayName: payload.displayName.trim(),
                authProvider: payload.authProvider,
                orgId: orgScopeId,
                branchId: branchIds[0],
                departmentId: departmentIds[0],
                role: payload.role || DEFAULT_SYSTEM_USER_ROLE,
                branchIds,
                departmentIds,
                phone: payload.phone?.trim() || '',
                lineUserId: payload.lineUserId?.trim() || '',
                createdAt: nowIso,
            });
        } catch (error) {
            console.error('Failed to add system user:', error);
            void modal.error('ไม่สามารถเพิ่มผู้ใช้ระบบได้ โปรดลองอีกครั้ง');
        }
    }, [branchScopeId, dataSource, departmentScopeId, modal, normalizeIdList, orgScopeId]);

    const handleUpdateSystemUser = useCallback(async (userId: string, patch: Partial<SystemUserAccount>) => {
        if (dataSource !== 'firebase') {
            void modal.alert('การจัดการผู้ใช้ระบบมีให้ใช้งานในโหมด Firebase เท่านั้น', { variant: 'warning' });
            return;
        }
        try {
            const safePatch: Partial<SystemUserAccount> = { ...patch };
            delete safePatch.id;
            await upsertSystemUserAccount(userId, safePatch);
        } catch (error) {
            console.error('Failed to update system user:', error);
            void modal.error('ไม่สามารถอัปเดตผู้ใช้ระบบได้ โปรดลองอีกครั้ง');
        }
    }, [dataSource, modal]);

    const handleDeleteSystemUser = useCallback(async (userId: string) => {
        if (dataSource !== 'firebase') {
            void modal.alert('การจัดการผู้ใช้ระบบมีให้ใช้งานในโหมด Firebase เท่านั้น', { variant: 'warning' });
            return;
        }
        try {
            await fbDeleteSystemUserAccount(userId);
        } catch (error) {
            console.error('Failed to delete system user:', error);
            void modal.error('ไม่สามารถลบผู้ใช้ระบบได้ โปรดลองอีกครั้ง');
        }
    }, [dataSource, modal]);

    if (loading) return <LinearLoadingScreen message="กำลังโหลดผู้ใช้งาน..." />;

    return (
        <UserManagementView
            teamMembers={teamMembers}
            systemUsers={dataSource === 'firebase' ? systemUsers : []}
            tasks={tasks}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onAddSystemUser={handleAddSystemUser}
            onUpdateSystemUser={handleUpdateSystemUser}
            onDeleteSystemUser={handleDeleteSystemUser}
        />
    );
}
