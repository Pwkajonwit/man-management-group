#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnv } from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_ORG_ID = 'org-default';
const DEFAULT_BRANCH_ID = 'branch-hq';
const DEFAULT_DEPARTMENT_ID = 'dept-general';
const DEFAULT_SYSTEM_USER_ROLE = 'staff';
const VALID_ROLES = new Set([
    'super_admin',
    'branch_manager',
    'department_manager',
    'staff',
    'viewer',
]);

function asString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => asString(item)).filter(Boolean)));
}

function arraysEqual(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function buildScopePatch(data) {
    const patch = {};
    if (!asString(data.orgId)) patch.orgId = DEFAULT_ORG_ID;
    if (!asString(data.branchId)) patch.branchId = DEFAULT_BRANCH_ID;
    if (!asString(data.departmentId)) patch.departmentId = DEFAULT_DEPARTMENT_ID;
    return patch;
}

function buildSystemUserPatch(data) {
    const patch = {};

    if (!asString(data.orgId)) {
        patch.orgId = DEFAULT_ORG_ID;
    }

    const role = asString(data.role);
    if (!VALID_ROLES.has(role)) {
        patch.role = DEFAULT_SYSTEM_USER_ROLE;
    }

    const originalBranchId = asString(data.branchId);
    const originalBranchIds = normalizeStringArray(data.branchIds);
    let nextBranchId = originalBranchId || originalBranchIds[0] || DEFAULT_BRANCH_ID;
    let nextBranchIds = originalBranchIds.length > 0 ? [...originalBranchIds] : [nextBranchId];
    if (!nextBranchIds.includes(nextBranchId)) {
        nextBranchIds = [nextBranchId, ...nextBranchIds];
    }
    if (!originalBranchId) {
        patch.branchId = nextBranchId;
    }
    if (!arraysEqual(originalBranchIds, nextBranchIds)) {
        patch.branchIds = nextBranchIds;
    }

    const originalDepartmentId = asString(data.departmentId);
    const originalDepartmentIds = normalizeStringArray(data.departmentIds);
    let nextDepartmentId = originalDepartmentId || originalDepartmentIds[0] || DEFAULT_DEPARTMENT_ID;
    let nextDepartmentIds = originalDepartmentIds.length > 0 ? [...originalDepartmentIds] : [nextDepartmentId];
    if (!nextDepartmentIds.includes(nextDepartmentId)) {
        nextDepartmentIds = [nextDepartmentId, ...nextDepartmentIds];
    }
    if (!originalDepartmentId) {
        patch.departmentId = nextDepartmentId;
    }
    if (!arraysEqual(originalDepartmentIds, nextDepartmentIds)) {
        patch.departmentIds = nextDepartmentIds;
    }

    return patch;
}

async function commitInBatches(updates, apply) {
    if (!apply || updates.length === 0) return;
    const batchSize = 400;
    for (let index = 0; index < updates.length; index += batchSize) {
        const chunk = updates.slice(index, index + batchSize);
        const batch = db.batch();
        chunk.forEach(({ ref, patch }) => batch.update(ref, patch));
        await batch.commit();
    }
}

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    const projectArg = argv.slice(2).find((arg) => arg.startsWith('--project=')) || '';
    return {
        apply: args.has('--apply'),
        verbose: args.has('--verbose'),
        projectId: projectArg ? projectArg.split('=')[1] : '',
    };
}

function getServiceAccount() {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson) {
        return JSON.parse(rawJson);
    }

    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (jsonPath) {
        const absolute = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
        return JSON.parse(fs.readFileSync(absolute, 'utf8'));
    }

    return null;
}

function initFirebase(projectIdFromArg) {
    if (getApps().length > 0) return;

    const envProjectId = asString(projectIdFromArg)
        || asString(process.env.FIREBASE_PROJECT_ID)
        || asString(process.env.GOOGLE_CLOUD_PROJECT)
        || asString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const serviceAccount = getServiceAccount();

    if (serviceAccount) {
        initializeApp({
            credential: cert(serviceAccount),
            projectId: envProjectId || serviceAccount.project_id,
        });
        return;
    }

    if (envProjectId) {
        initializeApp({
            credential: applicationDefault(),
            projectId: envProjectId,
        });
        return;
    }

    initializeApp({
        credential: applicationDefault(),
    });
}

const { apply, verbose, projectId } = parseArgs(process.argv);
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv();
initFirebase(projectId);
const db = getFirestore();

async function migrateCollection(collectionName, buildPatch) {
    const snapshot = await db.collection(collectionName).get();
    const updates = [];
    let scanned = 0;

    snapshot.forEach((docSnapshot) => {
        scanned += 1;
        const patch = buildPatch(docSnapshot.data() || {});
        if (Object.keys(patch).length > 0) {
            updates.push({
                id: docSnapshot.id,
                ref: docSnapshot.ref,
                patch,
            });
        }
    });

    await commitInBatches(updates, apply);

    console.log(`[${collectionName}] scanned=${scanned} changed=${updates.length}${apply ? ' applied' : ' dry-run'}`);
    if (verbose && updates.length > 0) {
        updates.slice(0, 5).forEach((item) => {
            console.log(`  - ${item.id}: ${JSON.stringify(item.patch)}`);
        });
    }

    return { scanned, changed: updates.length };
}

async function main() {
    console.log(`Running migration mode: ${apply ? 'apply' : 'dry-run'}`);

    const collections = [
        { name: 'projects', patchBuilder: buildScopePatch },
        { name: 'tasks', patchBuilder: buildScopePatch },
        { name: 'teamMembers', patchBuilder: buildScopePatch },
        { name: 'systemUsers', patchBuilder: buildSystemUserPatch },
    ];

    let totalScanned = 0;
    let totalChanged = 0;

    for (const entry of collections) {
        const result = await migrateCollection(entry.name, entry.patchBuilder);
        totalScanned += result.scanned;
        totalChanged += result.changed;
    }

    console.log(`Done. scanned=${totalScanned} changed=${totalChanged}${apply ? ' applied' : ' (no writes)'}`);
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
});
