
'use client';

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    Timestamp,
    serverTimestamp,
    Firestore,
} from 'firebase/firestore';
import type { SocialPost, SocialPostStatusType } from './types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

/**
 * Creates a new social media post in Firestore.
 * @param firestore - The Firestore instance.
 * @param postData - The data for the new post, without the ID and timestamps.
 */
export function createSocialPost(
    firestore: Firestore,
    postData: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>
) {
    const postWithTimestamps = {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    
    const socialPostsRef = collection(
        firestore,
        `workspaces/${postData.workspaceId}/companies/${postData.companyId}/socialPosts`
    );

    addDoc(socialPostsRef, postWithTimestamps).catch(error => {
        console.error("Error creating social post: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: socialPostsRef.path,
            operation: 'create',
            requestResourceData: postWithTimestamps,
        }));
    });
}

/**
 * Updates the status of a social media post.
 * @param firestore - The Firestore instance.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @param postId - The ID of the post to update.
 * @param status - The new status of the post.
 * @param rejectionReason - Optional reason for rejection.
 */
export function updateSocialPostStatus(
    firestore: Firestore,
    workspaceId: string,
    companyId: string,
    postId: string,
    status: SocialPostStatusType,
    rejectionReason?: string
) {
    const postRef = doc(
        firestore,
        `workspaces/${workspaceId}/companies/${companyId}/socialPosts`,
        postId
    );

    const updateData: { status: SocialPostStatusType; updatedAt: any; rejectionReason?: string } = {
        status,
        updatedAt: serverTimestamp(),
    };

    if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
    }

    updateDoc(postRef, updateData).catch(error => {
        console.error("Error updating social post status: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: updateData,
        }));
    });
}

/**
 * Lists social media posts for a company within a specific date range.
 * @param firestore - The Firestore instance.
 * @param companyId - The ID of the company.
 * @param workspaceId - The ID of the workspace.
 * @param startDate - The start of the date range.
 * @param endDate - The end of the date range.
 * @returns A promise that resolves to an array of social posts.
 */
export async function listSocialPostsByCompany(
    firestore: Firestore,
    companyId: string,
    workspaceId: string,
    startDate: Date,
    endDate: Date
): Promise<(SocialPost & { id: string })[]> {
    const socialPostsRef = collection(
        firestore,
        `workspaces/${workspaceId}/companies/${companyId}/socialPosts`
    );
    
    const q = query(
        socialPostsRef,
        where('scheduledAt', '>=', Timestamp.fromDate(startDate)),
        where('scheduledAt', '<=', Timestamp.fromDate(endDate))
    );

    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as SocialPost & { id: string })
        );
    } catch (error) {
        console.error("Error listing social posts: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `workspaces/${workspaceId}/companies/${companyId}/socialPosts`,
            operation: 'list',
        }));
        return [];
    }
}
