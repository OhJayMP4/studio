'use client';

import { useSelectedWorkspace } from "@/app/(main)/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Link as LinkIcon, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeamReportDialog } from "@/components/reporting/team-report-dialog";

export default function ReportingPage() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const router = useRouter();
    const { toast } = useToast();

    const handleLiveReportClick = () => {
        if (!selectedWorkspace) return;
        const liveReportUrl = `/reporting/live/${selectedWorkspace.id}`;
        
        navigator.clipboard.writeText(`${window.location.origin}${liveReportUrl}`).then(() => {
            toast({
                title: "Link Copied!",
                description: "The shareable link for the live report has been copied to your clipboard.",
            });
        });
        
        // Open the live report in a new tab
        window.open(liveReportUrl, '_blank');
    };
    
    if (!selectedWorkspace) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle>Reporting Hub</CardTitle>
                    <CardDescription>Please select a workspace from the sidebar to view reporting options.</CardDescription>
                </CardHeader>
                </Card>
            </div>
        );
    }
    
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline">Reporting for {selectedWorkspace.name}</h1>
        <p className="text-muted-foreground">Generate reports for your workspace.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Printable Workspace Summary
                </CardTitle>
                <CardDescription>
                    Generate a detailed, table-based report of all companies, projects, and tasks. Ideal for printing or saving as a PDF for offline review.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/reporting/summary" target="_blank">Generate Printable Report</Link>
                </Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LinkIcon />
                   Live CEO Report
                </CardTitle>
                <CardDescription>
                    Generate a shareable link to a live, interactive dashboard with charts and drill-down capabilities. Perfect for high-level overviews.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleLiveReportClick}>Copy Link & Open</Button>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users />
                   Team Report
                </CardTitle>
                <CardDescription>
                   Select team members to generate a printable report of all their assigned tasks across the workspace.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <TeamReportDialog />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
