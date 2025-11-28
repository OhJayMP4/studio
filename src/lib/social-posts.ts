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
    deleteDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { SocialPost, SocialPostStatusType } from './types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

type PostData = Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Creates a new social media post in Firestore.
 * @param firestore - The Firestore instance.
 * @param postData - The data for the new post.
 */
export async function createSocialPost(
    firestore: Firestore,
    postData: PostData
): Promise<void> {
    const postWithTimestamps = {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        rejectionReason: postData.rejectionReason || null,
    };
    
    const socialPostsRef = collection(
        firestore,
        `workspaces/${postData.workspaceId}/companies/${postData.companyId}/socialPosts`
    );

    try {
        await addDoc(socialPostsRef, postWithTimestamps);
    } catch(error) {
        console.error("Error creating social post: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: socialPostsRef.path,
            operation: 'create',
            requestResourceData: postWithTimestamps,
        }));
        throw error; // re-throw to be caught by the calling component
    };
}

/**
 * Updates an existing social media post in Firestore.
 * @param firestore - The Firestore instance.
 * @param postId - The ID of the post to update.
 * @param postData - The data to update.
 */
export async function updateSocialPost(
    firestore: Firestore,
    postId: string,
    postData: PostData
): Promise<void> {
    const postWithTimestamp = {
        ...postData,
        updatedAt: serverTimestamp(),
        rejectionReason: postData.rejectionReason || null,
    };

    const postRef = doc(
        firestore,
        `workspaces/${postData.workspaceId}/companies/${postData.companyId}/socialPosts`,
        postId
    );

    try {
        await updateDoc(postRef, postWithTimestamp as any);
    } catch(error) {
        console.error("Error updating social post: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: postWithTimestamp,
        }));
        throw error;
    }
}

/**
 * Deletes a social media post and its associated media.
 * @param firestore The Firestore instance.
 * @param workspaceId The ID of the workspace.
 * @param companyId The ID of the company.
 * @param post The post object to delete.
 */
export async function deleteSocialPost(
    firestore: Firestore,
    workspaceId: string,
    companyId: string,
    post: SocialPost
): Promise<void> {
    // 1. Delete associated media from Storage
    if (post.media && post.media.length > 0) {
        const storage = getStorage();
        const deletePromises = post.media.map(mediaItem => {
            const fileRef = ref(storage, mediaItem.fileUrl);
            return deleteObject(fileRef).catch(error => {
                // Log error if file deletion fails, but don't block Firestore deletion
                console.warn(`Failed to delete media file: ${mediaItem.fileUrl}`, error);
            });
        });
        await Promise.all(deletePromises);
    }

    // 2. Delete the Firestore document
    const postRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/socialPosts`, post.id);
    try {
        await deleteDoc(postRef);
    } catch (error) {
        console.error("Error deleting social post document: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: postRef.path,
            operation: 'delete',
        }));
        throw error;
    }
}

/**
 * Approves a social media post.
 * @param firestore - The Firestore instance.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @param postId - The ID of the post to approve.
 */
export async function approveSocialPost(
  firestore: Firestore,
  workspaceId: string,
  companyId: string,
  postId: string
): Promise<void> {
  const postRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/socialPosts`, postId);
  const updateData = {
    status: 'scheduled',
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(postRef, updateData);
  } catch (error) {
    console.error("Error approving social post: ", error);
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: postRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
    throw error;
  }
}

/**
 * Rejects a social media post.
 * @param firestore - The Firestore instance.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @param postId - The ID of the post to reject.
 * @param reason - The reason for rejection.
 */
export async function rejectSocialPost(
  firestore: Firestore,
  workspaceId: string,
  companyId: string,
  postId: string,
  reason: string
): Promise<void> {
  const postRef = doc(firestore, `workspaces/${workspaceId}/companies/${companyId}/socialPosts`, postId);
  const updateData = {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(postRef, updateData);
  } catch (error) {
    console.error("Error rejecting social post: ", error);
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: postRef.path,
      operation: 'update',
      requestResourceData: updateData,
    }));
    throw error;
  }
}


/**
 * Uploads a file to Firebase Storage for a social post.
 * @param file - The file to upload.
 * @param workspaceId - The ID of the workspace.
 * @param companyId - The ID of the company.
 * @returns A promise that resolves to the download URL and file name.
 */
export async function uploadPostMedia(
    file: File,
    workspaceId: string,
    companyId: string
): Promise<{ fileUrl: string; fileName: string }> {
    const storage = getStorage();
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `workspaces/${workspaceId}/companies/${companyId}/socialMedia/${uniqueFileName}`);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    return { fileUrl: downloadURL, fileName: file.name };
}

/**
 * Deletes a media file from Firebase Storage.
 * @param fileUrl - The URL of the file to delete.
 */
export async function deletePostMedia(fileUrl: string): Promise<void> {
    const storage = getStorage();
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
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
