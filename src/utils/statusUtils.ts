import { Project, Task } from '@/types/construction';

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
        case 'completed': return 'เสร็จสิ้น';
        case 'in-progress': return 'กำลังดำเนินการ';
        case 'delayed': return 'ติดขัด';
        case 'not-started':
        default: return 'ยังไม่เริ่ม';
    }
};

export const getPriorityLabel = (priority?: Task['priority'] | '') => {
    switch (priority) {
        case 'urgent': return 'ด่วนมาก';
        case 'high': return 'สูง';
        case 'medium': return 'ปานกลาง';
        case 'low': return 'ต่ำ';
        default: return 'ไม่ระบุ';
    }
};

export const getProjectStatusLabel = (status: Project['status']) => {
    switch (status) {
        case 'planning': return 'วางแผน';
        case 'in-progress': return 'ดำเนินการ';
        case 'on-hold': return 'พักไว้';
        case 'completed': return 'เสร็จสิ้น';
        default: return status;
    }
};
