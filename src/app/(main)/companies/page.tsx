'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AddWorkspaceDialog } from "@/components/common/add-workspace-dialog";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, deleteDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import type { Company, Project } from "@/lib/types";
import { AddCompanyDialog } from "@/components/common/add-company-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreVertical, LayoutGrid, List, Building, SortAsc, Pin, Filter } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useUserPrefs } from "@/hooks/use-sidebar-prefs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

type SortOption = 'alphabetical' | 'progress' | 'lastUsed';

function WorkspaceView() {
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const { prefs, setViewPref } = useUserPrefs();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('progress');
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);

  // Load default view and filter from prefs
  useEffect(() => {
    if (prefs?.viewPrefs?.companies) {
        setViewMode(prefs.viewPrefs.companies as 'grid' | 'list');
    }
    if (prefs?.viewPrefs?.companyFilter) {
        try {
            setSelectedFilter(JSON.parse(prefs.viewPrefs.companyFilter));
        } catch {
            setSelectedFilter([]);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.viewPrefs?.companies, prefs?.viewPrefs?.companyFilter]);

  const handleFilterChange = (id: string, checked: boolean) => {
    setSelectedFilter(prev => {
        const next = checked ? [...prev, id] : prev.filter(x => x !== id);
        setViewPref('companyFilter', JSON.stringify(next)).catch(() => {});
        return next;
    });
  };

  const handleClearFilter = () => {
    setSelectedFilter([]);
    setViewPref('companyFilter', JSON.stringify([])).catch(() => {});
  };

  const handleSetDefaultView = async () => {
    try {
        await setViewPref('companies', viewMode);
        toast({ title: "Default View Set", description: `Companies will now always open in ${viewMode} view.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Failed to save default", description: e.message });
    }
  };

  // Fetch all companies
  const companiesQuery = useMemoFirebase(() => {
    if (!selectedWorkspace?.id) return null;
    return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
  }, [firestore, selectedWorkspace?.id]);

  const { data: companies, isLoading: isCompaniesLoading } = useCollection<Company>(companiesQuery);

  // Fetch projects for each company hierachically
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

  const sortedEnrichedCompanies = useMemo(() => {
    if (!companies) return [];
    
    const enriched = companies.map(company => {
        const activeProjects = allProjects.filter(p => 
            p.companyId === company.id && 
            (p.status || 'active') === 'active' &&
            p.id !== 'general-tasks'
        );
        
        const averageProgress = activeProjects.length > 0
            ? Math.round(activeProjects.reduce((acc, p) => acc + (p.progress || 0), 0) / activeProjects.length)
            : 0;
        
        return {
            ...company,
            averageProgress,
            projectCount: activeProjects.length
        };
    });

    const filtered = selectedFilter.length > 0
        ? enriched.filter(c => selectedFilter.includes(c.id))
        : enriched;

    return filtered.sort((a, b) => {
        switch (sortBy) {
            case 'alphabetical':
                return a.name.localeCompare(b.name);
            case 'lastUsed': {
                const timeA = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
                const timeB = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
                return timeB - timeA;
            }
            case 'progress':
            default:
                return b.averageProgress - a.averageProgress;
        }
    });
  }, [companies, allProjects, sortBy, selectedFilter]);

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

  if (!companies || companies.length === 0) {
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

  const isCurrentViewDefault = prefs?.viewPrefs?.companies === viewMode;

  return (
    <div className="space-y-6">
        <CompaniesBreadcrumb />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-headline">Companies</h1>
            <div className="flex flex-wrap items-center gap-2">
                {companies && companies.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5">
                                <Filter className="h-3.5 w-3.5" />
                                Filter
                                {selectedFilter.length > 0 && (
                                    <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">
                                        {selectedFilter.length}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Show companies</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {companies.map(c => (
                                <DropdownMenuCheckboxItem
                                    key={c.id}
                                    checked={selectedFilter.includes(c.id)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(checked) => handleFilterChange(c.id, checked)}
                                >
                                    {c.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                            {selectedFilter.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-muted-foreground text-xs justify-center"
                                        onSelect={(e) => { e.preventDefault(); handleClearFilter(); }}
                                    >
                                        Clear filter
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <div className="flex items-center gap-2 mr-2">
                    <SortAsc className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="progress">Most Progress</SelectItem>
                            <SelectItem value="alphabetical">Alphabetical (A-Z)</SelectItem>
                            <SelectItem value="lastUsed">Recently Modified</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
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
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSetDefaultView}
                                    className={cn("h-8 w-8 p-0 ml-1", isCurrentViewDefault ? "text-primary" : "text-muted-foreground")}
                                >
                                    <Pin className={cn("h-4 w-4", isCurrentViewDefault && "fill-current")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isCurrentViewDefault ? "Current Default" : "Set as Default View"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <AddCompanyDialog />
            </div>
        </div>

        {sortedEnrichedCompanies.length === 0 && selectedFilter.length > 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No companies match the active filter.{' '}
                <button className="underline" onClick={handleClearFilter}>Clear filter</button>
            </div>
        ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedEnrichedCompanies.map((company) => (
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
                        {sortedEnrichedCompanies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell>
                                    <Avatar className="h-8 w-8 border rounded-sm">
                                        <AvatarImage src={company.logoUrl} alt={company.name} className="object-cover" />
                                        <AvatarFallback className="rounded-sm bg-muted text-muted-foreground text-[10px] font-bold">
                                            {company.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
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
