import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { GlobalQuickAdd } from "../common/global-quick-add";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="ml-auto flex items-center gap-4">
        <GlobalQuickAdd />
      </div>
    </header>
  );
}
