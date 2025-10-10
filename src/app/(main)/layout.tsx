'use client';

import MainSidebar from "@/components/layout/main-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import Header from "@/components/layout/header";
import { useUser, useFirestore } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState, createContext, useContext } from "react";
import { doc, setDoc } from "firebase/firestore";
import type { Workspace } from "@/lib/types";

interface SelectedWorkspaceContextType {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  isUserAdmin: boolean;
}

const SelectedWorkspaceContext = createContext<SelectedWorkspaceContextType | undefined>(undefined);

export const useSelectedWorkspace = () => {
  const context = useContext(SelectedWorkspaceContext);
  if (!context) {
    throw new Error('useSelectedWorkspace must be used within a MainLayout');
  }
  return context;
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    // If auth state is not loading and there's no user, redirect to login.
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    // When user logs in, create their user profile document if it doesn't exist
    if (user && firestore) {
      const userRef = doc(firestore, "users", user.uid);
      setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        avatarUrl: user.photoURL
      }, { merge: true });
    }
  }, [user, firestore]);

  const isUserAdmin = selectedWorkspace?.users[user?.uid || '']?.role === 'admin';

  // While checking for user, show a loading state.
  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        Loading...
      </div>
    );
  }
  
  // If user is logged in, render the main app layout.
  return (
    <SelectedWorkspaceContext.Provider value={{ selectedWorkspace, setSelectedWorkspace, isUserAdmin }}>
      <SidebarProvider>
        <MainSidebar />
        <SidebarInset>
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SelectedWorkspaceContext.Provider>
  );
}
