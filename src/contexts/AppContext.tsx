'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import {
    Project,
    Task,
    TeamMember,
    SubTask,
    Attachment,
    ActivityEntry,
    NotificationSettings,
    ScopeBranch,
    ScopeDepartment,
} from '@/types/construction';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { deleteStorageFile, uploadTaskAttachmentFile } from '@/lib/storage';
import {
    subscribeProjects, subscribeTasks, subscribeTeamMembers,
    subscribeTaskUpdates,
    subscribeSubTasksForTask, subscribeAttachmentsForTask, subscribeActivityLogForTask,
    createProject as fbCreateProject,
    updateProject as fbUpdateProject,
    deleteProject as fbDeleteProject,
    createTask as fbCreateTask, updateTask as fbUpdateTask, deleteTaskDoc,
    createSubTask as fbCreateSubTask, updateSubTask as fbUpdateSubTask, deleteSubTaskDoc,
    createAttachment as fbCreateAttachment, deleteAttachmentDoc,
    createActivityEntry as fbCreateActivityEntry,
    createTaskUpdate as fbCreateTaskUpdate,
    subscribeNotificationSettings as fbSubscribeNotificationSettings,
    subscribeScopeCatalog as fbSubscribeScopeCatalog,
    upsertNotificationSettings as fbUpsertNotificationSettings,
    seedInitialData,
} from '@/lib/firestore';
import {
    DEFAULT_BRANCH_ID,
    DEFAULT_DEPARTMENT_ID,
    DEFAULT_ORG_ID,
    isLegacyDefaultBranchId,
    isLegacyDefaultDepartmentId,
} from '@/lib/scope';
import { canAccessScopedRecord, canSelectScope, resolveUserScope } from '@/lib/rbac';
import { isTaskAssignedToCurrentUser } from '@/utils/taskOwnerUtils';

interface TaskUpdate {
    id: string;
    taskId: string;
    text: string;
    author: string;
    date: string;
}

type TaskStatus = Task['status'];
type TaskPriorityInput = Task['priority'] | '';

interface AppContextType {
    // Data
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    tasks: Task[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    teamMembers: TeamMember[];
    setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
    scopeBranchId: string;
    setScopeBranchId: React.Dispatch<React.SetStateAction<string>>;
    scopeDepartmentId: string;
    setScopeDepartmentId: React.Dispatch<React.SetStateAction<string>>;
    scopeBranchOptions: Array<{ id: string; label: string }>;
    scopeDepartmentOptions: Array<{ id: string; label: string }>;
    taskScopeBranchOptions: Array<{ id: string; label: string }>;
    taskScopeDepartmentOptions: Array<{ id: string; label: string; branchId?: string }>;
    canSelectScope: boolean;
    loading: boolean;
    dataSource: 'firebase' | 'local';
    notificationSettings: NotificationSettings;
    updateNotificationSettings: (patch: Partial<NotificationSettings>) => Promise<void>;

    // Active project
    activeProjectId: string | null;
    setActiveProjectId: React.Dispatch<React.SetStateAction<string | null>>;

    // Task Updates (comments)
    taskUpdates: Record<string, TaskUpdate[]>;
    addTaskUpdate: (taskId: string, text: string) => Promise<void>;
    createWorkspace: (name: string, code?: string) => Promise<void>;
    updateWorkspace: (
        projectId: string,
        name: string,
        code?: string,
        status?: Project['status'],
        scope?: { branchId?: string; departmentId?: string }
    ) => Promise<void>;
    deleteWorkspace: (projectId: string) => Promise<void>;

    // Sub-tasks
    subtasks: Record<string, SubTask[]>;
    addSubTask: (taskId: string, name: string) => void;
    toggleSubTask: (taskId: string, subtaskId: string) => void;
    deleteSubTask: (taskId: string, subtaskId: string) => void;

    // Attachments
    attachments: Record<string, Attachment[]>;
    addAttachment: (taskId: string, file: File) => Promise<void>;
    deleteAttachment: (taskId: string, attachmentId: string) => void;

    // Per-task subscription (subscribe when task detail opens, unsubscribe when it closes)
    subscribeTaskDetails: (taskId: string) => () => void;

    // Current user name
    currentUserName: string;

    // Activity Log
    activityLog: Record<string, ActivityEntry[]>;

    // Task operations
    handleAddItem: (category: string) => void;
    handleDeleteItem: (taskId: string) => void;
    handleUpdateTaskName: (taskId: string, newName: string) => void;
    handleUpdateTaskOwner: (taskId: string, newOwner: string) => void;
    handleUpdateTaskOwners: (taskId: string, newOwners: string[]) => void;
    handleUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
    handleUpdateTaskTimeline: (taskId: string, field: 'planStartDate' | 'planEndDate', newDate: string) => void;
    handleUpdateTaskProgress: (taskId: string, newProgress: string) => void;
    handleUpdateTaskPriority: (taskId: string, newPriority: TaskPriorityInput) => void;
    handleUpdateTaskEstimatedHours: (taskId: string, newHours: string) => void;
    handleUpdateTaskDescription: (taskId: string, description: string) => void;
    handleUpdateTaskScope: (taskId: string, scope: { branchId: string; departmentId: string }) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    notifyTaskAssigned: true,
    notifyTaskStatusChanged: true,
    notifyTaskCommentAdded: true,
    lineAdminUserId: '',
    lineReportType: 'project-summary',
    employeeReportEnabled: false,
    employeeReportFrequency: 'weekly',
    employeeReportDayOfWeek: 'monday',
    employeeReportTime: '17:00',
    employeeReportScope: 'active-project',
    employeeReportTemplate: 'detailed',
    employeeReportIncludeOverdue: true,
    employeeReportIncludeDueSoon: true,
    employeeReportIncludeCompleted: true,
    employeeReportIncludeNotStarted: true,
    employeeReportIncludeInProgress: true,
    employeeReportIncludeTaskList: true,
    employeeReportMaxItems: 6,
    employeeReportDueSoonDays: 2,
    employeeReportTestMemberId: '',
};
const ALL_SCOPE_VALUE = 'all';

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within an AppProvider');
    return context;
}

// Debounce helper for Firestore writes
function useDebouncedUpdate() {
    const timers = useRef<Record<string, NodeJS.Timeout>>({});

    return useCallback((key: string, fn: () => void, delay: number = 500) => {
        if (timers.current[key]) clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(fn, delay);
    }, []);
}

function areTaskArraysEquivalent(prev: Task[], next: Task[]): boolean {
    if (prev === next) return true;
    if (prev.length !== next.length) return false;

    for (let index = 0; index < prev.length; index += 1) {
        const prevTask = prev[index];
        const nextTask = next[index];
        if (!nextTask) return false;
        if (prevTask.id !== nextTask.id) return false;
        if (prevTask.updatedAt !== nextTask.updatedAt) return false;
    }

    return true;
}

// LINE Notify helper
async function sendLineNotify(payload: {
    to: string;
    taskId?: string;
    taskName: string;
    action: string;
    assignedBy?: string;
    newStatus?: string;
    projectName?: string;
    comment?: string;
    owner?: string;
    crew?: string;
    timeline?: string;
    priority?: string;
}) {
    const response = await fetch('/api/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'ไม่สามารถส่งการแจ้งเตือน LINE ได้');
    }
}

export function AppProvider({ children }: { children: ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const currentUserName = user?.displayName || 'Unknown';

    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [scopeBranchId, setScopeBranchId] = useState<string>(ALL_SCOPE_VALUE);
    const [scopeDepartmentId, setScopeDepartmentId] = useState<string>(ALL_SCOPE_VALUE);
    const [scopeCatalogBranches, setScopeCatalogBranches] = useState<ScopeBranch[]>([]);
    const [scopeCatalogDepartments, setScopeCatalogDepartments] = useState<ScopeDepartment[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataSource, setDataSource] = useState<'firebase' | 'local'>('firebase');
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [taskUpdates, setTaskUpdates] = useState<Record<string, TaskUpdate[]>>({});
    const [subtasks, setSubtasks] = useState<Record<string, SubTask[]>>({});
    const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
    const [activityLog, setActivityLog] = useState<Record<string, ActivityEntry[]>>({});

    const userScope = useMemo(() => resolveUserScope(user), [user]);
    const isScopeSelectionEnabled = useMemo(() => canSelectScope(userScope.role), [userScope.role]);
    const personallyAssignedTaskIdSet = useMemo(() => {
        if (!user) return new Set<string>();
        return new Set(
            tasks
                .filter((task) => isTaskAssignedToCurrentUser(task, teamMembers, currentUserName, user.lineUserId, user.uid))
                .map((task) => task.id)
        );
    }, [currentUserName, tasks, teamMembers, user]);
    const personallyAssignedProjectIdSet = useMemo(
        () => new Set(tasks.filter((task) => personallyAssignedTaskIdSet.has(task.id)).map((task) => task.projectId)),
        [personallyAssignedTaskIdSet, tasks]
    );

    const roleScopedProjects = useMemo(
        () => projects.filter((project) => canAccessScopedRecord(userScope, project) || (userScope.role === 'staff' && personallyAssignedProjectIdSet.has(project.id))),
        [personallyAssignedProjectIdSet, projects, userScope]
    );
    const roleScopedTeamMembers = useMemo(
        () => teamMembers.filter((member) => canAccessScopedRecord(userScope, member)),
        [teamMembers, userScope]
    );
    const roleScopedProjectIdSet = useMemo(
        () => new Set(roleScopedProjects.map((project) => project.id)),
        [roleScopedProjects]
    );
    const roleScopedTasks = useMemo(
        () => tasks.filter((task) => (
            (roleScopedProjectIdSet.has(task.projectId) && canAccessScopedRecord(userScope, task))
            || (userScope.role === 'staff' && personallyAssignedTaskIdSet.has(task.id))
        )),
        [personallyAssignedTaskIdSet, tasks, roleScopedProjectIdSet, userScope]
    );

    const allAccessibleBranchIds = useMemo(() => {
        const branchIds = new Set<string>();
        roleScopedProjects.forEach((project) => {
            const branchId = project.branchId || DEFAULT_BRANCH_ID;
            if (!isLegacyDefaultBranchId(branchId)) branchIds.add(branchId);
        });
        roleScopedTasks.forEach((task) => {
            const branchId = task.branchId || DEFAULT_BRANCH_ID;
            if (!isLegacyDefaultBranchId(branchId)) branchIds.add(branchId);
        });
        roleScopedTeamMembers.forEach((member) => {
            const branchId = member.branchId || DEFAULT_BRANCH_ID;
            if (!isLegacyDefaultBranchId(branchId)) branchIds.add(branchId);
        });
        userScope.branchIds.forEach((branchId) => {
            const safeBranchId = branchId || DEFAULT_BRANCH_ID;
            if (!isLegacyDefaultBranchId(safeBranchId)) branchIds.add(safeBranchId);
        });
        scopeCatalogBranches.forEach((branch) => {
            const branchId = branch.id || DEFAULT_BRANCH_ID;
            if (!isLegacyDefaultBranchId(branchId)) branchIds.add(branchId);
        });
        return Array.from(branchIds).filter(Boolean);
    }, [roleScopedProjects, roleScopedTasks, roleScopedTeamMembers, scopeCatalogBranches, userScope.branchIds]);

    const branchLabelById = useMemo(() => {
        const map = new Map<string, string>();
        scopeCatalogBranches.forEach((branch) => {
            if (!branch.id) return;
            map.set(branch.id, branch.label || branch.id);
        });
        return map;
    }, [scopeCatalogBranches]);

    const scopeBranchOptions = useMemo(() => {
        const options = allAccessibleBranchIds
            .sort()
            .map((branchId) => ({ id: branchId, label: branchLabelById.get(branchId) || branchId }));

        if (isScopeSelectionEnabled && options.length > 1) {
            return [{ id: ALL_SCOPE_VALUE, label: 'All Branches' }, ...options];
        }
        return options;
    }, [allAccessibleBranchIds, branchLabelById, isScopeSelectionEnabled]);

    const taskScopeBranchOptions = useMemo(() => {
        return allAccessibleBranchIds
            .sort()
            .map((branchId) => ({ id: branchId, label: branchLabelById.get(branchId) || branchId }));
    }, [allAccessibleBranchIds, branchLabelById]);

    const effectiveScopeBranchId = useMemo(() => {
        const fallbackBranch = scopeBranchOptions.find((option) => option.id !== ALL_SCOPE_VALUE)?.id || ALL_SCOPE_VALUE;
        const requestedBranchExists = scopeBranchOptions.some((option) => option.id === scopeBranchId);

        if (!requestedBranchExists) return fallbackBranch;
        if (!isScopeSelectionEnabled && scopeBranchId === ALL_SCOPE_VALUE) return fallbackBranch;
        return scopeBranchId;
    }, [isScopeSelectionEnabled, scopeBranchId, scopeBranchOptions]);

    const availableDepartmentIds = useMemo(() => {
        const departmentIds = new Set<string>();
        const branchFilter = effectiveScopeBranchId === ALL_SCOPE_VALUE ? null : effectiveScopeBranchId;

        const includeIfBranchMatch = (branchId?: string, departmentId?: string) => {
            const safeBranchId = branchId || DEFAULT_BRANCH_ID;
            const safeDepartmentId = departmentId || DEFAULT_DEPARTMENT_ID;
            if (isLegacyDefaultBranchId(safeBranchId) || isLegacyDefaultDepartmentId(safeDepartmentId)) return;
            if (branchFilter && safeBranchId !== branchFilter) return;
            departmentIds.add(safeDepartmentId);
        };

        roleScopedProjects.forEach((project) => includeIfBranchMatch(project.branchId, project.departmentId));
        roleScopedTasks.forEach((task) => includeIfBranchMatch(task.branchId, task.departmentId));
        roleScopedTeamMembers.forEach((member) => includeIfBranchMatch(member.branchId, member.departmentId));
        scopeCatalogDepartments.forEach((department) => {
            const catalogBranchId = department.branchId || null;
            const safeDepartmentId = department.id || DEFAULT_DEPARTMENT_ID;
            if (isLegacyDefaultDepartmentId(safeDepartmentId)) return;
            if (catalogBranchId && isLegacyDefaultBranchId(catalogBranchId)) return;
            if (branchFilter && catalogBranchId && catalogBranchId !== branchFilter) return;
            departmentIds.add(safeDepartmentId);
        });
        userScope.departmentIds.forEach((departmentId) => {
            const safeDepartmentId = departmentId || DEFAULT_DEPARTMENT_ID;
            if (!isLegacyDefaultDepartmentId(safeDepartmentId)) {
                departmentIds.add(safeDepartmentId);
            }
        });

        return Array.from(departmentIds).filter(Boolean);
    }, [effectiveScopeBranchId, roleScopedProjects, roleScopedTasks, roleScopedTeamMembers, scopeCatalogDepartments, userScope.departmentIds]);

    const departmentLabelById = useMemo(() => {
        const map = new Map<string, string>();
        scopeCatalogDepartments.forEach((department) => {
            if (!department.id) return;
            map.set(department.id, department.label || department.id);
        });
        return map;
    }, [scopeCatalogDepartments]);

    const scopeDepartmentOptions = useMemo(() => {
        const options = availableDepartmentIds
            .sort()
            .map((departmentId) => ({ id: departmentId, label: departmentLabelById.get(departmentId) || departmentId }));

        if (isScopeSelectionEnabled && options.length > 1) {
            return [{ id: ALL_SCOPE_VALUE, label: 'All Departments' }, ...options];
        }
        return options;
    }, [availableDepartmentIds, departmentLabelById, isScopeSelectionEnabled]);

    const taskScopeDepartmentOptions = useMemo(() => {
        const departmentMap = new Map<string, { id: string; label: string; branchId?: string }>();

        scopeCatalogDepartments.forEach((department) => {
            const id = department.id || DEFAULT_DEPARTMENT_ID;
            if (isLegacyDefaultDepartmentId(id)) return;
            if (department.branchId && isLegacyDefaultBranchId(department.branchId)) return;
            departmentMap.set(id, {
                id,
                label: department.label || id,
                ...(department.branchId ? { branchId: department.branchId } : {}),
            });
        });

        roleScopedProjects.forEach((project) => {
            const id = project.departmentId || DEFAULT_DEPARTMENT_ID;
            const branchId = project.branchId || DEFAULT_BRANCH_ID;
            if (isLegacyDefaultDepartmentId(id) || isLegacyDefaultBranchId(branchId)) return;
            if (departmentMap.has(id)) return;
            departmentMap.set(id, {
                id,
                label: departmentLabelById.get(id) || id,
                branchId,
            });
        });

        roleScopedTasks.forEach((task) => {
            const id = task.departmentId || DEFAULT_DEPARTMENT_ID;
            const branchId = task.branchId || DEFAULT_BRANCH_ID;
            if (isLegacyDefaultDepartmentId(id) || isLegacyDefaultBranchId(branchId)) return;
            if (departmentMap.has(id)) return;
            departmentMap.set(id, {
                id,
                label: departmentLabelById.get(id) || id,
                branchId,
            });
        });

        roleScopedTeamMembers.forEach((member) => {
            const id = member.departmentId || DEFAULT_DEPARTMENT_ID;
            const branchId = member.branchId || DEFAULT_BRANCH_ID;
            if (isLegacyDefaultDepartmentId(id) || isLegacyDefaultBranchId(branchId)) return;
            if (departmentMap.has(id)) return;
            departmentMap.set(id, {
                id,
                label: departmentLabelById.get(id) || id,
                branchId,
            });
        });

        userScope.departmentIds.forEach((departmentId) => {
            const safeDepartmentId = departmentId || DEFAULT_DEPARTMENT_ID;
            if (isLegacyDefaultDepartmentId(safeDepartmentId)) return;
            if (departmentMap.has(safeDepartmentId)) return;
            departmentMap.set(safeDepartmentId, {
                id: safeDepartmentId,
                label: departmentLabelById.get(safeDepartmentId) || safeDepartmentId,
            });
        });

        return Array.from(departmentMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    }, [departmentLabelById, roleScopedProjects, roleScopedTasks, roleScopedTeamMembers, scopeCatalogDepartments, userScope.departmentIds]);

    const effectiveScopeDepartmentId = useMemo(() => {
        const fallbackDepartment = scopeDepartmentOptions.find((option) => option.id !== ALL_SCOPE_VALUE)?.id || ALL_SCOPE_VALUE;
        const requestedDepartmentExists = scopeDepartmentOptions.some((option) => option.id === scopeDepartmentId);

        if (!requestedDepartmentExists) return fallbackDepartment;
        if (!isScopeSelectionEnabled && scopeDepartmentId === ALL_SCOPE_VALUE) return fallbackDepartment;
        return scopeDepartmentId;
    }, [isScopeSelectionEnabled, scopeDepartmentId, scopeDepartmentOptions]);

    const selectedScopedProjects = useMemo(() => {
        return roleScopedProjects.filter((project) => {
            const isPersonalProject = userScope.role === 'staff' && personallyAssignedProjectIdSet.has(project.id);
            if (isPersonalProject) return true;

            const projectBranchId = project.branchId || DEFAULT_BRANCH_ID;
            const projectDepartmentId = project.departmentId || DEFAULT_DEPARTMENT_ID;

            if (effectiveScopeBranchId !== ALL_SCOPE_VALUE && projectBranchId !== effectiveScopeBranchId) return false;
            if (effectiveScopeDepartmentId !== ALL_SCOPE_VALUE && projectDepartmentId !== effectiveScopeDepartmentId) return false;
            return true;
        });
    }, [effectiveScopeBranchId, effectiveScopeDepartmentId, personallyAssignedProjectIdSet, roleScopedProjects, userScope.role]);

    const selectedScopedProjectIdSet = useMemo(
        () => new Set(selectedScopedProjects.map((project) => project.id)),
        [selectedScopedProjects]
    );

    const selectedScopedTasks = useMemo(() => {
        return roleScopedTasks.filter((task) => {
            const isPersonalTask = userScope.role === 'staff' && personallyAssignedTaskIdSet.has(task.id);
            if (isPersonalTask) return true;

            if (!selectedScopedProjectIdSet.has(task.projectId)) return false;
            const taskBranchId = task.branchId || DEFAULT_BRANCH_ID;
            const taskDepartmentId = task.departmentId || DEFAULT_DEPARTMENT_ID;

            if (effectiveScopeBranchId !== ALL_SCOPE_VALUE && taskBranchId !== effectiveScopeBranchId) return false;
            if (effectiveScopeDepartmentId !== ALL_SCOPE_VALUE && taskDepartmentId !== effectiveScopeDepartmentId) return false;
            return true;
        });
    }, [effectiveScopeBranchId, effectiveScopeDepartmentId, personallyAssignedTaskIdSet, roleScopedTasks, selectedScopedProjectIdSet, userScope.role]);

    const selectedScopedTeamMembers = useMemo(() => {
        return roleScopedTeamMembers.filter((member) => {
            const memberBranchId = member.branchId || DEFAULT_BRANCH_ID;
            const memberDepartmentId = member.departmentId || DEFAULT_DEPARTMENT_ID;

            if (effectiveScopeBranchId !== ALL_SCOPE_VALUE && memberBranchId !== effectiveScopeBranchId) return false;
            if (effectiveScopeDepartmentId !== ALL_SCOPE_VALUE && memberDepartmentId !== effectiveScopeDepartmentId) return false;
            return true;
        });
    }, [effectiveScopeBranchId, effectiveScopeDepartmentId, roleScopedTeamMembers]);

    const debouncedUpdate = useDebouncedUpdate();
    const updateTaskInState = useCallback((taskId: string, updater: (task: Task) => Task) => {
        setTasks((prev) => {
            const targetIndex = prev.findIndex((task) => task.id === taskId);
            if (targetIndex < 0) return prev;

            const currentTask = prev[targetIndex];
            const nextTask = updater(currentTask);
            if (nextTask === currentTask) return prev;

            const nextTasks = [...prev];
            nextTasks[targetIndex] = nextTask;
            return nextTasks;
        });
    }, []);

    // Local fallback with empty state (no demo seed data)
    const loadLocalFallback = useCallback(() => {
        setProjects([]);
        setTasks([]);
        setTeamMembers([]);
        setScopeBranchId(ALL_SCOPE_VALUE);
        setScopeDepartmentId(ALL_SCOPE_VALUE);
        setScopeCatalogBranches([]);
        setScopeCatalogDepartments([]);
        setActiveProjectId(null);
        setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    }, []);

    // ===== Firestore Real-time Subscriptions =====
    // NOTE: subtasks/attachments/activityLog are NOT subscribed globally.
    // They are loaded per-task via subscribeTaskDetails() when TaskDetailPage opens.
    // This avoids downloading ALL subtasks/attachments/activity across ALL tasks.
    useEffect(() => {
        if (authLoading) return;
        if (!user) return;

        let unsubProjects: (() => void) | undefined;
        let unsubTasks: (() => void) | undefined;
        let unsubMembers: (() => void) | undefined;
        let unsubUpdates: (() => void) | undefined;
        let unsubNotificationSettings: (() => void) | undefined;
        let unsubScopeCatalog: (() => void) | undefined;

        async function init() {
            setLoading(true);
            try {
                // Seed data if Firestore is empty
                await seedInitialData();

                // Subscribe to project-level collections only
                unsubProjects = subscribeProjects((data) => {
                    setProjects(data);
                    if (data.length > 0) {
                        const firstAccessibleProject = data.find((project) => canAccessScopedRecord(userScope, project)) || data[0];
                        setActiveProjectId((prev) => prev || firstAccessibleProject.id);
                    }
                });

                unsubTasks = subscribeTasks((data) => {
                    setTasks((prev) => (areTaskArraysEquivalent(prev, data) ? prev : data));
                });

                unsubMembers = subscribeTeamMembers((data) => {
                    setTeamMembers(data);
                });

                // taskUpdates remain global (lightweight text, needed for badge counts on main board)
                unsubUpdates = subscribeTaskUpdates((data) => {
                    const grouped: Record<string, TaskUpdate[]> = {};
                    data.forEach(upd => {
                        const tid = upd.taskId;
                        if (!grouped[tid]) grouped[tid] = [];
                        grouped[tid].push(upd);
                    });
                    setTaskUpdates(grouped);
                });

                unsubNotificationSettings = fbSubscribeNotificationSettings((settings) => {
                    setNotificationSettings(settings || DEFAULT_NOTIFICATION_SETTINGS);
                });

                unsubScopeCatalog = fbSubscribeScopeCatalog((catalog) => {
                    setScopeCatalogBranches(catalog.branches);
                    setScopeCatalogDepartments(catalog.departments);
                });

                setDataSource('firebase');
            } catch (err) {
                console.error('Firestore init failed, falling back to local:', err);
                setDataSource('local');
                loadLocalFallback();
            }
            setLoading(false);
        }

        init();

        return () => {
            unsubProjects?.();
            unsubTasks?.();
            unsubMembers?.();
            unsubUpdates?.();
            unsubNotificationSettings?.();
            unsubScopeCatalog?.();
        };
    }, [loadLocalFallback, authLoading, user, userScope]);

    const resolvedActiveProjectId = useMemo(() => {
        if (selectedScopedProjects.length === 0) return null;
        const isActiveProjectVisible = selectedScopedProjects.some((project) => project.id === activeProjectId);
        if (isActiveProjectVisible) return activeProjectId;
        return selectedScopedProjects[0].id;
    }, [activeProjectId, selectedScopedProjects]);

    // ===== Per-task subscription (called by TaskDetailPage) =====
    const subscribeTaskDetails = useCallback((taskId: string) => {
        if (dataSource !== 'firebase') return () => { };

        const unsub1 = subscribeSubTasksForTask(taskId, (subs) => {
            setSubtasks(prev => ({ ...prev, [taskId]: subs }));
        });
        const unsub2 = subscribeAttachmentsForTask(taskId, (atts) => {
            setAttachments(prev => ({ ...prev, [taskId]: atts }));
        });
        const unsub3 = subscribeActivityLogForTask(taskId, (entries) => {
            setActivityLog(prev => ({ ...prev, [taskId]: entries }));
        });

        return () => {
            unsub1();
            unsub2();
            unsub3();
            // Clean up state for this task to free memory
            setSubtasks(prev => { const next = { ...prev }; delete next[taskId]; return next; });
            setAttachments(prev => { const next = { ...prev }; delete next[taskId]; return next; });
            setActivityLog(prev => { const next = { ...prev }; delete next[taskId]; return next; });
        };
    }, [dataSource]);

    // Helper: log activity to Firestore
    const logActivity = useCallback(async (taskId: string, action: string, field?: string, oldValue?: string, newValue?: string) => {
        const entry: Omit<ActivityEntry, 'id'> = {
            taskId,
            action,
            field,
            oldValue: oldValue || undefined,
            newValue: newValue || undefined,
            user: currentUserName,
            timestamp: new Date().toISOString(),
        };

        if (dataSource === 'firebase') {
            try { await fbCreateActivityEntry(entry); } catch (e) { console.error(e); }
        } else {
            setActivityLog(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), { ...entry, id: `act-${Date.now()}` }]
            }));
        }
    }, [dataSource, currentUserName]);

    // ===== Sub-task handlers =====
    const addSubTask = useCallback(async (taskId: string, name: string) => {
        if (!name.trim()) return;
        const newSub = { taskId, name: name.trim(), completed: false, createdAt: new Date().toISOString() };
        if (dataSource === 'firebase') {
            await fbCreateSubTask(newSub);
        } else {
            setSubtasks(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), { ...newSub, id: `st-${Date.now()}` }] }));
        }
        logActivity(taskId, 'subtask_added', 'subtask', undefined, name.trim());
    }, [dataSource, logActivity]);

    const toggleSubTask = useCallback(async (taskId: string, subtaskId: string) => {
        const st = (subtasks[taskId] || []).find(s => s.id === subtaskId);
        if (!st) return;
        if (dataSource === 'firebase') {
            await fbUpdateSubTask(subtaskId, { completed: !st.completed });
        } else {
            setSubtasks(prev => ({ ...prev, [taskId]: (prev[taskId] || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s) }));
        }
    }, [dataSource, subtasks]);

    const deleteSubTask = useCallback(async (taskId: string, subtaskId: string) => {
        if (dataSource === 'firebase') {
            await deleteSubTaskDoc(subtaskId);
        } else {
            setSubtasks(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter(s => s.id !== subtaskId) }));
        }
    }, [dataSource]);

    // ===== Attachment handlers =====
    const addAttachment = useCallback(async (taskId: string, file: File) => {
        const base = {
            taskId,
            name: file.name,
            type: file.type,
            size: file.size,
            createdAt: new Date().toISOString(),
            uploadedBy: currentUserName,
        };

        if (dataSource === 'firebase') {
            const uploaded = await uploadTaskAttachmentFile(taskId, file);
            await fbCreateAttachment({
                ...base,
                url: uploaded.url,
                storagePath: uploaded.storagePath,
            });
        } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setAttachments(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), { ...base, data: dataUrl, id: `att-${Date.now()}` }],
            }));
        }

        logActivity(taskId, 'file_attached', 'attachment', undefined, file.name);
    }, [dataSource, logActivity, currentUserName]);

    const deleteAttachment = useCallback(async (taskId: string, attachmentId: string) => {
        const att = (attachments[taskId] || []).find(a => a.id === attachmentId);
        if (dataSource === 'firebase') {
            if (att?.storagePath) {
                try {
                    await deleteStorageFile(att.storagePath);
                } catch (error) {
                    console.error('Failed to delete file from storage:', error);
                }
            }
            await deleteAttachmentDoc(attachmentId);
        } else {
            setAttachments(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter(a => a.id !== attachmentId) }));
        }
        if (att) logActivity(taskId, 'file_removed', 'attachment', att.name, undefined);
    }, [dataSource, attachments, logActivity]);

    const updateNotificationSettings = useCallback(async (patch: Partial<NotificationSettings>) => {
        setNotificationSettings(prev => ({ ...prev, ...patch }));
        if (dataSource === 'firebase') {
            await fbUpsertNotificationSettings(patch);
        }
    }, [dataSource]);

    const addTaskUpdate = useCallback(async (taskId: string, text: string) => {
        const trimmedText = text.trim();
        if (!trimmedText) return;

        const updateDoc = {
            taskId,
            text: trimmedText,
            author: currentUserName,
            date: new Date().toISOString(),
        };

        if (dataSource === 'firebase') {
            await fbCreateTaskUpdate(updateDoc);
        } else {
            setTaskUpdates(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), { ...updateDoc, id: `upd-${Date.now()}` }],
            }));
        }

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        if (!notificationSettings.notifyTaskCommentAdded) return;

        const ownerNames = Array.from(new Set([
            ...((task.assignedEmployeeIds || []).map(ownerId => teamMembers.find(m => m.id === ownerId)?.name).filter((name): name is string => Boolean(name))),
            ...(task.responsible ? [task.responsible] : []),
        ]));
        if (ownerNames.length === 0) return;

        const project = projects.find(p => p.id === task.projectId);
        try {
            await Promise.all(
                ownerNames.map(async (ownerName) => {
                    const member = teamMembers.find(m => m.name === ownerName);
                    if (!member?.lineUserId) return;
                    await sendLineNotify({
                        to: member.lineUserId,
                        taskId: task.id,
                        taskName: task.name,
                        action: 'comment_added',
                        projectName: project?.name,
                        comment: trimmedText,
                    });
                })
            );
        } catch (error) {
            console.error('Failed to send LINE comment notification:', error);
        }
    }, [currentUserName, dataSource, tasks, teamMembers, projects, notificationSettings.notifyTaskCommentAdded]);

    const resolveWriteScope = useCallback((projectId?: string) => {
        const sourceProject = projectId ? projects.find((project) => project.id === projectId) : null;
        if (sourceProject) {
            return {
                orgId: sourceProject.orgId || userScope.orgId || DEFAULT_ORG_ID,
                branchId: sourceProject.branchId || DEFAULT_BRANCH_ID,
                departmentId: sourceProject.departmentId || DEFAULT_DEPARTMENT_ID,
            };
        }

        const preferredBranchId = effectiveScopeBranchId !== ALL_SCOPE_VALUE
            ? effectiveScopeBranchId
            : (userScope.branchIds[0] || DEFAULT_BRANCH_ID);

        let preferredDepartmentId = effectiveScopeDepartmentId !== ALL_SCOPE_VALUE
            ? effectiveScopeDepartmentId
            : (scopeDepartmentOptions.find((option) => option.id !== ALL_SCOPE_VALUE)?.id
                || userScope.departmentIds[0]
                || DEFAULT_DEPARTMENT_ID);

        if (preferredDepartmentId === ALL_SCOPE_VALUE) {
            preferredDepartmentId = userScope.departmentIds[0] || DEFAULT_DEPARTMENT_ID;
        }

        return {
            orgId: userScope.orgId || DEFAULT_ORG_ID,
            branchId: preferredBranchId,
            departmentId: preferredDepartmentId,
        };
    }, [effectiveScopeBranchId, effectiveScopeDepartmentId, projects, scopeDepartmentOptions, userScope]);

    const createWorkspace = useCallback(async (name: string, code?: string) => {
        const trimmedName = name.trim();
        const trimmedCode = (code || '').trim();
        if (!trimmedName) return;

        const now = new Date();
        const startDate = format(now, 'yyyy-MM-dd');
        const endDate = format(addDays(now, 30), 'yyyy-MM-dd');
        const scope = resolveWriteScope();
        const projectPayload: Omit<Project, 'id'> = {
            orgId: scope.orgId,
            branchId: scope.branchId,
            departmentId: scope.departmentId,
            name: trimmedName,
            owner: currentUserName,
            code: trimmedCode || undefined,
            description: '',
            startDate,
            endDate,
            overallProgress: 0,
            status: 'planning',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };

        if (dataSource === 'firebase') {
            const newProjectId = await fbCreateProject(projectPayload);
            setActiveProjectId(newProjectId);
            return;
        }

        const localProjectId = `proj-${Date.now()}`;
        setProjects(prev => [...prev, { ...projectPayload, id: localProjectId }]);
        setActiveProjectId(localProjectId);
    }, [currentUserName, dataSource, resolveWriteScope]);

    const updateWorkspace = useCallback(async (
        projectId: string,
        name: string,
        code?: string,
        status?: Project['status'],
        scope?: { branchId?: string; departmentId?: string }
    ) => {
        const trimmedName = name.trim();
        const trimmedCode = (code || '').trim();
        if (!trimmedName) return;
        const nextBranchId = scope?.branchId || DEFAULT_BRANCH_ID;
        const nextDepartmentId = scope?.departmentId || DEFAULT_DEPARTMENT_ID;

        if (dataSource === 'firebase') {
            await fbUpdateProject(projectId, {
                name: trimmedName,
                code: trimmedCode || undefined,
                status,
                branchId: nextBranchId,
                departmentId: nextDepartmentId,
            });
            return;
        }

        setProjects(prev =>
            prev.map(p =>
                p.id === projectId
                    ? {
                        ...p,
                        name: trimmedName,
                        code: trimmedCode || undefined,
                        ...(status ? { status } : {}),
                        branchId: nextBranchId,
                        departmentId: nextDepartmentId,
                        updatedAt: new Date().toISOString(),
                    }
                    : p
            )
        );
    }, [dataSource]);

    const deleteWorkspace = useCallback(async (projectId: string) => {
        const remainingProjects = projects.filter(p => p.id !== projectId);
        const nextActiveProjectId = remainingProjects[0]?.id || null;

        if (dataSource === 'firebase') {
            const taskIds = tasks.filter(t => t.projectId === projectId).map(t => t.id);
            if (taskIds.length > 0) {
                await Promise.all(taskIds.map(taskId => deleteTaskDoc(taskId)));
            }
            await fbDeleteProject(projectId);
        } else {
            setTasks(prev => prev.filter(t => t.projectId !== projectId));
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }

        if (resolvedActiveProjectId === projectId) {
            setActiveProjectId(nextActiveProjectId);
        }
    }, [dataSource, projects, resolvedActiveProjectId, tasks]);

    // ===== Task handlers =====
    const handleAddItem = useCallback(async (category: string) => {
        const projId = resolvedActiveProjectId || 'proj-1';
        const scope = resolveWriteScope(projId);
        const nextOrder =
            tasks
                .filter(t => t.projectId === projId && (t.category || '') === (category || ''))
                .reduce((maxOrder, task) => Math.max(maxOrder, task.order || 0), 0) + 1;
        const newTaskData: Omit<Task, 'id'> = {
            orgId: scope.orgId,
            branchId: scope.branchId,
            departmentId: scope.departmentId,
            projectId: projId,
            name: "New Task",
            category,
            responsible: "",
            assignedEmployeeIds: [],
            progress: 0,
            status: "not-started",
            planStartDate: format(new Date(), 'yyyy-MM-dd'),
            planEndDate: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
            planDuration: 5,
            estimatedHours: 8,
            order: nextOrder,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (dataSource === 'firebase') {
            await fbCreateTask(newTaskData);
        } else {
            setTasks(prev => [...prev, { ...newTaskData, id: `new-${Date.now()}` }]);
        }
    }, [dataSource, resolveWriteScope, resolvedActiveProjectId, tasks]);

    const handleDeleteItem = useCallback(async (taskId: string) => {
        if (dataSource === 'firebase') {
            await deleteTaskDoc(taskId);
        } else {
            setTasks(prev => prev.filter(t => t.id !== taskId));
        }
    }, [dataSource]);

    const handleUpdateTaskName = useCallback((taskId: string, newName: string) => {
        // Optimistic update locally
        updateTaskInState(taskId, (task) => ({ ...task, name: newName }));
        // Debounced write to Firestore
        if (dataSource === 'firebase') {
            debouncedUpdate(`name-${taskId}`, () => fbUpdateTask(taskId, { name: newName }));
        }
    }, [dataSource, debouncedUpdate, updateTaskInState]);

    const handleUpdateTaskOwners = useCallback(async (taskId: string, newOwners: string[]) => {
        const task = tasks.find(t => t.id === taskId);
        const normalizedOwners = Array.from(new Set(newOwners.map(owner => owner.trim()).filter(Boolean)));
        const primaryOwner = normalizedOwners[0] || '';
        const nextAssignedEmployeeIds = normalizedOwners
            .map(ownerName => teamMembers.find(m => m.name === ownerName)?.id)
            .filter((id): id is string => Boolean(id));
        const previousOwners = task
            ? Array.from(new Set([
                ...((task.assignedEmployeeIds || []).map(ownerId => teamMembers.find(m => m.id === ownerId)?.name).filter((name): name is string => Boolean(name))),
                ...(task.responsible ? [task.responsible] : []),
            ]))
            : [];
        const ownersChanged =
            previousOwners.length !== normalizedOwners.length ||
            previousOwners.some(owner => !normalizedOwners.includes(owner));

        if (task && ownersChanged) {
            logActivity(
                taskId,
                'owner_changed',
                'responsible',
                previousOwners.join(', ') || 'Unassigned',
                normalizedOwners.join(', ') || 'Unassigned'
            );
        }

        updateTaskInState(taskId, (task) => ({
            ...task,
            responsible: primaryOwner,
            assignedEmployeeIds: nextAssignedEmployeeIds,
        }));

        try {
            if (dataSource === 'firebase') {
                await fbUpdateTask(taskId, { responsible: primaryOwner, assignedEmployeeIds: nextAssignedEmployeeIds });
            }
        } catch (error) {
            console.error('Failed to update task owners:', error);
            updateTaskInState(taskId, (currentTask) => ({
                ...currentTask,
                responsible: task?.responsible || '',
                assignedEmployeeIds: task?.assignedEmployeeIds || [],
            }));
            throw error;
        }

        if (task) {
            const newlyAssignedOwners = normalizedOwners.filter(owner => !previousOwners.includes(owner));
            if (notificationSettings.notifyTaskAssigned && newlyAssignedOwners.length > 0) {
                const project = projects.find(p => p.id === task.projectId);
                const crewNames = normalizedOwners.filter(ownerName => ownerName !== primaryOwner);

                try {
                    await Promise.all(
                        newlyAssignedOwners.map(async (ownerName) => {
                            const member = teamMembers.find(m => m.name === ownerName);
                            if (!member?.lineUserId) return;
                            await sendLineNotify({
                                to: member.lineUserId,
                                taskId: task.id,
                                taskName: task.name,
                                action: 'assigned',
                                assignedBy: currentUserName,
                                projectName: project?.name,
                                owner: primaryOwner || 'ยังไม่ระบุ',
                                crew: crewNames.join(', ') || undefined,
                                timeline: `${task.planStartDate || '-'} - ${task.planEndDate || '-'}`,
                                priority: task.priority || '-',
                            });
                        })
                    );
                } catch (error) {
                    console.error('Failed to send LINE assignment notification:', error);
                }
            }
        }
    }, [currentUserName, tasks, teamMembers, projects, dataSource, logActivity, notificationSettings.notifyTaskAssigned, updateTaskInState]);

    const handleUpdateTaskOwner = useCallback((taskId: string, newOwner: string) => {
        void handleUpdateTaskOwners(taskId, newOwner ? [newOwner] : []);
    }, [handleUpdateTaskOwners]);

    const handleUpdateTaskStatus = useCallback(async (taskId: string, newStatus: TaskStatus) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.status !== newStatus) {
            logActivity(taskId, 'status_changed', 'status', task.status, newStatus);

        }

        const shouldForceCompletedProgress = newStatus === 'completed';
        updateTaskInState(taskId, (task) => ({
            ...task,
            status: newStatus,
            ...(shouldForceCompletedProgress ? { progress: 100 } : {}),
        }));

        try {
            if (dataSource === 'firebase') {
                const statusPatch: Partial<Task> = { status: newStatus };
                if (shouldForceCompletedProgress) {
                    statusPatch.progress = 100;
                }
                await fbUpdateTask(taskId, statusPatch);
            }
        } catch (error) {
            console.error('Failed to update task status:', error);
            if (task) {
                updateTaskInState(taskId, (currentTask) => ({
                    ...currentTask,
                    status: task.status,
                    progress: task.progress,
                }));
            }
            throw error;
        }

        if (task && notificationSettings.notifyTaskStatusChanged) {
            const ownerNames = Array.from(new Set([
                ...((task.assignedEmployeeIds || []).map(ownerId => teamMembers.find(m => m.id === ownerId)?.name).filter((name): name is string => Boolean(name))),
                ...(task.responsible ? [task.responsible] : []),
            ]));
            const project = projects.find(p => p.id === task.projectId);

            try {
                await Promise.all(
                    ownerNames.map(async (ownerName) => {
                        const member = teamMembers.find(m => m.name === ownerName);
                        if (!member?.lineUserId) return;
                        await sendLineNotify({
                            to: member.lineUserId,
                            taskId: task.id,
                            taskName: task.name,
                            action: 'status_changed',
                            newStatus,
                            projectName: project?.name,
                        });
                    })
                );
            } catch (error) {
                console.error('Failed to send LINE status notification:', error);
            }
        }
    }, [tasks, teamMembers, projects, dataSource, logActivity, notificationSettings.notifyTaskStatusChanged, updateTaskInState]);

    const handleUpdateTaskTimeline = useCallback(async (taskId: string, field: 'planStartDate' | 'planEndDate', newDate: string) => {
        if (!newDate) return;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            logActivity(taskId, 'timeline_changed', field, task[field], newDate);
        }
        updateTaskInState(taskId, (currentTask) => {
            const updatedTask = { ...currentTask, [field]: newDate };
            const start = new Date(updatedTask.planStartDate);
            const end = new Date(updatedTask.planEndDate);
            const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            return { ...updatedTask, planDuration: duration };
        });
        if (dataSource === 'firebase') {
            const nextStartDate = field === 'planStartDate' ? newDate : task?.planStartDate;
            const nextEndDate = field === 'planEndDate' ? newDate : task?.planEndDate;
            if (!nextStartDate || !nextEndDate) return;
            const start = new Date(nextStartDate);
            const end = new Date(nextEndDate);
            const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            const timelinePatch: Partial<Task> = { planDuration: duration };
            timelinePatch[field] = newDate;
            await fbUpdateTask(taskId, timelinePatch);
        }
    }, [tasks, dataSource, logActivity, updateTaskInState]);

    const handleUpdateTaskProgress = useCallback(async (taskId: string, newProgress: string) => {
        let p = parseInt(newProgress);
        if (isNaN(p)) p = 0;
        if (p < 0) p = 0;
        if (p > 100) p = 100;
        const task = tasks.find(t => t.id === taskId);
        const nextStatus: TaskStatus | undefined =
            p >= 100
                ? 'completed'
                : task?.status === 'completed'
                    ? (p === 0 ? 'not-started' : 'in-progress')
                    : undefined;

        updateTaskInState(taskId, (task) => ({
            ...task,
            progress: p,
            ...(nextStatus && nextStatus !== task.status ? { status: nextStatus } : {}),
        }));
        if (dataSource === 'firebase') {
            const patch: Partial<Task> = { progress: p };
            if (task && nextStatus && nextStatus !== task.status) {
                patch.status = nextStatus;
            }
            debouncedUpdate(`progress-${taskId}`, () => fbUpdateTask(taskId, patch));
        }
    }, [tasks, dataSource, debouncedUpdate, updateTaskInState]);

    const handleUpdateTaskPriority = useCallback(async (taskId: string, newPriority: TaskPriorityInput) => {
        const task = tasks.find(t => t.id === taskId);
        const normalizedPriority = newPriority || undefined;
        if (task && task.priority !== newPriority) {
            logActivity(taskId, 'priority_changed', 'priority', task.priority || 'none', newPriority || 'none');
        }
        updateTaskInState(taskId, (task) => ({ ...task, priority: normalizedPriority }));
        if (dataSource === 'firebase') {
            await fbUpdateTask(taskId, { priority: normalizedPriority });
        }
    }, [tasks, dataSource, logActivity, updateTaskInState]);

    const handleUpdateTaskEstimatedHours = useCallback(async (taskId: string, newHours: string) => {
        let hours = Number.parseFloat(newHours);
        if (!Number.isFinite(hours)) hours = 0;
        if (hours < 0) hours = 0;
        if (hours > 500) hours = 500;

        updateTaskInState(taskId, (task) => ({ ...task, estimatedHours: hours }));
        if (dataSource === 'firebase') {
            debouncedUpdate(`estimated-hours-${taskId}`, () => fbUpdateTask(taskId, { estimatedHours: hours }));
        }
    }, [dataSource, debouncedUpdate, updateTaskInState]);

    const handleUpdateTaskDescription = useCallback(async (taskId: string, description: string) => {
        updateTaskInState(taskId, (task) => ({ ...task, description }));
        if (dataSource === 'firebase') {
            await fbUpdateTask(taskId, { description });
        }
    }, [dataSource, updateTaskInState]);

    const handleUpdateTaskScope = useCallback(async (
        taskId: string,
        scope: { branchId: string; departmentId: string }
    ) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;

        const nextBranchId = scope.branchId || DEFAULT_BRANCH_ID;
        const nextDepartmentId = scope.departmentId || DEFAULT_DEPARTMENT_ID;
        const previousBranchId = task.branchId || DEFAULT_BRANCH_ID;
        const previousDepartmentId = task.departmentId || DEFAULT_DEPARTMENT_ID;

        if (previousBranchId === nextBranchId && previousDepartmentId === nextDepartmentId) {
            return;
        }

        if (previousBranchId !== nextBranchId) {
            logActivity(taskId, 'scope_changed', 'branchId', previousBranchId, nextBranchId);
        }
        if (previousDepartmentId !== nextDepartmentId) {
            logActivity(taskId, 'scope_changed', 'departmentId', previousDepartmentId, nextDepartmentId);
        }

        updateTaskInState(taskId, (currentTask) => ({
            ...currentTask,
            branchId: nextBranchId,
            departmentId: nextDepartmentId,
        }));

        if (dataSource === 'firebase') {
            await fbUpdateTask(taskId, {
                branchId: nextBranchId,
                departmentId: nextDepartmentId,
            });
        }
    }, [dataSource, logActivity, tasks, updateTaskInState]);

    return (
        <AppContext.Provider value={{
            projects: selectedScopedProjects, setProjects,
            tasks: selectedScopedTasks, setTasks,
            teamMembers: selectedScopedTeamMembers, setTeamMembers,
            scopeBranchId: effectiveScopeBranchId, setScopeBranchId,
            scopeDepartmentId: effectiveScopeDepartmentId, setScopeDepartmentId,
            scopeBranchOptions,
            scopeDepartmentOptions,
            taskScopeBranchOptions,
            taskScopeDepartmentOptions,
            canSelectScope: isScopeSelectionEnabled,
            loading,
            dataSource,
            notificationSettings,
            updateNotificationSettings,
            activeProjectId: resolvedActiveProjectId, setActiveProjectId,
            taskUpdates, addTaskUpdate,
            createWorkspace,
            updateWorkspace,
            deleteWorkspace,
            subtasks, addSubTask, toggleSubTask, deleteSubTask,
            attachments, addAttachment, deleteAttachment,
            activityLog,
            subscribeTaskDetails,
            currentUserName,
            handleAddItem, handleDeleteItem,
            handleUpdateTaskName, handleUpdateTaskOwner, handleUpdateTaskOwners,
            handleUpdateTaskStatus, handleUpdateTaskTimeline,
            handleUpdateTaskProgress, handleUpdateTaskPriority,
            handleUpdateTaskEstimatedHours,
            handleUpdateTaskDescription,
            handleUpdateTaskScope,
        }}>
            {children}
        </AppContext.Provider>
    );
}
