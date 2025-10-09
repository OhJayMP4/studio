import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyById } from "@/lib/data";
import { calculateCompletion } from "@/lib/data-client";
import { ArrowRight, FolderKanban } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { AddProjectButton } from "@/components/common/add-project-button";

export default function CompanyPage({ params }: { params: { workspaceId: string, companyId: string } }) {
    const company = getCompanyById(params.workspaceId, params.companyId);

    if (!company) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">{company.name}</h1>
                    <p className="text-muted-foreground">Overview of projects for this company.</p>
                </div>
                <AddProjectButton workspaceId={params.workspaceId} companyId={params.companyId} />
            </div>


             {company.projects.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {company.projects.map(project => {
                        const completion = calculateCompletion({ silos: project.silos });
                        return (
                            <Card key={project.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="font-headline text-xl">{project.name}</CardTitle>
                                            <CardDescription>{project.silos.length} silos</CardDescription>
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
                                        <Link href={`/workspaces/${params.workspaceId}/companies/${params.companyId}/projects/${project.id}`}>
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
                         <AddProjectButton workspaceId={params.workspaceId} companyId={params.companyId} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
