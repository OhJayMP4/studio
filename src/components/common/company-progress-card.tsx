
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { Company } from "@/lib/types";
import { Progress } from "../ui/progress";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Building } from "lucide-react";

interface CompanyProgressCardProps {
    company: Company;
    children: React.ReactNode; // For actions dropdown
    progressOverride?: number; // Pre-calculated progress from parent
}

export function CompanyProgressCard({ company, children, progressOverride = 0 }: CompanyProgressCardProps) {
    const fallback = company.name.charAt(0).toUpperCase();

    return (
        <Card className="relative hover:shadow-lg transition-shadow flex flex-col group overflow-hidden">
            {children}
            <Link href={`/company/${company.id}`} passHref className="flex flex-col flex-grow">
                <div className="cursor-pointer flex flex-col flex-grow">
                    <CardHeader className="flex-grow pb-4">
                        <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 border rounded-md shrink-0">
                                <AvatarImage src={company.logoUrl} alt={company.name} className="object-cover" />
                                <AvatarFallback className="rounded-md bg-muted text-muted-foreground font-bold">
                                    {fallback}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 pr-8">
                                <CardTitle className="truncate text-xl">{company.name}</CardTitle>
                                <CardDescription className="line-clamp-2 mt-1 leading-snug">{company.description}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                         <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Overall Workspace Progress</span>
                                <span className="text-sm font-bold tabular-nums">{progressOverride}%</span>
                            </div>
                            <Progress value={progressOverride} className="h-1.5" />
                        </div>
                    </CardContent>
                </div>
            </Link>
        </Card>
    );
}
