import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectById, calculateCompletion } from "@/lib/data";
import { ArrowRight, Container } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default function ProjectPage({ params }: { params: { workspaceId: string, companyId: string, projectId: string } }) {
    const project = getProjectById(params.workspaceId, params.companyId, params.projectId);

    if (!project) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline">{project.name}</h1>
                <p className="text-muted-foreground">Overview of silos for this project.</p>
            </div>

            {project.silos.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {project.silos.map(silo => {
                        const completion = calculateCompletion(silo.tasks);
                        return (
                            <Card key={silo.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="font-headline text-xl">{silo.name}</CardTitle>
                                            <CardDescription>{silo.tasks.length} tasks</CardDescription>
                                        </div>
                                        <Container className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                     <div className="mb-1 flex justify-between text-sm">
                                        <span className="font-medium">Task Progress</span>
                                        <span className="text-muted-foreground">{completion}%</span>
                                    </div>
                                    <Progress value={completion} aria-label={`${completion}% complete`} />
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link href={`/workspaces/${params.workspaceId}/companies/${params.companyId}/projects/${params.projectId}/silos/${silo.id}`}>
                                            View Silo <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="text-center py-12">
                     <CardContent>
                        <h3 className="text-lg font-medium">No Silos Yet</h3>
                        <p className="text-muted-foreground">Get started by creating a new silo for this project.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
