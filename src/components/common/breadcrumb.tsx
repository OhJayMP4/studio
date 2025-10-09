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

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;
  
  // This approach is not ideal for production but works for this mock data setup
  // to avoid bundling server modules on the client.
  // In a real app, you would fetch this data on the server and pass it down.
  const [data, setData] = React.useState<{workspaces: any[], companies: any[], projects: any[], silos: any[]}>({ workspaces: [], companies: [], projects: [], silos: [] });

  React.useEffect(() => {
    // This is a workaround to avoid server-side code in a client component.
    // We are dynamically importing the data functions.
    const fetchData = async () => {
      try {
        const dataLib = await import("@/lib/data");
        setData({
          workspaces: dataLib.getWorkspaces(),
          companies: dataLib.getAllCompanies(),
          projects: dataLib.getAllProjects(),
          silos: dataLib.getAllSilos(),
        });
      } catch (e) {
          // This will fail in the browser, so we just ignore the error
      }
    };
    fetchData();
  }, [pathname]);


  const breadcrumbItems = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    let name = segment.charAt(0).toUpperCase() + segment.slice(1);

    if (segments[index-1] === 'workspaces' && data.workspaces.find(ws => ws.id === segment)) {
        name = data.workspaces.find(ws => ws.id === segment)?.name || name;
    } else if (segments[index-1] === 'companies' && data.companies.find(c => c.id === segment)) {
        name = data.companies.find(c => c.id === segment)?.name || name;
    } else if (segments[index-1] === 'projects' && data.projects.find(p => p.id === segment)) {
        name = data.projects.find(p => p.id === segment)?.name || name;
    } else if (segments[index-1] === 'silos' && data.silos.find(s => s.id === segment)) {
        name = data.silos.find(s => s.id === segment)?.name || name;
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
