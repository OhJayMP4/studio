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

function BreadcrumbSegment({
  segment,
  isLast,
  path,
}: {
  segment: string;
  isLast: boolean;
  path: string;
}) {
  const name = segment.charAt(0).toUpperCase() + segment.slice(1);

  return (
    <React.Fragment>
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
}


export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <ShadBreadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const path = `/${segments.slice(0, index + 1).join("/")}`;
          return (
            <BreadcrumbSegment
              key={index}
              segment={segment}
              isLast={index === segments.length - 1}
              path={path}
            />
          );
        })}
      </BreadcrumbList>
    </ShadBreadcrumb>
  );
}
