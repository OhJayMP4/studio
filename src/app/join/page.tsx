'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type Invite = {
  id: string;
  workspaceId: string;
  email: string;
  expires: number;
  token: string;
};

function JoinProcessor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'joining'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [invite, setInvite] = useState<Invite | null>(null);

    useEffect(() => {
        if (isUserLoading) {
            return; // Wait for user auth state to be resolved
        }

        if (!token) {
            setStatus('error');
            setError('No invitation token provided. Please use the link from your invitation email.');
            return;
        }

        if (!user) {
            // Not logged in, redirect to login but preserve the token
            const loginUrl = `/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`;
            router.replace(loginUrl);
            return;
        }
        
        const processInvite = async () => {
            setStatus('loading');
            
            const invitesRef = collection(firestore, 'invites');
            const q = query(invitesRef, where('token', '==', token));
            const inviteSnapshot = await getDocs(q);

            if (inviteSnapshot.empty) {
                setStatus('error');
                setError('This invitation is invalid or has already been used.');
                return;
            }

            const foundInvite = { id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() } as Invite;

            if (foundInvite.expires < Date.now()) {
                setStatus('error');
                setError('This invitation has expired.');
                // Optional: Clean up expired invite
                await deleteDoc(doc(firestore, 'invites', foundInvite.id));
                return;
            }

            // At this point, the token is valid, not expired, and the user is logged in.
            setInvite(foundInvite);
            setStatus('success'); // Ready to show the join button
        };

        processInvite();
    }, [token, user, isUserLoading, firestore, router]);


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
                    role: 'contributor', // Or another default role
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

            // Redirect to the newly joined workspace
            router.push(`/dashboard?ws=${invite.workspaceId}`);

        } catch (e: any) {
            setStatus('error');
            setError(`Failed to join workspace: ${e.message}`);
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
                    <CardTitle>You're Invited!</CardTitle>
                    <CardDescription>
                        You have been invited to join a new workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">Click the button below to accept the invitation and join.</p>
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
            <Suspense fallback={<div>Loading...</div>}>
                <JoinProcessor />
            </Suspense>
        </div>
    )
}
