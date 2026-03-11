'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FirebaseClientProvider } from '@/firebase';

const LoginCard = dynamic(
  () => import('@/components/common/login-card').then((mod) => mod.LoginCard),
  { 
    ssr: false,
    loading: () => (
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <Skeleton className="mx-auto h-16 w-16 rounded-full" />
            <Skeleton className="h-8 w-3/4 mx-auto mt-4" />
            <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
        </CardHeader>
      </Card>
    ),
  }
);

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* 
        We use a matched fallback in FirebaseClientProvider to avoid hydration errors.
        The provider itself handles the initial loading state consistently.
      */}
      <FirebaseClientProvider>
        <Suspense fallback={
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
                <Skeleton className="mx-auto h-16 w-16 rounded-full" />
                <Skeleton className="h-8 w-3/4 mx-auto mt-4" />
                <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
            </CardHeader>
          </Card>
        }>
          <LoginCard />
        </Suspense>
      </FirebaseClientProvider>
    </div>
  );
}
