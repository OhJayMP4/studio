
'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc, getDocs, query, where } from "firebase/firestore";
import type { Company, Project } from "@/lib/types";
import { AddCompanyDialog } from "@/components/common/add-company-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreVertical, LayoutGrid, List, Building } from "lucide-react";
import { EditCompanyDialog } from "@/components/common/edit-company-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { CompanyProgressCard } from "@/components/common/company-progress-card";
import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

function CompaniesBreadcrumb() {
  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="font-headline">Companies</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function CompanyActions({ company }: { company: Company }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { selectedWorkspace } = useSelectedWorkspace();

    const handleDelete = async () => {
        if (!selectedWorkspace) return;
        const companyRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id);
        try {
            await deleteDoc(companyRef);
            toast({
                title: "Company Deleted",
                description: `"${company.name}" has been deleted.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error Deleting Company",
                description: error.message,
            });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <EditCompanyDialog company={company}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                    </DropdownMenuItem>
                </EditCompanyDialog>
                <DeleteDialog onConfirm={handleDelete} itemName={company.name}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                        Delete
                    </DropdownMenuItem>
                </DeleteDialog>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function WorkspaceView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);

  // Fetch all companies
  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace?.id) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace?.id]);

  const { data: companies, isLoading: isCompaniesLoading } = useCollection<Company>(companiesQuery);

  // Instead of a broad collectionGroup query which is failing permissions,
  // we fetch projects for each company hierachically.
  useEffect(() => {
    if (!companies || companies.length === 0 || !selectedWorkspace) {
        setAllProjects([]);
        return;
    }

    const fetchProjectsHierarchically = async () => {
        setIsProjectsLoading(true);
        try {
            const projectPromises = companies.map(async (company) => {
                const projectsRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id, 'projects');
                // We fetch all projects including archived ones for counting, but we can filter later
                const snap = await getDocs(projectsRef);
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            });

            const results = await Promise.all(projectPromises);
            setAllProjects(results.flat());
        } catch (error) {
            console.error("Error fetching projects hierachically:", error);
        } finally {
            setIsProjectsLoading(false);
        }
    };

    fetchProjectsHierarchically();
  }, [companies, selectedWorkspace, firestore]);

  const enrichedCompanies = useMemo(() => {
    if (!companies) return [];
    
    const results = companies.map(company => {
        // Filter projects for this company and exclude archived ones manually
        const companyProjects = allProjects.filter(p => 
            p.companyId === company.id && 
            (p.status || 'active') !== 'archived'
        );
        
        const averageProgress = companyProjects.length > 0
            ? Math.round(companyProjects.reduce((acc, p) => acc + (p.progress || 0), 0) / companyProjects.length)
            : 0;
        
        return {
            ...company,
            averageProgress,
            projectCount: companyProjects.length
        };
    });

    // Auto sort by progress descending (most progress first)
    return results.sort((a, b) => b.averageProgress - a.averageProgress);
  }, [companies, allProjects]);

  const isLoading = isCompaniesLoading || (companies && companies.length > 0 && isProjectsLoading && allProjects.length === 0);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <CompaniesBreadcrumb />
            <div className="flex justify-between items-center">
                <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
                <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
            </div>
        </div>
    );
  }

  if (!enrichedCompanies || enrichedCompanies.length === 0) {
    return (
      <Card className="w-full max-w-md text-center mx-auto mt-12">
        <CardHeader>
          <CardTitle>No Companies Found</CardTitle>
          <CardDescription>Get started by adding your first company to this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddCompanyDialog>
              <Button>Add Company</Button>
          </AddCompanyDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <CompaniesBreadcrumb />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-headline">Companies</h1>
            <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-muted p-1 rounded-md">
                    <Button
                        size="sm"
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        onClick={() => setViewMode('grid')}
                        className="h-8 w-8 p-0"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        onClick={() => setViewMode('list')}
                        className="h-8 w-8 p-0"
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
                <AddCompanyDialog />
            </div>
        </div>

        {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {enrichedCompanies.map((company) => (
                    <CompanyProgressCard 
                        key={company.id} 
                        company={company}
                        progressOverride={company.averageProgress}
                    >
                        <div className="absolute top-2 right-2 z-10">
                            <CompanyActions company={company} />
                        </div>
                    </CompanyProgressCard>
                ))}
            </div>
        ) : (
            <div className="border rounded-md bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Projects</TableHead>
                            <TableHead className="w-[30%]">Progress</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {enrichedCompanies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell>
                                    <Building className="h-5 w-5 text-muted-foreground" />
                                </TableCell>
                                <TableCell className="font-medium">
                                    <Link href={`/company/${company.id}`} className="hover:underline">
                                        {company.name}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {company.projectCount} active projects
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Progress value={company.averageProgress} className="h-2" />
                                        <span className="text-xs font-medium tabular-nums w-8">{company.averageProgress}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <CompanyActions company={company} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )}
    </div>
  );
}


export default function CompaniesPage() {
  const { selectedWorkspace } = useSelectedWorkspace();

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SaturnSync</CardTitle>
            <CardDescription>Select a workspace from the sidebar to get started, or create a new one.</CardDescription>
          </CardHeader>
          <CardContent>
             <AddWorkspaceDialog open={false} onOpenChange={() => {}} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <WorkspaceView />;
}
