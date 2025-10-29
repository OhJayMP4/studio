'use client';

import { useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { TeamMemberTable } from './team-member-table';


export function WorkspaceManager() {
    const { selectedWorkspace } = useSelectedWorkspace();
    const [workspaceName, setWorkspaceName] = useState(selectedWorkspace?.name || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();

    const handleSaveWorkspaceName = async () => {
        if (!selectedWorkspace || !workspaceName.trim()) {
            toast({ variant: 'destructive', title: 'Workspace name cannot be empty.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            await updateDoc(workspaceRef, { name: workspaceName });
            toast({ title: 'Workspace name updated successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update workspace name', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (!selectedWorkspace) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workspace Settings</CardTitle>
                    <CardDescription>Manage general settings for the "{selectedWorkspace.name}" workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="workspaceName">Workspace Name</Label>
                        <Input
                            id="workspaceName"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveWorkspaceName} disabled={isSubmitting || workspaceName === selectedWorkspace.name}>
                        {isSubmitting ? 'Saving...' : 'Save Workspace Name'}
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manage Team</CardTitle>
                    <CardDescription>Manage members and their roles within the workspace.</CardDescription>
                </CardHeader>
                <CardContent>
                   <TeamMemberTable />
                </CardContent>
            </Card>
        </div>
    );
}
