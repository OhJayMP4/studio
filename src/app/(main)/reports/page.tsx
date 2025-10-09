import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Link2, BarChart } from "lucide-react";

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline">Reports</h1>
                <p className="text-muted-foreground">Generate and share insights from your workspaces.</p>
            </div>
             <Card>
                <CardHeader>
                    <BarChart className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="font-headline text-xl">Generate a New Report</CardTitle>
                    <CardDescription>Select a report type to get started. This feature is currently under development.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Button disabled>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF Overview
                    </Button>
                    <Button disabled>
                        <Link2 className="mr-2 h-4 w-4" />
                        Live Link Report
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
