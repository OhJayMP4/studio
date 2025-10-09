'use client';

import MainSidebar from "@/components/layout/main-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import Header from "@/components/layout/header";
import { useUser } from "@/firebase";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { useAuth } from "@/firebase";
import { useEffect } from "react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  useEffect(() => {
    if (!user && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        Loading...
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      <MainSidebar />
      <SidebarInset>
        <Header />
        <main className="p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
