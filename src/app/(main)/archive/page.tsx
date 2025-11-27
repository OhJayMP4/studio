
'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where, orderBy } from "firebase/firestore";
import type { Project } from "@/lib/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDocs } from "@/firebase/firestore/use-docs";
import { useMemo } from "react";

function ArchiveBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Archive</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ArchivedProjectsList() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();

    const archivedProjectsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace?.id) return null;
        return query(
            collectionGroup(firestore, 'projects'),
            where('workspaceId', '==', selectedWorkspace.id),
            where('status', '==', 'archived'),
            orderBy('archivedAt', 'desc')
        );
    }, [firestore, selectedWorkspace]);

    const { data: projects, isLoading: isLoadingProjects } = useCollection<Project>(archivedProjectsQuery);

    const companyIds = useMemo(() => {
        if (!projects) return [];
        return [...new Set(projects.map(p => p.companyId))];
    }, [projects]);

    // Construct full paths for useDocs
    const companyPaths = useMemo(() => {
        if (!selectedWorkspace?.id || companyIds.length === 0) return [];
        return companyIds.map(id => `workspaces/${selectedWorkspace.id}/companies/${id}`);
    }, [companyIds, selectedWorkspace?.id]);

    const { data: companies, isLoading: isLoadingCompanies } = useDocs(companyPaths);

    const companyNameMap = useMemo(() => {
        if (!companies) return new Map<string, string>();
        return new Map(companies.map(c => [c.id, c.name]));
    }, [companies]);

    const isLoading = isLoadingProjects || (companyIds.length > 0 && isLoadingCompanies);

    if (isLoading) {
        return (
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Archived On</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }
    
    if (!projects || projects.length === 0) {
        return (
             <div className="text-center border-2 border-dashed border-muted rounded-lg p-12">
                <h2 className="text-xl font-semibold">No Archived Projects</h2>
                <p className="text-muted-foreground mt-2">Projects you archive will appear here.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Archived</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map(project => (
                        <TableRow key={project.id}>
                            <TableCell className="font-medium">
                                <Link href={`/company/${project.companyId}/project/${project.id}`} className="hover:underline">
                                    {project.name}
                                </Link>
                            </TableCell>
                             <TableCell>{companyNameMap.get(project.companyId) || '...'}</TableCell>
                            <TableCell>
                                {project.archivedAt ? (
                                    <span title={format(project.archivedAt.toDate(), 'PPpp')}>
                                        {formatDistanceToNow(project.archivedAt.toDate(), { addSuffix: true })}
                                    </span>
                                ) : 'N/A'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function ArchivePage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Select a workspace from the sidebar to view its archived projects.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <ArchiveBreadcrumb />
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-headline">Archived Projects</h1>
        </div>
        <ArchivedProjectsList />
    </div>
  );
}
