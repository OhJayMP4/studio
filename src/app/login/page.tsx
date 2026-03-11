'use client';

import { Suspense, useEffect, useState } from 'react';
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

function LoginLoading() {
    return (
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
                <Skeleton className="mx-auto h-16 w-16 rounded-full" />
                <Skeleton className="h-8 w-3/4 mx-auto mt-4" />
                <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
            </CardHeader>
        </Card>
    );
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
         <LoginLoading />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <FirebaseClientProvider>
        <Suspense fallback={<LoginLoading />}>
          <LoginCard />
        </Suspense>
      </FirebaseClientProvider>
    </div>
  );
}
