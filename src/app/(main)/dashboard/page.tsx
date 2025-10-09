import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaces, calculateCompletion } from "@/lib/data";
import { ArrowRight, Building2, Users } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AddCompanyButton } from "@/components/common/add-company-button";

export default function DashboardPage() {
    const workspaces = getWorkspaces();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back! Here's an overview of your workspaces.</p>
                </div>
                <AddCompanyButton />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workspaces.map(workspace => {
                    const companies = workspace.companies;
                    const totalProjects = companies.reduce((acc, company) => acc + company.projects.length, 0);
                    const allTasks = companies.flatMap(c => c.projects.flatMap(p => p.silos.flatMap(s => s.tasks)));
                    const completion = calculateCompletion(allTasks);

                    return (
                        <Card key={workspace.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="font-headline text-xl">{workspace.name}</CardTitle>
                                        <CardDescription>{totalProjects} projects</CardDescription>
                                    </div>
                                    <Building2 className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-4">
                                <div>
                                    <div className="mb-1 flex justify-between text-sm">
                                        <span className="font-medium">Overall Progress</span>
                                        <span className="text-muted-foreground">{completion}%</span>
                                    </div>
                                    <Progress value={completion} aria-label={`${completion}% complete`} />
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="h-4 w-4" />
                                    <span>{workspace.users.length} members</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href={`/workspaces/${workspace.id}`}>
                                        Open Workspace <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
