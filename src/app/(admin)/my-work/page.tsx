'use client';

import React from 'react';
import MyWorkTrackerView from '@/components/MyWorkTrackerView';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';

export default function MyWorkPage() {
    const { tasks, projects, teamMembers, loading } = useAppContext();

    if (loading) return <LinearLoadingScreen message="กำลังโหลดระบบติดตามงาน..." />;

    return <MyWorkTrackerView tasks={tasks} projects={projects} teamMembers={teamMembers} />;
}
