import { Task, TeamMember } from '@/types/construction';

export function getTaskOwnerNames(task: Task, teamMembers: TeamMember[]): string[] {
    const ownerNamesFromIds = (task.assignedEmployeeIds || [])
        .map((ownerId) => teamMembers.find((member) => member.id === ownerId)?.name)
        .filter((name): name is string => Boolean(name));
    const fallbackOwner = task.responsible ? [task.responsible] : [];
    return Array.from(new Set([...ownerNamesFromIds, ...fallbackOwner].map((name) => name.trim()).filter(Boolean)));
}

export function isTaskAssignedTo(task: Task, memberName: string, teamMembers: TeamMember[]): boolean {
    return getTaskOwnerNames(task, teamMembers).includes(memberName);
}

export function isTaskUnassigned(task: Task, teamMembers: TeamMember[]): boolean {
    return getTaskOwnerNames(task, teamMembers).length === 0;
}

function normalizeName(name: string): string {
    return name
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[._-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeCompactName(name: string): string {
    return normalizeName(name).replace(/\s+/g, '');
}

export function findCurrentTeamMember(
    teamMembers: TeamMember[],
    currentUserName: string,
    lineUserId?: string,
    authUid?: string
): TeamMember | null {
    if (lineUserId) {
        const matchedByLine = teamMembers.find((member) => member.lineUserId === lineUserId);
        if (matchedByLine) return matchedByLine;
    }

    if (authUid) {
        const matchedByUid = teamMembers.find((member) => member.id === authUid);
        if (matchedByUid) return matchedByUid;
    }

    const normalizedCurrentName = normalizeName(currentUserName);
    const normalizedCurrentCompact = normalizeCompactName(currentUserName);
    if (!normalizedCurrentName) return null;

    const exactMatch = teamMembers.find((member) => normalizeName(member.name) === normalizedCurrentName);
    if (exactMatch) return exactMatch;

    const fuzzyMatches = teamMembers.filter((member) => {
        const memberName = normalizeName(member.name);
        const memberCompact = normalizeCompactName(member.name);
        if (!memberName) return false;

        // Best-effort match for slight format differences between auth name and team member name
        return (
            memberName.includes(normalizedCurrentName) ||
            normalizedCurrentName.includes(memberName) ||
            memberCompact.includes(normalizedCurrentCompact) ||
            normalizedCurrentCompact.includes(memberCompact)
        );
    });

    return fuzzyMatches.length === 1 ? fuzzyMatches[0] : null;
}

export function isTaskAssignedToCurrentUser(
    task: Task,
    teamMembers: TeamMember[],
    currentUserName: string,
    lineUserId?: string,
    authUid?: string
): boolean {
    const currentMember = findCurrentTeamMember(teamMembers, currentUserName, lineUserId, authUid);
    const assignedIds = new Set(task.assignedEmployeeIds || []);

    if (currentMember && assignedIds.has(currentMember.id)) {
        return true;
    }

    const normalizedCurrentName = normalizeName(currentUserName);
    const normalizedCurrentCompact = normalizeCompactName(currentUserName);
    const ownerNames = getTaskOwnerNames(task, teamMembers).map((name) => normalizeName(name));
    const ownerCompactNames = getTaskOwnerNames(task, teamMembers).map((name) => normalizeCompactName(name));

    if (normalizedCurrentName && ownerNames.includes(normalizedCurrentName)) {
        return true;
    }

    if (normalizedCurrentCompact && ownerCompactNames.includes(normalizedCurrentCompact)) {
        return true;
    }

    const allowFuzzyByCurrentName = normalizedCurrentCompact.length >= 3;
    if (allowFuzzyByCurrentName) {
        const fuzzyByName = ownerNames.some((ownerName) =>
            ownerName.includes(normalizedCurrentName) || normalizedCurrentName.includes(ownerName)
        );
        if (fuzzyByName) {
            return true;
        }

        const fuzzyByCompact = ownerCompactNames.some((ownerName) =>
            ownerName.includes(normalizedCurrentCompact) || normalizedCurrentCompact.includes(ownerName)
        );
        if (fuzzyByCompact) {
            return true;
        }
    }

    if (currentMember) {
        const normalizedMemberName = normalizeName(currentMember.name);
        const normalizedMemberCompact = normalizeCompactName(currentMember.name);

        if (ownerNames.includes(normalizedMemberName) || ownerCompactNames.includes(normalizedMemberCompact)) {
            return true;
        }

        // Fuzzy fallback when owner label and account label are similar but not identical
        return ownerNames.some((ownerName) =>
            ownerName.includes(normalizedMemberName) || normalizedMemberName.includes(ownerName)
        );
    }

    return false;
}
