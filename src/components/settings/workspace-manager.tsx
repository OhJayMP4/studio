'use client';

import { useState } from 'react';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useFirebase, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { TeamMemberTable } from './team-member-table';
import { DeleteDialog } from '../common/delete-dialog';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Pencil } from 'lucide-react';
import { InviteMemberButton } from '../common/invite-member-button';

export function WorkspaceManager() {
    const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();
    const [workspaceName, setWorkspaceName] = useState(selectedWorkspace?.name || '');
    const [isSubmittingName, setIsSubmittingName] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const { firebaseApp } = useFirebase();
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
        if (!selectedWorkspace || !firebaseApp) return;

        setIsDeleting(true);
        toast({ title: 'Deleting Workspace...', description: 'This may take a few moments.' });

        try {
            const functions = getFunctions(firebaseApp);
            const deleteWorkspaceFn = httpsCallable(functions, 'deleteWorkspace');

            await deleteWorkspaceFn({ workspaceId: selectedWorkspace.id });

            toast({
                title: 'Workspace Deleted',
                description: `The "${selectedWorkspace.name}" workspace has been permanently deleted.`,
            });

            setSelectedWorkspace(null); 
            router.push('/dashboard');
            router.refresh();

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
    
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !selectedWorkspace || !firebaseApp || !user) {
            return;
        }

        const file = event.target.files[0];
        const storage = getStorage(firebaseApp);
        const tempFilePath = `user-uploads/${user.uid}/new-logo`;
        const storageRef = ref(storage, tempFilePath);

        setIsUploading(true);
        toast({ title: "Uploading Image..." });

        try {
            await uploadBytes(storageRef, file);
            toast({ title: "Upload complete, processing image..." });

            const functions = getFunctions(firebaseApp);
            const finalizeWorkspaceLogo = httpsCallable(functions, 'finalizeWorkspaceLogo');
            
            const result = await finalizeWorkspaceLogo({
                workspaceId: selectedWorkspace.id,
                tempFilePath: tempFilePath
            });

            const data = result.data as { success: boolean, logoUrl: string };

            if (data.success) {
                toast({ title: "Workspace image updated successfully!" });
            } else {
                throw new Error("Cloud function failed to process the image.");
            }

        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error.message || 'An error occurred while uploading the image.',
            });
        } finally {
            setIsUploading(false);
        }
    };

    if (!selectedWorkspace) {
        return null;
    }

    const fallback = selectedWorkspace.name.charAt(0).toUpperCase();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workspace Settings</CardTitle>
                    <CardDescription>Manage general settings for the "{selectedWorkspace.name}" workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 text-4xl">
                                <AvatarImage src={selectedWorkspace.logoUrl ?? undefined} />
                                <AvatarFallback className='font-bold bg-muted text-muted-foreground'>{fallback}</AvatarFallback>
                            </Avatar>
                             <label htmlFor="workspace-logo-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                                <Pencil className="h-8 w-8" />
                                <input type="file" id="workspace-logo-upload" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isUploading} />
                            </label>
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label htmlFor="workspaceName">Workspace Name</Label>
                            <Input
                                id="workspaceName"
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveWorkspaceName} disabled={isSubmittingName || workspaceName === selectedWorkspace.name}>
                        {isSubmittingName ? 'Saving...' : 'Save Workspace Name'}
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1.5">
                        <CardTitle>Manage Team</CardTitle>
                        <CardDescription>Manage members and their roles within the workspace.</CardDescription>
                    </div>
                    <InviteMemberButton />
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
