'use client';

import { Building } from 'lucide-react';

export default function DashboardPage() {
    return (
        <div className="flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                <Building className="h-16 w-16 text-muted-foreground" />
                <h3 className="text-2xl font-semibold mt-4">Welcome to your Workspace</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    Select a workspace from the sidebar to view its companies and projects, or create a new one to get started.
                </p>
            </div>
        </div>
    );
}
