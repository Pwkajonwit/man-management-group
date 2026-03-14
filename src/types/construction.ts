// Type definitions for Construction Management System

export type SystemUserRole =
    | 'super_admin'
    | 'branch_manager'
    | 'department_manager'
    | 'staff'
    | 'viewer';

export interface Project {
    id: string;
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    name: string;
    owner: string;
    code?: string;
    description?: string;
    startDate: string;
    endDate: string;
    overallProgress: number;
    status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
    createdAt: string;
    updatedAt: string;
    categoryOrder?: string[];
    subcategoryOrder?: Record<string, string[]>; // { "categoryName": ["sub1", "sub2", ...] }
    color?: string;
    googleSheetUrl?: string;
}

export interface Task {
    id: string;
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    projectId: string;
    category: string;
    subcategory?: string; // Optional subcategory for grouping
    subsubcategory?: string; // Optional sub-subcategory
    type?: 'task' | 'group';
    name: string;
    description?: string;
    responsible?: string;
    assignedEmployeeIds?: string[];
    color?: string; // Custom color for the task/group bar
    costCode?: string; // e.g. "1", "2", "101"
    cost?: number; // Cost in Baht
    quantity?: string; // Q'ty with unit (e.g. "20 m.")
    planStartDate: string;
    planEndDate: string;
    planDuration: number;
    estimatedHours?: number;
    actualStartDate?: string;
    actualEndDate?: string;
    actualDuration?: number;
    progress: number; // 0-100
    progressUpdatedAt?: string; // Date when progress was last updated by user
    status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    parentTaskId?: string | null;
    order: number;
    predecessors?: string[];
    remarks?: string;
    dueProcurementDate?: string;
    dueMaterialOnSiteDate?: string;
    dateOfUse?: string;
    procurementStatus?: 'to-order' | 'ordered' | 'delivered' | 'ready' | 'in-stock' | 'plan-a' | 'plan-b' | 'plan-c' | 'actual';
    createdAt: string;
    updatedAt: string;
}

export interface SubTask {
    id: string;
    taskId: string;
    name: string;
    completed: boolean;
    createdAt: string;
}

export interface Attachment {
    id: string;
    taskId: string;
    name: string;
    type: string; // mime type
    size: number; // bytes
    data?: string; // base64 (legacy/local mode)
    url?: string; // downloadable URL from Firebase Storage
    storagePath?: string; // Firebase Storage object path
    createdAt: string;
    uploadedBy: string;
}

export interface ActivityEntry {
    id: string;
    taskId: string;
    action: string; // e.g. "status_changed", "owner_changed", "priority_changed"
    field?: string;
    oldValue?: string;
    newValue?: string;
    user: string;
    timestamp: string;
}

export interface WeeklyLog {
    id: string;
    projectId: string;
    weekNumber: number;
    year: number;
    startDate: string;
    endDate: string;
    plannedCumulativeProgress: number;
    actualCumulativeProgress: number;
    gap: number; // Variance between plan and actual
    notes?: string;
    createdAt: string;
}

export interface Media {
    id: string;
    taskId: string;
    projectId: string;
    url: string;
    type: 'image' | 'document';
    caption?: string;
    uploadedBy: string;
    uploadedAt: string;
}

export interface TaskProgressUpdate {
    id: string;
    taskId: string;
    previousProgress: number;
    newProgress: number;
    updatedBy: string;
    notes?: string;
    mediaIds?: string[];
    createdAt: string;
}

// S-Curve data point
export interface SCurveDataPoint {
    week: number;
    date: string;
    plannedProgress: number;
    actualProgress: number;
    cumulativePlanned: number;
    cumulativeActual: number;
    bucketStart?: Date;
    bucketEnd?: Date;
    rawId?: string;
}

// Team member
export interface Member {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'admin' | 'project_manager' | 'engineer' | 'viewer';
    position?: string;
    department?: string;
    username?: string;
    avatar?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Employee (for task assignment, not login permission)
export interface Employee {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
    employeeCode?: string;
    avatarBase64?: string;
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface Expense {
    id: string;
    projectId: string;
    amount: number;
    description: string;
    date: string; // ISO date string YYYY-MM-DD
    costCode?: string;
    type?: 'material' | 'labor' | 'subcontract' | 'overhead' | 'other';
    createdAt?: string;
}

export interface TeamMember {
    id: string;
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    name: string;
    memberType?: 'team' | 'crew'; // team = update/report user, crew = assign-only worker group
    position: string;
    department: string;
    phone: string;
    capacityHoursPerWeek?: number;
    avatar?: string; // base64 encoded image
    lineUserId?: string; // LINE userId for notifications
}

export interface SystemUserAccount {
    id: string; // Firebase Auth uid
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    role?: SystemUserRole;
    branchIds?: string[];
    departmentIds?: string[];
    email: string;
    username: string;
    displayName: string;
    authProvider: 'password' | 'line';
    phone?: string;
    lineUserId?: string;
    createdAt: string;
    lastLoginAt?: string;
    updatedAt?: string;
}

export interface NotificationSettings {
    notifyTaskAssigned: boolean;
    notifyTaskStatusChanged: boolean;
    notifyTaskCommentAdded: boolean;
    lineAdminUserId: string;
    lineReportType: 'project-summary' | 'today-team-load' | 'completed-last-2-days';
    employeeReportEnabled: boolean;
    employeeReportFrequency: 'daily' | 'weekly';
    employeeReportDayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    employeeReportTime: string; // HH:mm
    employeeReportScope: 'active-project' | 'all-projects';
    employeeReportTemplate: 'compact' | 'detailed';
    employeeReportIncludeOverdue: boolean;
    employeeReportIncludeDueSoon: boolean;
    employeeReportIncludeCompleted: boolean;
    employeeReportIncludeNotStarted: boolean;
    employeeReportIncludeInProgress: boolean;
    employeeReportIncludeTaskList: boolean;
    employeeReportMaxItems: number;
    employeeReportDueSoonDays: number;
    employeeReportTestMemberId: string;
}

export interface ScopeBranch {
    id: string;
    label?: string;
}

export interface ScopeDepartment {
    id: string;
    label?: string;
    branchId?: string;
}

export interface ScopeCatalog {
    branches: ScopeBranch[];
    departments: ScopeDepartment[];
    updatedAt?: string;
}
