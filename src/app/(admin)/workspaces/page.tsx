'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, Task } from '@/types/construction';
import { format, addDays, isPast, addDays as addD } from 'date-fns';
import {
  Search, Plus, ChevronDown, LayoutGrid,
  Activity, MessageSquare, Trash2, Download, Upload,
  Filter, AlertTriangle, X, CalendarDays, Send, Clock3, Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import KanbanBoard from '@/components/KanbanBoard';
import TaskCalendarView from '@/components/TaskCalendarView';
import TaskUpdateDrawer from '@/components/TaskUpdateDrawer';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { useAppContext } from '@/contexts/AppContext';
import { createTask as fbCreateTask } from '@/lib/firestore';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';

// Priority helpers
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
const TASK_STATUSES: Task['status'][] = ['not-started', 'in-progress', 'completed', 'delayed'];
const PROJECT_STATUSES: Project['status'][] = ['planning', 'in-progress', 'on-hold', 'completed'];

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'bg-[#e2445c] text-white';
    case 'high': return 'bg-[#fdab3d] text-white';
    case 'medium': return 'bg-[#579bfc] text-white';
    case 'low': return 'bg-[#c4c4c4] text-white';
    default: return 'bg-[#e6e9ef] text-[#676879]';
  }
};

const getPriorityLabel = (priority?: string) => {
  switch (priority) {
    case 'urgent': return 'Urgent';
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return '-';
  }
};

const getProjectStatusLabel = (status: Project['status']) => {
  switch (status) {
    case 'planning': return 'Planning';
    case 'in-progress': return 'In Progress';
    case 'on-hold': return 'On Hold';
    case 'completed': return 'Completed';
    default: return status;
  }
};

// Check if task is overdue
const isOverdue = (task: Task): boolean => {
  if (task.status === 'completed') return false;
  if (!task.planEndDate) return false;
  const endDate = new Date(task.planEndDate);
  endDate.setHours(23, 59, 59); // End of day
  return isPast(endDate);
};

// Check if deadline is within 2 days
const isDueSoon = (task: Task): boolean => {
  if (task.status === 'completed') return false;
  if (!task.planEndDate) return false;
  const endDate = new Date(task.planEndDate);
  const twoDaysFromNow = addD(new Date(), 2);
  return !isPast(endDate) && endDate <= twoDaysFromNow;
};

export default function TaskBoardPage() {
  const router = useRouter();
  const {
    projects, tasks, setTasks, teamMembers, loading, dataSource,
    activeProjectId,
    updateWorkspace,
    deleteWorkspace,
    notificationSettings,
    taskUpdates, addTaskUpdate,
    handleAddItem, handleDeleteItem,
    handleUpdateTaskName, handleUpdateTaskOwners,
    handleUpdateTaskStatus, handleUpdateTaskTimeline,
    handleUpdateTaskProgress, handleUpdateTaskPriority,
  } = useAppContext();
  const modal = useConfirmModal();

  const [activeTab, setActiveTab] = useState<'table' | 'kanban' | 'calendar'>('table');
  const [activeOwnerDropdown, setActiveOwnerDropdown] = useState<string | null>(null);
  const [ownerDropdownAnchor, setOwnerDropdownAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeCrewDropdown, setActiveCrewDropdown] = useState<string | null>(null);
  const [crewDropdownAnchor, setCrewDropdownAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(null);
  const [statusDropdownAnchor, setStatusDropdownAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activePriorityDropdown, setActivePriorityDropdown] = useState<string | null>(null);
  const [priorityDropdownAnchor, setPriorityDropdownAnchor] = useState<{ x: number; y: number } | null>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskUpdateText, setTaskUpdateText] = useState("");
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isSendingLineReport, setIsSendingLineReport] = useState(false);
  const [pendingAddCategory, setPendingAddCategory] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [manualCategories, setManualCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [hideCompletedTasks, setHideCompletedTasks] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectStatusDraft, setProjectStatusDraft] = useState<Project['status']>('planning');
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("default"); // default, priority, dueDate, progress

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === activeProjectId),
    [tasks, activeProjectId]
  );
  const activeProjectName = activeProject?.name || '';
  const activeProjectStatus = activeProject?.status || 'planning';

  useEffect(() => {
    if (!activeProjectId) {
      setProjectNameDraft('');
      setProjectStatusDraft('planning');
      setShowProjectSettings(false);
      return;
    }
    setProjectNameDraft(activeProjectName);
    setProjectStatusDraft(activeProjectStatus);
  }, [activeProjectId, activeProjectName, activeProjectStatus]);

  const projectSettingsChanged = useMemo(() => {
    if (!activeProject) return false;
    return (
      projectNameDraft.trim() !== activeProject.name ||
      projectStatusDraft !== activeProject.status
    );
  }, [activeProject, projectNameDraft, projectStatusDraft]);

  const handleSaveProjectSettings = useCallback(async () => {
    if (!activeProject) return;
    const trimmedName = projectNameDraft.trim();
    if (!trimmedName) {
      void modal.alert('ต้องระบุชื่อโครงการ', { variant: 'warning' });
      return;
    }
    try {
      setSavingProjectSettings(true);
      await updateWorkspace(
        activeProject.id,
        trimmedName,
        activeProject.code,
        projectStatusDraft
      );
      setShowProjectSettings(false);
    } catch (error) {
      console.error('Failed to update project settings:', error);
      void modal.error('ไม่สามารถอัปเดตการตั้งค่าโครงการได้ โปรดลองอีกครั้ง');
    } finally {
      setSavingProjectSettings(false);
    }
  }, [activeProject, projectNameDraft, projectStatusDraft, updateWorkspace, modal]);

  const handleDeleteProject = useCallback(async () => {
    if (!activeProject || deletingProject) return;
    if (projects.length <= 1) {
      void modal.alert('ต้องมีพื้นที่ทำงานอย่างน้อยหนึ่งรายการ', { variant: 'warning' });
      return;
    }
    const confirmed = await modal.confirm({
      title: 'ยืนยันการลบ',
      message: `คุณต้องการลบพื้นที่ทำงาน "${activeProject.name}" และงานทั้งหมดหรือไม่?`,
      description: 'การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      confirmLabel: 'ลบ',
    });
    if (!confirmed) return;

    try {
      setDeletingProject(true);
      await deleteWorkspace(activeProject.id);
      setShowProjectSettings(false);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      void modal.error('ไม่สามารถลบพื้นที่ทำงานได้ โปรดลองอีกครั้ง');
    } finally {
      setDeletingProject(false);
    }
  }, [activeProject, deleteWorkspace, deletingProject, projects.length, modal]);

  const memberTypeByName = useMemo(() => {
    const map = new Map<string, 'team' | 'crew'>();
    teamMembers.forEach((member) => {
      map.set(member.name, member.memberType === 'crew' ? 'crew' : 'team');
    });
    return map;
  }, [teamMembers]);
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    teamMembers.forEach((member) => {
      map.set(member.id, member.name);
    });
    return map;
  }, [teamMembers]);
  const memberByName = useMemo(() => {
    const map = new Map<string, (typeof teamMembers)[number]>();
    teamMembers.forEach((member) => {
      map.set(member.name, member);
    });
    return map;
  }, [teamMembers]);
  const getTaskOwnerNames = useCallback((task: Task): string[] => {
    const ownerNamesFromIds = (task.assignedEmployeeIds || [])
      .map((ownerId) => memberNameById.get(ownerId))
      .filter((name): name is string => Boolean(name));
    const fallbackOwner = task.responsible ? [task.responsible] : [];
    return Array.from(new Set([...ownerNamesFromIds, ...fallbackOwner].map((name) => name.trim()).filter(Boolean)));
  }, [memberNameById]);

  // Apply filters, search, and sort
  const filteredTasks = useMemo(() => {
    let result = [...projectTasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        getTaskOwnerNames(t).some(owner => owner.toLowerCase().includes(q)) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      if (filterPriority === 'none') {
        result = result.filter(t => !t.priority);
      } else {
        result = result.filter(t => t.priority === filterPriority);
      }
    }

    // Filter by owner
    if (filterOwner !== 'all') {
      if (filterOwner === 'unassigned') {
        result = result.filter(t => getTaskOwnerNames(t).length === 0);
      } else {
        result = result.filter(t => getTaskOwnerNames(t).includes(filterOwner));
      }
    }

    // Sort
    if (sortBy === 'default') {
      result.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => (priorityOrder[a.priority || ''] ?? 4) - (priorityOrder[b.priority || ''] ?? 4));
    } else if (sortBy === 'dueDate') {
      result.sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());
    } else if (sortBy === 'progress') {
      result.sort((a, b) => b.progress - a.progress);
    }

    return result;
  }, [projectTasks, searchQuery, filterStatus, filterPriority, filterOwner, sortBy, getTaskOwnerNames]);

  const assignmentByTaskId = useMemo(() => {
    const map = new Map<string, { assignedNames: string[]; ownerNames: string[]; crewNames: string[] }>();
    projectTasks.forEach((task) => {
      const assignedNames = getTaskOwnerNames(task);
      map.set(task.id, {
        assignedNames,
        ownerNames: assignedNames.filter((name) => memberTypeByName.get(name) !== 'crew'),
        crewNames: assignedNames.filter((name) => memberTypeByName.get(name) === 'crew'),
      });
    });
    return map;
  }, [projectTasks, getTaskOwnerNames, memberTypeByName]);

  // Counts for header badges
  const { overdueCount, dueSoonCount, unassignedCount } = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let unassigned = 0;

    projectTasks.forEach((task) => {
      if (isOverdue(task)) overdue += 1;
      if (isDueSoon(task)) dueSoon += 1;
      const assignment = assignmentByTaskId.get(task.id);
      if (!assignment || assignment.assignedNames.length === 0) unassigned += 1;
    });

    return {
      overdueCount: overdue,
      dueSoonCount: dueSoon,
      unassignedCount: unassigned,
    };
  }, [projectTasks, assignmentByTaskId]);

  const twoDayCompletionReport = useMemo(() => {
    const toLocalDateKey = (isoValue?: string) => {
      if (!isoValue) return '';
      const parsed = new Date(isoValue);
      if (Number.isNaN(parsed.getTime())) return '';
      return format(parsed, 'yyyy-MM-dd');
    };
    const toLocalTimeLabel = (isoValue?: string) => {
      if (!isoValue) return '-';
      const parsed = new Date(isoValue);
      if (Number.isNaN(parsed.getTime())) return '-';
      return format(parsed, 'HH:mm');
    };

    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const yesterdayKey = format(addDays(today, -1), 'yyyy-MM-dd');
    const visibleLimit = 8;

    const completedTasks = projectTasks.filter((task) => task.status === 'completed');
    const toSortedItems = (items: Task[]) =>
      [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const todayCompleted = toSortedItems(
      completedTasks.filter((task) => toLocalDateKey(task.updatedAt) === todayKey)
    );
    const yesterdayCompleted = toSortedItems(
      completedTasks.filter((task) => toLocalDateKey(task.updatedAt) === yesterdayKey)
    );

    const mapDocumentItems = (items: Task[]) =>
      items.slice(0, visibleLimit).map((task) => {
        const assignment = assignmentByTaskId.get(task.id);
        const ownerNames = assignment?.ownerNames || [];
        const crewNames = assignment?.crewNames || [];

        return {
          name: task.name,
          ownerLabel: ownerNames.length > 0 ? ownerNames.join(', ') : 'ยังไม่ระบุ',
          crewLabel: crewNames.length > 0 ? crewNames.join(', ') : '-',
          timeLabel: toLocalTimeLabel(task.updatedAt),
        };
      });

    return {
      todayDateLabel: format(today, 'dd/MM/yyyy'),
      yesterdayDateLabel: format(addDays(today, -1), 'dd/MM/yyyy'),
      todayDoneCount: todayCompleted.length,
      yesterdayDoneCount: yesterdayCompleted.length,
      totalCompletedCount: completedTasks.length,
      todayItems: mapDocumentItems(todayCompleted),
      yesterdayItems: mapDocumentItems(yesterdayCompleted),
      todayMoreCount: Math.max(todayCompleted.length - visibleLimit, 0),
      yesterdayMoreCount: Math.max(yesterdayCompleted.length - visibleLimit, 0),
    };
  }, [projectTasks, assignmentByTaskId]);

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || filterOwner !== 'all' || searchQuery.trim() !== '';

  // Group filtered tasks by category (and include manually added empty categories when no active filters)
  const allGroups = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      const cat = task.category || 'ไม่มีหมวดหมู่';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(task);
    });

    if (!hasActiveFilters) {
      manualCategories.forEach((category) => {
        if (!grouped[category]) grouped[category] = [];
      });
    }

    return grouped;
  }, [filteredTasks, hasActiveFilters, manualCategories]);

  const hiddenCompletedCount = useMemo(
    () => filteredTasks.filter((task) => task.status === 'completed').length,
    [filteredTasks]
  );

  const visibleGroups = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    Object.entries(allGroups).forEach(([category, categoryTasks]) => {
      const visibleTasks = hideCompletedTasks
        ? categoryTasks.filter((task) => task.status !== 'completed')
        : categoryTasks;

      if (visibleTasks.length > 0 || (!hasActiveFilters && manualCategories.includes(category))) {
        grouped[category] = visibleTasks;
      }
    });

    return grouped;
  }, [allGroups, hideCompletedTasks, hasActiveFilters, manualCategories]);

  const groupCategoryKeys = useMemo(() => Object.keys(visibleGroups), [visibleGroups]);
  const allCategoriesCollapsed = groupCategoryKeys.length > 0
    && groupCategoryKeys.every((category) => Boolean(collapsedCategories[category]));
  const hasOnlyHiddenDoneTasks = hideCompletedTasks && filteredTasks.length > 0 && groupCategoryKeys.length === 0;

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleAllCategories = () => {
    setCollapsedCategories((prev) => {
      const shouldCollapseAll = groupCategoryKeys.some((category) => !prev[category]);
      const next = { ...prev };

      groupCategoryKeys.forEach((category) => {
        next[category] = shouldCollapseAll;
      });

      return next;
    });
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterOwner('all');
    setSearchQuery('');
    setSortBy('default');
  };

  const handleCreateCategory = () => {
    const categoryName = newCategoryName.trim();
    if (!categoryName) return;

    const existingCategories = new Set(
      [
        ...projectTasks.map((task) => (task.category || 'ไม่มีหมวดหมู่').toLowerCase()),
        ...manualCategories.map((category) => category.toLowerCase()),
      ]
    );
    if (existingCategories.has(categoryName.toLowerCase())) {
      void modal.alert('มีหมวดหมู่นี้อยู่แล้ว', { variant: 'warning' });
      return;
    }

    setManualCategories((prev) => [...prev, categoryName]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleAddUpdate = async () => {
    if (!selectedTask || taskUpdateText.trim() === "") return;
    await addTaskUpdate(selectedTask.id, taskUpdateText);
    setTaskUpdateText("");
  };

  const toggleOwnerDropdown = (taskId: string, anchorEl: HTMLDivElement) => {
    if (activeOwnerDropdown === taskId) {
      setActiveOwnerDropdown(null);
      setOwnerDropdownAnchor(null);
      return;
    }
    setActiveCrewDropdown(null);
    setCrewDropdownAnchor(null);
    setActiveStatusDropdown(null);
    setStatusDropdownAnchor(null);
    setActivePriorityDropdown(null);
    setPriorityDropdownAnchor(null);
    const rect = anchorEl.getBoundingClientRect();
    setOwnerDropdownAnchor({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 6,
    });
    setActiveOwnerDropdown(taskId);
  };

  const toggleCrewDropdown = (taskId: string, anchorEl: HTMLDivElement) => {
    if (activeCrewDropdown === taskId) {
      setActiveCrewDropdown(null);
      setCrewDropdownAnchor(null);
      return;
    }
    setActiveOwnerDropdown(null);
    setOwnerDropdownAnchor(null);
    setActiveStatusDropdown(null);
    setStatusDropdownAnchor(null);
    setActivePriorityDropdown(null);
    setPriorityDropdownAnchor(null);
    const rect = anchorEl.getBoundingClientRect();
    setCrewDropdownAnchor({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 6,
    });
    setActiveCrewDropdown(taskId);
  };

  const toggleStatusDropdown = (taskId: string, anchorEl: HTMLDivElement) => {
    if (activeStatusDropdown === taskId) {
      setActiveStatusDropdown(null);
      setStatusDropdownAnchor(null);
      return;
    }
    setActiveOwnerDropdown(null);
    setOwnerDropdownAnchor(null);
    setActiveCrewDropdown(null);
    setCrewDropdownAnchor(null);
    setActivePriorityDropdown(null);
    setPriorityDropdownAnchor(null);
    const rect = anchorEl.getBoundingClientRect();
    setStatusDropdownAnchor({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 6,
    });
    setActiveStatusDropdown(taskId);
  };

  const togglePriorityDropdown = (taskId: string, anchorEl: HTMLDivElement) => {
    if (activePriorityDropdown === taskId) {
      setActivePriorityDropdown(null);
      setPriorityDropdownAnchor(null);
      return;
    }
    setActiveOwnerDropdown(null);
    setOwnerDropdownAnchor(null);
    setActiveCrewDropdown(null);
    setCrewDropdownAnchor(null);
    setActiveStatusDropdown(null);
    setStatusDropdownAnchor(null);
    const rect = anchorEl.getBoundingClientRect();
    setPriorityDropdownAnchor({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 6,
    });
    setActivePriorityDropdown(taskId);
  };

  useEffect(() => {
    if (!activeOwnerDropdown && !activeCrewDropdown && !activeStatusDropdown && !activePriorityDropdown) return;
    const closeDropdowns = () => {
      setActiveOwnerDropdown(null);
      setOwnerDropdownAnchor(null);
      setActiveCrewDropdown(null);
      setCrewDropdownAnchor(null);
      setActiveStatusDropdown(null);
      setStatusDropdownAnchor(null);
      setActivePriorityDropdown(null);
      setPriorityDropdownAnchor(null);
    };
    window.addEventListener('scroll', closeDropdowns, true);
    window.addEventListener('resize', closeDropdowns);
    return () => {
      window.removeEventListener('scroll', closeDropdowns, true);
      window.removeEventListener('resize', closeDropdowns);
    };
  }, [activeOwnerDropdown, activeCrewDropdown, activeStatusDropdown, activePriorityDropdown]);

  const openDeleteTaskModal = (task: Task) => {
    setPendingDeleteTask(task);
  };

  const openAddTaskModal = (category: string) => {
    setPendingAddCategory(category);
  };

  const closeAddTaskModal = () => {
    if (isCreatingTask) return;
    setPendingAddCategory(null);
  };

  const closeDeleteTaskModal = () => {
    if (isDeletingTask) return;
    setPendingDeleteTask(null);
  };

  const confirmAddTask = async () => {
    if (!pendingAddCategory || isCreatingTask) return;
    try {
      setIsCreatingTask(true);
      await Promise.resolve(handleAddItem(pendingAddCategory));
      setPendingAddCategory(null);
    } catch (error) {
      console.error('Failed to add task:', error);
      void modal.error('ไม่สามารถเพิ่มงานได้ โปรดลองอีกครั้ง');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const confirmDeleteTask = async () => {
    if (!pendingDeleteTask || isDeletingTask) return;
    try {
      setIsDeletingTask(true);
      await Promise.resolve(handleDeleteItem(pendingDeleteTask.id));
      setPendingDeleteTask(null);
    } catch (error) {
      console.error('Failed to delete task:', error);
      void modal.error('ไม่สามารถลบงานได้ โปรดลองอีกครั้ง');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleSendLineAdminReport = async () => {
    if (isSendingLineReport) return;
    const confirmed = await modal.confirm({
      title: 'ส่งรายงาน LINE',
      message: 'ส่งรายงานโครงการไปยังผู้ดูแลระบบ LINE ตอนนี้หรือไม่?',
    });
    if (!confirmed) return;

    const reportType = notificationSettings.lineReportType || 'project-summary';
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const statusCounts = projectTasks.reduce(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      { 'not-started': 0, 'in-progress': 0, completed: 0, delayed: 0 } as Record<Task['status'], number>
    );
    const teamLoad = teamMembers
      .map((member) => {
        const memberTasks = projectTasks.filter((task) =>
          (assignmentByTaskId.get(task.id)?.assignedNames || []).includes(member.name)
        );
        const openTasks = memberTasks.filter((task) => task.status !== 'completed');
        return {
          name: member.name,
          totalOpen: openTasks.length,
          dueToday: openTasks.filter((task) => task.planEndDate === todayKey).length,
          overdue: openTasks.filter((task) => isOverdue(task)).length,
        };
      })
      .filter((item) => item.totalOpen > 0 || item.dueToday > 0 || item.overdue > 0);

    try {
      setIsSendingLineReport(true);
      const response = await fetch('/api/line-admin-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: activeProject?.name || 'Unknown Project',
          projectId: activeProject?.id || '',
          adminLineUserId: (notificationSettings.lineAdminUserId || '').trim(),
          reportType,
          teamLoad,
          completedDigest: {
            todayDate: twoDayCompletionReport.todayDateLabel,
            yesterdayDate: twoDayCompletionReport.yesterdayDateLabel,
            todayDone: twoDayCompletionReport.todayDoneCount,
            yesterdayDone: twoDayCompletionReport.yesterdayDoneCount,
            todayTasks: twoDayCompletionReport.todayItems.map(
              (item) => `${item.name} (Owner: ${item.ownerLabel}${item.crewLabel !== '-' ? `; Crew: ${item.crewLabel}` : ''})`
            ),
            yesterdayTasks: twoDayCompletionReport.yesterdayItems.map(
              (item) => `${item.name} (Owner: ${item.ownerLabel}${item.crewLabel !== '-' ? `; Crew: ${item.crewLabel}` : ''})`
            ),
            todayMore: twoDayCompletionReport.todayMoreCount,
            yesterdayMore: twoDayCompletionReport.yesterdayMoreCount,
          },
          metrics: {
            totalTasks: projectTasks.length,
            overdue: overdueCount,
            dueSoon: dueSoonCount,
            unassigned: unassignedCount,
            notStarted: statusCounts['not-started'],
            inProgress: statusCounts['in-progress'],
            completed: statusCounts.completed,
            delayed: statusCounts.delayed,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to send report');
      }

      void modal.success('ส่งรายงานไปยังผู้ดูแลระบบ LINE เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Failed to send LINE admin report:', error);
      void modal.error('ไม่สามารถส่งรายงานไปยังผู้ดูแลระบบ LINE ได้ โปรดตรวจสอบการตั้งค่า LINE');
    } finally {
      setIsSendingLineReport(false);
    }
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Task Name', 'Category', 'Responsible', 'Status', 'Priority', 'Plan Start', 'Plan End', 'Duration (Days)', 'Progress (%)'];
    const csvRows = [headers.join(',')];

    projectTasks.forEach(task => {
      const ownerDisplay = getTaskOwnerNames(task).join('; ');
      const row = [
        `"${task.name.replace(/"/g, '""')}"`,
        `"${(task.category || '').replace(/"/g, '""')}"`,
        `"${ownerDisplay.replace(/"/g, '""')}"`,
        task.status,
        task.priority || '',
        task.planStartDate,
        task.planEndDate,
        task.planDuration,
        task.progress
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Thai chars
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject?.name || 'tasks'}_export_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string).replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
        if (lines.length < 2) {
          void modal.alert('CSV ไม่มีแถวข้อมูล', { variant: 'warning' });
          return;
        }

        const parseCsvRow = (row: string): string[] => {
          const rowValues: string[] = [];
          let inQuotes = false;
          let currentVal = '';

          for (let j = 0; j < row.length; j++) {
            const char = row[j];
            if (char === '"' && row[j + 1] === '"') {
              currentVal += '"';
              j++;
            } else if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              rowValues.push(currentVal.trim());
              currentVal = '';
            } else {
              currentVal += char;
            }
          }

          rowValues.push(currentVal.trim());
          return rowValues;
        };

        const headers = parseCsvRow(lines[0]).map((header) => header.trim().replace(/^"|"$/g, ''));
        const headerLookup = new Map<string, number>(
          headers.map((header, index) => [header.toLowerCase(), index])
        );

        const getValue = (rowValues: string[], ...keys: string[]) => {
          for (const key of keys) {
            const keyIndex = headerLookup.get(key.toLowerCase());
            if (keyIndex !== undefined) {
              return (rowValues[keyIndex] || '').trim().replace(/^"|"$/g, '');
            }
          }
          return '';
        };

        const toIsoDate = (value: string): string => {
          if (!value || value === '-') return '';
          const cleaned = value.trim();
          if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(cleaned)) {
            const [d, m, y] = cleaned.split(/[/-]/);
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
            return cleaned;
          }
          return '';
        };

        const newTasks: Task[] = [];
        const baseOrder = Math.max(...tasks.map((task) => task.order || 0), 0);
        const nowIso = new Date().toISOString();
        const defaultStart = format(new Date(), 'yyyy-MM-dd');
        const defaultEnd = format(addDays(new Date(), 5), 'yyyy-MM-dd');

        for (let i = 1; i < lines.length; i++) {
          const rowValues = parseCsvRow(lines[i]);
          if (rowValues.length < 2) continue;

          const name = getValue(rowValues, 'Task Name', 'Name', 'Task');
          if (!name) continue;

          const category = getValue(rowValues, 'Category') || 'Uncategorized';
          const importedStatusRaw = getValue(rowValues, 'Status').toLowerCase();
          const importedPriorityRaw = getValue(rowValues, 'Priority').toLowerCase();
          const importedProgressRaw = getValue(rowValues, 'Progress', 'Progress (%)').replace('%', '');
          const importedProgress = Number.parseFloat(importedProgressRaw || '0');

          let normalizedStatus: Task['status'] = 'not-started';
          if (TASK_STATUSES.includes(importedStatusRaw as Task['status'])) {
            normalizedStatus = importedStatusRaw as Task['status'];
          }
          if (Number.isFinite(importedProgress) && importedProgress >= 100) {
            normalizedStatus = 'completed';
          }

          let normalizedPriority: Task['priority'] = undefined;
          if (PRIORITIES.includes(importedPriorityRaw as (typeof PRIORITIES)[number])) {
            normalizedPriority = importedPriorityRaw as Task['priority'];
          }

          let normalizedProgress = Number.isFinite(importedProgress) ? importedProgress : 0;
          normalizedProgress = Math.max(0, Math.min(100, normalizedProgress));
          if (normalizedStatus === 'completed') {
            normalizedProgress = 100;
          }

          const planStartDate = toIsoDate(getValue(rowValues, 'Plan Start', 'PlanStartDate', 'Start Date'));
          const planEndDate = toIsoDate(getValue(rowValues, 'Plan End', 'PlanEndDate', 'End Date'));

          const importedOwnersRaw = getValue(rowValues, 'Responsible', 'Owner', 'Owners');
          const importedOwners = importedOwnersRaw
            .split(/[;,|]/)
            .map((value) => value.trim())
            .filter(Boolean);
          const importedAssignedEmployeeIds = importedOwners
            .map((ownerName) => teamMembers.find((member) => member.name === ownerName)?.id)
            .filter((id): id is string => Boolean(id));

          const parsedDuration = Number.parseInt(
            getValue(rowValues, 'Duration', 'Duration (Days)', 'PlanDuration') || '5',
            10
          );

          newTasks.push({
            id: `imp-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            projectId: activeProjectId || 'proj-1',
            name,
            category,
            responsible: importedOwners[0] || '',
            assignedEmployeeIds: importedAssignedEmployeeIds,
            progress: normalizedProgress,
            status: normalizedStatus,
            priority: normalizedPriority,
            planStartDate: planStartDate || defaultStart,
            planEndDate: planEndDate || defaultEnd,
            planDuration: Number.isFinite(parsedDuration) ? parsedDuration : 5,
            order: baseOrder + newTasks.length + 1,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }

        if (newTasks.length > 0) {
          if (dataSource === 'firebase') {
            await Promise.all(
              newTasks.map((task) => {
                const taskPayload = { ...task };
                delete (taskPayload as Partial<Task>).id;
                if ((taskPayload as Partial<Task>).priority === undefined) {
                  delete (taskPayload as Partial<Task>).priority;
                }
                return fbCreateTask(taskPayload as Omit<Task, 'id'>);
              })
            );
          } else {
            setTasks([...tasks, ...newTasks]);
          }
          void modal.success(`นำเข้างาน ${newTasks.length} รายการจาก CSV สำเร็จ`);
        } else {
          void modal.alert('ไม่พบแถวงานที่ถูกต้องใน CSV', { variant: 'warning' });
        }
      } catch (err) {
        console.error(err);
        void modal.error('ไม่สามารถนำเข้า CSV ได้ โปรดตรวจสอบรูปแบบไฟล์และคอลัมน์ที่จำเป็น');
      }
    };

    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  if (loading) return <LinearLoadingScreen message="Loading task board..." />;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
      {/* Header */}
      <header className="min-h-[64px] bg-white flex flex-wrap items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-3 shrink-0 transition-all">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#323338] truncate flex items-center gap-2">
            {activeProject ? activeProject.name : 'เลือกโครงการ'}
            {/* Overdue badge */}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 bg-[#ffebef] text-[#e2445c] px-2.5 py-0.5 rounded-full text-[12px] font-bold animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} Overdue
              </span>
            )}
            {dueSoonCount > 0 && (
              <span className="flex items-center gap-1 bg-[#fff3e0] text-[#fdab3d] px-2.5 py-0.5 rounded-full text-[12px] font-bold">
                {dueSoonCount} Due Soon
              </span>
            )}
          </h1>
          {activeProject && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-[#eef3fb] border border-[#d0dbe9] px-2.5 py-0.5 text-[11px] font-semibold text-[#33495f]">
                {getProjectStatusLabel(activeProject.status)}
              </span>
              <button
                type="button"
                onClick={() => setShowProjectSettings((prev) => !prev)}
                className="px-2.5 py-1 rounded-md border border-[#d0d4e4] bg-white text-[#323338] text-[12px] font-medium hover:bg-[#f5f6f8] transition-colors"
                title={showProjectSettings ? 'ปิดการตั้งค่าโครงการ' : 'แก้ไขการตั้งค่าโครงการ'}
              >
                {showProjectSettings ? 'ปิดการตั้งค่าโครงการ' : 'แก้ไขการตั้งค่าโครงการ'}
              </button>
            </div>
          )}
          {activeProject && showProjectSettings && (
            <div className="mt-2 max-w-[460px] rounded-xl border border-[#d0d4e4] bg-[#f8fafc] p-3 flex flex-col gap-2">
              <label className="text-[12px] font-medium text-[#495d71]">ชื่อโครงการ</label>
              <input
                type="text"
                value={projectNameDraft}
                onChange={(e) => setProjectNameDraft(e.target.value)}
                placeholder="ชื่อโครงการ"
                className="w-full rounded-lg border border-[#c4cede] bg-white px-3 py-2 text-[13px] text-[#233548] outline-none focus:border-[#0073ea] focus:ring-2 focus:ring-[#0073ea]/20"
              />
              <label className="text-[12px] font-medium text-[#495d71]">สถานะโครงการ</label>
              <select
                value={projectStatusDraft}
                onChange={(e) => setProjectStatusDraft(e.target.value as Project['status'])}
                className="w-full rounded-lg border border-[#c4cede] bg-white px-3 py-2 text-[13px] text-[#233548] outline-none focus:border-[#0073ea] focus:ring-2 focus:ring-[#0073ea]/20"
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getProjectStatusLabel(status)}
                  </option>
                ))}
              </select>
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteProject()}
                  disabled={deletingProject || projects.length <= 1}
                  className="mr-auto px-3 py-1.5 rounded-lg border border-[#e2445c] bg-[#fff2f4] text-[#c62846] text-[12px] font-medium hover:bg-[#ffe7ec] disabled:opacity-50 disabled:cursor-not-allowed"
                  title={projects.length <= 1 ? 'ไม่สามารถลบพื้นที่ทำงานสุดท้ายได้' : 'ลบพื้นที่ทำงาน'}
                >
                  {deletingProject ? 'กำลังลบ...' : 'ลบพื้นที่ทำงาน'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProjectNameDraft(activeProject.name);
                    setProjectStatusDraft(activeProject.status);
                    setShowProjectSettings(false);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#cfd6e4] bg-white text-[#4a5f75] text-[12px] font-medium hover:bg-[#eef2f8]"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProjectSettings()}
                  disabled={!projectSettingsChanged || savingProjectSettings || !projectNameDraft.trim()}
                  className="px-3 py-1.5 rounded-lg border border-[#0073ea] bg-[#0073ea] text-white text-[12px] font-medium hover:bg-[#0063c7] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingProjectSettings ? 'กำลังบันทึก...' : 'บันทึกโครงการ'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-2.5 h-[18px] w-[18px] text-[#676879]" />
            <input
              type="text"
              placeholder="ค้นหางาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#f5f6f8] border border-[#d0d4e4] rounded-full text-[15px] focus:ring-2 focus:ring-[#0073ea] focus:border-[#0073ea] outline-none w-full sm:w-56 transition-all focus:bg-white placeholder:text-[#676879]"
            />
          </div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportFileUpload}
            className="hidden"
          />
          <button
            onClick={handleImportButtonClick}
            className="flex items-center gap-2 px-3 py-2 bg-[#f5f6f8] hover:bg-[#d0d4e4] text-[#323338] border border-[#d0d4e4] rounded-lg transition-colors font-medium text-[13px]"
            title="นำเข้า CSV"
          >
            <Download className="w-4 h-4" /> นำเข้า
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-[#f5f6f8] hover:bg-[#d0d4e4] text-[#323338] border border-[#d0d4e4] rounded-lg transition-colors font-medium text-[13px]"
            title="ส่งออก CSV"
          >
            <Upload className="w-4 h-4" /> ส่งออก
          </button>
          <button
            onClick={() => void handleSendLineAdminReport()}
            disabled={isSendingLineReport}
            className="flex items-center gap-2 px-3 py-2 bg-[#0073ea] hover:bg-[#0060c0] text-white border border-[#0073ea] rounded-lg transition-colors font-medium text-[13px] disabled:opacity-60 disabled:cursor-not-allowed"
            title="ส่งรายงานให้ผู้ดูแลระบบ LINE"
          >
            <Send className="w-4 h-4" /> {isSendingLineReport ? 'กำลังส่ง...' : 'ส่งรายงาน'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/reports/completed-2-days')}
            className="flex items-center gap-2 px-3 py-2 bg-[#f5f6f8] hover:bg-[#d0d4e4] text-[#323338] border border-[#d0d4e4] rounded-lg transition-colors font-medium text-[13px]"
            title="Open 2-day report page"
          >
            รายงาน 2 วัน (PDF)
          </button>
        </div>
      </header>

      {/* View Tabs + Filter Bar */}
      <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 bg-white border-b border-[#d0d4e4] shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="flex items-center gap-5 sm:gap-8 text-[14px] sm:text-[15px] overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('table')}
              className={`pb-3 flex items-center gap-2 border-b-[3px] font-medium transition-colors whitespace-nowrap ${activeTab === 'table' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-[#676879] hover:text-[#323338]'}`}
            >
              <Activity className="w-4 h-4" /> ตารางหลัก
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`pb-3 flex items-center gap-2 border-b-[3px] font-medium transition-colors whitespace-nowrap ${activeTab === 'kanban' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-[#676879] hover:text-[#323338]'}`}
            >
              <LayoutGrid className="w-4 h-4" /> คัมบัง
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`pb-3 flex items-center gap-2 border-b-[3px] font-medium transition-colors whitespace-nowrap ${activeTab === 'calendar' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-[#676879] hover:text-[#323338]'}`}
            >
              <CalendarDays className="w-4 h-4" /> ปฏิทิน
            </button>
          </div>

          {/* Filter & Sort controls */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${showFilters || hasActiveFilters
                ? 'bg-[#cce5ff] text-[#0052cc] border-[#0073ea]'
                : 'bg-white text-[#676879] border-[#d0d4e4] hover:bg-[#f5f6f8]'
                }`}
            >
              <Filter className="w-3.5 h-3.5" /> ตัวกรอง
              {hasActiveFilters && (
                <span className="ml-1 bg-[#0073ea] text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">!</span>
              )}
            </button>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[#d0d4e4] bg-white text-[#676879] outline-none cursor-pointer hover:bg-[#f5f6f8]"
            >
              <option value="default">ค่าเริ่มต้น</option>
              <option value="priority">ความสำคัญ</option>
              <option value="dueDate">วันครบกำหนด</option>
              <option value="progress">ความคืบหน้า</option>
            </select>
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="flex items-center gap-3 pb-4 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border outline-none cursor-pointer transition-colors ${filterStatus !== 'all' ? 'border-[#0073ea] bg-[#cce5ff] text-[#0052cc]' : 'border-[#d0d4e4] bg-white text-[#676879]'
                }`}
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="not-started">ยังไม่เริ่ม</option>
              <option value="in-progress">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="delayed">ติดขัด</option>
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border outline-none cursor-pointer transition-colors ${filterPriority !== 'all' ? 'border-[#0073ea] bg-[#cce5ff] text-[#0052cc]' : 'border-[#d0d4e4] bg-white text-[#676879]'
                }`}
            >
              <option value="all">ความสำคัญทั้งหมด</option>
              <option value="urgent">ด่วนมาก</option>
              <option value="high">สูง</option>
              <option value="medium">ปานกลาง</option>
              <option value="low">ต่ำ</option>
              <option value="none">- ไม่ระบุความสำคัญ</option>
            </select>

            {/* Owner Filter */}
            <select
              value={filterOwner}
              onChange={e => setFilterOwner(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border outline-none cursor-pointer transition-colors ${filterOwner !== 'all' ? 'border-[#0073ea] bg-[#cce5ff] text-[#0052cc]' : 'border-[#d0d4e4] bg-white text-[#676879]'
                }`}
            >
              <option value="all">ผู้รับผิดชอบทั้งหมด</option>
              <option value="unassigned">ยังไม่ระบุ</option>
              {teamMembers.filter((member) => member.memberType !== 'crew').map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[#e2445c] hover:bg-[#ffebef] rounded-lg transition-colors font-medium"
              >
                <X className="w-3.5 h-3.5" /> ล้างทั้งหมด
              </button>
            )}

            <span className="text-[12px] text-[#a0a2b1] ml-0 sm:ml-auto w-full sm:w-auto">
              {filteredTasks.length} / {projectTasks.length} งาน
            </span>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'table' ? (
          <div className="space-y-10 max-w-[1600px]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">งานทั้งหมด</div>
                <div className="text-[24px] font-black text-[#323338] mt-1">{projectTasks.length}</div>
              </div>
              <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ที่ถูกกรอง</div>
                <div className="text-[24px] font-black text-[#0073ea] mt-1">{filteredTasks.length}</div>
              </div>
              <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">ยังไม่ระบุผู้รับผิดชอบ</div>
                <div className="text-[24px] font-black text-[#fdab3d] mt-1">{unassignedCount}</div>
              </div>
              <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">มีความเสี่ยง</div>
                <div className="text-[24px] font-black text-[#e2445c] mt-1">{overdueCount + dueSoonCount}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[13px] text-[#676879]">
                หมวดหมู่: <span className="font-semibold text-[#323338]">{groupCategoryKeys.length}</span>
                {hideCompletedTasks && hiddenCompletedCount > 0 && (
                  <span className="ml-2 text-[#a0a2b1]">({hiddenCompletedCount} เสร็จสิ้นที่ถูกซ่อน)</span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => setHideCompletedTasks((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors ${
                    hideCompletedTasks
                      ? 'border-[#0073ea] bg-[#cce5ff] text-[#0052cc] hover:bg-[#b8daff]'
                      : 'border-[#d0d4e4] bg-white text-[#323338] hover:bg-[#f5f6f8]'
                  }`}
                >
                  {hideCompletedTasks ? `แสดงงานที่เสร็จสิ้น (${hiddenCompletedCount})` : 'ซ่อนงานที่เสร็จสิ้น'}
                </button>
                <button
                  type="button"
                  onClick={toggleAllCategories}
                  disabled={groupCategoryKeys.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#d0d4e4] bg-white text-[#323338] hover:bg-[#f5f6f8] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allCategoriesCollapsed ? 'ขยายทั้งหมด' : 'ย่อทั้งหมด'}
                </button>
                {!isAddingCategory ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#d0d4e4] bg-white text-[#323338] hover:bg-[#f5f6f8]"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มหมวดหมู่
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCategory();
                        if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }
                      }}
                      placeholder="ชื่อหมวดหมู่..."
                      className="h-9 px-3 text-[13px] bg-white border border-[#d0d4e4] rounded-lg outline-none focus:ring-2 focus:ring-[#0073ea] min-w-[180px] w-full sm:w-auto"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="h-9 px-3 text-[13px] rounded-lg bg-[#0073ea] text-white hover:bg-[#0060c0]"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="h-9 px-3 text-[13px] rounded-lg bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {groupCategoryKeys.length === 0 && (
              <div className="text-center py-16 text-[#676879]">
                <div className="text-4xl mb-3 opacity-50">ค้นหา</div>
                <div className="text-lg font-medium text-[#323338]">ไม่พบงาน</div>
                <div className="text-sm mt-1">
                  {hasOnlyHiddenDoneTasks
                    ? 'งานทั้งหมดที่มองเห็นได้เสร็จสิ้นแล้วและถูกซ่อนอยู่'
                    : 'ลองปรับตัวกรองหรือคำค้นหาของคุณ'}
                </div>
                {hasOnlyHiddenDoneTasks && (
                  <button
                    onClick={() => setHideCompletedTasks(false)}
                    className="mt-4 px-4 py-2 bg-[#0073ea] text-white rounded-lg text-sm font-medium hover:bg-[#0060c0] transition-colors"
                  >
                    แสดงงานที่เสร็จสิ้น
                  </button>
                )}
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-[#0073ea] text-white rounded-lg text-sm font-medium hover:bg-[#0060c0] transition-colors">
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
            )}
            {groupCategoryKeys.map((category, index) => {
              const groupColors = ["#579bfc", "#a25ddc", "#00c875", "#fdab3d", "#e2445c"];
              const color = groupColors[index % 5];
              const categoryTasks = visibleGroups[category] || [];
              const hiddenDoneInCategory = hideCompletedTasks
                ? (allGroups[category]?.length || 0) - categoryTasks.length
                : 0;
              const isCollapsed = Boolean(collapsedCategories[category]);
              return (
                <div key={category} className="bg-transparent rounded-none">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 mb-2 sticky top-0 z-20 bg-[#f5f6f8] py-2">
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(category)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[#e6e9ef] transition-colors"
                      aria-label={isCollapsed ? `Expand ${category}` : `Collapse ${category}`}
                      title={isCollapsed ? 'Expand category' : 'Collapse category'}
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} style={{ color }} />
                    </button>
                    <h3 className="font-medium text-[18px]" style={{ color }}>{category}</h3>
                    <span className="text-[13px] text-[#676879] font-normal ml-2">{categoryTasks.length} Tasks</span>
                    {hideCompletedTasks && hiddenDoneInCategory > 0 && (
                      <span className="text-[12px] text-[#a0a2b1] font-normal">+{hiddenDoneInCategory} Done hidden</span>
                    )}
                  </div>

                  {/* Table */}
                  {!isCollapsed && (
                    <div className="bg-white rounded-[8px] border border-[#d0d4e4] shadow-[0_4px_8px_rgba(0,0,0,0.02)] overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-[14px]">
                      <thead>
                        <tr className="border-b border-[#d0d4e4] text-[#676879] font-normal bg-white">
                          <th className="px-4 py-3 md:sticky md:left-0 md:z-10 w-[340px] font-normal border-r border-[#d0d4e4]">งาน</th>
                          <th className="px-4 py-3 w-[120px] font-normal border-r border-[#d0d4e4] text-center">ผู้รับผิดชอบ</th>
                          <th className="px-4 py-3 w-[120px] font-normal border-r border-[#d0d4e4] text-center">ทีมช่าง</th>
                          <th className="px-0 py-3 w-[140px] font-normal border-r border-[#d0d4e4] text-center">สถานะ</th>
                          <th className="px-0 py-3 w-[100px] font-normal border-r border-[#d0d4e4] text-center">ความสำคัญ</th>
                          <th className="px-4 py-3 w-[220px] font-normal border-r border-[#d0d4e4] text-center">กำหนดเวลา</th>
                          <th className="px-4 py-3 w-[100px] font-normal text-center">ความคืบหน้า</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTasks.map((task) => {
                          const overdue = isOverdue(task);
                          const dueSoon = isDueSoon(task);
                          const assignment = assignmentByTaskId.get(task.id);
                          const ownerNames = assignment?.ownerNames || [];
                          const crewNames = assignment?.crewNames || [];
                          const visibleOwnerNames = ownerNames.slice(0, 3);
                          const additionalOwnerCount = Math.max(ownerNames.length - visibleOwnerNames.length, 0);
                          const crewDisplayLabel = crewNames.length === 0
                            ? '-'
                            : crewNames.join(', ');
                          return (
                            <tr key={task.id} className={`border-b border-[#e6e9ef] last:border-0 hover:bg-[#f5f6f8] group transition-colors ${activeOwnerDropdown === task.id || activeCrewDropdown === task.id || activeStatusDropdown === task.id || activePriorityDropdown === task.id ? 'relative z-50' : 'relative z-0'} ${overdue ? 'bg-[#fff5f5]' : ''}`}>
                              {/* Item Name */}
                              <td className={`px-0 py-0 md:sticky md:left-0 ${overdue ? 'bg-[#fff5f5]' : 'bg-white'} group-hover:bg-[#f5f6f8] border-r border-[#d0d4e4] transition-colors`}>
                                <div className="flex items-stretch h-[44px]">
                                  <div className="w-2 shrink-0" style={{ backgroundColor: color }}></div>
                                  <div className="flex-1 flex items-center px-3 font-normal text-[#323338] gap-2">
                                    {/* Overdue / DueSoon indicator */}
                                    {overdue && (
                                      <div className="shrink-0" title="Overdue!">
                                        <AlertTriangle className="w-4 h-4 text-[#e2445c]" />
                                      </div>
                                    )}
                                    {dueSoon && !overdue && (
                                      <div className="shrink-0 text-[#fdab3d]" title="Due soon!">
                                        <Clock3 className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div
                                      className="relative cursor-pointer text-[#a0a2b1] hover:text-[#0073ea] transition-colors shrink-0"
                                      onClick={() => router.push(`/tasks/${task.id}`)}
                                      title="Open Task Detail"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                      {(taskUpdates[task.id] && taskUpdates[task.id].length > 0) && (
                                        <div className="absolute -top-1.5 -right-1.5 bg-[#0073ea] text-white w-3 h-3 flex items-center justify-center rounded-sm text-[8px] font-bold">
                                          {taskUpdates[task.id].length}
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      value={task.name}
                                      onChange={(e) => handleUpdateTaskName(task.id, e.target.value)}
                                      className="flex-1 bg-transparent border-none outline-none focus:ring-1 focus:ring-[#0073ea] px-1 py-0.5 rounded cursor-text transition-all hover:bg-black/5 min-w-0"
                                      title="Use comment icon to open detail"
                                    />
                                  </div>
                                </div>
                              </td>
                              {/* Owner */}
                              <td className={`px-2 py-0 border-r border-[#d0d4e4] h-[44px] relative ${activeOwnerDropdown === task.id ? 'z-50' : ''}`}>
                                <div
                                  className="flex justify-center items-center h-full cursor-pointer hover:bg-[#e6e9ef]/50 transition-colors"
                                  onClick={(e) => toggleOwnerDropdown(task.id, e.currentTarget)}
                                >
                                  <div className="relative flex items-center">
                                    {ownerNames.length === 0 ? (
                                      <div className="w-[30px] h-[30px] rounded-full bg-[#e6e9ef] flex items-center justify-center text-[12px] font-medium text-[#323338] border border-white shrink-0" title="Unassigned owner">
                                        -
                                      </div>
                                    ) : (
                                      <div className="flex items-center -space-x-2" title={ownerNames.join(', ')}>
                                        {visibleOwnerNames.map((ownerName, index) => {
                                          const ownerMember = memberByName.get(ownerName);
                                          return ownerMember?.avatar ? (
                                            <img
                                              key={`${task.id}-owner-${ownerName}`}
                                              src={ownerMember.avatar}
                                              alt={ownerName}
                                              className="w-[30px] h-[30px] rounded-full object-cover border-2 border-white shrink-0"
                                              style={{ zIndex: 10 - index }}
                                            />
                                          ) : (
                                            <div
                                              key={`${task.id}-owner-${ownerName}`}
                                              className="w-[30px] h-[30px] rounded-full bg-[#e6e9ef] flex items-center justify-center text-[11px] font-medium text-[#323338] border-2 border-white shrink-0"
                                              style={{ zIndex: 10 - index }}
                                            >
                                              {ownerName.substring(0, 2).toUpperCase()}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {additionalOwnerCount > 0 && (
                                      <div className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center">
                                        +{additionalOwnerCount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {activeOwnerDropdown === task.id && ownerDropdownAnchor && createPortal(
                                  <div
                                    className="fixed w-48 bg-white rounded-lg shadow-xl border border-[#d0d4e4] z-[220] py-2"
                                    style={{
                                      left: ownerDropdownAnchor.x,
                                      top: ownerDropdownAnchor.y,
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    <div className="px-3 py-1 text-xs font-semibold text-[#676879] uppercase tracking-wider">กำหนดผู้รับผิดชอบ</div>
                                    <div className="max-h-64 overflow-y-auto mt-1">
                                      <div
                                        className="px-3 py-2 text-sm hover:bg-[#f5f6f8] cursor-pointer text-[#676879] italic border-b border-[#e6e9ef]"
                                        onClick={() => { handleUpdateTaskOwners(task.id, [...crewNames]); }}
                                      >
                                        ไม่ได้กำหนดผู้รับผิดชอบ
                                      </div>
                                      {teamMembers.filter((member) => member.memberType !== 'crew').map(member => (
                                        <div
                                          key={member.id}
                                          className={`px-3 py-2 text-sm hover:bg-[#f5f6f8] cursor-pointer border-b border-[#e6e9ef] last:border-0 ${ownerNames.includes(member.name) ? 'bg-[#cce5ff]' : ''}`}
                                          onClick={() => {
                                            const nextOwners = ownerNames.includes(member.name)
                                              ? ownerNames.filter((owner) => owner !== member.name)
                                              : [...ownerNames, member.name];
                                            handleUpdateTaskOwners(task.id, [...nextOwners, ...crewNames]);
                                          }}
                                        >
                                          <div className={`font-medium flex items-center justify-between ${ownerNames.includes(member.name) ? 'text-[#0052cc]' : 'text-[#323338]'}`}>
                                            {member.name}
                                            {ownerNames.includes(member.name) && (
                                              <Check className="w-3.5 h-3.5 text-[#0073ea]" />
                                            )}
                                          </div>
                                          <div className="text-xs text-[#676879] mt-0.5">
                                            {member.position} - {member.department}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="px-3 pt-2 mt-1 border-t border-[#e6e9ef] flex items-center justify-between">
                                      <span className="text-[11px] text-[#676879]">{ownerNames.length} รายการที่เลือก</span>
                                      <button
                                        onClick={() => {
                                          setActiveOwnerDropdown(null);
                                          setOwnerDropdownAnchor(null);
                                        }}
                                        className="text-[11px] px-2 py-1 rounded bg-[#f5f6f8] hover:bg-[#e6e9ef] text-[#323338]"
                                      >
                                        เสร็จสิ้น
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </td>
                              {/* Crew */}
                              <td className={`px-2 py-0 border-r border-[#d0d4e4] h-[44px] relative ${activeCrewDropdown === task.id ? 'z-50' : ''}`}>
                                <div
                                  className="w-full h-full flex justify-center items-center cursor-pointer hover:bg-[#e6e9ef]/50 transition-colors"
                                  onClick={(e) => toggleCrewDropdown(task.id, e.currentTarget)}
                                  title={crewNames.length === 0 ? '-' : crewDisplayLabel}
                                >
                                  <div className={`max-w-full text-center text-[12px] px-2 truncate ${crewNames.length === 0 ? 'text-[#676879]' : 'text-[#323338]'}`}>
                                    {crewDisplayLabel}
                                  </div>
                                </div>
                                {activeCrewDropdown === task.id && crewDropdownAnchor && createPortal(
                                  <div
                                    className="fixed w-48 bg-white rounded-lg shadow-xl border border-[#d0d4e4] z-[220] py-2"
                                    style={{
                                      left: crewDropdownAnchor.x,
                                      top: crewDropdownAnchor.y,
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    <div className="px-3 py-1 text-xs font-semibold text-[#676879] uppercase tracking-wider">กำหนดทีมช่าง</div>
                                    <div className="max-h-64 overflow-y-auto mt-1">
                                      <div
                                        className="px-3 py-2 text-sm hover:bg-[#f5f6f8] cursor-pointer text-[#676879] italic border-b border-[#e6e9ef]"
                                        onClick={() => { handleUpdateTaskOwners(task.id, [...ownerNames]); }}
                                      >
                                        ไม่มีทีมช่าง
                                      </div>
                                      {teamMembers.filter((member) => member.memberType === 'crew').map(member => (
                                        <div
                                          key={member.id}
                                          className={`px-3 py-2 text-sm hover:bg-[#f5f6f8] cursor-pointer border-b border-[#e6e9ef] last:border-0 ${crewNames.includes(member.name) ? 'bg-[#ffe9c7]' : ''}`}
                                          onClick={() => {
                                            const nextCrew = crewNames.includes(member.name)
                                              ? crewNames.filter((name) => name !== member.name)
                                              : [...crewNames, member.name];
                                            handleUpdateTaskOwners(task.id, [...ownerNames, ...nextCrew]);
                                          }}
                                        >
                                          <div className={`font-medium flex items-center justify-between ${crewNames.includes(member.name) ? 'text-[#b05b00]' : 'text-[#323338]'}`}>
                                            {member.name}
                                            {crewNames.includes(member.name) && (
                                              <Check className="w-3.5 h-3.5 text-[#fdab3d]" />
                                            )}
                                          </div>
                                          <div className="text-xs text-[#676879] mt-0.5">
                                            {member.position} - {member.department}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="px-3 pt-2 mt-1 border-t border-[#e6e9ef] flex items-center justify-between">
                                      <span className="text-[11px] text-[#676879]">{crewNames.length} รายการที่เลือก</span>
                                      <button
                                        onClick={() => {
                                          setActiveCrewDropdown(null);
                                          setCrewDropdownAnchor(null);
                                        }}
                                        className="text-[11px] px-2 py-1 rounded bg-[#f5f6f8] hover:bg-[#e6e9ef] text-[#323338]"
                                      >
                                        เสร็จสิ้น
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </td>
                              {/* Status */}
                              <td className={`px-[2px] py-[2px] border-r border-[#d0d4e4] h-[44px] cursor-pointer relative ${activeStatusDropdown === task.id ? 'z-50' : ''}`}>
                                <div
                                  className={`w-full h-full flex items-center justify-center text-[13px] font-normal tracking-wide transition-opacity hover:opacity-90 ${getStatusColor(task.status)}`}
                                  onClick={(e) => toggleStatusDropdown(task.id, e.currentTarget)}
                                >
                                  {getStatusLabel(task.status)}
                                </div>
                                {activeStatusDropdown === task.id && statusDropdownAnchor && createPortal(
                                  <div
                                    className="fixed w-40 bg-white rounded-lg shadow-xl border border-[#d0d4e4] z-[220] p-1"
                                    style={{
                                      left: statusDropdownAnchor.x,
                                      top: statusDropdownAnchor.y,
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    {TASK_STATUSES.map(s => (
                                      <div
                                        key={s}
                                        onClick={() => {
                                          handleUpdateTaskStatus(task.id, s);
                                          setActiveStatusDropdown(null);
                                          setStatusDropdownAnchor(null);
                                        }}
                                        className={`px-3 py-2 text-sm cursor-pointer mb-1 last:mb-0 rounded ${getStatusColor(s)} text-center hover:opacity-90 shadow-sm`}
                                      >
                                        {getStatusLabel(s)}
                                      </div>
                                    ))}
                                  </div>,
                                  document.body
                                )}
                              </td>
                              {/* Priority */}
                              <td className={`px-[2px] py-[2px] border-r border-[#d0d4e4] h-[44px] cursor-pointer relative ${activePriorityDropdown === task.id ? 'z-50' : ''}`}>
                                <div
                                  className={`w-full h-full flex items-center justify-center text-[12px] font-medium tracking-wide transition-opacity hover:opacity-90 rounded-sm ${getPriorityColor(task.priority)}`}
                                  onClick={(e) => togglePriorityDropdown(task.id, e.currentTarget)}
                                >
                                  {getPriorityLabel(task.priority)}
                                </div>
                                {activePriorityDropdown === task.id && priorityDropdownAnchor && createPortal(
                                  <div
                                    className="fixed w-36 bg-white rounded-lg shadow-xl border border-[#d0d4e4] z-[220] p-1"
                                    style={{
                                      left: priorityDropdownAnchor.x,
                                      top: priorityDropdownAnchor.y,
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    {/* No priority option */}
                                    <div
                                      onClick={() => {
                                        handleUpdateTaskPriority(task.id, '');
                                        setActivePriorityDropdown(null);
                                        setPriorityDropdownAnchor(null);
                                      }}
                                      className="px-3 py-2 text-sm cursor-pointer mb-1 rounded bg-[#e6e9ef] text-[#676879] text-center hover:opacity-90"
                                    >
                                      - None
                                    </div>
                                    {PRIORITIES.map(p => (
                                      <div
                                        key={p}
                                        onClick={() => {
                                          handleUpdateTaskPriority(task.id, p);
                                          setActivePriorityDropdown(null);
                                          setPriorityDropdownAnchor(null);
                                        }}
                                        className={`px-3 py-2 text-sm cursor-pointer mb-1 last:mb-0 rounded ${getPriorityColor(p)} text-center hover:opacity-90 shadow-sm`}
                                      >
                                        {getPriorityLabel(p)}
                                      </div>
                                    ))}
                                  </div>,
                                  document.body
                                )}
                              </td>
                              {/* Timeline */}
                              <td className={`px-2 py-0 border-r border-[#d0d4e4] h-[44px] ${overdue ? 'bg-[#fff5f5]' : 'bg-[#f5f6f8]/50'} group-hover:bg-[#e6e9ef]/50 cursor-text`}>
                                <div className="flex justify-center items-center h-full gap-0.5">
                                  <input
                                    type="date"
                                    value={task.planStartDate}
                                    onChange={(e) => handleUpdateTaskTimeline(task.id, 'planStartDate', e.target.value)}
                                    className="bg-transparent text-[12px] leading-none tabular-nums text-[#323338] w-[104px] cursor-pointer outline-none hover:bg-white rounded px-0.5 py-0.5 transition-colors [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:scale-90"
                                  />
                                  <span className="text-[#676879] text-[11px]">-</span>
                                  <input
                                    type="date"
                                    value={task.planEndDate}
                                    onChange={(e) => handleUpdateTaskTimeline(task.id, 'planEndDate', e.target.value)}
                                    className={`bg-transparent text-[12px] leading-none tabular-nums w-[104px] cursor-pointer outline-none hover:bg-white rounded px-0.5 py-0.5 transition-colors [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:scale-90 ${overdue ? 'text-[#e2445c] font-semibold' : 'text-[#323338]'}`}
                                  />
                                </div>
                              </td>
                              {/* Progress */}
                              <td className="px-4 py-0 h-[44px]">
                                <div className="flex items-center justify-between h-full text-[#323338] pr-2">
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={task.progress}
                                      onChange={(e) => handleUpdateTaskProgress(task.id, e.target.value)}
                                      className="w-12 text-center bg-transparent border border-transparent hover:border-[#d0d4e4] focus:border-[#0073ea] rounded outline-none p-0.5 text-[14px]"
                                    />
                                    <span className="ml-1 text-[#676879]">%</span>
                                  </div>
                                  <button
                                    onClick={() => openDeleteTaskModal(task)}
                                    className="text-[#e2445c] hover:bg-[#ffebef] p-1.5 rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Add Item Row */}
                    <div
                      onClick={() => openAddTaskModal(category)}
                      className="flex items-stretch h-[44px] hover:bg-[#f5f6f8] transition-colors border-t border-[#e6e9ef] cursor-pointer"
                    >
                      <div className="w-2 shrink-0 bg-[#d0d4e4]"></div>
                      <div className="flex items-center px-4 flex-1 text-[#676879] gap-2 font-normal">
                        <Plus className="w-4 h-4" /> เพิ่มงาน
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : activeTab === 'kanban' ? (
          <div className="h-full">
            <KanbanBoard
              tasks={filteredTasks}
              teamMembers={teamMembers}
              onStatusChange={handleUpdateTaskStatus}
            />
          </div>
        ) : activeTab === 'calendar' ? (
          <div className="h-full">
            <TaskCalendarView
              tasks={filteredTasks}
              onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
            />
          </div>
        ) : null}
      </div>

      {pendingAddCategory && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#d0d4e4] shadow-2xl">
            <div className="px-5 py-4 border-b border-[#e6e9ef]">
              <h3 className="text-[18px] font-bold text-[#323338]">ยืนยันการเพิ่มงาน</h3>
            </div>
            <div className="px-5 py-4 text-[14px] text-[#323338] space-y-2">
              <p>
                เพิ่มงานใหม่ในหมวดหมู่ <span className="font-semibold">{pendingAddCategory}</span> หรือไม่?
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[#e6e9ef] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeAddTaskModal}
                disabled={isCreatingTask}
                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef] disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmAddTask()}
                disabled={isCreatingTask}
                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#0073ea] text-white hover:bg-[#0060c0] disabled:opacity-60"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteTask && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#d0d4e4] shadow-2xl">
            <div className="px-5 py-4 border-b border-[#e6e9ef]">
              <h3 className="text-[18px] font-bold text-[#323338]">ยืนยันการลบ</h3>
            </div>
            <div className="px-5 py-4 text-[14px] text-[#323338] space-y-2">
              <p>
                ลบงาน <span className="font-semibold">{pendingDeleteTask.name}</span> หรือไม่?
              </p>
              <p className="text-[#676879] text-[13px]">
                การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[#e6e9ef] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteTaskModal}
                disabled={isDeletingTask}
                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef] disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTask()}
                disabled={isDeletingTask}
                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#e2445c] text-white hover:bg-[#c9344b] disabled:opacity-60"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in Drawer for Task Updates */}
      <TaskUpdateDrawer
        selectedTask={selectedTask}
        onClose={() => setSelectedTask(null)}
        taskUpdateText={taskUpdateText}
        setTaskUpdateText={setTaskUpdateText}
        handleAddUpdate={handleAddUpdate}
        taskUpdates={taskUpdates}
      />
    </div>
  );
}
