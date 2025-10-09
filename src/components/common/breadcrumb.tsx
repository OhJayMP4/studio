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
function useDocumentName(collectionPath: string, docId: string) {
    const firestore = useFirestore();
    const docRef = useMemoFirebase(() => docId ? doc(firestore, collectionPath, docId) : null, [firestore, collectionPath, docId]);
    const { data } = useDoc<Workspace | Company | Project | Silo>(docRef);
    return data?.name;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const breadcrumbItems = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    let name = segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;

    let docName;
    if (segments[index-1] === 'workspaces') {
        docName = useDocumentName('workspaces', segment);
    } else if (segments[index-1] === 'companies') {
        const workspaceId = segments[index - 2];
        docName = useDocumentName(`workspaces/${workspaceId}/companies`, segment);
    } else if (segments[index-1] === 'projects') {
        const companyId = segments[index-2];
        docName = useDocumentName(`companies/${companyId}/projects`, segment);
    } else if (segments[index-1] === 'silos') {
        const projectId = segments[index-2];
        docName = useDocumentName(`projects/${projectId}/silos`, segment);
    }

    if(docName) {
        name = docName;
    }


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
