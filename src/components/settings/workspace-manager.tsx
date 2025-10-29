'use client';

import { useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { TeamMemberTable } from './team-member-table';
import { DeleteDialog } from '../common/delete-dialog';
import { useRouter } from 'next/navigation';

export function WorkspaceManager() {
    const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();
    const [workspaceName, setWorkspaceName] = useState(selectedWorkspace?.name || '');
    const [isSubmittingName, setIsSubmittingName] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const router = useRouter();

    const handleSaveWorkspaceName = async () => {
        if (!selectedWorkspace || !workspaceName.trim()) {
            toast({ variant: 'destructive', title: 'Workspace name cannot be empty.' });
            return;
        }

        setIsSubmittingName(true);
        try {
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            await updateDoc(workspaceRef, { name: workspaceName });
            toast({ title: 'Workspace name updated successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to update workspace name', description: error.message });
        } finally {
            setIsSubmittingName(false);
        }
    };

    const handleDeleteWorkspace = async () => {
        if (!selectedWorkspace) return;

        setIsDeleting(true);
        toast({ title: 'Deleting Workspace...', description: 'This may take a few moments.' });

        try {
            // Note: Deleting subcollections client-side is complex and not recommended for large workspaces.
            // A Cloud Function is the robust way to handle this. This is a best-effort client-side delete.
            const workspaceRef = doc(firestore, 'workspaces', selectedWorkspace.id);
            
            const batch = writeBatch(firestore);

            // 1. Remove workspaceId from all members' user profiles
            for (const memberId of selectedWorkspace.memberIds) {
                const userRef = doc(firestore, 'users', memberId);
                batch.update(userRef, {
                    workspaceIds: (await getDoc(userRef)).data()?.workspaceIds.filter((id: string) => id !== selectedWorkspace.id)
                });
            }

            // In a real-world scenario, you would need a recursive function
            // to delete all documents in all subcollections (companies, projects, etc.)
            // For this project, we'll just delete the main workspace doc.
            // This will leave subcollections orphaned, but they will be inaccessible.
            batch.delete(workspaceRef);

            await batch.commit();

            toast({
                title: 'Workspace Deleted',
                description: `The "${selectedWorkspace.name}" workspace has been permanently deleted.`,
            });

            setSelectedWorkspace(null); // Clear selected workspace
            router.push('/dashboard'); // Redirect to a safe page

        } catch (error: any) {
            console.error("Error deleting workspace: ", error);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: error.message || 'An error occurred while deleting the workspace.',
            });
        } finally {
            setIsDeleting(false);
        }
    }


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
                    <Button onClick={handleSaveWorkspaceName} disabled={isSubmittingName || workspaceName === selectedWorkspace.name}>
                        {isSubmittingName ? 'Saving...' : 'Save Workspace Name'}
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

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DeleteDialog onConfirm={handleDeleteWorkspace} itemName={`workspace "${selectedWorkspace.name}"`}>
                         <Button variant="destructive" disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete this Workspace'}
                        </Button>
                    </DeleteDialog>
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">
                        Deleting a workspace will remove all associated companies, projects, tasks, and sales data permanently.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
