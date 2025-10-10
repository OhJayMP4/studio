'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { ArrowRight, FolderKanban } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { AddProjectButton } from "@/components/common/add-project-button";
import { collection, doc } from "firebase/firestore";
import type { Company, Project } from "@/lib/types";

export default function CompanyPage({ params: { workspaceId, companyId } }: { params: { workspaceId: string, companyId: string } }) {
    const firestore = useFirestore();

    const companyRef = useMemoFirebase(() => doc(firestore, "workspaces", workspaceId, "companies", companyId), [firestore, workspaceId, companyId]);
    const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);
    
    const projectsRef = useMemoFirebase(() => collection(firestore, "companies", companyId, "projects"), [firestore, companyId]);
    const { data: projects, isLoading: areProjectsLoading } = useCollection<Project>(projectsRef);

    if (isCompanyLoading || areProjectsLoading) {
        return <div>Loading...</div>
    }

    if (!company) {
        notFound();
    }

    const completion = 0; // Placeholder

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">{company.name}</h1>
                    <p className="text-muted-foreground">Overview of projects for this company.</p>
                </div>
                <AddProjectButton workspaceId={workspaceId} companyId={companyId} />
            </div>


             {(projects?.length || 0) > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects?.map(project => {
                        return (
                            <Card key={project.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="font-headline text-xl">{project.name}</CardTitle>
                                            <CardDescription>{project.silos?.length || 0} silos</CardDescription>
                                        </div>
                                        <FolderKanban className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-4">
                                    <div>
                                        <div className="mb-1 flex justify-between text-sm">
                                            <span className="font-medium">Task Progress</span>
                                            <span className="text-muted-foreground">{completion}%</span>
                                        </div>
                                        <Progress value={completion} aria-label={`${completion}% complete`} />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link href={`/workspaces/${workspaceId}/companies/${companyId}/projects/${project.id}`}>
                                            View Project <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                 <Card className="text-center py-20">
                     <CardHeader>
                        <div className="mx-auto bg-muted rounded-full p-3 w-fit">
                           <FolderKanban className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <CardTitle className="font-headline text-2xl mt-4">No Projects Yet</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <p className="text-muted-foreground mb-4">Get started by creating a new project for this company.</p>
                         <AddProjectButton workspaceId={workspaceId} companyId={companyId} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
