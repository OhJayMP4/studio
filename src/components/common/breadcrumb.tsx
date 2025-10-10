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
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Workspace, Company, Project, Silo } from "@/lib/types";

// A hook to fetch a single document and return its name.
function useDocumentName(collectionPath: string | null, docId: string | null) {
  const firestore = useFirestore();
  const docRef = useMemoFirebase(
    () => (collectionPath && docId ? doc(firestore, collectionPath, docId) : null),
    [firestore, collectionPath, docId]
  );
  const { data } = useDoc<Workspace | Company | Project | Silo>(docRef);
  return data?.name;
}

// A new component to render a single breadcrumb segment.
// This component can call hooks unconditionally.
function BreadcrumbSegment({
  segment,
  segments,
  index,
}: {
  segment: string;
  segments: string[];
  index: number;
}) {
  const path = `/${segments.slice(0, index + 1).join("/")}`;
  const isLast = index === segments.length - 1;

  let collectionPath: string | null = null;
  let docId: string | null = null;

  // Determine if this segment is a document ID that needs a name lookup.
  const prevSegment = segments[index - 1];
  if (prevSegment === 'workspaces') {
    collectionPath = 'workspaces';
    docId = segment;
  } else if (prevSegment === 'companies') {
    const workspaceId = segments[index - 2];
    collectionPath = `workspaces/${workspaceId}/companies`;
    docId = segment;
  } else if (prevSegment === 'projects') {
    const companyId = segments[index - 2];
    collectionPath = `companies/${companyId}/projects`;
    docId = segment;
  } else if (prevSegment === 'silos') {
    const projectId = segments[index - 2];
    collectionPath = `projects/${projectId}/silos`;
    docId = segment;
  }

  // Call the hook at the top level of the component.
  const docName = useDocumentName(collectionPath, docId);

  // Determine the display name for the breadcrumb.
  let name = docName || segment.charAt(0).toUpperCase() + segment.slice(1);

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
        {segments.map((segment, index) => (
          <BreadcrumbSegment
            key={index}
            segment={segment}
            segments={segments}
            index={index}
          />
        ))}
      </BreadcrumbList>
    </ShadBreadcrumb>
  );
}
