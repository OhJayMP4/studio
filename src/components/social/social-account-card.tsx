
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { saveSocialAccount } from '@/lib/social-accounts';
import type { SocialAccount, SocialPlatform } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Facebook, Instagram, Linkedin, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const formSchema = z.object({
  accountName: z.string().min(1, 'Account name is required.'),
  accountId: z.string().min(1, 'Account ID is required.'),
  accessToken: z.string().min(1, 'Access token is required.'),
  expiresAt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SocialAccountCardProps {
  platform: SocialPlatform;
  companyId: string;
  account: SocialAccount | undefined;
  onAccountUpdate: () => void;
}

const platformDetails = {
  facebook: { icon: Facebook, color: 'text-blue-600' },
  instagram: { icon: Instagram, color: 'text-pink-500' },
  linkedin: { icon: Linkedin, color: 'text-sky-700' },
  x: { icon: X, color: 'text-foreground' },
};

const statusDetails = {
  connected: { icon: CheckCircle, color: 'text-green-500', label: 'Connected' },
  expired: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Expired' },
  revoked: { icon: XCircle, color: 'text-red-500', label: 'Revoked' },
};

export function SocialAccountCard({ platform, companyId, account, onAccountUpdate }: SocialAccountCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { selectedWorkspace } = useSelectedWorkspace();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: account?.accountName || '',
      accountId: account?.accountId || '',
      accessToken: account?.accessToken || '',
      expiresAt: account?.expiresAt ? format((account.expiresAt as any).toDate(), 'yyyy-MM-dd') : '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!selectedWorkspace) return;
    setIsSubmitting(true);
    try {
      await saveSocialAccount(firestore, selectedWorkspace.id, companyId, {
        platform,
        accountName: data.accountName,
        accountId: data.accountId,
        accessToken: data.accessToken,
        status: 'connected', // Assume manual connection is always "connected"
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
      toast({ title: 'Account Saved', description: `Your ${platform} account has been updated.` });
      onAccountUpdate();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleFacebookConnect = () => {
    if (!selectedWorkspace) return;
    
    const clientId = process.env.NEXT_PUBLIC_FB_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_FB_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
        toast({
            variant: 'destructive',
            title: 'Configuration Error',
            description: 'Facebook App ID or Redirect URI is not configured.'
        });
        return;
    }
    
    const scope = 'pages_show_list,pages_read_engagement,pages_manage_posts';
    const state = {
        workspaceId: selectedWorkspace.id,
        companyId: companyId
    };
    const encodedState = encodeURIComponent(JSON.stringify(state));
    
    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${encodedState}&response_type=code`;
    
    window.open(oauthUrl, '_blank');
  };

  const PlatformIcon = platformDetails[platform].icon;
  const currentStatus = account ? statusDetails[account.status] : null;

  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value={platform} className="border-b-0">
          <div className="p-4 flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <PlatformIcon className={cn("h-8 w-8", platformDetails[platform].color)} />
                <div className="text-left">
                  <h3 className="font-semibold capitalize">{platform}</h3>
                  {account ? (
                    <p className="text-sm text-muted-foreground">{account.accountName}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not Connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentStatus && (
                   <Badge variant="outline" className={cn("flex items-center gap-1.5", currentStatus.color)}>
                     <currentStatus.icon className="h-3 w-3" />
                     {currentStatus.label}
                   </Badge>
                )}
                 {!account && (
                    platform === 'facebook' ? (
                        <Button onClick={handleFacebookConnect}>Connect Facebook</Button>
                    ) : (
                         <AccordionTrigger className="p-2 hover:no-underline" />
                    )
                )}
                 {account && <AccordionTrigger className="p-2 hover:no-underline" />}
              </div>
            </div>
          <AccordionContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Manually update the connection details. Note: for real connections, use the 'Connect' button.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`${platform}-accountName`}>Account Name</Label>
                  <Input id={`${platform}-accountName`} {...register('accountName')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${platform}-accountId`}>Account ID</Label>
                  <Input id={`${platform}-accountId`} {...register('accountId')} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${platform}-accessToken`}>Access Token</Label>
                <Input id={`${platform}-accessToken`} {...register('accessToken')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${platform}-expiresAt`}>Expires At (Optional)</Label>
                <Input id={`${platform}-expiresAt`} type="date" {...register('expiresAt')} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Connection'}
                </Button>
              </div>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
