import React from 'react';
import type { Viewport } from 'next';
import UserGate from '@/components/UserGate';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
    return <UserGate>{children}</UserGate>;
}
