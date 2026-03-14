import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

type NotifyAction = 'assigned' | 'status_changed' | 'comment_added' | 'deadline_warning' | 'overdue';

interface NotifyPayload {
    to: string;
    taskId?: string;
    taskName: string;
    action: NotifyAction;
    assignedBy?: string;
    newStatus?: string;
    projectName?: string;
    comment?: string;
    owner?: string;
    crew?: string;
    timeline?: string;
    priority?: string;
}

interface FlexTextNode {
    type: 'text';
    text: string;
    size?: 'sm' | 'md' | 'lg';
    weight?: 'regular' | 'bold';
    color?: string;
    wrap?: boolean;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    style?: 'normal' | 'italic';
}

type FlexBoxNode = {
    type: 'box';
    layout: 'vertical' | 'horizontal' | 'baseline';
    contents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode>;
    backgroundColor?: string;
    paddingAll?: string;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    cornerRadius?: string;
    spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
};

type FlexButtonNode = {
    type: 'button';
    action: {
        type: 'uri';
        label: string;
        uri: string;
    };
    style?: 'primary' | 'secondary' | 'link';
    color?: string;
    height?: 'sm' | 'md';
};

interface FlexMessage {
    type: 'flex';
    altText: string;
    contents: {
        type: 'bubble';
        size: 'mega' | 'kilo' | 'giga';
        body: FlexBoxNode;
        footer: FlexBoxNode;
    };
}

const ALLOWED_ACTIONS = new Set<NotifyAction>([
    'assigned',
    'status_changed',
    'comment_added',
    'deadline_warning',
    'overdue',
]);

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function formatDateDdMmYyyy(value: Date | string | undefined): string {
    if (!value) return '-';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '-';
        const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (isoDateMatch) {
            return `${isoDateMatch[3]}-${isoDateMatch[2]}-${isoDateMatch[1]}`;
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return trimmed;
        return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
    }
    return `${pad2(value.getDate())}-${pad2(value.getMonth() + 1)}-${value.getFullYear()}`;
}

function formatTimelineLabel(value?: string): string {
    if (!value) return '-';
    const range = value.split(' - ');
    if (range.length === 2) {
        return `${formatDateDdMmYyyy(range[0])} - ${formatDateDdMmYyyy(range[1])}`;
    }
    return formatDateDdMmYyyy(value);
}

function asTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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

function validateNotifyPayload(body: unknown): NotifyPayload | null {
    if (!body || typeof body !== 'object') return null;

    const input = body as Record<string, unknown>;
    const to = asTrimmedString(input.to);
    const taskName = asTrimmedString(input.taskName);
    const action = asTrimmedString(input.action) as NotifyAction | null;

    if (!to || !taskName || !action || !ALLOWED_ACTIONS.has(action)) {
        return null;
    }

    return {
        to,
        taskId: asTrimmedString(input.taskId) || undefined,
        taskName,
        action,
        assignedBy: asTrimmedString(input.assignedBy) || undefined,
        newStatus: asTrimmedString(input.newStatus) || undefined,
        projectName: asTrimmedString(input.projectName) || undefined,
        comment: asTrimmedString(input.comment) || undefined,
        owner: asTrimmedString(input.owner) || undefined,
        crew: asTrimmedString(input.crew) || undefined,
        timeline: asTrimmedString(input.timeline) || undefined,
        priority: asTrimmedString(input.priority) || undefined,
    };
}

export async function POST(request: NextRequest) {
    try {
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            return NextResponse.json(
                { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' },
                { status: 500 }
            );
        }

        if (!isAllowedOrigin(request)) {
            return NextResponse.json(
                { ok: false, error: 'Forbidden origin' },
                { status: 403 }
            );
        }

        const payload = validateNotifyPayload(await request.json());
        if (!payload) {
            return NextResponse.json(
                { ok: false, error: 'Invalid payload' },
                { status: 400 }
            );
        }

        const flexMessage = buildFlexMessage(payload);

        const response = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: payload.to,
                messages: [flexMessage],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LINE API error:', errorText);
            return NextResponse.json({ ok: false, error: errorText }, { status: response.status });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('LINE notify error:', error);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

function buildFlexMessage(payload: NotifyPayload): FlexMessage {
    const actionMeta: Record<NotifyAction, { title: string; badge: string; color: string }> = {
        assigned: { title: 'แจ้งมอบหมายงานใหม่', badge: 'งานใหม่', color: '#1D4ED8' },
        status_changed: { title: 'แจ้งเปลี่ยนสถานะงาน', badge: 'อัปเดต', color: '#0F766E' },
        comment_added: { title: 'แจ้งความคิดเห็นใหม่', badge: 'ข้อความ', color: '#9A3412' },
        deadline_warning: { title: 'งานใกล้ครบกำหนดส่ง', badge: 'ใกล้ส่ง', color: '#B45309' },
        overdue: { title: 'งานเกินกำหนดเวลา', badge: 'ล่าช้า', color: '#B91C1C' },
    };
    const statusLabels: Record<string, string> = {
        'not-started': 'ยังไม่เริ่ม',
        'in-progress': 'กำลังดำเนินการ',
        completed: 'เสร็จสิ้น',
        delayed: 'ล่าช้า',
    };

    const meta = actionMeta[payload.action];
    const currentDateLabel = formatDateDdMmYyyy(new Date());
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://your-app.vercel.app';
    const liffId = (process.env.NEXT_PUBLIC_LIFF_ID || '').trim();
    const taskDetailUrl = (() => {
        if (liffId) {
            if (payload.taskId) {
                const liffStatePath = `/tasks/${encodeURIComponent(payload.taskId)}`;
                return `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(liffStatePath)}`;
            }
            return `https://liff.line.me/${liffId}`;
        }
        if (payload.taskId) {
            return `${appUrl}/me/tasks/${encodeURIComponent(payload.taskId)}`;
        }
        return `${appUrl}/me`;
    })();

    const row = (label: string, value?: string, valueColor = '#111827'): FlexBoxNode => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
            { type: 'text', text: label, size: 'sm', color: '#6B7280' },
            { type: 'text', text: (value && value.trim()) ? value : '-', size: 'sm', color: valueColor, weight: 'bold', wrap: true },
        ],
    });

    const detailRows: FlexBoxNode[] = [
        row('สถานะ', payload.newStatus ? (statusLabels[payload.newStatus] || payload.newStatus) : '-', '#0B6BCB'),
        row('โดย', payload.assignedBy || '-'),
    ];
    if (payload.action === 'assigned') {
        detailRows.push(row('ผู้รับผิดชอบ', payload.owner || '-'));
        detailRows.push(row('ทีมช่าง', payload.crew || '-'));
        detailRows.push(row('ไทม์ไลน์', formatTimelineLabel(payload.timeline)));
        detailRows.push(row('ลำดับความสำคัญ', payload.priority || '-'));
    }

    const bodyContents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode> = [
        {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            backgroundColor: '#EEF3F8',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: 'การแจ้งเตือน', size: 'sm', color: '#475467', weight: 'bold' },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        { type: 'text', text: meta.title, size: 'md', color: '#0F172A', weight: 'bold', wrap: true },
                        { type: 'text', text: meta.badge, size: 'sm', color: meta.color, weight: 'bold' },
                    ],
                },
                { type: 'text', text: `วันที่: ${currentDateLabel}`, size: 'sm', color: '#475467', margin: 'sm' },
            ],
        },
        {
            type: 'text',
            text: payload.taskName,
            weight: 'bold',
            size: 'lg',
            color: '#111827',
            wrap: true,
            margin: 'md',
        },
        {
            type: 'text',
            text: payload.projectName ? `โครงการ: ${payload.projectName}` : 'โครงการ: -',
            size: 'sm',
            color: '#4B5563',
            margin: 'sm',
            wrap: true,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: detailRows,
            backgroundColor: '#F8FAFC',
            paddingAll: '12px',
            cornerRadius: '10px',
            margin: 'sm',
        },
    ];

    if (payload.comment) {
        bodyContents.push({
            type: 'text',
            text: 'คอมเมนต์',
            size: 'sm',
            color: '#6B7280',
            margin: 'md',
            weight: 'bold',
        });
        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: payload.comment,
                    size: 'sm',
                    color: '#1F2937',
                    wrap: true,
                },
            ],
            backgroundColor: '#FFF7ED',
            paddingAll: '12px',
            cornerRadius: '10px',
        });
    }

    return {
        type: 'flex',
        altText: `${meta.title}: ${payload.taskName}`,
        contents: {
            type: 'bubble',
            size: 'mega',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: bodyContents,
                paddingAll: '16px',
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: 'ดูรายละเอียดงาน',
                            uri: taskDetailUrl,
                        },
                        style: 'primary',
                        color: '#1D4ED8',
                        height: 'sm',
                    },
                ],
                paddingAll: '12px',
            },
        },
    };
}
