'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings } from "lucide-react";

export default function DashboardPage() {
    const { user } = useUser();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user?.displayName || user?.email}!</p>
                </div>
            </div>
            
            <Card className="text-center py-20">
                <CardHeader>
                    <div className="mx-auto bg-muted rounded-full p-3 w-fit">
                        <Settings className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <CardTitle className="font-headline text-2xl mt-4">Ready to Build</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">This is your new starting point. Let's build something great.</p>
                    <Button asChild>
                        <Link href="/settings">
                            Go to Settings
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
