import type { SystemUserRole } from '@/types/construction';
import { DEFAULT_BRANCH_ID, DEFAULT_DEPARTMENT_ID, DEFAULT_ORG_ID } from '@/lib/scope';

const ADMIN_ROLE_SET = new Set<SystemUserRole>(['super_admin', 'branch_manager', 'department_manager']);

export interface ScopedRecord {
    orgId?: string;
    branchId?: string;
    departmentId?: string;
}

export interface UserScopeLike extends ScopedRecord {
    role?: SystemUserRole;
    branchIds?: string[];
    departmentIds?: string[];
}

export interface ResolvedUserScope {
    role: SystemUserRole;
    orgId: string;
    branchIds: string[];
    departmentIds: string[];
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeScopeRecord(record: ScopedRecord): Required<ScopedRecord> {
    return {
        orgId: record.orgId || DEFAULT_ORG_ID,
        branchId: record.branchId || DEFAULT_BRANCH_ID,
        departmentId: record.departmentId || DEFAULT_DEPARTMENT_ID,
    };
}

export function resolveUserScope(user?: UserScopeLike | null): ResolvedUserScope {
    const orgId = user?.orgId || DEFAULT_ORG_ID;
    const role = user?.role || 'staff';
    const fallbackBranch = user?.branchId || DEFAULT_BRANCH_ID;
    const fallbackDepartment = user?.departmentId || DEFAULT_DEPARTMENT_ID;

    const branchIds = uniqueStrings([...(user?.branchIds || []), fallbackBranch]);
    const departmentIds = uniqueStrings([...(user?.departmentIds || []), fallbackDepartment]);

    return {
        role,
        orgId,
        branchIds: branchIds.length > 0 ? branchIds : [DEFAULT_BRANCH_ID],
        departmentIds: departmentIds.length > 0 ? departmentIds : [DEFAULT_DEPARTMENT_ID],
    };
}

export function hasAdminAccess(role?: SystemUserRole): boolean {
    return ADMIN_ROLE_SET.has(role || 'staff');
}

export function canSelectScope(role?: SystemUserRole): boolean {
    return hasAdminAccess(role);
}

export function canAccessScopedRecord(userScope: ResolvedUserScope, record: ScopedRecord): boolean {
    const normalizedRecord = normalizeScopeRecord(record);
    if (userScope.role === 'super_admin') return true;
    if (normalizedRecord.orgId !== userScope.orgId) return false;

    const branchAllowed = userScope.branchIds.includes(normalizedRecord.branchId);
    if (!branchAllowed) return false;

    if (userScope.role === 'branch_manager') return true;
    return userScope.departmentIds.includes(normalizedRecord.departmentId);
}
