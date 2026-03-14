'use client';

import React from 'react';
import DashboardOverviewView from '@/components/DashboardOverviewView';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';

export default function DashboardPage() {
    const { tasks, teamMembers, loading } = useAppContext();

    if (loading) return <LinearLoadingScreen message="กำลังโหลดแดชบอร์ด..." />;

    return <DashboardOverviewView tasks={tasks} teamMembers={teamMembers} />;
}
