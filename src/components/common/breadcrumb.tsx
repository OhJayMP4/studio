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

// This component is now simplified and might not be used directly for dynamic routes.
// We are keeping it for simple, static routes.
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] !== 'dashboard') return null;

  return (
    <ShadBreadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Dashboard</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </ShadBreadcrumb>
  );
}
