'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';

export default function MeAdminReportAliasPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const query = searchParams.toString();
        const target = query ? `/reports/admin?${query}` : '/reports/admin';
        router.replace(target);
    }, [router, searchParams]);

    return <LinearLoadingScreen message="กำลังเปิดรายงานผู้ดูแลระบบ..." />;
}

