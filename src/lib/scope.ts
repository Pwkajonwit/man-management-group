import type { SystemUserRole } from '@/types/construction';

export const DEFAULT_ORG_ID = 'org-default';
export const DEFAULT_BRANCH_ID = 'branch-hq';
export const DEFAULT_DEPARTMENT_ID = 'dept-general';
export const DEFAULT_SYSTEM_USER_ROLE: SystemUserRole = 'staff';

export function isLegacyDefaultBranchId(value?: string | null): boolean {
    return String(value || '').trim() === DEFAULT_BRANCH_ID;
}

export function isLegacyDefaultDepartmentId(value?: string | null): boolean {
    return String(value || '').trim() === DEFAULT_DEPARTMENT_ID;
}

export interface ScopeFields {
    orgId?: string;
    branchId?: string;
    departmentId?: string;
}

export interface RequiredScopeFields {
    orgId: string;
    branchId: string;
    departmentId: string;
}

export interface SystemScopeFields extends ScopeFields {
    role?: SystemUserRole;
    branchIds?: string[];
    departmentIds?: string[];
}

function ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

export function withDefaultScope<T extends ScopeFields>(value: T): T & RequiredScopeFields {
    return {
        ...value,
        orgId: value.orgId || DEFAULT_ORG_ID,
        branchId: value.branchId || DEFAULT_BRANCH_ID,
        departmentId: value.departmentId || DEFAULT_DEPARTMENT_ID,
    };
}

export function withDefaultSystemScope<T extends SystemScopeFields>(
    value: T
): T & RequiredScopeFields & { role: SystemUserRole; branchIds: string[]; departmentIds: string[] } {
    const scoped = withDefaultScope(value);
    const branchIds = ensureStringArray(value.branchIds);
    const departmentIds = ensureStringArray(value.departmentIds);

    if (branchIds.length === 0) branchIds.push(scoped.branchId);
    if (departmentIds.length === 0) departmentIds.push(scoped.departmentId);

    return {
        ...scoped,
        role: value.role || DEFAULT_SYSTEM_USER_ROLE,
        branchIds,
        departmentIds,
    };
}
