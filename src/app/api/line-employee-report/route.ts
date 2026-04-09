import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

interface EmployeeReportPayload {
    to: string;
    employeeName: string;
    projectName: string;
    periodLabel: string;
    template: 'compact' | 'detailed';
    summary: {
        total: number;
        overdue: number;
        dueSoon: number;
        inProgress: number;
        notStarted: number;
        completed: number;
    };
    tasks: Array<{
        name: string;
        status: string;
        dueDate: string;
        startDate?: string;
        endDate?: string;
        durationDays?: number;
        projectName?: string;
    }>;
}

function isAllowedOrigin(request: NextRequest): boolean {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredUrl) return true;

    const requestOrigin = request.headers.get('origin');
    if (!requestOrigin) return true;

    try {
        return new URL(configuredUrl).origin === requestOrigin;
    } catch {
        return false;
    }
}

function isValidPayload(body: unknown): body is EmployeeReportPayload {
    if (!body || typeof body !== 'object') return false;
    const input = body as Record<string, unknown>;

    const isValidString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
    if (!isValidString(input.to)) return false;
    if (!isValidString(input.employeeName)) return false;
    if (!isValidString(input.projectName)) return false;
    if (!isValidString(input.periodLabel)) return false;
    if (input.template !== 'compact' && input.template !== 'detailed') return false;

    if (!input.summary || typeof input.summary !== 'object') return false;
    const summary = input.summary as Record<string, unknown>;
    const summaryKeys = ['total', 'overdue', 'dueSoon', 'inProgress', 'notStarted', 'completed'];
    if (!summaryKeys.every((key) => typeof summary[key] === 'number' && Number.isFinite(summary[key] as number))) {
        return false;
    }

    if (!Array.isArray(input.tasks)) return false;
    const tasksValid = input.tasks.every((task) => {
        if (!task || typeof task !== 'object') return false;
        const item = task as Record<string, unknown>;
        const base = isValidString(item.name) && isValidString(item.status) && isValidString(item.dueDate);
        const optionalDateValid =
            item.startDate === undefined || (typeof item.startDate === 'string' && item.startDate.trim().length > 0);
        const optionalEndDateValid =
            item.endDate === undefined || (typeof item.endDate === 'string' && item.endDate.trim().length > 0);
        const optionalDurationValid =
            item.durationDays === undefined || (typeof item.durationDays === 'number' && Number.isFinite(item.durationDays));
        const optionalProjectNameValid =
            item.projectName === undefined || (typeof item.projectName === 'string' && item.projectName.trim().length > 0);
        return base && optionalDateValid && optionalEndDateValid && optionalDurationValid && optionalProjectNameValid;
    });

    return tasksValid;
}

type FlexTextNode = {
    type: 'text';
    text: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    weight?: 'regular' | 'bold';
    color?: string;
    wrap?: boolean;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    align?: 'start' | 'center' | 'end';
    flex?: number;
};

type FlexBoxNode = {
    type: 'box';
    layout: 'vertical' | 'horizontal';
    contents: Array<FlexTextNode | FlexBoxNode>;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    paddingAll?: string;
    backgroundColor?: string;
    cornerRadius?: string;
    flex?: number;
    width?: string;
    height?: string;
    alignItems?: 'flex-start' | 'center' | 'flex-end';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
    spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    borderWidth?: string;
    borderColor?: string;
};

function statusColor(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('overdue') || s.includes('delayed') || s.includes('stuck')) return '#B42318';
    if (s.includes('progress')) return '#0c3b69';
    if (s.includes('complete') || s.includes('done')) return '#067647';
    if (s.includes('not')) return '#6B7280';
    return '#374151';
}

function parseDate(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function dayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDateDMY(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayDiff(start: Date, end: Date): number {
    const ms = dayStart(end).getTime() - dayStart(start).getTime();
    return Math.floor(ms / 86400000);
}

function buildTimelineSection(
    tasks: EmployeeReportPayload['tasks'],
    today: Date,
    projectTitle?: string
): FlexBoxNode {
    const timelineDays = Array.from({ length: 5 }, (_, idx) => addDays(today, idx - 2));

    const headerDays: FlexBoxNode = {
        type: 'box',
        layout: 'horizontal',
        width: '100%',
        spacing: 'sm',
        contents: timelineDays.map((day) => ({
            type: 'box',
            layout: 'vertical',
            flex: 1,
            alignItems: 'center',
            contents: [
                {
                    type: 'text',
                    text: String(day.getDate()),
                    size: 'xs',
                    color: isSameDay(day, today) ? '#DC2626' : '#6B7280',
                    weight: isSameDay(day, today) ? 'bold' : 'regular',
                },
            ],
        })),
    };

    const rows = tasks.slice(0, 3).map((task, index) => {
        const start = parseDate(task.startDate) || parseDate(task.dueDate) || today;
        const end = parseDate(task.endDate) || parseDate(task.dueDate) || start;
        const normalizedStart = start.getTime() <= end.getTime() ? start : end;
        const normalizedEnd = start.getTime() <= end.getTime() ? end : start;
        // Duration in the timeline is inclusive of both start and end dates.
        const duration = Math.max(1, dayDiff(normalizedStart, normalizedEnd) + 1);

        const cells: FlexBoxNode[] = timelineDays.map((day) => {
            const active = dayStart(day).getTime() >= dayStart(normalizedStart).getTime()
                && dayStart(day).getTime() <= dayStart(normalizedEnd).getTime();
            const isToday = isSameDay(day, today);

            return {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                paddingAll: '1px',
                borderWidth: isToday ? '1px' : undefined,
                borderColor: isToday ? '#DC2626' : undefined,
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        height: '18px',
                        backgroundColor: active ? '#0b4580' : '#D1D5DB',
                        cornerRadius: '2px',
                        contents: [{ type: 'text', text: ' ', size: 'xs' }],
                    },
                ],
            };
        });

        return {
            type: 'box',
            layout: 'vertical',
            margin: index === 0 ? 'sm' : 'md',
            paddingAll: '6px',
            backgroundColor: '#FFFFFF',
            cornerRadius: '6px',
            contents: [
                {
                    type: 'text',
                    text: task.name,
                    size: 'sm',
                    color: '#111827',
                    weight: 'bold',
                    wrap: true,
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'box',
                            layout: 'vertical',
                            width: '96px',
                            contents: [
                                { type: 'text', text: formatDateDMY(normalizedStart), size: 'xs', color: '#4B5563' },
                                { type: 'text', text: formatDateDMY(normalizedEnd), size: 'xs', color: '#4B5563', margin: 'sm' },
                            ],
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            width: '20px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            contents: [
                                { type: 'text', text: String(duration), size: 'md', color: '#111827', weight: 'bold' },
                            ],
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            flex: 1,
                            spacing: 'sm',
                            contents: cells,
                        },
                    ],
                },
            ],
        } as FlexBoxNode;
    });

    return {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        paddingAll: '10px',
        backgroundColor: '#F3F4F6',
        cornerRadius: '10px',
        contents: [
            ...(projectTitle
                ? [{
                    type: 'text' as const,
                    text: projectTitle,
                    size: 'sm' as const,
                    weight: 'bold' as const,
                    color: '#111827',
                }]
                : []),
            {
                type: 'text',
                text: projectTitle ? 'ไทม์ไลน์ (5 วัน)' : 'ตัวอย่างไทม์ไลน์ (5 วัน)',
                size: 'sm',
                weight: 'bold',
                color: '#374151',
                margin: projectTitle ? 'sm' : undefined,
            },
            {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                spacing: 'sm',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        width: '96px',
                        contents: [{ type: 'text', text: 'เริ่ม/สิ้น', size: 'xs', color: '#6B7280' }],
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        width: '20px',
                        alignItems: 'center',
                        contents: [{ type: 'text', text: 'ว', size: 'xs', color: '#6B7280' }],
                    },
                    { type: 'box', layout: 'vertical', flex: 1, contents: [headerDays] },
                ],
            },
            ...rows,
        ],
    };
}

function groupTasksByProject(tasks: EmployeeReportPayload['tasks']) {
    const grouped = new Map<string, EmployeeReportPayload['tasks']>();
    tasks.forEach((task) => {
        const project = (task.projectName || 'โครงการที่ไม่รู้จัก').trim() || 'โครงการที่ไม่รู้จัก';
        if (!grouped.has(project)) grouped.set(project, []);
        grouped.get(project)?.push(task);
    });
    return Array.from(grouped.entries()).map(([projectName, items]) => ({ projectName, tasks: items }));
}

function buildFlexMessage(payload: EmployeeReportPayload) {
    const groupedProjectTasks = groupTasksByProject(payload.tasks);
    const multiProjectMode = groupedProjectTasks.length > 1;
    const generatedAt = new Date().toLocaleString('th-TH', { hour12: false });
    const summaryCards: FlexBoxNode[] = [
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'เปิด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(payload.summary.total), size: 'lg', weight: 'bold', color: '#111827', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#EFF6FF',
            cornerRadius: '8px',
            flex: 1,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'เกินกำหนด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(payload.summary.overdue), size: 'lg', weight: 'bold', color: '#B42318', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#FEF2F2',
            cornerRadius: '8px',
            flex: 1,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'ใกล้ครบกำหนด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(payload.summary.dueSoon), size: 'lg', weight: 'bold', color: '#B54708', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#FFF7ED',
            cornerRadius: '8px',
            flex: 1,
        },
    ];

    const simpleTaskRows: FlexBoxNode[] = payload.tasks.slice(0, 4).map((task, index) => ({
        type: 'box',
        layout: 'vertical',
        margin: index === 0 ? 'none' : 'sm',
        paddingAll: '10px',
        backgroundColor: '#FFFFFF',
        cornerRadius: '8px',
        contents: [
            {
                type: 'text',
                text: multiProjectMode ? `[โครงการ: ${task.projectName || 'ไม่รู้จัก'}] ${task.name}` : task.name,
                size: 'sm',
                weight: 'bold',
                color: '#111827',
                wrap: true
            },
            {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                contents: [
                    { type: 'text', text: task.status, size: 'xs', color: statusColor(task.status), weight: 'bold' },
                    { type: 'text', text: `ครบกำหนด ${task.dueDate}`, size: 'xs', color: '#6B7280', align: 'end' },
                ],
            },
        ],
    }));

    const bodyContents: Array<FlexTextNode | FlexBoxNode> = [
        {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            backgroundColor: '#EEF3F8',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: 'รายงาน', size: 'sm', color: '#475467', weight: 'bold' },
                { type: 'text', text: 'สรุปภาระงานพนักงาน', size: 'md', weight: 'bold', color: '#0F172A', margin: 'sm' },
                { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#475467', margin: 'sm' },
            ],
        },
        {
            type: 'text',
            text: `${payload.employeeName} - ${payload.periodLabel}`,
            size: 'md',
            weight: 'bold',
            color: '#111827',
            wrap: true,
            margin: 'md',
        },
        {
            type: 'text',
            text: multiProjectMode ? `โครงการ: ${groupedProjectTasks.length} กลุ่ม (ทุกโครงการ)` : `โครงการ: ${payload.projectName}`,
            size: 'sm',
            color: '#4B5563',
            margin: 'sm',
            wrap: true,
        },
        {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            spacing: 'sm',
            contents: summaryCards,
        },
        {
            type: 'text',
            text: `กำลังดำเนินการ ${payload.summary.inProgress} | ยังไม่เริ่ม ${payload.summary.notStarted} | เสร็จสิ้น ${payload.summary.completed}`,
            size: 'xs',
            color: '#4B5563',
            margin: 'md',
            wrap: true,
        },
    ];

    if (payload.tasks.length > 0) {
        if (payload.template === 'detailed') {
            if (multiProjectMode) {
                bodyContents.push({
                    type: 'text',
                    text: 'แบ่งตามโครงการ',
                    size: 'sm',
                    weight: 'bold',
                    color: '#374151',
                    margin: 'md',
                });
                groupedProjectTasks.slice(0, 3).forEach((group) => {
                    bodyContents.push(buildTimelineSection(group.tasks, dayStart(new Date()), group.projectName));
                });
            } else {
                bodyContents.push(buildTimelineSection(payload.tasks, dayStart(new Date())));
            }
        } else {
            bodyContents.push({
                type: 'text',
                text: 'รายการงานหลัก',
                size: 'sm',
                weight: 'bold',
                color: '#374151',
                margin: 'md',
            });
            bodyContents.push({
                type: 'box',
                layout: 'vertical',
                margin: 'sm',
                backgroundColor: '#F3F4F6',
                paddingAll: '8px',
                cornerRadius: '10px',
                contents: simpleTaskRows,
            });
        }
    }

    return {
        type: 'flex',
        altText: `รายงานพนักงาน: ${payload.employeeName}`,
        contents: {
            type: 'bubble',
            size: 'giga',
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                contents: bodyContents,
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#6B7280', align: 'center' },
                ],
            },
        },
    };
}

export async function POST(request: NextRequest) {
    try {
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            return NextResponse.json({ ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }, { status: 500 });
        }
        if (!isAllowedOrigin(request)) {
            return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 });
        }

        const body = await request.json();
        if (!isValidPayload(body)) {
            return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
        }

        const response = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: body.to.trim(),
                messages: [buildFlexMessage(body)],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ ok: false, error: errorText }, { status: response.status });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
