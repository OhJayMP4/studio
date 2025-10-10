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
} from "@/components/ui/sidebar";
import {
  Settings,
  LayoutDashboard,
  BarChart,
  Building,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { WorkspaceSwitcher } from "../common/workspace-switcher";
import { MyTasks } from "./my-tasks-sidebar";
import { Accordion } from "../ui/accordion";
import { Separator } from "../ui/separator";

export default function MainSidebar() {
  const pathname = usePathname();

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return pathname === path;
    }
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
                <SidebarMenuButton tooltip="Dashboard" asChild isActive={isActive('/dashboard', true)}>
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Companies" asChild isActive={isActive('/companies') || pathname.startsWith('/company/')}>
                  <Link href="/companies">
                    <Building />
                    <span>Companies</span>
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
        <Separator className="my-4" />
        <Accordion type="single" collapsible className="w-full" defaultValue="my-tasks">
            <MyTasks />
        </Accordion>

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
