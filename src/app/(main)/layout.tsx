'use client';

import MainSidebar from "@/components/layout/main-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import Header from "@/components/layout/header";
import { useUser, useFirestore, FirebaseClientProvider } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState, createContext, useContext } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
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


function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isUserLoading && !user && mounted) {
      router.push('/login');
    }
  }, [user, isUserLoading, router, mounted]);

  useEffect(() => {
    if (user && firestore) {
      const userRef = doc(firestore, "users", user.uid);
      const initializeUser = async () => {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
           setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            avatarUrl: user.photoURL,
            workspaceIds: []
          }, { merge: true });
        }
      }
      initializeUser();
    }
  }, [user, firestore]);

  const isUserAdmin = selectedWorkspace?.users?.[user?.uid || '']?.role === 'admin';

  // Prevent hydration mismatch by waiting for mount and auth state
  if (!mounted || isUserLoading || (!user && !isUserLoading)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        Loading...
      </div>
    );
  }

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


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </FirebaseClientProvider>
  )
}
