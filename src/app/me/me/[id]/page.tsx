import { redirect } from 'next/navigation';

interface LegacyMeTaskPageProps {
    params: Promise<{ id: string }>;
}

export default async function LegacyMeTaskPage({ params }: LegacyMeTaskPageProps) {
    const { id } = await params;
    redirect(`/me/tasks/${encodeURIComponent(id)}`);
}

