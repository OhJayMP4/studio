"use client";

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarGroup,
  SidebarInput,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Building2,
  Rocket,
  Search,
  Building,
  FolderKanban,
  Container,
  Archive,
  FileText,
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { mockData } from "@/lib/data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { UserNav } from "./user-nav";

export default function MainSidebar() {
  const pathname = usePathname();
  const workspaces = mockData.workspaces;

  const isActive = (path: string) => {
    return pathname === path;
  };

  const isSubActive = (path: string) => {
    return pathname.startsWith(path);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-headline text-lg">SaturnSync</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <SidebarInput placeholder="Search..." className="pl-8" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <Accordion type="multiple" defaultValue={['workspaces']} className="w-full">
          <AccordionItem value="workspaces">
            <AccordionTrigger className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:no-underline">Workspaces</AccordionTrigger>
            <AccordionContent>
              <SidebarMenu>
                {workspaces.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    <Accordion type="single" collapsible className="w-full" disabled={!isSubActive(`/workspaces/${workspace.id}`)}>
                      <AccordionItem value={`ws-${workspace.id}`} className="border-b-0">
                        <AccordionTrigger asChild>
                          <SidebarMenuButton tooltip={workspace.name} isActive={isSubActive(`/workspaces/${workspace.id}`)} asChild>
                            <div>
                               <Building2 />
                               <Link href={`/workspaces/${workspace.id}`} className="flex-1 text-left">{workspace.name}</Link>
                            </div>
                          </SidebarMenuButton>
                        </AccordionTrigger>
                        <AccordionContent className="p-0">
                          <SidebarMenuSub>
                            {workspace.companies.map((company) => (
                              <SidebarMenuSubItem key={company.id}>
                                <Accordion type="single" collapsible className="w-full">
                                  <AccordionItem value={`co-${company.id}`} className="border-b-0">
                                    <AccordionTrigger asChild>
                                      <SidebarMenuSubButton isActive={isSubActive(`/workspaces/${workspace.id}/companies/${company.id}`)} asChild>
                                        <div>
                                          <Building />
                                          <Link href={`/workspaces/${workspace.id}/companies/${company.id}`} className="flex-1 text-left">{company.name}</Link>
                                        </div>
                                      </SidebarMenuSubButton>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0">
                                      <SidebarMenuSub>
                                        {company.projects.map((project) => (
                                          <SidebarMenuSubItem key={project.id}>
                                            <SidebarMenuSubButton isActive={isSubActive(`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}`)} asChild>
                                              <Link href={`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}`}>
                                                <FolderKanban />
                                                <span>{project.name}</span>
                                              </Link>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        ))}
                                      </SidebarMenuSub>
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <SidebarGroup>
          <SidebarMenu>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Reports" asChild isActive={isActive('/reports')}>
                  <Link href="/reports">
                    <FileText />
                    <span>Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Archive" asChild isActive={isActive('/archive')}>
                  <Link href="/archive">
                    <Archive />
                    <span>Archive</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings" asChild isActive={isSubActive('/settings')}>
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
