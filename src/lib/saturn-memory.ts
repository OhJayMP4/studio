'use client';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

export type WorkspaceMemory = {
  facts: string[];
  lastUpdated: any;
};

export type UserMemory = {
  preferences: string[];
  patterns: string[];
  lastUpdated: any;
};

export async function getWorkspaceMemory(
  firestore: Firestore,
  workspaceId: string,
): Promise<WorkspaceMemory> {
  try {
    const snap = await getDoc(
      doc(firestore, 'workspaces', workspaceId, 'saturn-workspace-memory', 'main'),
    );
    if (!snap.exists()) return { facts: [], lastUpdated: null };
    return snap.data() as WorkspaceMemory;
  } catch {
    return { facts: [], lastUpdated: null };
  }
}

export async function getUserMemory(
  firestore: Firestore,
  workspaceId: string,
  uid: string,
): Promise<UserMemory> {
  try {
    const snap = await getDoc(
      doc(firestore, 'workspaces', workspaceId, 'saturn-user-memory', uid),
    );
    if (!snap.exists()) return { preferences: [], patterns: [], lastUpdated: null };
    return snap.data() as UserMemory;
  } catch {
    return { preferences: [], patterns: [], lastUpdated: null };
  }
}

export async function saveWorkspaceMemory(
  firestore: Firestore,
  workspaceId: string,
  facts: string[],
): Promise<void> {
  await setDoc(
    doc(firestore, 'workspaces', workspaceId, 'saturn-workspace-memory', 'main'),
    { facts, lastUpdated: serverTimestamp() },
    { merge: true },
  );
}

export async function saveUserMemory(
  firestore: Firestore,
  workspaceId: string,
  uid: string,
  preferences: string[],
  patterns: string[],
): Promise<void> {
  await setDoc(
    doc(firestore, 'workspaces', workspaceId, 'saturn-user-memory', uid),
    { preferences, patterns, lastUpdated: serverTimestamp() },
    { merge: true },
  );
}

const MAX_WORKSPACE_FACTS = 40;
const MAX_USER_PREFS = 12;
const MAX_USER_PATTERNS = 12;

function dedupeAndCap(existing: string[], incoming: string[], max: number): string[] {
  const existingLower = existing.map(s => s.toLowerCase());
  const newUnique = incoming.filter(s => {
    const sl = s.toLowerCase();
    return !existingLower.some(e => e.includes(sl.slice(0, 30)) || sl.includes(e.slice(0, 30)));
  });
  return [...existing, ...newUnique].slice(-max);
}

export function mergeMemory(
  existing: { workspaceFacts: string[]; userPreferences: string[]; userPatterns: string[] },
  extracted: { workspaceFacts: string[]; userPreferences: string[]; userPatterns: string[] },
): { workspaceFacts: string[]; userPreferences: string[]; userPatterns: string[] } {
  return {
    workspaceFacts: dedupeAndCap(existing.workspaceFacts, extracted.workspaceFacts, MAX_WORKSPACE_FACTS),
    userPreferences: dedupeAndCap(existing.userPreferences, extracted.userPreferences, MAX_USER_PREFS),
    userPatterns: dedupeAndCap(existing.userPatterns, extracted.userPatterns, MAX_USER_PATTERNS),
  };
}
