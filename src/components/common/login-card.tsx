'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Rocket } from 'lucide-react';
import { useAuth, useFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;


export function LoginCard() {
  const auth = useAuth();
  const { firebaseApp } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  });

  const handleAuthAction = async (data: FormValues) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const redirectUrl = searchParams.get('redirect');

      if (authMode === 'signUp') {
        if (!data.name) {
            form.setError('name', { type: 'manual', message: 'Name is required for new accounts.' });
            setIsSubmitting(false);
            return;
        }

        const functions = getFunctions(firebaseApp);
        const sendVerificationEmail = httpsCallable(functions, 'sendVerificationEmail');
        
        await sendVerificationEmail({ email: data.email, name: data.name, password: data.password });

        toast({ title: 'Verification Email Sent', description: "Check your inbox for a verification code." });
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);

      } else { // Sign in
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: 'Signed In', description: "You've been successfully signed in." });
        router.push(redirectUrl || '/dashboard');
      }

    } catch (error) {
      const firebaseError = error as FirebaseError;
      let friendlyMessage = 'An unexpected error occurred. Please try again.';
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          friendlyMessage = 'No account found with this email. Please sign up or check your email address.';
          break;
        case 'auth/wrong-password':
          friendlyMessage = 'Incorrect password. Please try again.';
          break;
        case 'functions/already-exists':
        case 'auth/email-already-in-use':
          friendlyMessage = 'This email is already in use. Please sign in or use a different email.';
          break;
        case 'auth/invalid-email':
            friendlyMessage = 'The email address is not valid.';
            break;
        case 'functions/invalid-argument':
            friendlyMessage = 'Please ensure all fields are filled out correctly.';
            break;
        default:
          console.error(firebaseError);
          friendlyMessage = firebaseError.message; // Use the message from the function error
          break;
      }
      setAuthError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-headline text-3xl">
            {authMode === 'signIn' ? 'Welcome Back' : 'Create an Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'signIn' ? 'Sign in to continue to SaturnSync' : 'Fill in your details to get started'}
          </CardDescription>
        </CardHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleAuthAction)}>
            <CardContent className="space-y-4">
              {authMode === 'signUp' && (
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                        <Input placeholder="Your Name" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {authError && (
                <p className="text-sm font-medium text-destructive">{authError}</p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
               <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : authMode === 'signIn'
                  ? 'Sign In'
                  : 'Create Account'}
              </Button>
               <Button
                type="button"
                variant="link"
                className="w-full text-muted-foreground"
                disabled={isSubmitting}
                onClick={() => {
                  setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
                  setAuthError(null);
                  form.reset();
                }}
              >
                {authMode === 'signIn' ? "Don't have an account? Create one" : 'Already have an account? Sign In'}
              </Button>
            </CardFooter>
          </form>
        </FormProvider>
      </Card>
  )
}
