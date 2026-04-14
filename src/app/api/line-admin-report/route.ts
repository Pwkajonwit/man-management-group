import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_ADMIN_USER_ID_FROM_ENV = process.env.LINE_ADMIN_USER_ID || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

interface ReportPayload {
    projectName: string;
    projectId?: string;
    adminLineUserId?: string;
    adminLineGroupId?: string;
    reportType?: 'project-summary' | 'today-team-load' | 'completed-last-2-days';
    teamLoad?: Array<{
        name: string;
        totalOpen: number;
        dueToday: number;
        overdue: number;
    }>;
    completedDigest?: {
        todayDate: string;
        yesterdayDate: string;
        todayDone: number;
        yesterdayDone: number;
        todayTasks?: string[];
        yesterdayTasks?: string[];
        todayMore?: number;
        yesterdayMore?: number;
    };
    metrics: {
        totalTasks: number;
        overdue: number;
        dueSoon: number;
        unassigned: number;
        notStarted: number;
        inProgress: number;
        completed: number;
        delayed: number;
    };
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

type FlexBoxNode = {
    type: 'box';
    layout: 'vertical' | 'horizontal';
    contents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode>;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    paddingAll?: string;
    backgroundColor?: string;
    cornerRadius?: string;
    flex?: number;
    spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
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

function isValidReportPayload(body: unknown): body is ReportPayload {
    if (!body || typeof body !== 'object') return false;
    const input = body as Record<string, unknown>;

    if (typeof input.projectName !== 'string' || !input.projectName.trim()) return false;
    if (input.projectId !== undefined && typeof input.projectId !== 'string') return false;

    if (input.adminLineUserId !== undefined && typeof input.adminLineUserId !== 'string') {
        return false;
    }
    if (input.adminLineGroupId !== undefined && typeof input.adminLineGroupId !== 'string') {
        return false;
    }
    if (
        input.reportType !== undefined
        && input.reportType !== 'project-summary'
        && input.reportType !== 'today-team-load'
        && input.reportType !== 'completed-last-2-days'
    ) {
        return false;
    }
    if (input.teamLoad !== undefined) {
        if (!Array.isArray(input.teamLoad)) return false;
        const isValid = input.teamLoad.every((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const item = entry as Record<string, unknown>;
            return (
                typeof item.name === 'string' &&
                typeof item.totalOpen === 'number' &&
                Number.isFinite(item.totalOpen) &&
                typeof item.dueToday === 'number' &&
                Number.isFinite(item.dueToday) &&
                typeof item.overdue === 'number' &&
                Number.isFinite(item.overdue)
            );
        });
        if (!isValid) return false;
    }

    if (input.completedDigest !== undefined) {
        if (!input.completedDigest || typeof input.completedDigest !== 'object') return false;
        const digest = input.completedDigest as Record<string, unknown>;
        if (typeof digest.todayDate !== 'string' || typeof digest.yesterdayDate !== 'string') return false;
        if (typeof digest.todayDone !== 'number' || !Number.isFinite(digest.todayDone)) return false;
        if (typeof digest.yesterdayDone !== 'number' || !Number.isFinite(digest.yesterdayDone)) return false;
        if (digest.todayTasks !== undefined) {
            if (!Array.isArray(digest.todayTasks) || !digest.todayTasks.every((item) => typeof item === 'string')) return false;
        }
        if (digest.yesterdayTasks !== undefined) {
            if (!Array.isArray(digest.yesterdayTasks) || !digest.yesterdayTasks.every((item) => typeof item === 'string')) return false;
        }
        if (digest.todayMore !== undefined && (typeof digest.todayMore !== 'number' || !Number.isFinite(digest.todayMore))) {
            return false;
        }
        if (digest.yesterdayMore !== undefined && (typeof digest.yesterdayMore !== 'number' || !Number.isFinite(digest.yesterdayMore))) {
            return false;
        }
    }

    if (!input.metrics || typeof input.metrics !== 'object') return false;

    const metrics = input.metrics as Record<string, unknown>;
    const requiredKeys = ['totalTasks', 'overdue', 'dueSoon', 'unassigned', 'notStarted', 'inProgress', 'completed', 'delayed'];
    return requiredKeys.every((key) => typeof metrics[key] === 'number' && Number.isFinite(metrics[key] as number));
}

function buildFlexMessage(payload: ReportPayload): FlexMessage {
    const generatedAt = new Date().toLocaleString('th-TH', { hour12: false });
    const reportType = payload.reportType || 'project-summary';
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://your-app.vercel.app';
    const liffId = (process.env.NEXT_PUBLIC_LIFF_ID || '').trim();
    const reportPath = `/reports/admin?type=${encodeURIComponent(reportType)}${payload.projectId ? `&projectId=${encodeURIComponent(payload.projectId)}` : ''}`;
    const reportUrl = liffId
        ? `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(reportPath)}`
        : `${appUrl}${reportPath}`;
    const meta = {
        'project-summary': { title: 'แจ้งสรุปภาพรวมโครงการ', badge: 'ภาพรวม', color: '#1D4ED8' },
        'today-team-load': { title: 'แจ้งสรุปภาระงานรายวัน', badge: 'รายบุคคล', color: '#0F766E' },
        'completed-last-2-days': { title: 'แจ้งสรุปงานที่เสร็จสิ้น', badge: 'เสร็จล่าสุด', color: '#9A3412' },
    }[reportType];

    const row = (label: string, value: string, valueColor = '#0F172A'): FlexBoxNode => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
            { type: 'text', text: label, size: 'sm', color: '#475467' },
            { type: 'text', text: value, size: 'sm', color: valueColor, weight: 'bold', align: 'end', wrap: true },
        ],
    });

    const bodyContents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode> = [
        {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            backgroundColor: '#EEF3F8',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: 'รายงาน', size: 'sm', color: '#475467', weight: 'bold' },
                { type: 'text', text: meta.title, size: 'md', color: '#0F172A', weight: 'bold', margin: 'sm' },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        { type: 'text', text: `โครงการ: ${payload.projectName}`, size: 'sm', color: '#334155', wrap: true },
                        { type: 'text', text: meta.badge, size: 'sm', color: meta.color, weight: 'bold', align: 'end' },
                    ],
                },
                { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#475467', margin: 'sm' },
            ],
        },
        {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            paddingAll: '12px',
            backgroundColor: '#F8FAFC',
            cornerRadius: '10px',
            spacing: 'sm',
            contents: [
                { type: 'text', text: 'ตัวชี้วัดสำคัญ', size: 'sm', color: '#334155', weight: 'bold' },
                row('งานทั้งหมด', String(payload.metrics.totalTasks)),
                row('เกินกำหนด', String(payload.metrics.overdue), '#B91C1C'),
                row('ใกล้ครบกำหนด', String(payload.metrics.dueSoon), '#B45309'),
                row('ยังไม่มอบหมาย', String(payload.metrics.unassigned)),
                row('ยังไม่เริ่ม', String(payload.metrics.notStarted)),
                row('กำลังดำเนินการ', String(payload.metrics.inProgress), '#1D4ED8'),
                row('เสร็จสิ้น', String(payload.metrics.completed), '#0F766E'),
                row('ล่าช้า', String(payload.metrics.delayed), '#B91C1C'),
            ],
        },
    ];

    if (reportType === 'today-team-load') {
        const teamLoadRows = payload.teamLoad || [];
        bodyContents.push({
            type: 'text',
            text: 'รายละเอียดภาระงานทีม',
            size: 'sm',
            weight: 'bold',
            color: '#334155',
            margin: 'md',
        });

        if (teamLoadRows.length === 0) {
            bodyContents.push({
                type: 'box',
                layout: 'vertical',
                paddingAll: '10px',
                backgroundColor: '#F8FAFC',
                cornerRadius: '10px',
                contents: [
                    { type: 'text', text: 'ไม่มีงานเปิดที่มอบหมายวันนี้', size: 'sm', color: '#475467' },
                ],
            });
        } else {
            teamLoadRows.slice(0, 10).forEach((item, index) => {
                bodyContents.push({
                    type: 'box',
                    layout: 'vertical',
                    margin: index === 0 ? 'sm' : 'md',
                    paddingAll: '10px',
                    backgroundColor: '#FFFFFF',
                    cornerRadius: '10px',
                    contents: [
                        { type: 'text', text: item.name, size: 'sm', weight: 'bold', color: '#111827', wrap: true },
                        {
                            type: 'text',
                            text: `เปิด ${item.totalOpen} | ครบกำหนดวันนี้ ${item.dueToday} | เกินกำหนด ${item.overdue}`,
                            size: 'sm',
                            color: '#475467',
                            margin: 'sm',
                            wrap: true,
                        },
                    ],
                });
            });
        }
    }

    if (reportType === 'completed-last-2-days') {
        const digest = payload.completedDigest;
        const todayTasks = (digest?.todayTasks || []).slice(0, 6);
        const yesterdayTasks = (digest?.yesterdayTasks || []).slice(0, 6);

        bodyContents.push({
            type: 'text',
            text: 'สรุปงานที่เสร็จสิ้น',
            size: 'sm',
            weight: 'bold',
            color: '#334155',
            margin: 'md',
        });

        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'sm',
            paddingAll: '10px',
            backgroundColor: '#FFFFFF',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: `วันนี้ (${digest?.todayDate || '-'}) : ${digest?.todayDone ?? 0}`, size: 'sm', weight: 'bold', color: '#0F172A' },
                ...(todayTasks.length > 0
                    ? todayTasks.map((taskName) => ({
                        type: 'text' as const,
                        text: `- ${taskName}`,
                        size: 'xs' as const,
                        color: '#475467',
                        margin: 'sm' as const,
                        wrap: true,
                    }))
                    : [{ type: 'text' as const, text: '- ไม่มีงานที่เสร็จสิ้น', size: 'xs' as const, color: '#475467', margin: 'sm' as const }]),
            ],
        });

        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            paddingAll: '10px',
            backgroundColor: '#FFFFFF',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: `พรุ่งนี้ (${digest?.yesterdayDate || '-'}) : ${digest?.yesterdayDone ?? 0}`, size: 'sm', weight: 'bold', color: '#0F172A' },
                ...(yesterdayTasks.length > 0
                    ? yesterdayTasks.map((taskName) => ({
                        type: 'text' as const,
                        text: `- ${taskName}`,
                        size: 'xs' as const,
                        color: '#475467',
                        margin: 'sm' as const,
                        wrap: true,
                    }))
                    : [{ type: 'text' as const, text: '- ไม่มีงานที่เสร็จสิ้น', size: 'xs' as const, color: '#475467', margin: 'sm' as const }]),
            ],
        });
    }

    const footerContents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode> = [
        { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#6B7280', align: 'center' },
    ];

    if (reportType !== 'today-team-load') {
        footerContents.unshift({
            type: 'button',
            action: {
                type: 'uri',
                label: 'เปิดรายงานฉบับเต็ม',
                uri: reportUrl,
            },
            style: 'primary',
            color: '#1D4ED8',
            height: 'sm',
        });
    }

    return {
        type: 'flex',
        altText: `${meta.title}: ${payload.projectName}`,
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
                contents: footerContents,
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
        if (!isValidReportPayload(body)) {
            return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
        }

        const targetIds = [
            (body.adminLineUserId || '').trim(),
            (body.adminLineGroupId || '').trim(),
            LINE_ADMIN_USER_ID_FROM_ENV.trim()
        ]
            .join(',')
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);

        const uniqueTargetIds = Array.from(new Set(targetIds));

        if (uniqueTargetIds.length === 0) {
            return NextResponse.json(
                { ok: false, error: 'LINE admin user ID is not configured in Settings or environment' },
                { status: 500 }
            );
        }

        const flexMessage = buildFlexMessage(body);

        const pushPromises = uniqueTargetIds.map(targetId => fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: targetId,
                messages: [flexMessage],
            }),
        }));

        const responses = await Promise.all(pushPromises);
        const failedResponse = responses.find(r => !r.ok);

        if (failedResponse) {
            const errorText = await failedResponse.text();
            return NextResponse.json({ ok: false, error: errorText }, { status: failedResponse.status });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
