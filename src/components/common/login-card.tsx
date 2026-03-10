'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Rocket, ArrowLeft } from 'lucide-react';
import { useAuth, useFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional().or(z.literal('')),
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
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [resetSent, setResetSent] = useState(false);

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

      if (authMode === 'forgotPassword') {
        await sendPasswordResetEmail(auth, data.email);
        setResetSent(true);
        toast({
          title: 'Reset Email Sent',
          description: `A password reset link has been sent to ${data.email}.`,
        });
        setIsSubmitting(false);
        return;
      }

      if (authMode === 'signUp') {
        if (!data.name) {
            form.setError('name', { type: 'manual', message: 'Name is required for new accounts.' });
            setIsSubmitting(false);
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password!);
        await sendEmailVerification(userCredential.user);
        
        toast({ title: 'Verification Email Sent', description: "Please check your inbox to verify your email address." });
        router.push('/login?status=verification-sent');

      } else { // Sign in
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password!);
        if (!userCredential.user.emailVerified) {
          toast({
            variant: 'destructive',
            title: 'Email Not Verified',
            description: 'Please verify your email before signing in. We can resend the verification link.',
          });
          sendEmailVerification(userCredential.user); // Resend verification email
          setAuthError('Your email address has not been verified.');
          return;
        }

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
        case 'auth/email-already-in-use':
          friendlyMessage = 'This email is already in use. Please sign in or use a different email.';
          break;
        case 'auth/invalid-email':
            friendlyMessage = 'The email address is not valid.';
            break;
        case 'auth/too-many-requests':
            friendlyMessage = 'Too many attempts. Please try again later.';
            break;
        default:
          console.error(firebaseError);
          friendlyMessage = firebaseError.message;
          break;
      }
      setAuthError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authMode === 'forgotPassword' && resetSent) {
    return (
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-headline text-2xl">Check your email</CardTitle>
          <CardDescription>
            We've sent a password reset link to <strong>{form.getValues('email')}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Follow the instructions in the email to reset your password. If you don't see it, check your spam folder.
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAuthMode('signIn');
              setResetSent(false);
              setAuthError(null);
            }}
          >
            Back to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          {authMode === 'forgotPassword' && (
            <button 
              onClick={() => {
                setAuthMode('signIn');
                setAuthError(null);
              }}
              className="absolute left-4 top-6 p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-headline text-3xl">
            {authMode === 'signIn' ? 'Welcome Back' : authMode === 'signUp' ? 'Create an Account' : 'Reset Password'}
          </CardTitle>
          <CardDescription>
            {authMode === 'signIn' 
              ? 'Sign in to continue to SaturnSync' 
              : authMode === 'signUp' 
              ? 'Fill in your details to get started'
              : 'Enter your email to receive a reset link'}
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
              {authMode !== 'forgotPassword' && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        {authMode === 'signIn' && (
                          <Button
                            variant="link"
                            className="px-0 font-normal h-auto text-xs"
                            type="button"
                            onClick={() => {
                              setAuthMode('forgotPassword');
                              setAuthError(null);
                            }}
                          >
                            Forgot password?
                          </Button>
                        )}
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                  ? 'Processing...'
                  : authMode === 'signIn'
                  ? 'Sign In'
                  : authMode === 'signUp'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </Button>
               {authMode !== 'forgotPassword' && (
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
               )}
            </CardFooter>
          </form>
        </FormProvider>
      </Card>
  )
}
