'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Settings,
  Plus,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { WorkspaceSwitcher } from "../common/workspace-switcher";
import { Separator } from "../ui/separator";
import { useSidebarPrefs } from "@/hooks/use-sidebar-prefs";
import { AddModuleDialog } from "../sidebar/add-module-dialog";
import { useState } from "react";
import * as LucideIcons from 'lucide-react';
import { Button } from "@/components/ui/button";
import { RemoveModuleDialog } from "../sidebar/remove-module-dialog";
import { cn } from "@/lib/utils";


export default function MainSidebar() {
  const pathname = usePathname();
  const { prefs, loading, setModuleHidden } = useSidebarPrefs();
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path;
  };
  
  const sortedModules = prefs?.sidebarModules?.filter(m => !m.hidden).sort((a, b) => a.order - b.order) || [];
  
  const Icon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
      const LucideIcon = (LucideIcons as any)[name];
      if (!LucideIcon) {
          return <LucideIcons.HelpCircle {...props} />; // Fallback icon
      }
      return <LucideIcon {...props} />;
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
            {loading ? (
                <>
                    <div className="h-8 w-full bg-muted rounded-md animate-pulse" />
                    <div className="h-8 w-full bg-muted rounded-md animate-pulse" />
                    <div className="h-8 w-full bg-muted rounded-md animate-pulse" />
                </>
            ) : (
                sortedModules.map(module => (
                     <SidebarMenuItem key={module.id} className="group/item">
                        <SidebarMenuButton tooltip={module.label} asChild isActive={isActive(module.route)}>
                          <Link href={module.route}>
                            <Icon name={module.icon} />
                            <span>{module.label}</span>
                          </Link>
                        </SidebarMenuButton>
                         <RemoveModuleDialog module={module} onConfirm={() => setModuleHidden(module.id, true)}>
                            <Button variant="ghost" size="icon" className={cn("absolute top-1/2 right-2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/item:opacity-100",
                             "group-data-[collapsible=icon]:hidden"
                            )}>
                                <X className="h-4 w-4"/>
                            </Button>
                        </RemoveModuleDialog>
                      </SidebarMenuItem>
                ))
            )}
        </SidebarMenu>

      </SidebarContent>
      <SidebarFooter>
        <div className="w-full px-2">
             <Button variant="outline" className="w-full justify-center bg-orange-500 text-white hover:bg-orange-600 hover:text-white" onClick={() => setIsAddModuleOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
            </Button>
        </div>
        <Separator className="my-2" />
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
      <AddModuleDialog open={isAddModuleOpen} onOpenChange={setIsAddModuleOpen} />
    </Sidebar>
  );
}
