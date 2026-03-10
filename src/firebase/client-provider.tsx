'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // useMemo ensures that Firebase is initialized only once on the client-side,
  // preventing re-initializations on re-renders.
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []); // Empty dependency array guarantees this runs only once.

  // If the services are not yet initialized (e.g., initial server render),
  // return a loading state that matches the MainLayoutContent loading state.
  if (!firebaseServices.firebaseApp || !firebaseServices.auth || !firebaseServices.firestore || !firebaseServices.storage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
