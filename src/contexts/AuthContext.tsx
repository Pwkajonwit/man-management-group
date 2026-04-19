'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initializeLiff, getLineProfile, loginWithLine, logout as lineLogout, isLoggedIn, LineProfile } from '@/lib/line';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User as FirebaseUser,
} from 'firebase/auth';
import { getSystemUserAccountById, getSystemUserAccounts, getTeamMembers, updateTeamMember, upsertSystemUserAccount } from '@/lib/firestore';
import { SystemUserAccount, SystemUserRole, TeamMember } from '@/types/construction';
import {
    DEFAULT_BRANCH_ID,
    DEFAULT_DEPARTMENT_ID,
    DEFAULT_ORG_ID,
    DEFAULT_SYSTEM_USER_ROLE,
} from '@/lib/scope';

interface AuthUser {
    uid: string;
    displayName: string;
    pictureUrl?: string;
    lineUserId?: string;
    orgId: string;
    branchId: string;
    departmentId: string;
    role: SystemUserRole;
    branchIds: string[];
    departmentIds: string[];
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    loginLine: () => void;
    pendingLineProfile: LineProfile | null;
    requiresLinePhoneBinding: boolean;
    bindLinePhone: (phone: string) => Promise<void>;
    loginWithPassword: (userOrEmail: string, password: string) => Promise<void>;
    registerWithPassword: (userOrEmail: string, password: string, displayName?: string) => Promise<void>;
    logoutUser: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

const USERNAME_EMAIL_DOMAIN = 'workos.local';
const DIGITS_ONLY = /[^0-9]/g;

function normalizeLinePictureUrl(url?: string): string | undefined {
    if (!url) return undefined;
    return url.replace(/^http:\/\//i, 'https://');
}

function toAuthEmail(userOrEmail: string): string {
    const normalized = userOrEmail.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('@')) return normalized;
    return `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
}

function mapFirebaseUser(firebaseUser: FirebaseUser): AuthUser {
    return {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        pictureUrl: firebaseUser.photoURL || undefined,
        lineUserId: undefined,
        orgId: DEFAULT_ORG_ID,
        branchId: DEFAULT_BRANCH_ID,
        departmentId: DEFAULT_DEPARTMENT_ID,
        role: DEFAULT_SYSTEM_USER_ROLE,
        branchIds: [DEFAULT_BRANCH_ID],
        departmentIds: [DEFAULT_DEPARTMENT_ID],
    };
}

function mapTeamMemberToAuthUser(member: TeamMember, lineUserId?: string, pictureUrl?: string): AuthUser {
    const branchId = member.branchId || DEFAULT_BRANCH_ID;
    const departmentId = member.departmentId || DEFAULT_DEPARTMENT_ID;
    const resolvedPictureUrl = pictureUrl || member.avatar || undefined;
    return {
        uid: lineUserId || member.id,
        displayName: member.name || 'User',
        pictureUrl: resolvedPictureUrl,
        lineUserId,
        orgId: member.orgId || DEFAULT_ORG_ID,
        branchId,
        departmentId,
        role: DEFAULT_SYSTEM_USER_ROLE,
        branchIds: [branchId],
        departmentIds: [departmentId],
    };
}

function mapSystemUserToAuthUser(account: SystemUserAccount, lineUserId?: string, pictureUrl?: string): AuthUser {
    const branchId = account.branchId || DEFAULT_BRANCH_ID;
    const departmentId = account.departmentId || DEFAULT_DEPARTMENT_ID;
    const branchIds = Array.from(new Set([...(account.branchIds || []), branchId].filter(Boolean)));
    const departmentIds = Array.from(new Set([...(account.departmentIds || []), departmentId].filter(Boolean)));

    return {
        uid: account.id,
        displayName: account.displayName || account.username || account.email || 'User',
        pictureUrl,
        lineUserId: lineUserId || account.lineUserId,
        orgId: account.orgId || DEFAULT_ORG_ID,
        branchId,
        departmentId,
        role: account.role || DEFAULT_SYSTEM_USER_ROLE,
        branchIds: branchIds.length > 0 ? branchIds : [DEFAULT_BRANCH_ID],
        departmentIds: departmentIds.length > 0 ? departmentIds : [DEFAULT_DEPARTMENT_ID],
    };
}

function mergeSystemScope(baseUser: AuthUser, account: {
    orgId?: string;
    branchId?: string;
    departmentId?: string;
    role?: SystemUserRole;
    branchIds?: string[];
    departmentIds?: string[];
} | null): AuthUser {
    if (!account) return baseUser;

    const branchId = account.branchId || baseUser.branchId || DEFAULT_BRANCH_ID;
    const departmentId = account.departmentId || baseUser.departmentId || DEFAULT_DEPARTMENT_ID;
    const branchIds = Array.from(new Set([...(account.branchIds || []), branchId].filter(Boolean)));
    const departmentIds = Array.from(new Set([...(account.departmentIds || []), departmentId].filter(Boolean)));

    return {
        ...baseUser,
        orgId: account.orgId || baseUser.orgId || DEFAULT_ORG_ID,
        branchId,
        departmentId,
        role: account.role || baseUser.role || DEFAULT_SYSTEM_USER_ROLE,
        branchIds: branchIds.length > 0 ? branchIds : [DEFAULT_BRANCH_ID],
        departmentIds: departmentIds.length > 0 ? departmentIds : [DEFAULT_DEPARTMENT_ID],
    };
}

function usernameFromEmail(email?: string): string {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return email;
    return email.slice(0, atIndex);
}

function normalizePhone(phone: string): string {
    return phone.replace(DIGITS_ONLY, '');
}

function findMemberByPhone(members: TeamMember[], phone: string): TeamMember | null {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return members.find((member) => normalizePhone(member.phone || '') === normalized) || null;
}

function findSystemUserByPhone(users: SystemUserAccount[], phone: string): SystemUserAccount | null {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return users.find((account) => normalizePhone(account.phone || '') === normalized) || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingLineProfile, setPendingLineProfile] = useState<LineProfile | null>(null);
    const [requiresLinePhoneBinding, setRequiresLinePhoneBinding] = useState(false);

    useEffect(() => {
        let mounted = true;

        const handleAuthState = async (firebaseUser: FirebaseUser | null) => {
            try {
                const liffReady = await initializeLiff();
                if (firebaseUser && mounted) {
                    const account = await getSystemUserAccountById(firebaseUser.uid);
                    const baseUser = mapFirebaseUser(firebaseUser);

                    if (account) {
                        if (liffReady && isLoggedIn()) {
                            const profile = await getLineProfile();
                            const normalizedPictureUrl = normalizeLinePictureUrl(profile?.pictureUrl);
                            setPendingLineProfile(null);
                            setRequiresLinePhoneBinding(false);
                            setUser(mergeSystemScope({
                                ...baseUser,
                                ...(profile?.userId ? { lineUserId: profile.userId } : {}),
                                ...(normalizedPictureUrl ? { pictureUrl: normalizedPictureUrl } : {}),
                            }, account));
                            setLoading(false);
                            return;
                        }

                        setPendingLineProfile(null);
                        setRequiresLinePhoneBinding(false);
                        setUser(mergeSystemScope(baseUser, account));
                        setLoading(false);
                        return;
                    }
                }

                if (liffReady && isLoggedIn()) {
                    const profile = await getLineProfile();
                    if (profile && mounted) {
                        const normalizedPictureUrl = normalizeLinePictureUrl(profile.pictureUrl);
                        const [members, systemAccounts] = await Promise.all([
                            getTeamMembers(),
                            getSystemUserAccounts(),
                        ]);
                        const matchedSystemByLine = systemAccounts.find((account) => account.lineUserId === profile.userId);
                        const matchedByLine = members.find((member) => member.lineUserId === profile.userId);
                        const linePictureUrl = normalizedPictureUrl || matchedByLine?.avatar;

                        if (matchedSystemByLine) {
                            if (matchedByLine && normalizedPictureUrl && matchedByLine.avatar !== normalizedPictureUrl) {
                                await updateTeamMember(matchedByLine.id, { avatar: normalizedPictureUrl });
                            }

                            void upsertSystemUserAccount(matchedSystemByLine.id, {
                                lastLoginAt: new Date().toISOString(),
                            }).catch((syncError) => {
                                console.error('Failed to sync system user account on LINE login:', syncError);
                            });

                            setPendingLineProfile(null);
                            setRequiresLinePhoneBinding(false);
                            setUser(mergeSystemScope(
                                mapSystemUserToAuthUser(matchedSystemByLine, profile.userId, linePictureUrl),
                                matchedSystemByLine
                            ));
                            setLoading(false);
                            return;
                        }

                        if (matchedByLine) {
                            if (normalizedPictureUrl && matchedByLine.avatar !== normalizedPictureUrl) {
                                await updateTeamMember(matchedByLine.id, { avatar: normalizedPictureUrl });
                            }

                            setPendingLineProfile(null);
                            setRequiresLinePhoneBinding(false);
                            setUser(mapTeamMemberToAuthUser(matchedByLine, profile.userId, linePictureUrl));
                            setLoading(false);
                            return;
                        }

                        setPendingLineProfile(profile);
                        setRequiresLinePhoneBinding(true);
                        setUser(null);
                        setLoading(false);
                        return;
                    }
                }

                if (firebaseUser && mounted) {
                    setPendingLineProfile(null);
                    setRequiresLinePhoneBinding(false);
                    const account = await getSystemUserAccountById(firebaseUser.uid);
                    const baseUser = mapFirebaseUser(firebaseUser);
                    setUser(mergeSystemScope(baseUser, account));
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error('Auth check error:', err);
            }

            if (mounted) {
                setPendingLineProfile(null);
                setRequiresLinePhoneBinding(false);
                setUser(null);
                setLoading(false);
            }
        };

        if (!hasFirebaseConfig) {
            void handleAuthState(null);
            return () => {
                mounted = false;
            };
        }

        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            void handleAuthState(firebaseUser);
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    useEffect(() => {
        if (!hasFirebaseConfig) return;
        void setPersistence(auth, browserLocalPersistence).catch((err) => {
            console.error('Failed to set Firebase auth persistence:', err);
        });
    }, []);

    const loginLine = () => {
        if (hasFirebaseConfig) {
            void signOut(auth).catch(() => {
                // ignore
            });
        }
        setUser(null);
        setPendingLineProfile(null);
        setRequiresLinePhoneBinding(false);
        loginWithLine();
    };

    const bindLinePhone = async (phone: string) => {
        if (!pendingLineProfile) {
            throw new Error('LINE profile is not ready for binding.');
        }

        const normalizedInput = normalizePhone(phone);
        if (!normalizedInput) {
            throw new Error('Please enter a valid phone number.');
        }

        const [members, systemAccounts] = await Promise.all([
            getTeamMembers(),
            getSystemUserAccounts(),
        ]);
        const matchedMember = findMemberByPhone(members, normalizedInput);
        const matchedSystemUser = findSystemUserByPhone(systemAccounts, normalizedInput);

        if (!matchedMember && !matchedSystemUser) {
            throw new Error('Phone number was not found in employees or system users.');
        }

        if (matchedMember?.lineUserId && matchedMember.lineUserId !== pendingLineProfile.userId) {
            throw new Error('This phone is already linked with another LINE account.');
        }

        if (matchedSystemUser?.lineUserId && matchedSystemUser.lineUserId !== pendingLineProfile.userId) {
            throw new Error('This phone is already linked with another LINE account.');
        }

        const normalizedPictureUrl = normalizeLinePictureUrl(pendingLineProfile.pictureUrl);
        const linePictureUrl = normalizedPictureUrl || matchedMember?.avatar;
        if (matchedMember) {
            const memberPatch: Partial<TeamMember> = { lineUserId: pendingLineProfile.userId };
            if (normalizedPictureUrl && matchedMember.avatar !== normalizedPictureUrl) {
                memberPatch.avatar = normalizedPictureUrl;
            }
            await updateTeamMember(matchedMember.id, memberPatch);
        }

        if (matchedSystemUser) {
            await upsertSystemUserAccount(matchedSystemUser.id, {
                lineUserId: pendingLineProfile.userId,
                phone: matchedSystemUser.phone || phone.trim(),
                lastLoginAt: new Date().toISOString(),
            });
        }

        setRequiresLinePhoneBinding(false);
        setPendingLineProfile(null);
        if (matchedSystemUser) {
            const updatedSystemUser: SystemUserAccount = {
                ...matchedSystemUser,
                lineUserId: pendingLineProfile.userId,
                lastLoginAt: new Date().toISOString(),
            };
            setUser(mergeSystemScope(
                mapSystemUserToAuthUser(updatedSystemUser, pendingLineProfile.userId, linePictureUrl),
                updatedSystemUser
            ));
            return;
        }

        if (!matchedMember) {
            throw new Error('Phone number was not found in employees or system users.');
        }

        setUser(mapTeamMemberToAuthUser(matchedMember, pendingLineProfile.userId, linePictureUrl));
    };

    const loginWithPassword = async (userOrEmail: string, password: string) => {
        if (!hasFirebaseConfig) {
            throw new Error('Firebase Auth is not configured in this environment.');
        }

        const email = toAuthEmail(userOrEmail);
        if (!email || !password.trim()) {
            throw new Error('Please enter User/Email and Password.');
        }

        await setPersistence(auth, browserLocalPersistence);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        try {
            const createdAtRaw = credential.user.metadata.creationTime;
            const createdAt = createdAtRaw ? new Date(createdAtRaw).toISOString() : undefined;
            const effectiveEmail = credential.user.email || email;
            await upsertSystemUserAccount(credential.user.uid, {
                email: effectiveEmail,
                username: usernameFromEmail(effectiveEmail),
                displayName: credential.user.displayName || usernameFromEmail(effectiveEmail) || 'User',
                authProvider: 'password',
                createdAt,
                lastLoginAt: new Date().toISOString(),
            });
        } catch (syncError) {
            console.error('Failed to sync system user account on login:', syncError);
        }
        const account = await getSystemUserAccountById(credential.user.uid);
        setUser(mergeSystemScope(mapFirebaseUser(credential.user), account));
    };

    const registerWithPassword = async (userOrEmail: string, password: string, displayName?: string) => {
        if (!hasFirebaseConfig) {
            throw new Error('Firebase Auth is not configured in this environment.');
        }

        const email = toAuthEmail(userOrEmail);
        if (!email || !password.trim()) {
            throw new Error('Please enter User/Email and Password.');
        }

        await setPersistence(auth, browserLocalPersistence);
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const finalName = (displayName || userOrEmail).trim();
        if (finalName) {
            await updateProfile(credential.user, { displayName: finalName });
        }
        try {
            const nowIso = new Date().toISOString();
            const effectiveEmail = credential.user.email || email;
            await upsertSystemUserAccount(credential.user.uid, {
                email: effectiveEmail,
                username: usernameFromEmail(effectiveEmail),
                displayName: finalName || usernameFromEmail(effectiveEmail) || 'User',
                authProvider: 'password',
                orgId: DEFAULT_ORG_ID,
                branchId: DEFAULT_BRANCH_ID,
                departmentId: DEFAULT_DEPARTMENT_ID,
                role: DEFAULT_SYSTEM_USER_ROLE,
                branchIds: [DEFAULT_BRANCH_ID],
                departmentIds: [DEFAULT_DEPARTMENT_ID],
                createdAt: nowIso,
                lastLoginAt: nowIso,
            });
        } catch (syncError) {
            console.error('Failed to sync system user account on register:', syncError);
        }

        const account = await getSystemUserAccountById(credential.user.uid);
        setUser(mergeSystemScope(mapFirebaseUser(credential.user), account));
    };

    const logoutUser = () => {
        if (hasFirebaseConfig) {
            void signOut(auth).catch(() => {
                // ignore
            });
        }

        try {
            lineLogout();
        } catch {
            // ignore if not LINE
        }

        setPendingLineProfile(null);
        setRequiresLinePhoneBinding(false);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                loginLine,
                pendingLineProfile,
                requiresLinePhoneBinding,
                bindLinePhone,
                loginWithPassword,
                registerWithPassword,
                logoutUser,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
