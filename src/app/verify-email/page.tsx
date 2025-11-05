'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FirebaseClientProvider, useFirebase, useAuth } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"


const formSchema = z.object({
  code: z.string().min(6, { message: 'Verification code must be 6 digits.' }),
});

type FormValues = z.infer<typeof formSchema>;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const { toast } = useToast();
  const { firebaseApp } = useFirebase();
  const auth = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  if (!email) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Missing Information</AlertTitle>
        <AlertDescription>
          No email address was provided. Please start the sign-up process again.
        </AlertDescription>
      </Alert>
    );
  }

  const handleVerifyCode = async (data: FormValues) => {
    if (!firebaseApp) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const functions = getFunctions(firebaseApp);
      const verifyEmailCode = httpsCallable(functions, 'verifyEmailCode');
      const result = await verifyEmailCode({ email, code: data.code });
      
      const resultData = result.data as { success: boolean, token?: string };

      if (resultData.success && resultData.token) {
        await signInWithCustomToken(auth, resultData.token);
        toast({
          title: 'Account Verified!',
          description: 'You have been successfully signed up and logged in.',
        });
        router.push('/dashboard');
      } else {
        throw new Error('Verification failed unexpectedly.');
      }

    } catch (e: any) {
      console.error("Error verifying code: ", e);
      let friendlyMessage = e.message || 'An unknown error occurred.';
      if (e.code) {
        friendlyMessage = e.message;
      }
      setError(friendlyMessage);
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: friendlyMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <form onSubmit={handleSubmit(handleVerifyCode)}>
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to <strong>{email}</strong>. Please enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <InputOTP
            maxLength={6}
            onComplete={(value) => setValue('code', value)}
            {...register('code')}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
           {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
           {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Verify and Sign Up'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/40">
      <Suspense fallback={<div>Loading...</div>}>
        <FirebaseClientProvider>
          <VerifyEmailForm />
        </FirebaseClientProvider>
      </Suspense>
    </div>
  );
}
