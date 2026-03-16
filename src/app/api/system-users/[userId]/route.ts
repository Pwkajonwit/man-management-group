import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb, verifyFirebaseAdminBearerToken } from '@/lib/firebaseAdmin';
import { withDefaultSystemScope } from '@/lib/scope';
import type { SystemUserAccount } from '@/types/construction';

export const runtime = 'nodejs';

interface UpdateSystemUserRequest {
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
    lastLoginAt?: string;
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

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    try {
        await verifyFirebaseAdminBearerToken(request.headers.get('authorization'));

        const { userId } = await context.params;
        const body = await request.json() as UpdateSystemUserRequest;
        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getFirebaseAdminDb();
        const docRef = adminDb.collection('systemUsers').doc(userId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            return NextResponse.json({ error: 'ไม่พบผู้ใช้ระบบที่ต้องการอัปเดต' }, { status: 404 });
        }

        const currentUser = snapshot.data() as Partial<SystemUserAccount>;
        const username = asTrimmedString(body.username || currentUser.username).toLowerCase();
        const email = asTrimmedString(body.email || currentUser.email).toLowerCase();
        const displayName = asTrimmedString(body.displayName || currentUser.displayName);
        const authProvider: SystemUserAccount['authProvider'] = body.authProvider === 'line'
            ? 'line'
            : body.authProvider === 'password'
                ? 'password'
                : (currentUser.authProvider === 'line' ? 'line' : 'password');
        const password = asTrimmedString(body.password);

        if (!username || !email || !displayName) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อที่แสดง ชื่อผู้ใช้ และอีเมล' }, { status: 400 });
        }
        if (authProvider === 'password' && password && password.length < 6) {
            return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
        }

        let authUserExists = false;
        try {
            await adminAuth.getUser(userId);
            authUserExists = true;
        } catch (error) {
            const authError = error as { code?: string };
            if (authError.code !== 'auth/user-not-found') throw error;
        }

        if (authUserExists) {
            const authPatch: { email?: string; displayName?: string; password?: string } = {};
            if (email && email !== currentUser.email) authPatch.email = email;
            if (displayName && displayName !== currentUser.displayName) authPatch.displayName = displayName;
            if (authProvider === 'password' && password) authPatch.password = password;
            if (Object.keys(authPatch).length > 0) {
                await adminAuth.updateUser(userId, authPatch);
            }
        } else if (authProvider === 'password') {
            if (password.length < 6) {
                return NextResponse.json({ error: 'กรุณากำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษรสำหรับผู้ใช้รายนี้' }, { status: 400 });
            }
            await adminAuth.createUser({
                uid: userId,
                email,
                password,
                displayName,
            });
        }

        const scoped = withDefaultSystemScope({
            orgId: asTrimmedString(body.orgId || currentUser.orgId),
            branchId: asTrimmedString(body.branchId || currentUser.branchId),
            departmentId: asTrimmedString(body.departmentId || currentUser.departmentId),
            role: body.role || currentUser.role,
            branchIds: normalizeUniqueIds(body.branchIds ?? currentUser.branchIds, asTrimmedString(body.branchId || currentUser.branchId)),
            departmentIds: normalizeUniqueIds(body.departmentIds ?? currentUser.departmentIds, asTrimmedString(body.departmentId || currentUser.departmentId)),
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
            phone: asTrimmedString(body.phone ?? currentUser.phone),
            lineUserId: asTrimmedString(body.lineUserId ?? currentUser.lineUserId),
            lastLoginAt: asTrimmedString(body.lastLoginAt || currentUser.lastLoginAt),
            updatedAt: new Date().toISOString(),
        });

        await docRef.set(payload, { merge: true });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to update system user:', error);
        const message = error instanceof Error ? error.message : 'ไม่สามารถอัปเดตผู้ใช้ระบบได้';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
) {
    try {
        await verifyFirebaseAdminBearerToken(request.headers.get('authorization'));

        const { userId } = await context.params;
        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getFirebaseAdminDb();

        await adminDb.collection('systemUsers').doc(userId).delete();
        try {
            await adminAuth.deleteUser(userId);
        } catch (error) {
            const authError = error as { code?: string };
            if (authError.code !== 'auth/user-not-found') throw error;
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete system user:', error);
        const message = error instanceof Error ? error.message : 'ไม่สามารถลบผู้ใช้ระบบได้';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
