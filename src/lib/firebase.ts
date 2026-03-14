import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasFirebaseConfig = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.storageBucket,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
].every((value) => typeof value === 'string' && value.trim().length > 0);

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;

if (hasFirebaseConfig) {
    // Initialize Firebase (prevent re-initialization in development)
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    // Initialize services
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
} else {
    // Keep module import-safe during SSR/build when env vars are missing.
    app = null as unknown as FirebaseApp;
    db = null as unknown as Firestore;
    storage = null as unknown as FirebaseStorage;
    auth = null as unknown as Auth;

    if (typeof window !== 'undefined') {
        console.warn('Firebase env vars are missing. Firebase services are disabled.');
    }
}

export { app, db, storage, auth, hasFirebaseConfig };
