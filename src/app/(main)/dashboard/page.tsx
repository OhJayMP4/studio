'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection } from "@/firebase";
import { ArrowRight, Building2, Users } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { collection, query, where } from "firebase/firestore";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase";
import type { Workspace } from "@/lib/types";
import { AddWorkspaceButton } from "@/components/common/add-workspace-button";

// Helper function to calculate completion percentages - safe for client-side usage
const calculateCompletion = (items: any): number => {
    // This is a placeholder and needs a proper implementation based on your data structure
    return 0;
};


export default function DashboardPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const workspacesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // This query finds workspaces where the user is a member by checking their role.
        return query(
            collection(firestore, "workspaces"),
            where(`users.${user.uid}.role`, 'in', ['admin', 'contributor', 'viewer'])
        );
    }, [firestore, user]);

    const { data: workspaces, isLoading } = useCollection<Workspace>(workspacesQuery);

    if (isLoading) {
        return <div>Loading workspaces...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back! Here's an overview of your workspaces.</p>
                </div>
                <AddWorkspaceButton />
            </div>
            
            {(workspaces?.length || 0) > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {workspaces?.map(workspace => {
                        const companies = workspace.companies || [];
                        const totalProjects = companies.reduce((acc, company) => acc + (company.projects?.length || 0), 0);
                        const completion = 0; // Placeholder

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
                                        <span>{Object.keys(workspace.users || {}).length} members</span>
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
            ) : (
                <Card className="text-center py-20">
                    <CardHeader>
                       <div className="mx-auto bg-muted rounded-full p-3 w-fit">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                       </div>
                       <CardTitle className="font-headline text-2xl mt-4">No Workspaces Yet</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <p className="text-muted-foreground mb-4">Get started by creating your first workspace.</p>
                        <AddWorkspaceButton />
                   </CardContent>
               </Card>
            )}

        </div>
    );
}
