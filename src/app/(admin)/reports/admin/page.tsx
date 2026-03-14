'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import AdminLineReportView from '@/components/AdminLineReportView';
import { useAppContext } from '@/contexts/AppContext';

export default function AdminReportViewerPage() {
    const { projects, tasks, teamMembers, loading, activeProjectId } = useAppContext();
    const searchParams = useSearchParams();
    const type = searchParams.get('type');
    const projectId = searchParams.get('projectId');

    if (loading) return <LinearLoadingScreen message="กำลังโหลดรายงานผู้ดูแลระบบ..." />;

    return (
        <AdminLineReportView
            projects={projects}
            tasks={tasks}
            teamMembers={teamMembers}
            activeProjectId={activeProjectId}
            initialType={type}
            initialProjectId={projectId}
        />
    );
}

