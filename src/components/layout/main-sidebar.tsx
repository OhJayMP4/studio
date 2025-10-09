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
  LayoutDashboard,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getWorkspaces, getCurrentUser } from "@/lib/data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { UserNav } from "./user-nav";
import { AddCompanyButton } from "../common/add-company-button";
import { AddProjectButton } from "../common/add-project-button";
import { AddSiloButton } from "../common/add-silo-button";

export default function MainSidebar() {
  const pathname = usePathname();
  const workspaces = getWorkspaces();
  const user = getCurrentUser();

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
          </SidebarMenu>
        </SidebarGroup>

        <Accordion type="multiple" defaultValue={['workspaces']} className="w-full">
          <AccordionItem value="workspaces">
            <AccordionTrigger className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:no-underline">Workspaces</AccordionTrigger>
            <AccordionContent>
              {user.role === 'admin' && (
                  <div className="px-2 pb-2">
                     <AddCompanyButton />
                  </div>
              )}
              <SidebarMenu>
                {workspaces.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    <Accordion type="single" collapsible className="w-full" disabled={!isSubActive(`/workspaces/${workspace.id}`)}>
                      <AccordionItem value={`ws-${workspace.id}`} className="border-b-0">
                        <AccordionTrigger>
                            <SidebarMenuButton tooltip={workspace.name} isActive={isSubActive(`/workspaces/${workspace.id}`)} asChild>
                               <Link href={`/workspaces/${workspace.id}`}>
                                   <Building2 />
                                   <span>{workspace.name}</span>
                               </Link>
                           </SidebarMenuButton>
                        </AccordionTrigger>
                        <AccordionContent className="p-0 pl-4">
                           {user.role === 'admin' && (
                              <div className="pb-2">
                                <AddProjectButton workspaceId={workspace.id} />
                              </div>
                            )}
                          <SidebarGroup className="p-0">
                            <SidebarMenuSub>
                              {workspace.companies.map((company) => (
                                <SidebarMenuSubItem key={company.id}>
                                  <Accordion type="single" collapsible className="w-full" disabled={!isSubActive(`/workspaces/${workspace.id}/companies/${company.id}`)}>
                                    <AccordionItem value={`co-${company.id}`} className="border-b-0">
                                      <AccordionTrigger>
                                        <SidebarMenuSubButton isActive={isSubActive(`/workspaces/${workspace.id}/companies/${company.id}`)} asChild>
                                          <Link href={`/workspaces/${workspace.id}/companies/${company.id}`}>
                                            <Building />
                                            <span>{company.name}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </AccordionTrigger>
                                      <AccordionContent className="p-0 pl-4">
                                         {user.role === 'admin' && (
                                            <div className="pb-2">
                                                <AddSiloButton workspaceId={workspace.id} companyId={company.id} />
                                            </div>
                                         )}
                                         <SidebarGroup className="p-0">
                                            <SidebarMenuSub>
                                              {company.projects.map((project) => (
                                                <SidebarMenuSubItem key={project.id}>
                                                   <Accordion type="single" collapsible className="w-full" disabled={!isSubActive(`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}`)}>
                                                      <AccordionItem value={`proj-${project.id}`} className="border-b-0">
                                                        <AccordionTrigger>
                                                            <SidebarMenuSubButton isActive={isSubActive(`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}`)} asChild>
                                                              <Link href={`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}`}>
                                                                <FolderKanban />
                                                                <span>{project.name}</span>
                                                              </Link>
                                                            </SidebarMenuSubButton>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="p-0">
                                                           <SidebarGroup className="p-0">
                                                              <SidebarMenuSub>
                                                                {project.silos.map(silo => (
                                                                  <SidebarMenuSubItem key={silo.id}>
                                                                      <SidebarMenuSubButton isActive={isSubActive(`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}/silos/${silo.id}`)} asChild>
                                                                          <Link href={`/workspaces/${workspace.id}/companies/${company.id}/projects/${project.id}/silos/${silo.id}`}>
                                                                              <Container />
                                                                              <span>{silo.name}</span>
                                                                          </Link>
                                                                      </SidebarMenuSubButton>
                                                                  </SidebarMenuSubItem>
                                                                ))}
                                                              </SidebarMenuSub>
                                                           </SidebarGroup>
                                                        </AccordionContent>
                                                      </AccordionItem>
                                                    </Accordion>
                                                </SidebarMenuSubItem>
                                              ))}
                                            </SidebarMenuSub>
                                          </SidebarGroup>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </SidebarGroup>
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
