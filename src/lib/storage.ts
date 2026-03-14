import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { hasFirebaseConfig, storage } from './firebase';

export interface UploadedStorageFile {
    url: string;
    storagePath: string;
}

function ensureStorageAvailable() {
    if (!hasFirebaseConfig || !storage) {
        throw new Error('Firebase Storage is not configured.');
    }
}

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadTaskAttachmentFile(taskId: string, file: File): Promise<UploadedStorageFile> {
    ensureStorageAvailable();

    const safeName = sanitizeFileName(file.name || 'attachment');
    const storagePath = `attachments/${taskId}/${Date.now()}-${Math.floor(Math.random() * 100000)}-${safeName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
    });

    const url = await getDownloadURL(storageRef);
    return { url, storagePath };
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
    if (!storagePath) return;

    ensureStorageAvailable();
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
}
