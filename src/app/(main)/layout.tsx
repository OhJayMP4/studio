'use client';

import MainSidebar from "@/components/layout/main-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import Header from "@/components/layout/header";
import { NotificationToasts } from "@/components/common/notification-toasts";
import { useUser, useFirestore, FirebaseClientProvider } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState, createContext, useContext } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import type { Workspace } from "@/lib/types";
import { useUserPrefs } from "@/hooks/use-sidebar-prefs";
import { useTheme } from "next-themes";

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

/**
 * Manager component to handle theme and accent color syncing.
 * This must be rendered inside the SelectedWorkspaceContext.Provider.
 */
function ThemeAndAccentManager() {
  const { prefs } = useUserPrefs();
  const { setTheme } = useTheme();

  // Sync theme from prefs
  useEffect(() => {
    if (prefs?.theme) {
      setTheme(prefs.theme);
    }
  }, [prefs?.theme, setTheme]);

  // Apply accent color from prefs to all relevant CSS variables
  useEffect(() => {
    if (prefs?.accentColor) {
      const root = document.documentElement;
      root.style.setProperty('--primary', prefs.accentColor);
      root.style.setProperty('--ring', prefs.accentColor);
      // Ensure sidebar variables are also updated
      root.style.setProperty('--sidebar-primary', prefs.accentColor);
      root.style.setProperty('--sidebar-ring', prefs.accentColor);
      // Update accent background for hover/active states
      root.style.setProperty('--sidebar-accent', `hsl(${prefs.accentColor} / 0.1)`);
      root.style.setProperty('--sidebar-accent-foreground', prefs.accentColor);
    }
  }, [prefs?.accentColor]);

  return null;
}


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
      <ThemeAndAccentManager />
      <SidebarProvider>
        <MainSidebar />
        <SidebarInset>
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <NotificationToasts />
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
