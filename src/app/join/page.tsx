'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser, FirebaseClientProvider } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  arrayUnion,
  getDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Invite, Workspace } from '@/lib/types';

function JoinProcessor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    
    const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'joining'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [invite, setInvite] = useState<Invite | null>(null);
    const [workspaceName, setWorkspaceName] = useState<string>('');


    useEffect(() => {
        if (isUserLoading) {
            return; // Wait for user auth state to be resolved
        }

        if (!token) {
            setStatus('error');
            setError('No invitation token provided. Please use the link from your invitation email.');
            return;
        }

        if (!user || !user.email) {
            // Not logged in, or user has no email, redirect to login but preserve the token
            const loginUrl = `/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`;
            router.replace(loginUrl);
            return;
        }
        
        const processInvite = async () => {
            setStatus('loading');
            
            const invitesRef = collection(firestore, 'invites');
            // This query is now compliant with the security rule that requires filtering by the user's email.
            const q = query(
                invitesRef, 
                where('token', '==', token),
                where('email', '==', user.email)
            );
            
            try {
                const inviteSnapshot = await getDocs(q);

                if (inviteSnapshot.empty) {
                    setStatus('error');
                    setError('This invitation is invalid, expired, or not intended for your account.');
                    return;
                }

                const foundInvite = { id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() } as Invite;

                if (foundInvite.expires < Date.now()) {
                    // Clean up expired invite
                    await writeBatch(firestore).delete(doc(firestore, 'invites', foundInvite.id)).commit();
                    setStatus('error');
                    setError('This invitation has expired.');
                    return;
                }
                
                // Redundant check since query enforces it, but good for safety
                if (foundInvite.email.toLowerCase() !== user.email?.toLowerCase()) {
                    setStatus('error');
                    setError(`This invite is for ${foundInvite.email}, but you are logged in as ${user.email}. Please log in with the correct account.`);
                    return;
                }

                // At this point, the token is valid, not expired, and for the correct user.
                setInvite(foundInvite);
                
                // Fetch workspace name to display
                const workspaceRef = doc(firestore, 'workspaces', foundInvite.workspaceId);
                const workspaceDoc = await getDoc(workspaceRef);

                if (workspaceDoc.exists()) {
                    const workspaceData = workspaceDoc.data() as Workspace;
                    
                    // Check if user is already a member
                    if(workspaceData.memberIds.includes(user.uid)) {
                       toast({
                           title: "Already a Member",
                           description: `You are already a member of the ${workspaceData.name} workspace.`
                       });
                       // Clean up the (now redundant) invite
                       await writeBatch(firestore).delete(doc(firestore, 'invites', foundInvite.id)).commit();
                       router.push(`/dashboard?ws=${foundInvite.workspaceId}`);
                       return;
                    }

                    setWorkspaceName(workspaceData.name);
                    setStatus('success'); // Ready to show the join button
                } else {
                    setStatus('error');
                    setError('The workspace you were invited to no longer exists.');
                    // Clean up the invite since it's invalid
                    await writeBatch(firestore).delete(doc(firestore, 'invites', foundInvite.id)).commit();
                }

            } catch (e: any) {
                console.error("Error processing invite: ", e);
                setStatus('error');
                setError(e.message || "An error occurred while verifying the invitation. Please ensure you are logged in with the correct email address.");
            }
        };

        processInvite();
    }, [token, user, isUserLoading, firestore, router, toast]);


    const handleJoinWorkspace = async () => {
        if (!user || !invite) return;

        setStatus('joining');
        try {
            const batch = writeBatch(firestore);

            // 1. Update Workspace document
            const workspaceRef = doc(firestore, 'workspaces', invite.workspaceId);
            batch.update(workspaceRef, {
                memberIds: arrayUnion(user.uid),
                [`users.${user.uid}`]: {
                    role: 'contributor', // All invited users start as contributors
                    name: user.displayName,
                    avatarUrl: user.photoURL,
                }
            });

            // 2. Update User's profile document
            const userRef = doc(firestore, 'users', user.uid);
            batch.update(userRef, {
                workspaceIds: arrayUnion(invite.workspaceId)
            });

            // 3. Delete the invite document
            const inviteRef = doc(firestore, 'invites', invite.id);
            batch.delete(inviteRef);

            await batch.commit();

            toast({
                title: "Welcome!",
                description: `You have successfully joined the ${workspaceName} workspace.`
            });

            // Redirect to the newly joined workspace, which will now appear in the switcher
            router.push(`/dashboard?ws=${invite.workspaceId}`);

        } catch (e: any) {
            console.error("Error joining workspace: ", e);
            setStatus('error');
            setError(`Failed to join workspace: ${e.message}. Please check permissions and try again.`);
            toast({
                variant: 'destructive',
                title: 'Join Failed',
                description: `Could not join the workspace. Please try again or contact the administrator.`,
            });
        }
    };


    if (status === 'loading' || isUserLoading) {
        return (
            <Card className="w-full max-w-lg mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-6 w-1/4" />
                </CardContent>
            </Card>
        );
    }
    
    if (status === 'error') {
        return (
             <Alert variant="destructive" className="max-w-lg mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Invitation Error</AlertTitle>
                <AlertDescription>
                    {error}
                     <div className='mt-4'>
                        <Button asChild variant="outline">
                            <Link href="/dashboard">Go to Dashboard</Link>
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }


    if (status === 'success' && invite && user) {
        return (
             <Card className="w-full max-w-lg mx-auto text-center">
                <CardHeader>
                    <CardTitle>Join {workspaceName}</CardTitle>
                    <CardDescription>
                        You have been invited to join the <strong>{workspaceName}</strong> workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">Click the button below to accept the invitation and become a member.</p>
                    <Button onClick={handleJoinWorkspace} disabled={status === 'joining'}>
                        {status === 'joining' ? 'Joining...' : 'Join Workspace'}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return null; // Should not be reached
}

export default function JoinPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
            <Suspense fallback={<Card className="w-full max-w-lg mx-auto"><CardHeader><CardTitle>Loading Invitation...</CardTitle></CardHeader></Card>}>
                <FirebaseClientProvider>
                    <JoinProcessor />
                </FirebaseClientProvider>
            </Suspense>
        </div>
    )
}
