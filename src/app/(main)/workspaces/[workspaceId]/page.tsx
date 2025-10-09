import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceById, calculateCompletion } from "@/lib/data";
import { ArrowRight, Building } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default function WorkspacePage({ params }: { params: { workspaceId: string } }) {
    const workspace = getWorkspaceById(params.workspaceId);

    if (!workspace) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline">{workspace.name}</h1>
                <p className="text-muted-foreground">Overview of companies within this workspace.</p>
            </div>

            {workspace.companies.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workspace.companies.map(company => {
                        const completion = calculateCompletion({ projects: company.projects });

                        return (
                            <Card key={company.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="font-headline text-xl">{company.name}</CardTitle>
                                            <CardDescription>{company.projects.length} projects</CardDescription>
                                        </div>
                                        <Building className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                     <div className="mb-1 flex justify-between text-sm">
                                        <span className="font-medium">Overall Progress</span>
                                        <span className="text-muted-foreground">{completion}%</span>
                                    </div>
                                    <Progress value={completion} aria-label={`${completion}% complete`} />
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link href={`/workspaces/${workspace.id}/companies/${company.id}`}>
                                            View Company <ArrowRight className="ml-2 h-4 w-4" />
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
                        <h3 className="text-lg font-medium">No Companies Yet</h3>
                        <p className="text-muted-foreground">Get started by creating a new company in this workspace.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
