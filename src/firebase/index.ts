'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage';

// These will be initialized on the client
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!getApps().length) {
      // We explicitly pass firebaseConfig to ensure the correct storage bucket (.firebasestorage.app) 
      // is used regardless of environment variable defaults.
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      firestore = getFirestore(app);
      // Force the specific storage bucket domain
      storage = getStorage(app, "gs://studio-1397195000-3cb07.firebasestorage.app");
    } else {
      app = getApp();
      auth = getAuth(app);
      firestore = getFirestore(app);
      // Ensure existing app instances also point to the correct bucket
      storage = getStorage(app, "gs://studio-1397195000-3cb07.firebasestorage.app");
    }
  }
  // On the server, we return undefined. ClientProvider will handle this.
  return { firebaseApp: app, auth, firestore, storage };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './firestore/use-docs';
export * from './errors';
export * from './error-emitter';

// This is intentionally not a star export to avoid conflicts
export { useUser } from './auth/use-user';
