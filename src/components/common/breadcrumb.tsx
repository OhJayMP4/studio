"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb as ShadBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";
import { mockData } from "@/lib/data";

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const breadcrumbItems = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    let name = segment.charAt(0).toUpperCase() + segment.slice(1);

    // Replace IDs with names from mock data
    if (segments[index-1] === 'workspaces' && mockData.workspaces.find(ws => ws.id === segment)) {
        name = mockData.workspaces.find(ws => ws.id === segment)?.name || name;
    } else if (segments[index-1] === 'companies' && mockData.workspaces.flatMap(ws => ws.companies).find(c => c.id === segment)) {
        name = mockData.workspaces.flatMap(ws => ws.companies).find(c => c.id === segment)?.name || name;
    } else if (segments[index-1] === 'projects' && mockData.workspaces.flatMap(ws => ws.companies).flatMap(c => c.projects).find(p => p.id === segment)) {
        name = mockData.workspaces.flatMap(ws => ws.companies).flatMap(c => c.projects).find(p => p.id === segment)?.name || name;
    } else if (segments[index-1] === 'silos' && mockData.workspaces.flatMap(ws => ws.companies).flatMap(c => c.projects).flatMap(p => p.silos).find(s => s.id === segment)) {
        name = mockData.workspaces.flatMap(ws => ws.companies).flatMap(c => c.projects).flatMap(p => p.silos).find(s => s.id === segment)?.name || name;
    }


    const isLast = index === segments.length - 1;

    return (
      <React.Fragment key={path}>
        <BreadcrumbItem>
          {isLast ? (
            <BreadcrumbPage className="font-headline">{name}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={path}>{name}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {!isLast && <BreadcrumbSeparator />}
      </React.Fragment>
    );
  });

  return (
    <ShadBreadcrumb className="hidden md:flex">
      <BreadcrumbList>{breadcrumbItems}</BreadcrumbList>
    </ShadBreadcrumb>
  );
}
