import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, onSnapshot, setDoc, writeBatch, deleteField
} from 'firebase/firestore';
import { db } from './firebase';
import {
    Project,
    Task,
    TeamMember,
    SubTask,
    Attachment,
    ActivityEntry,
    NotificationSettings,
    ScopeCatalog,
    ScopeBranch,
    ScopeDepartment,
    SystemUserAccount,
} from '@/types/construction';
import {
    DEFAULT_BRANCH_ID,
    DEFAULT_DEPARTMENT_ID,
    DEFAULT_ORG_ID,
    withDefaultScope,
    withDefaultSystemScope,
} from '@/lib/scope';

function omitUndefinedFields(data: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) payload[key] = value;
    });
    return payload;
}

function withDeleteFieldForUndefined(data: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        payload[key] = value === undefined ? deleteField() : value;
    });
    return payload;
}

function normalizeProjectDoc(value: Project): Project {
    return withDefaultScope(value);
}

function normalizeTaskDoc(value: Task): Task {
    return withDefaultScope(value);
}

function normalizeTeamMemberDoc(value: TeamMember): TeamMember {
    return withDefaultScope(value);
}

function normalizeSystemUserDoc(value: SystemUserAccount): SystemUserAccount {
    return withDefaultSystemScope(value);
}

function normalizeScopeId(value: unknown): string {
    return String(value || '').trim();
}

function normalizeScopeBranches(value: unknown): ScopeBranch[] {
    if (!Array.isArray(value)) return [];
    const result: ScopeBranch[] = [];
    const seen = new Set<string>();

    value.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const branch = item as Partial<ScopeBranch>;
        const id = normalizeScopeId(branch.id);
        if (!id || seen.has(id)) return;
        seen.add(id);

        const label = normalizeScopeId(branch.label);
        result.push({
            id,
            ...(label ? { label } : {}),
        });
    });

    return result;
}

function normalizeScopeDepartments(value: unknown): ScopeDepartment[] {
    if (!Array.isArray(value)) return [];
    const result: ScopeDepartment[] = [];
    const seen = new Set<string>();

    value.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const department = item as Partial<ScopeDepartment>;
        const id = normalizeScopeId(department.id);
        if (!id || seen.has(id)) return;
        seen.add(id);

        const label = normalizeScopeId(department.label);
        const branchId = normalizeScopeId(department.branchId);
        result.push({
            id,
            ...(label ? { label } : {}),
            ...(branchId ? { branchId } : {}),
        });
    });

    return result;
}

function normalizeScopeCatalog(value: Partial<ScopeCatalog> | null | undefined): ScopeCatalog {
    return {
        branches: normalizeScopeBranches(value?.branches),
        departments: normalizeScopeDepartments(value?.departments),
        updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : undefined,
    };
}

// ========== PROJECTS ==========

export async function getProjects(): Promise<Project[]> {
    const snapshot = await getDocs(collection(db, 'projects'));
    return snapshot.docs.map((docItem) => normalizeProjectDoc({ ...docItem.data(), id: docItem.id } as Project));
}

export async function createProject(project: Omit<Project, 'id'>): Promise<string> {
    const payload = withDefaultScope(project);
    const docRef = await addDoc(collection(db, 'projects'), payload);
    return docRef.id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
    const payload = withDeleteFieldForUndefined({ ...data, updatedAt: new Date().toISOString() });
    await updateDoc(doc(db, 'projects', id), payload);
}

export async function deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', id));
}

export function subscribeProjects(callback: (projects: Project[]) => void) {
    return onSnapshot(collection(db, 'projects'), (snapshot) => {
        const projects = snapshot.docs.map((docItem) => normalizeProjectDoc({ ...docItem.data(), id: docItem.id } as Project));
        callback(projects);
    });
}

// ========== TASKS ==========

export async function getTasks(projectId?: string): Promise<Task[]> {
    let q;
    if (projectId) {
        q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    } else {
        q = collection(db, 'tasks');
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docItem) => normalizeTaskDoc({ ...docItem.data(), id: docItem.id } as Task));
}

export async function createTask(task: Omit<Task, 'id'>): Promise<string> {
    const payload = withDefaultScope(task);
    const docRef = await addDoc(collection(db, 'tasks'), payload);
    return docRef.id;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    Object.entries(data).forEach(([key, value]) => {
        // Firestore rejects undefined. Use deleteField() so clearing optional values works.
        payload[key] = value === undefined ? deleteField() : value;
    });
    await updateDoc(doc(db, 'tasks', id), payload);
}

export async function deleteTaskDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', id));
}

export function subscribeTasks(callback: (tasks: Task[]) => void) {
    return onSnapshot(collection(db, 'tasks'), (snapshot) => {
        const tasks = snapshot.docs.map((docItem) => normalizeTaskDoc({ ...docItem.data(), id: docItem.id } as Task));
        callback(tasks);
    });
}

// ========== TEAM MEMBERS ==========

export async function getTeamMembers(): Promise<TeamMember[]> {
    const snapshot = await getDocs(collection(db, 'teamMembers'));
    return snapshot.docs.map((docItem) => normalizeTeamMemberDoc({ ...docItem.data(), id: docItem.id } as TeamMember));
}

export async function createTeamMember(member: Omit<TeamMember, 'id'>): Promise<string> {
    const payload = withDefaultScope(member);
    const docRef = await addDoc(collection(db, 'teamMembers'), omitUndefinedFields(payload as unknown as Record<string, unknown>));
    return docRef.id;
}

export async function upsertTeamMember(id: string, member: Omit<TeamMember, 'id'>): Promise<void> {
    const payload = withDefaultScope(member);
    await setDoc(doc(db, 'teamMembers', id), omitUndefinedFields(payload as unknown as Record<string, unknown>), { merge: true });
}

export async function updateTeamMember(id: string, data: Partial<TeamMember>): Promise<void> {
    const payload = withDeleteFieldForUndefined(data as Record<string, unknown>);
    if (Object.keys(payload).length === 0) return;
    await updateDoc(doc(db, 'teamMembers', id), payload);
}

export async function deleteTeamMember(id: string): Promise<void> {
    await deleteDoc(doc(db, 'teamMembers', id));
}

export function subscribeTeamMembers(callback: (members: TeamMember[]) => void) {
    return onSnapshot(collection(db, 'teamMembers'), (snapshot) => {
        const members = snapshot.docs.map((docItem) => normalizeTeamMemberDoc({ ...docItem.data(), id: docItem.id } as TeamMember));
        callback(members);
    });
}

// ========== SYSTEM USERS (AUTH ACCOUNTS) ==========

export async function upsertSystemUserAccount(id: string, data: Partial<Omit<SystemUserAccount, 'id'>>): Promise<void> {
    const shouldApplyDefaultScope =
        data.orgId !== undefined
        || data.branchId !== undefined
        || data.departmentId !== undefined
        || data.role !== undefined
        || data.branchIds !== undefined
        || data.departmentIds !== undefined;

    const scopedData = shouldApplyDefaultScope
        ? withDefaultSystemScope(data as SystemUserAccount)
        : data;

    const payload = omitUndefinedFields({
        ...scopedData,
        updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
    await setDoc(doc(db, 'systemUsers', id), payload, { merge: true });
}

export async function deleteSystemUserAccount(id: string): Promise<void> {
    await deleteDoc(doc(db, 'systemUsers', id));
}

export async function getSystemUserAccountById(id: string): Promise<SystemUserAccount | null> {
    const snapshot = await getDoc(doc(db, 'systemUsers', id));
    if (!snapshot.exists()) return null;
    return normalizeSystemUserDoc({ ...snapshot.data(), id: snapshot.id } as SystemUserAccount);
}

export async function getSystemUserAccounts(): Promise<SystemUserAccount[]> {
    const snapshot = await getDocs(collection(db, 'systemUsers'));
    return snapshot.docs.map((docItem) => normalizeSystemUserDoc({ ...docItem.data(), id: docItem.id } as SystemUserAccount));
}

export function subscribeSystemUserAccounts(callback: (users: SystemUserAccount[]) => void) {
    return onSnapshot(collection(db, 'systemUsers'), (snapshot) => {
        const users = snapshot.docs
            .map((docItem) => normalizeSystemUserDoc({ ...docItem.data(), id: docItem.id } as SystemUserAccount))
            .sort((a, b) => {
                const aTime = new Date(a.lastLoginAt || a.updatedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.lastLoginAt || b.updatedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });
        callback(users);
    });
}

// ========== NOTIFICATION SETTINGS ==========

const NOTIFICATION_SETTINGS_DOC = doc(db, 'appConfig', 'notificationSettings');
const SCOPE_CATALOG_DOC = doc(db, 'appConfig', 'scopeCatalog');

export function subscribeScopeCatalog(callback: (catalog: ScopeCatalog) => void) {
    return onSnapshot(SCOPE_CATALOG_DOC, (snapshot) => {
        if (!snapshot.exists()) {
            callback({ branches: [], departments: [] });
            return;
        }

        callback(normalizeScopeCatalog(snapshot.data() as Partial<ScopeCatalog>));
    });
}

export async function upsertScopeCatalog(data: Partial<ScopeCatalog>): Promise<void> {
    const payload = normalizeScopeCatalog(data);
    await setDoc(SCOPE_CATALOG_DOC, {
        branches: payload.branches,
        departments: payload.departments,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
}

export function subscribeNotificationSettings(callback: (settings: NotificationSettings | null) => void) {
    return onSnapshot(NOTIFICATION_SETTINGS_DOC, (snapshot) => {
        if (!snapshot.exists()) {
            callback(null);
            return;
        }

        const data = snapshot.data() as Partial<NotificationSettings>;
        callback({
            notifyTaskAssigned: data.notifyTaskAssigned ?? true,
            notifyTaskStatusChanged: data.notifyTaskStatusChanged ?? true,
            notifyTaskCommentAdded: data.notifyTaskCommentAdded ?? true,
            lineAdminUserId: (typeof data.lineAdminUserId === 'string' ? data.lineAdminUserId : '').trim(),
            lineAdminGroupId: (typeof data.lineAdminGroupId === 'string' ? data.lineAdminGroupId : '').trim(),
            adminReportProjectSummary: data.adminReportProjectSummary ?? true,
            adminReportTeamLoad: data.adminReportTeamLoad ?? true,
            adminReportCompleted: data.adminReportCompleted ?? true,
            
            adminReportFrequency: data.adminReportFrequency === 'daily' ? 'daily' : 'weekly',
            adminReportDayOfWeek: (() => {
                const day = data.adminReportDayOfWeek;
                if (day === 'monday' || day === 'tuesday' || day === 'wednesday' || day === 'thursday' || day === 'friday' || day === 'saturday' || day === 'sunday') {
                    return day;
                }
                return 'monday';
            })(),
            adminReportTime: typeof data.adminReportTime === 'string' && /^\d{2}:\d{2}$/.test(data.adminReportTime) ? data.adminReportTime : '08:00',

            employeeReportEnabled: data.employeeReportEnabled ?? false,
            employeeReportFrequency: data.employeeReportFrequency === 'daily' ? 'daily' : 'weekly',
            employeeReportDayOfWeek: (() => {
                const day = data.employeeReportDayOfWeek;
                if (day === 'monday' || day === 'tuesday' || day === 'wednesday' || day === 'thursday' || day === 'friday' || day === 'saturday' || day === 'sunday') {
                    return day;
                }
                return 'monday';
            })(),
            employeeReportTime: typeof data.employeeReportTime === 'string' && /^\d{2}:\d{2}$/.test(data.employeeReportTime) ? data.employeeReportTime : '17:00',
            employeeReportScope:
                data.employeeReportScope === 'all-projects'
                    || data.employeeReportScope === 'active-branch'
                    || data.employeeReportScope === 'active-department'
                    ? data.employeeReportScope
                    : 'active-project',
            employeeReportTemplate: data.employeeReportTemplate === 'compact' ? 'compact' : 'detailed',
            employeeReportIncludeOverdue: data.employeeReportIncludeOverdue ?? true,
            employeeReportIncludeDueSoon: data.employeeReportIncludeDueSoon ?? true,
            employeeReportIncludeCompleted: data.employeeReportIncludeCompleted ?? true,
            employeeReportIncludeNotStarted: data.employeeReportIncludeNotStarted ?? true,
            employeeReportIncludeInProgress: data.employeeReportIncludeInProgress ?? true,
            employeeReportIncludeTaskList: data.employeeReportIncludeTaskList ?? true,
            employeeReportMaxItems: Number.isFinite(data.employeeReportMaxItems) ? Math.min(Math.max(Number(data.employeeReportMaxItems), 1), 20) : 6,
            employeeReportDueSoonDays: Number.isFinite(data.employeeReportDueSoonDays) ? Math.min(Math.max(Number(data.employeeReportDueSoonDays), 1), 14) : 2,
            employeeReportTestMemberId: typeof data.employeeReportTestMemberId === 'string' ? data.employeeReportTestMemberId : '',
        });
    });
}

export async function upsertNotificationSettings(data: Partial<NotificationSettings>): Promise<void> {
    const payload = omitUndefinedFields({
        ...data,
        updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
    await setDoc(NOTIFICATION_SETTINGS_DOC, payload, { merge: true });
}

// ========== SUBTASKS ==========

export async function getSubTasks(taskId: string): Promise<SubTask[]> {
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
}

export async function createSubTask(subtask: Omit<SubTask, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'subtasks'), subtask);
    return docRef.id;
}

export async function updateSubTask(id: string, data: Partial<SubTask>): Promise<void> {
    await updateDoc(doc(db, 'subtasks', id), data);
}

export async function deleteSubTaskDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'subtasks', id));
}

export function subscribeSubTasks(callback: (subtasks: SubTask[]) => void) {
    return onSnapshot(collection(db, 'subtasks'), (snapshot) => {
        const subtasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
        callback(subtasks);
    });
}

// ========== ATTACHMENTS ==========

export async function createAttachment(attachment: Omit<Attachment, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'attachments'), omitUndefinedFields(attachment as Record<string, unknown>));
    return docRef.id;
}

export async function deleteAttachmentDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'attachments', id));
}

export function subscribeAttachments(callback: (attachments: Attachment[]) => void) {
    return onSnapshot(collection(db, 'attachments'), (snapshot) => {
        const attachments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attachment));
        callback(attachments);
    });
}

// ========== ACTIVITY LOG ==========

export async function createActivityEntry(entry: Omit<ActivityEntry, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'activityLog'), omitUndefinedFields(entry as Record<string, unknown>));
    return docRef.id;
}

export function subscribeActivityLog(callback: (entries: ActivityEntry[]) => void) {
    return onSnapshot(collection(db, 'activityLog'), (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityEntry));
        callback(entries);
    });
}

// ========== TASK UPDATES (Comments) ==========

export interface TaskUpdateDoc {
    id: string;
    taskId: string;
    text: string;
    author: string;
    date: string;
}

export async function createTaskUpdate(update: Omit<TaskUpdateDoc, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'taskUpdates'), update);
    return docRef.id;
}

export function subscribeTaskUpdates(callback: (updates: TaskUpdateDoc[]) => void) {
    return onSnapshot(collection(db, 'taskUpdates'), (snapshot) => {
        const updates = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TaskUpdateDoc));
        callback(updates);
    });
}

// ========== PER-TASK SUBSCRIPTIONS (optimized — only loads data for specific task) ==========

export function subscribeSubTasksForTask(taskId: string, callback: (subtasks: SubTask[]) => void) {
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const subtasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
        callback(subtasks);
    });
}

export function subscribeAttachmentsForTask(taskId: string, callback: (attachments: Attachment[]) => void) {
    const q = query(collection(db, 'attachments'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const attachments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attachment));
        callback(attachments);
    });
}

export function subscribeActivityLogForTask(taskId: string, callback: (entries: ActivityEntry[]) => void) {
    const q = query(collection(db, 'activityLog'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityEntry));
        callback(entries);
    });
}

// ========== SEED DATA ==========

export async function seedInitialData(): Promise<void> {
    const existingProjects = await getDocs(collection(db, 'projects'));
    if (existingProjects.docs.length > 0) {
        console.log('Data already exists, skipping seed.');
        return;
    }

    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const sub = (days: number) => new Date(now.getTime() - days * 86400000);
    const add = (days: number) => new Date(now.getTime() + days * 86400000);

    const batch = writeBatch(db);

    const projRef = doc(db, 'projects', 'proj-1');
    batch.set(projRef, {
        orgId: DEFAULT_ORG_ID,
        branchId: DEFAULT_BRANCH_ID,
        departmentId: DEFAULT_DEPARTMENT_ID,
        name: "Monday.com Style Demo", description: "A demonstration project",
        owner: "System Admin", status: "in-progress",
        startDate: fmt(sub(10)), endDate: fmt(add(50)),
        overallProgress: 35, createdAt: now.toISOString(), updatedAt: now.toISOString()
    });

    const projRef2 = doc(db, 'projects', 'proj-2');
    batch.set(projRef2, {
        orgId: DEFAULT_ORG_ID,
        branchId: DEFAULT_BRANCH_ID,
        departmentId: DEFAULT_DEPARTMENT_ID,
        name: "Website Redesign", description: "Redesigning company website",
        owner: "Marketing", status: "planning",
        startDate: fmt(now), endDate: fmt(add(30)),
        overallProgress: 0, createdAt: now.toISOString(), updatedAt: now.toISOString()
    });

    const tasksData = [
        { id: 't1', name: "Define MVP scope", category: "Planning", responsible: "Alex M.", planStartDate: fmt(sub(10)), planEndDate: fmt(sub(5)), planDuration: 5, estimatedHours: 16, progress: 100, status: "completed", priority: "high", order: 1 },
        { id: 't2', name: "Design Database Schema", category: "Planning", responsible: "Sarah T.", planStartDate: fmt(sub(4)), planEndDate: fmt(sub(1)), planDuration: 6, estimatedHours: 24, progress: 60, status: "in-progress", priority: "urgent", order: 2 },
        { id: 't3', name: "Finalize UI Mockups", category: "Planning", responsible: "Chris P.", planStartDate: fmt(now), planEndDate: fmt(add(1)), planDuration: 7, estimatedHours: 20, progress: 10, status: "in-progress", priority: "high", order: 3 },
        { id: 't4', name: "Setup Next.js environment", category: "Development", responsible: "Alex M.", planStartDate: fmt(sub(2)), planEndDate: fmt(add(1)), planDuration: 3, estimatedHours: 12, progress: 80, status: "in-progress", priority: "medium", order: 4 },
        { id: 't5', name: "Implement Auth Flow", category: "Development", responsible: "Mike D.", planStartDate: fmt(add(2)), planEndDate: fmt(add(10)), planDuration: 8, estimatedHours: 28, progress: 0, status: "not-started", priority: "medium", order: 5 },
        { id: 't6', name: "Build Dashboard Core", category: "Development", responsible: "Anna K.", planStartDate: fmt(add(8)), planEndDate: fmt(add(25)), planDuration: 17, estimatedHours: 40, progress: 0, status: "not-started", priority: "low", order: 6 },
        { id: 't7', name: "Security Audit", category: "Review", responsible: "John H.", planStartDate: fmt(add(26)), planEndDate: fmt(add(30)), planDuration: 4, estimatedHours: 18, progress: 0, status: "not-started", order: 7 },
        { id: 't8', name: "UAT Testing", category: "Review", responsible: "Customer", planStartDate: fmt(add(31)), planEndDate: fmt(add(45)), planDuration: 14, estimatedHours: 30, progress: 0, status: "not-started", priority: "low", order: 8 },
    ];

    for (const t of tasksData) {
        batch.set(doc(db, 'tasks', t.id), {
            ...t,
            orgId: DEFAULT_ORG_ID,
            branchId: DEFAULT_BRANCH_ID,
            departmentId: DEFAULT_DEPARTMENT_ID,
            projectId: 'proj-1',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        });
    }

    const membersData = [
        { id: 'u1', name: "Alex M.", position: "Project Manager", department: "Management", phone: "081-111-1234", capacityHoursPerWeek: 40 },
        { id: 'u2', name: "Sarah T.", position: "Frontend Developer", department: "Engineering", phone: "082-222-2345", capacityHoursPerWeek: 40 },
        { id: 'u3', name: "Chris P.", position: "UI/UX Designer", department: "Design", phone: "083-333-3456", capacityHoursPerWeek: 35 },
        { id: 'u4', name: "Mike D.", position: "Backend Developer", department: "Engineering", phone: "084-444-4567", capacityHoursPerWeek: 40 },
        { id: 'u5', name: "Anna K.", position: "QA Engineer", department: "Quality Assurance", phone: "085-555-5678", capacityHoursPerWeek: 35 },
        { id: 'u6', name: "John H.", position: "Security Analyst", department: "Security", phone: "086-666-6789", capacityHoursPerWeek: 30 },
        { id: 'u7', name: "Customer", position: "Client", department: "External", phone: "-", capacityHoursPerWeek: 20 },
    ];

    for (const m of membersData) {
        batch.set(doc(db, 'teamMembers', m.id), {
            ...m,
            orgId: DEFAULT_ORG_ID,
            branchId: DEFAULT_BRANCH_ID,
            departmentId: DEFAULT_DEPARTMENT_ID,
        });
    }

    batch.set(doc(db, 'subtasks', 'st1'), { taskId: 't2', name: "Define entities and relationships", completed: true, createdAt: now.toISOString() });
    batch.set(doc(db, 'subtasks', 'st2'), { taskId: 't2', name: "Create ERD diagram", completed: false, createdAt: now.toISOString() });
    batch.set(doc(db, 'subtasks', 'st3'), { taskId: 't2', name: "Review with team lead", completed: false, createdAt: now.toISOString() });

    await batch.commit();
    console.log('Initial data seeded to Firestore!');
}
