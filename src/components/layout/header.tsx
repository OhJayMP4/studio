import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { GlobalQuickAdd } from "../common/global-quick-add";
import { GlobalSearch } from "../common/global-search";
import { Notifications } from "../common/notifications";
import { PresenceAvatars } from "../common/presence-avatars";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <PresenceAvatars />
      <div className="ml-auto flex items-center gap-4">
        <GlobalSearch />
        <GlobalQuickAdd />
        <Notifications />
      </div>
    </header>
  );
}
