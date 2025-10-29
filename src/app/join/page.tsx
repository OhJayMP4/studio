'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser, FirebaseClientProvider } from '@/firebase';
import {
  getFunctions,
  httpsCallable,
  FunctionsError,
} from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function JoinProcessor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    
    const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'joining'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isUserLoading) {
            return; 
        }

        if (!token) {
            setStatus('error');
            setError('No invitation token provided. Please use the link from your invitation email.');
            return;
        }

        if (!user) {
            const loginUrl = `/login?redirect=${encodeURIComponent(`/join?token=${token}`)}`;
            router.replace(loginUrl);
            return;
        }

        // If we have a user and a token, we are ready to attempt to join.
        setStatus('success');

    }, [token, user, isUserLoading, router]);


    const handleJoinWorkspace = async () => {
        if (!user || !token) return;

        setStatus('joining');
        try {
            const functions = getFunctions();
            const joinWorkspace = httpsCallable(functions, 'joinWorkspace');
            const result = await joinWorkspace({ token });

            const data = result.data as { success: boolean, workspaceId: string };

            if (data.success) {
                toast({
                    title: "Welcome!",
                    description: `You have successfully joined the workspace.`
                });
                router.push(`/dashboard?ws=${data.workspaceId}`);
            } else {
                 throw new Error("The join operation failed unexpectedly.");
            }
        } catch (e: any) {
            console.error("Error calling joinWorkspace function: ", e);
            let friendlyMessage = e.message || 'An unknown error occurred.';
            if (e instanceof FunctionsError) {
                friendlyMessage = e.message;
            }
            setStatus('error');
            setError(`Failed to join workspace: ${friendlyMessage}`);
            toast({
                variant: 'destructive',
                title: 'Join Failed',
                description: friendlyMessage,
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

    if (status === 'success' || status === 'joining') {
        return (
             <Card className="w-full max-w-lg mx-auto text-center">
                <CardHeader>
                    <CardTitle>Join Workspace</CardTitle>
                    <CardDescription>
                        You are about to accept an invitation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">Click the button below to join the workspace associated with your invitation.</p>
                    <Button onClick={handleJoinWorkspace} disabled={status === 'joining'}>
                        {status === 'joining' ? 'Joining...' : 'Accept Invitation & Join'}
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
