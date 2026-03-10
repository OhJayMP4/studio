'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Company } from "@/lib/types";
import { Progress } from "../ui/progress";
import Link from "next/link";

interface CompanyProgressCardProps {
    company: Company;
    children: React.ReactNode; // For actions dropdown
    progressOverride?: number; // Pre-calculated progress from parent
}

export function CompanyProgressCard({ company, children, progressOverride = 0 }: CompanyProgressCardProps) {
    return (
        <Card className="relative hover:shadow-lg transition-shadow flex flex-col">
            {children}
            <Link href={`/company/${company.id}`} passHref className="flex flex-col flex-grow">
                <div className="cursor-pointer flex flex-col flex-grow">
                    <CardHeader className="flex-grow">
                        <CardTitle className="pr-8">{company.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{company.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Overall Progress</span>
                                <span className="text-sm font-medium">{progressOverride}%</span>
                            </div>
                            <Progress value={progressOverride} />
                        </div>
                    </CardContent>
                </div>
            </Link>
        </Card>
    );
}
