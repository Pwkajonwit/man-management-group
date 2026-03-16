'use client';

import React from 'react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import MobileMyTasksView from '@/components/MobileMyTasksView';
import { useAppContext } from '@/contexts/AppContext';

export default function MePage() {
    const {
        tasks,
        projects,
        teamMembers,
        currentUserName,
        loading,
        handleUpdateTaskStatus,
        taskScopeBranchOptions,
        taskScopeDepartmentOptions,
    } = useAppContext();

    if (loading) return <LinearLoadingScreen message="กำลังโหลดงานของคุณ..." />;

    return (
        <MobileMyTasksView
            tasks={tasks}
            projects={projects}
            teamMembers={teamMembers}
            currentUserName={currentUserName}
            branchOptions={taskScopeBranchOptions}
            departmentOptions={taskScopeDepartmentOptions}
            onStatusChange={handleUpdateTaskStatus}
        />
    );
}
