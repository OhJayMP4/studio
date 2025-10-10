'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-3xl font-headline mb-4">Dashboard</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome to SaturnSync</CardTitle>
                    <CardDescription>This is your dashboard. We will build it out step-by-step from here.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The application has been reset to a clean, stable state.</p>
                </CardContent>
            </Card>
        </div>
    );
}
