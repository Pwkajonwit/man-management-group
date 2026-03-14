import liff from '@line/liff';

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '';

export interface LineProfile {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}

let isLiffInitialized = false;

export function isLineLoginAvailable(): boolean {
    return Boolean(LIFF_ID);
}

export async function initializeLiff(): Promise<boolean> {
    if (isLiffInitialized) return true;
    if (!LIFF_ID) {
        console.warn('LIFF_ID is not set. LINE Login is disabled.');
        return false;
    }
    try {
        await liff.init({ liffId: LIFF_ID });
        isLiffInitialized = true;
        return true;
    } catch (err) {
        console.error('LIFF init failed', err);
        return false;
    }
}

export function isLoggedIn(): boolean {
    return liff.isLoggedIn();
}

export function loginWithLine(): void {
    if (!LIFF_ID) {
        console.warn('LINE Login is unavailable because NEXT_PUBLIC_LIFF_ID is not set.');
        if (typeof window !== 'undefined') {
            window.alert('LINE Login ยังไม่ถูกตั้งค่า (NEXT_PUBLIC_LIFF_ID)');
        }
        return;
    }

    const doLogin = () => {
        liff.login({ redirectUri: window.location.href });
    };

    if (isLiffInitialized) {
        doLogin();
        return;
    }

    void liff
        .init({ liffId: LIFF_ID })
        .then(() => {
            isLiffInitialized = true;
            doLogin();
        })
        .catch((err) => {
            console.error('LIFF init failed before login', err);
            if (typeof window !== 'undefined') {
                window.alert('ไม่สามารถเริ่ม LINE Login ได้ กรุณาตรวจสอบการตั้งค่า LIFF');
            }
        });
}

export function logout(): void {
    liff.logout();
    window.location.reload();
}

export async function getLineProfile(): Promise<LineProfile | null> {
    try {
        if (!liff.isLoggedIn()) return null;
        const profile = await liff.getProfile();
        return {
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
        };
    } catch (err) {
        console.error('Failed to get LINE profile', err);
        return null;
    }
}

export function getLiffAccessToken(): string | null {
    return liff.getAccessToken();
}
