import { NextRequest, NextResponse } from 'next/server';
import { withDefaultSystemScope } from '@/lib/scope';
import { getFirebaseAdminAuth, getFirebaseAdminDb, verifyFirebaseAdminBearerToken } from '@/lib/firebaseAdmin';
import type { SystemUserAccount } from '@/types/construction';

export const runtime = 'nodejs';

interface CreateSystemUserRequest {
    id?: string;
    username?: string;
    email?: string;
    displayName?: string;
    authProvider?: SystemUserAccount['authProvider'];
    password?: string;
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    role?: SystemUserAccount['role'];
    branchIds?: string[];
    departmentIds?: string[];
    phone?: string;
    lineUserId?: string;
}

function asTrimmedString(value: unknown): string {
    return String(value || '').trim();
}

function normalizeUniqueIds(value: unknown, fallback?: string): string[] {
    const items = Array.isArray(value)
        ? value.map((item) => asTrimmedString(item))
        : [];
    const result = Array.from(new Set(items.filter(Boolean)));
    if (result.length === 0 && fallback) result.push(fallback);
    return result;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    ) as T;
}

export async function POST(request: NextRequest) {
    try {
        await verifyFirebaseAdminBearerToken(request.headers.get('authorization'));

        const body = await request.json() as CreateSystemUserRequest;
        const username = asTrimmedString(body.username).toLowerCase();
        const email = asTrimmedString(body.email).toLowerCase();
        const displayName = asTrimmedString(body.displayName);
        const authProvider: SystemUserAccount['authProvider'] = body.authProvider === 'line' ? 'line' : 'password';
        const password = asTrimmedString(body.password);

        if (!username || !email || !displayName) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อที่แสดง ชื่อผู้ใช้ และอีเมล' }, { status: 400 });
        }
        if (authProvider === 'password' && password.length < 6) {
            return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
        }

        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getFirebaseAdminDb();
        const nowIso = new Date().toISOString();

        let id = asTrimmedString(body.id);
        if (authProvider === 'password') {
            const createdUser = await adminAuth.createUser({
                ...(id ? { uid: id } : {}),
                email,
                password,
                displayName,
            });
            id = createdUser.uid;
        }

        if (!id) {
            id = `su-${Date.now()}`;
        }

        const scoped = withDefaultSystemScope({
            orgId: asTrimmedString(body.orgId),
            branchId: asTrimmedString(body.branchId),
            departmentId: asTrimmedString(body.departmentId),
            role: body.role,
            branchIds: normalizeUniqueIds(body.branchIds, asTrimmedString(body.branchId)),
            departmentIds: normalizeUniqueIds(body.departmentIds, asTrimmedString(body.departmentId)),
        });

        const payload = omitUndefined({
            username,
            email,
            displayName,
            authProvider,
            orgId: scoped.orgId,
            branchId: scoped.branchId,
            departmentId: scoped.departmentId,
            role: scoped.role,
            branchIds: scoped.branchIds,
            departmentIds: scoped.departmentIds,
            phone: asTrimmedString(body.phone),
            lineUserId: asTrimmedString(body.lineUserId),
            createdAt: nowIso,
            updatedAt: nowIso,
        });

        await adminDb.collection('systemUsers').doc(id).set(payload, { merge: true });

        return NextResponse.json({ id });
    } catch (error) {
        console.error('Failed to create system user:', error);
        const message = error instanceof Error ? error.message : 'ไม่สามารถเพิ่มผู้ใช้ระบบได้';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
