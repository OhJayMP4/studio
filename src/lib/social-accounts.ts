
'use client';

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    serverTimestamp,
    Firestore,
} from 'firebase/firestore';
import type { SocialAccount } from './types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

/**
 * Fetches all social accounts for a given company.
 * @param firestore - The Firestore instance.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @returns A promise that resolves to an array of social accounts.
 */
export async function listSocialAccounts(
    firestore: Firestore,
    workspaceId: string,
    companyId: string
): Promise<(SocialAccount & { id: string })[]> {
    const accountsRef = collection(firestore, `workspaces/${workspaceId}/companies/${companyId}/socialAccounts`);
    try {
        const querySnapshot = await getDocs(accountsRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialAccount & { id: string }));
    } catch (error) {
        console.error("Error listing social accounts:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: accountsRef.path,
            operation: 'list',
        }));
        return [];
    }
}

/**
 * Creates or updates a social account document.
 * @param firestore - The Firestore instance.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @param accountData - The data for the social account.
 */
export async function saveSocialAccount(
    firestore: Firestore,
    workspaceId: string,
    companyId: string,
    accountData: Omit<SocialAccount, 'id' | 'workspaceId' | 'companyId'>
): Promise<void> {
    const accountRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/socialAccounts`, accountData.platform);
    
    const dataToSave = {
        ...accountData,
        workspaceId,
        companyId,
    };

    try {
        await setDoc(accountRef, dataToSave, { merge: true });
    } catch (error) {
        console.error("Error saving social account:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: accountRef.path,
            operation: 'write',
            requestResourceData: dataToSave,
        }));
        throw error;
    }
}
