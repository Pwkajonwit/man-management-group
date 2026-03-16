import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_CREDENTIAL_ERROR = 'Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY, or configure GOOGLE_APPLICATION_CREDENTIALS.';

function getAdminCredential() {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const canUseApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_ADMIN_USE_APPLICATION_DEFAULT === 'true');

    if (projectId && clientEmail && privateKey) {
        return {
            projectId,
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        };
    }

    if (projectId && canUseApplicationDefault) {
        return {
            projectId,
            credential: applicationDefault(),
        };
    }

    throw new Error(DEFAULT_CREDENTIAL_ERROR);
}

function getAdminApp() {
    if (getApps().length > 0) return getApps()[0];

    const { projectId, credential } = getAdminCredential();
    return initializeApp({
        credential,
        projectId,
    });
}

export function getFirebaseAdminAuth() {
    return getAuth(getAdminApp());
}

export function getFirebaseAdminDb() {
    return getFirestore(getAdminApp());
}

export async function verifyFirebaseAdminBearerToken(authorizationHeader: string | null): Promise<DecodedIdToken> {
    const bearerPrefix = 'Bearer ';
    if (!authorizationHeader || !authorizationHeader.startsWith(bearerPrefix)) {
        throw new Error('Missing authorization token.');
    }

    const token = authorizationHeader.slice(bearerPrefix.length).trim();
    if (!token) {
        throw new Error('Missing authorization token.');
    }

    return getFirebaseAdminAuth().verifyIdToken(token);
}

export function isFirebaseAdminConfigError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes(DEFAULT_CREDENTIAL_ERROR) || message.includes('Could not load the default credentials');
}
