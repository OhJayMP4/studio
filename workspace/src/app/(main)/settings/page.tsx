'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { WorkspaceManager } from '@/components/settings/workspace-manager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Pencil, KeyRound, User, Palette, Monitor, Sun, Moon, Check, Sparkles, Bell, Home } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useUserPrefs } from '@/hooks/use-sidebar-prefs';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';

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

const ACCENT_COLORS = [
  { name: 'Default Orange', value: '23 100% 54%' },
  { name: 'Sky Blue', value: '217 91% 60%' },
  { name: 'Emerald Green', value: '142 71% 45%' },
  { name: 'Royal Violet', value: '262 83% 58%' },
  { name: 'Rose Red', value: '346 84% 61%' },
  { name: 'Golden Amber', value: '38 92% 50%' },
  { name: 'Slate Gray', value: '215 25% 27%' },
  { name: 'Deep Indigo', value: '239 84% 67%' },
  { name: 'Dark Green', value: '142 71% 25%' },
];

export default function SettingsPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const user = auth.currentUser;
  const { selectedWorkspace, isUserAdmin } = useSelectedWorkspace();
  const { prefs, setTheme: saveThemeToPrefs, setAccentColor, setViewPref } = useUserPrefs();
  const { theme, setTheme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

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
    } else if (user) {
      profileForm.reset({
        name: user.displayName || '',
        email: user.email || '',
      });
    }
  }, [userProfile, user, profileForm]);
  
  const handleUpdateProfile = async (data: ProfileFormValues) => {
    if (!user || !userProfileRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
      return;
    }

    try {
      if (user.displayName !== data.name) {
        await updateProfile(user, { displayName: data.name });
      }
      await updateDoc(userProfileRef, { name: data.name });
      toast({ title: 'Profile Updated', description: 'Your information has been successfully updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not update your profile.' });
    }
  };

  const handlePasswordUpdate = async (data: PasswordFormValues) => {
    if (!user || !user.email) return;
    
    try {
        const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, data.newPassword);
        toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
        passwordForm.reset();
    } catch (error: any) {
        let description = 'An unexpected error occurred.';
        if (error.code === 'auth/wrong-password') description = 'The current password you entered is incorrect.';
        toast({ variant: 'destructive', title: 'Password Update Failed', description });
    }
  }

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    if (!userProfileRef) return;
    try {
        await updateDoc(userProfileRef, { emailNotificationsEnabled: enabled });
        toast({ title: enabled ? 'Notifications Enabled' : 'Notifications Disabled' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user || !userProfileRef || !storage) return;
    const file = event.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 2MB.' });
        return;
    }
    const avatarRef = ref(storage, `user-avatars/${user.uid}`);
    setIsUploading(true);
    try {
        await uploadBytesResumable(avatarRef, file);
        const downloadURL = await getDownloadURL(avatarRef);
        await updateDoc(userProfileRef, { avatarUrl: downloadURL });
        await updateProfile(user, { photoURL: downloadURL });
        toast({ title: 'Avatar Updated' });
    } catch (error: any) {
         toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
         setIsUploading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    saveThemeToPrefs(newTheme);
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

  const name = userProfile?.name || user?.displayName || '';
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL || '';
  const fallback = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="space-y-8 max-w-4xl pb-20">
      <div>
        <h1 className="text-4xl font-headline font-bold">Settings</h1>
        <p className="text-muted-foreground text-lg">Personalize your environment and manage workspace security.</p>
      </div>

      <Card className="border-none shadow-sm bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Palette className="h-6 w-6 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how SaturnSync looks for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
          <div className="space-y-4">
            <Label className="text-base font-bold uppercase tracking-wider text-muted-foreground">Theme Mode</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Monitor },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleThemeChange(mode.id as any)}
                  className={cn(
                    "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all group",
                    theme === mode.id 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-muted bg-background hover:border-muted-foreground/30"
                  )}
                >
                  <mode.icon className={cn("h-5 w-5 transition-colors", theme === mode.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className={cn("font-semibold", theme === mode.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {mode.label}
                  </span>
                  {theme === mode.id && <Check className="h-4 w-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>

            <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-bold uppercase tracking-wider text-muted-foreground">Accent Color</Label>
                  <p className="text-xs text-muted-foreground mt-1">Choose a color to personalize your workspace experience.</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                    <Sparkles className="h-3 w-3" />
                    Workspace Theming
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setAccentColor(color.value)}
                  className={cn(
                    "group relative flex h-12 w-full items-center justify-center rounded-lg border-2 transition-all active:scale-95",
                    prefs?.accentColor === color.value 
                        ? "border-foreground scale-105 shadow-lg z-10" 
                        : "border-transparent opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: `hsl(${color.value})` }}
                  title={color.name}
                >
                  {prefs?.accentColor === color.value ? (
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-1 shadow-inner">
                        <Check className="h-5 w-5 text-white" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 rounded-lg transition-opacity" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Home className="h-6 w-6 text-primary" />
            Navigation
          </CardTitle>
          <CardDescription>Choose which page opens when you first sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label className="text-base font-bold uppercase tracking-wider text-muted-foreground">Home Page</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(prefs?.sidebarModules ?? [
                { id: 'dashboard', label: 'Dashboard', route: '/dashboard' },
                { id: 'my-tasks', label: 'My Tasks', route: '/my-tasks' },
                { id: 'companies', label: 'Companies', route: '/companies' },
                { id: 'reporting', label: 'Reporting', route: '/reporting' },
              ]).filter((m: any) => !m.hidden).map((m: any) => {
                const currentHome = prefs?.viewPrefs?.homePage ?? '/dashboard';
                const isSelected = currentHome === m.route;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setViewPref('homePage', m.route)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md text-foreground"
                        : "border-muted bg-background hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Bell className="h-6 w-6 text-primary" />
            Notification Settings
          </CardTitle>
          <CardDescription>Manage how you want to be notified of workspace activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-background rounded-xl border-2 border-muted">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive emails when tasks are assigned to you.</p>
            </div>
            <Switch 
              checked={userProfile?.emailNotificationsEnabled !== false} 
              onCheckedChange={handleToggleEmailNotifications} 
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="flex flex-col border-none shadow-sm overflow-hidden">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile
            </CardTitle>
            <CardDescription>Update your public identity.</CardDescription>
            </CardHeader>
            <FormProvider {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)} className="flex-1 flex flex-col">
                <CardContent className="space-y-6 flex-grow">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative group">
                        <Avatar className="h-28 w-24 text-4xl rounded-2xl ring-4 ring-background shadow-2xl">
                            <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                            <AvatarFallback className="bg-muted text-muted-foreground rounded-2xl">{fallback}</AvatarFallback>
                        </Avatar>
                        <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl border-2 border-white/20 backdrop-blur-sm">
                            <div className="flex flex-col items-center">
                                <Pencil className="h-6 w-6 mb-1" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Update</span>
                            </div>
                            <input type="file" id="avatar-upload" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isUploading} />
                        </label>
                    </div>
                    <div className="w-full space-y-4">
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
                            <Input type="email" {...field} disabled className="bg-muted/50" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                </div>
                </CardContent>
                <CardFooter className="pt-6 border-t bg-muted/30">
                <Button type="submit" className="w-full" disabled={profileForm.formState.isSubmitting || isUploading}>
                    {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Profile'}
                </Button>
                </CardFooter>
            </form>
            </FormProvider>
        </Card>

        <Card className="flex flex-col border-none shadow-sm overflow-hidden">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Security
            </CardTitle>
            <CardDescription>Keep your account safe.</CardDescription>
            </CardHeader>
            <FormProvider {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="flex-1 flex flex-col">
                <CardContent className="space-y-4 flex-grow">
                <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="Confirm identity" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Separator className="my-2" />
                <div className="space-y-4">
                    <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                            <Input type="password" placeholder="Min. 6 chars" {...field} />
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
                            <Input type="password" placeholder="Repeat password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                </CardContent>
                <CardFooter className="pt-6 border-t bg-muted/30">
                <Button type="submit" variant="outline" className="w-full" disabled={passwordForm.formState.isSubmitting}>
                    {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                </Button>
                </CardFooter>
            </form>
            </FormProvider>
        </Card>
      </div>
      
      {selectedWorkspace && isUserAdmin && (
        <>
            <Separator />
            <WorkspaceManager />
        </>
      )}
    </div>
  );
}
