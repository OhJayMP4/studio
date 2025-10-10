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
  SidebarGroupAction,
} from "@/components/ui/sidebar";
import {
  Settings,
  LayoutDashboard,
  Plus,
  Building,
  BarChart,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { WorkspaceSwitcher } from "../common/workspace-switcher";
import { useSelectedWorkspace } from "@/app/(main)/layout";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Company } from "@/lib/types";
import { AddCompanyDialog } from "../common/add-company-dialog";

function CompaniesList() {
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const firestore = useFirestore();

  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace]);

  const { data: companies, isLoading } = useCollection<Company>(companiesQuery);

  if (!selectedWorkspace) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center">
        <span>Companies</span>
      </SidebarGroupLabel>
      {isUserAdmin && (
        <AddCompanyDialog>
          <SidebarGroupAction tooltip="Add Company">
            <Plus />
          </SidebarGroupAction>
        </AddCompanyDialog>
      )}

      {isLoading && <p className="p-2 text-xs">Loading...</p>}
      <SidebarMenu>
        {companies?.map((company) => (
          <SidebarMenuItem key={company.id}>
            <SidebarMenuButton tooltip={company.name} asChild>
              <Link href={`/company/${company.id}`}>
                <Building />
                <span>{company.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default function MainSidebar() {
  const pathname = usePathname();
  const { selectedWorkspace } = useSelectedWorkspace();

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="p-2">
         <SidebarGroup>
          <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" asChild isActive={isActive('/dashboard')}>
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Reporting" asChild isActive={isActive('/reporting')}>
                  <Link href="/reporting">
                    <BarChart />
                    <span>Reporting</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {selectedWorkspace && <CompaniesList />}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" asChild isActive={isActive('/settings')}>
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
