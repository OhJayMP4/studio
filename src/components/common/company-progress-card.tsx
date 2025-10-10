'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Company, Project } from "@/lib/types";
import { useEffect, useState } from "react";
import { Progress } from "../ui/progress";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

interface CompanyProgressCardProps {
    company: Company;
    children: React.ReactNode; // For actions dropdown
}

export function CompanyProgressCard({ company, children }: CompanyProgressCardProps) {
    const { selectedWorkspace } = useSelectedWorkspace();
    const firestore = useFirestore();
    const [averageProgress, setAverageProgress] = useState(0);

    const projectsQuery = useMemoFirebase(() => {
        if (!selectedWorkspace) return null;
        return collection(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id, 'projects');
    }, [firestore, selectedWorkspace, company.id]);

    const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

    useEffect(() => {
        if (projects && projects.length > 0) {
            const totalProgress = projects.reduce((acc, project) => acc + project.progress, 0);
            setAverageProgress(Math.round(totalProgress / projects.length));
        } else {
            setAverageProgress(0);
        }
    }, [projects]);


    return (
        <Card className="relative hover:shadow-lg transition-shadow flex flex-col">
            {children}
            <Link href={`/company/${company.id}`} passHref className="flex flex-col flex-grow">
                <div className="cursor-pointer flex flex-col flex-grow">
                    <CardHeader className="flex-grow">
                        <CardTitle className="pr-8">{company.name}</CardTitle>
                        <CardDescription>{company.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                             <div className="space-y-2">
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        ) : (
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Overall Progress</span>
                                    <span className="text-sm font-medium">{averageProgress}%</span>
                                </div>
                                <Progress value={averageProgress} />
                            </div>
                        )}
                    </CardContent>
                </div>
            </Link>
        </Card>
    );
}
