
'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { TeamBreakdownView } from "@/components/reporting/team-breakdown/team-breakdown-view";

export default function TeamBreakdownPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) return null;

  return (
    <div className="space-y-6">
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/reporting">Reporting</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-headline font-bold">My Team Breakdown</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">My Team Breakdown</h1>
          <p className="text-muted-foreground mt-1">Real-time workload analysis for {selectedWorkspace.name}.</p>
        </div>
      </div>

      <TeamBreakdownView />
    </div>
  );
}
