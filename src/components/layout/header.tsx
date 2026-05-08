import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalQuickAdd } from "../common/global-quick-add";
import { GlobalSearch } from "../common/global-search";
import { Notifications } from "../common/notifications";
import { ActivityLog } from "../common/activity-log";
import { PresenceAvatars } from "../common/presence-avatars";
import { SaturnHeaderButton } from "../common/saturn-header-button";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <PresenceAvatars />
      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch />
        <GlobalQuickAdd />
        <SaturnHeaderButton />
        <div className="w-px h-5 bg-border mx-1" />
        <ActivityLog />
        <Notifications />
      </div>
    </header>
  );
}
