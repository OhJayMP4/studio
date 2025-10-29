
'use client';

import { useUser } from "@/firebase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserTasks } from "@/hooks/use-user-tasks";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSelectedWorkspace } from "@/app/(main)/layout";

export function MyTasksSidebarItem() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const { user } = useUser();
    const { tasks, isLoading } = useUserTasks(selectedWorkspace?.id);
    const pathname = usePathname();

    const activeCount = tasks.active.length;
    const isActive = pathname === '/my-tasks';

    return (
        <SidebarMenuItem>
            <SidebarMenuButton tooltip="My Tasks" asChild isActive={isActive}>
              <Link href="/my-tasks">
                <ClipboardCheck />
                <span>My Tasks</span>
                 {activeCount > 0 && !isLoading && (
                    <Badge variant="secondary" className="ml-auto h-5 px-2">
                        {activeCount}
                    </Badge>
                 )}
              </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
