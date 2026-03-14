import { Task } from '@/types/construction';

export const getStatusColor = (status: Task['status']) => {
    switch (status) {
        case 'completed': return 'bg-[#00c875] text-white';
        case 'in-progress': return 'bg-[#fdab3d] text-white';
        case 'delayed': return 'bg-[#e2445c] text-white';
        case 'not-started':
        default: return 'bg-[#c4c4c4] text-white';
    }
};

export const getStatusLabel = (status: Task['status']) => {
    switch (status) {
        case 'completed': return 'Done';
        case 'in-progress': return 'Working on it';
        case 'delayed': return 'Stuck';
        case 'not-started':
        default: return 'Not Started';
    }
};
