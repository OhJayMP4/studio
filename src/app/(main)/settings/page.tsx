'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { WorkspaceManager } from '@/components/settings/workspace-manager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Pencil, KeyRound, User } from 'lucide-react';


const profileFormSchema = z.object({
  name: z.string().min(1, { message: 'Name is required.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
});

const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, { message: 'Current password is required.'}),
    newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function SettingsPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const user = auth.currentUser;
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const [isUploading, setIsUploading] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading, error } = useDoc<UserProfile>(userProfileRef);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    }
  });

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({
        name: userProfile.name || '',
        email: userProfile.email || '',
      });
    }
  }, [userProfile, profileForm]);
  
  const handleUpdateProfile = async (data: ProfileFormValues) => {
    if (!user || !userProfileRef) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to update your profile.',
      });
      return;
    }

    try {
      if (user.displayName !== data.name) {
        await updateProfile(user, { displayName: data.name });
      }
      await updateDoc(userProfileRef, {
        name: data.name,
      });
      
      toast({
        title: 'Profile Updated',
        description: 'Your information has been successfully updated.',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update your profile.',
      });
    }
  };

  const handlePasswordUpdate = async (data: PasswordFormValues) => {
    if (!user || !user.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'No authenticated user found.' });
        return;
    }
    
    try {
        const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        await updatePassword(user, data.newPassword);

        toast({
            title: 'Password Updated',
            description: 'Your password has been changed successfully.',
        });
        passwordForm.reset();

    } catch (error: any) {
         console.error('Error updating password:', error);
        let description = 'An unexpected error occurred.';
        if (error.code === 'auth/wrong-password') {
            description = 'The current password you entered is incorrect.';
        }
        toast({
            variant: 'destructive',
            title: 'Password Update Failed',
            description: description,
        });
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user || !userProfileRef) return;
    
    const file = event.target.files[0];
    const storage = getStorage();
    const avatarRef = ref(storage, `user-avatars/${user.uid}`);
    
    setIsUploading(true);
    toast({ title: "Uploading avatar..." });
    
    try {
        await uploadBytes(avatarRef, file);
        const downloadURL = await getDownloadURL(avatarRef);

        // Update Auth Profile
        await updateProfile(user, { photoURL: downloadURL });
        
        // Update Firestore Profile
        await updateDoc(userProfileRef, { avatarUrl: downloadURL });

        toast({ title: 'Avatar Updated', description: 'Your profile picture has been updated across the app.' });
    } catch (error: any) {
         toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
        setIsUploading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings.</p>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return <div>Error loading profile: {error.message}</div>
  }

  const name = userProfile?.name || '';
  const avatarUrl = user?.photoURL || userProfile?.avatarUrl || '';
  const fallback = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace settings.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            My Profile
          </CardTitle>
          <CardDescription>Update your personal information and profile picture.</CardDescription>
        </CardHeader>
        <FormProvider {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)}>
            <CardContent className="space-y-6">
               <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b">
                 <div className="relative group">
                    <Avatar className="h-24 w-24 text-4xl border-4 border-background shadow-xl">
                        <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                        <AvatarFallback className="bg-muted text-muted-foreground">{fallback}</AvatarFallback>
                    </Avatar>
                     <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full border-2 border-white/20 backdrop-blur-sm">
                        <div className="flex flex-col items-center">
                            <Pencil className="h-6 w-6 mb-1" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                        </div>
                        <input type="file" id="avatar-upload" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isUploading} />
                    </label>
                </div>
                <div className="flex-1 w-full space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} disabled />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground italic">Email changes are handled via support for security.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
               <Button type="submit" disabled={profileForm.formState.isSubmitting || isUploading}>
                {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </form>
        </FormProvider>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Security & Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <FormProvider {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)}>
            <CardContent className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your old password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator className="my-2" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Min. 6 characters" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Repeat new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            </CardContent>
            <CardFooter>
               <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </CardFooter>
          </form>
        </FormProvider>
      </Card>
      
      {selectedWorkspace && isUserAdmin && <WorkspaceManager />}
    </div>
  );
}
