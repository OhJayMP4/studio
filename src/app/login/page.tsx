'use client';

import { Suspense, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Rocket } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;


function LoginCard() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  });

  const handleAuthAction = async (action: 'signIn' | 'signUp', data: FormValues) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      let userCredential;
      if (action === 'signUp') {
        if (!data.name) {
            setAuthError('Name is required for new accounts.');
            setIsSubmitting(false);
            return;
        }
        userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        if (userCredential.user && data.name) {
          await updateProfile(userCredential.user, { displayName: data.name });
        }
        toast({ title: 'Account Created', description: "You've been successfully signed up." });
      } else {
        userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({ title: 'Signed In', description: "You've been successfully signed in." });
      }

      const redirectUrl = searchParams.get('redirect');
      router.push(redirectUrl || '/dashboard');

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
        default:
          console.error(firebaseError);
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
          <CardTitle className="font-headline text-3xl">SaturnSync</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <FormProvider {...form}>
          <form>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (for new accounts)</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                type="button"
                onClick={form.handleSubmit((data) => handleAuthAction('signIn', data))}
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit((data) => handleAuthAction('signUp', data))}
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing Up...' : 'Sign Up'}
              </Button>
            </CardFooter>
          </form>
        </FormProvider>
      </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginCard />
      </Suspense>
    </div>
  );
}