'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarGroup,
  SidebarFooter,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  Rocket,
  Settings,
  ChevronsUpDown,
  PlusCircle,
  Building,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Workspace } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { AddWorkspaceDialog } from "../common/add-workspace-dialog";
import { Skeleton } from "../ui/skeleton";
import { AddCompanyDialog } from "../common/add-company-dialog";

// We'll get these from layout
import { useSelectedWorkspace } from "@/app/(main)/layout";

function WorkspaceSwitcher() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();

  const workspacesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'workspaces'),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between h-12 text-base px-2">
            <div className="flex items-center gap-2 truncate">
              <Building className="h-5 w-5"/>
              <span className="truncate">{selectedWorkspace?.name || 'Select Workspace'}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--sidebar-width)]">
        <DropdownMenuGroup>
          {workspaces && workspaces.length > 0 ? (
            workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => setSelectedWorkspace(workspace)}>
                {workspace.name}
              </DropdownMenuItem>
            ))
          ) : (
             <DropdownMenuItem disabled>No workspaces found</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <AddWorkspaceDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Workspace
            </DropdownMenuItem>
        </AddWorkspaceDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export default function MainSidebar() {
  const pathname = usePathname();
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-headline text-lg">SaturnSync</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
         <WorkspaceSwitcher />
         {selectedWorkspace && (
           <SidebarGroup>
            <SidebarGroupLabel className="flex items-center">
              <span>Companies</span>
              {isUserAdmin && (
                <AddCompanyDialog workspaceId={selectedWorkspace.id}>
                  <Button variant="ghost" size="icon" className="ml-auto h-6 w-6">
                    <PlusCircle className="h-4 w-4"/>
                  </Button>
                </AddCompanyDialog>
              )}
            </SidebarGroupLabel>

            {/* We'll list companies here in the next step */}
           </SidebarGroup>
         )}
         <SidebarGroup>
          <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" asChild isActive={isActive('/dashboard')}>
                  <Link href="/dashboard">
                    <Building />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings" asChild isActive={isActive('/settings')}>
                  <Link href="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
