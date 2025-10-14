'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Workspace, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [owner, setOwner] = useState<UserProfile | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const wsId = searchParams.get('ws');
  const ownerId = searchParams.get('owner');

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user auth state is resolved
    }

    if (!user) {
      // Not logged in, redirect to login page with redirect URL
      const redirectUrl = `/invite?ws=${wsId}&owner=${ownerId}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    if (!wsId || !ownerId) {
      setError('Invalid invite link. Workspace or owner information is missing.');
      setIsLoading(false);
      return;
    }

    const fetchInviteDetails = async () => {
      try {
        const workspaceRef = doc(firestore, 'workspaces', wsId);
        const ownerRef = doc(firestore, 'users', ownerId);

        const [workspaceSnap, ownerSnap] = await Promise.all([
          getDoc(workspaceRef),
          getDoc(ownerRef),
        ]);

        if (!workspaceSnap.exists()) {
          throw new Error('This workspace no longer exists.');
        }

        const workspaceData = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

        if (workspaceData.users[ownerId]?.role !== 'admin') {
           throw new Error('The user who sent this invite is no longer an admin of this workspace.');
        }

        if (workspaceData.users[user.uid]) {
            throw new Error('You are already a member of this workspace.');
        }
        
        setWorkspace(workspaceData);

        if (ownerSnap.exists()) {
          setOwner({ id: ownerSnap.id, ...ownerSnap.data() } as UserProfile);
        } else {
            // Fallback if owner doc is missing, use info from workspace
            setOwner({
                uid: ownerId,
                name: workspaceData.users[ownerId]?.name || 'An admin',
                email: null,
                avatarUrl: workspaceData.users[ownerId]?.avatarUrl || null,
            })
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInviteDetails();
  }, [user, isUserLoading, wsId, ownerId, firestore, router]);

  const handleJoinWorkspace = async () => {
    if (!user || !workspace) return;
    setIsJoining(true);

    try {
        const workspaceRef = doc(firestore, 'workspaces', workspace.id);
        const userRef = doc(firestore, 'users', user.uid);

        await updateDoc(workspaceRef, {
            [`users.${user.uid}`]: {
                role: 'contributor',
                name: user.displayName,
                avatarUrl: user.photoURL,
            },
            memberIds: arrayUnion(user.uid)
        });

        await updateDoc(userRef, {
            workspaceIds: arrayUnion(workspace.id)
        });
        
        toast({
            title: "Success!",
            description: `You have joined the "${workspace.name}" workspace.`
        });
        router.push('/dashboard');

    } catch (err: any) {
        console.error("Error joining workspace:", err);
        toast({
            variant: "destructive",
            title: "Join Failed",
            description: err.message || "Could not join the workspace."
        });
        setIsJoining(false);
    }
  };


  if (isLoading) {
    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
  }

  if (error) {
     return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-destructive">Invite Invalid</CardTitle>
                <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={() => router.push('/dashboard')} className='w-full'>Go to Dashboard</Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => router.push('/dashboard')}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Workspace</DialogTitle>
          <DialogDescription>
            {owner?.name || 'A user'} has invited you to join the{' '}
            <span className="font-bold">{workspace?.name}</span> workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>Cancel</Button>
          <Button onClick={handleJoinWorkspace} disabled={isJoining}>
            {isJoining ? 'Joining...' : 'Accept Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InvitePage() {
    return (
        <div className="flex items-center justify-center h-full">
            <Suspense fallback={<div>Loading...</div>}>
                <InviteContent />
            </Suspense>
        </div>
    )
}
