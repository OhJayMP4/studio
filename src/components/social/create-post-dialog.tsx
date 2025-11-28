
'use client';

import React from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, ChevronDown, UploadCloud, File, X, Video } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { createSocialPost, updateSocialPost, uploadPostMedia, deletePostMedia } from '@/lib/social-posts';
import { SocialPost, SocialPostStatusType, SocialPlatform, SocialPlatforms } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

const formSchema = z.object({
  scheduledAtDate: z.date({ required_error: 'A date is required.' }),
  scheduledAtTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  platforms: z.array(z.string()).min(1, 'Select at least one platform.'),
  captionDefault: z.string().min(1, 'A default caption is required.'),
  showAdvancedCaptions: z.boolean().default(false),
  captionFacebook: z.string().optional(),
  captionInstagram: z.string().optional(),
  captionLinkedin: z.string().optional(),
  captionX: z.string().optional(),
  media: z.array(z.object({
      fileUrl: z.string(),
      fileName: z.string(),
      fileType: z.enum(['image', 'video']),
  })).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreatePostDialogProps {
  companyId: string;
  onPostCreated: () => void;
  postToEdit?: SocialPost | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  selectedDate?: Date;
}

export function CreatePostDialog({
  companyId,
  onPostCreated,
  postToEdit,
  open,
  onOpenChange,
  children,
  selectedDate,
}: CreatePostDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  
  const [isUploading, setIsUploading] = React.useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platforms: [],
      media: [],
    },
  });

  const { watch, reset, setValue } = form;
  const mediaFiles = watch('media', []);

  React.useEffect(() => {
    if (isOpen) {
      if (postToEdit) {
        const scheduledAt = (postToEdit.scheduledAt as Timestamp).toDate();
        reset({
          scheduledAtDate: scheduledAt,
          scheduledAtTime: format(scheduledAt, 'HH:mm'),
          platforms: postToEdit.platforms,
          captionDefault: postToEdit.captionDefault,
          showAdvancedCaptions: !!(postToEdit.captionFacebook || postToEdit.captionInstagram || postToEdit.captionLinkedin || postToEdit.captionX),
          captionFacebook: postToEdit.captionFacebook,
          captionInstagram: postToEdit.captionInstagram,
          captionLinkedin: postToEdit.captionLinkedin,
          captionX: postToEdit.captionX,
          media: postToEdit.media,
        });
      } else {
        reset({
          scheduledAtDate: selectedDate || new Date(),
          scheduledAtTime: format(new Date(), 'HH:mm'),
          platforms: [],
          captionDefault: '',
          showAdvancedCaptions: false,
          captionFacebook: '',
          captionInstagram: '',
          captionLinkedin: '',
          captionX: '',
          media: [],
        });
      }
    }
  }, [isOpen, postToEdit, selectedDate, reset]);
  
  const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
    if (!selectedWorkspace) return;
    setIsUploading(true);
    try {
        const uploadPromises = acceptedFiles.map(file => uploadPostMedia(file, selectedWorkspace.id, companyId));
        const uploadedMedia = await Promise.all(uploadPromises);
        setValue('media', [...(mediaFiles || []), ...uploadedMedia.map(m => ({...m, fileType: m.fileName.endsWith('mp4') ? 'video' : 'image'}))], { shouldValidate: true });
        toast({ title: "Media uploaded successfully." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Upload failed", description: (error as Error).message });
    } finally {
        setIsUploading(false);
    }
  }, [selectedWorkspace, companyId, setValue, toast, mediaFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleRemoveMedia = async (fileUrl: string) => {
    const newMedia = mediaFiles?.filter(m => m.fileUrl !== fileUrl);
    setValue('media', newMedia);
    try {
        await deletePostMedia(fileUrl);
    } catch (error) {
        console.warn("Failed to delete media from storage, it might have been already removed.", error);
    }
  };

  const processSubmit = async (data: FormValues, status: SocialPostStatusType) => {
    if (!user || !selectedWorkspace) {
      toast({ variant: 'destructive', title: 'You must be logged in to a workspace.' });
      return;
    }

    const [hours, minutes] = data.scheduledAtTime.split(':').map(Number);
    const scheduledAtWithTime = setMinutes(setHours(data.scheduledAtDate, hours), minutes);

    const postData: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        workspaceId: selectedWorkspace.id,
        createdByUserId: user.uid,
        scheduledAt: Timestamp.fromDate(scheduledAtWithTime),
        platforms: data.platforms as SocialPlatform[],
        captionDefault: data.captionDefault,
        captionFacebook: data.captionFacebook || '',
        captionInstagram: data.captionInstagram || '',
        captionLinkedin: data.captionLinkedin || '',
        captionX: data.captionX || '',
        media: data.media || [],
        status: status,
        rejectionReason: postToEdit?.status === 'rejected' ? '' : (postToEdit?.rejectionReason || null),
    };
    
    try {
        if (postToEdit) {
            await updateSocialPost(firestore, postToEdit.id, postData);
            toast({ title: 'Post updated successfully' });
        } else {
            await createSocialPost(firestore, postData);
            toast({ title: 'Post created successfully' });
        }
        setIsOpen(false);
        onPostCreated();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to save post', description: error.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <FormProvider {...form}>
          <form>
            <DialogHeader>
              <DialogTitle>{postToEdit ? 'Edit Social Post' : 'Create Social Post'}</DialogTitle>
              <DialogDescription>Plan and schedule a new post for your social media channels.</DialogDescription>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                     <Controller
                        control={form.control}
                        name="captionDefault"
                        render={({ field }) => <Textarea {...field} placeholder="Write your main caption here..." rows={8} />}
                      />
                      {form.formState.errors.captionDefault && <p className="text-sm text-destructive">{form.formState.errors.captionDefault.message}</p>}

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label>Advanced Captions</Label>
                            <Switch checked={watch('showAdvancedCaptions')} onCheckedChange={(checked) => setValue('showAdvancedCaptions', checked)} />
                        </div>
                        {watch('showAdvancedCaptions') && (
                            <div className="space-y-2 pl-2 border-l-2">
                               <Controller
                                  control={form.control}
                                  name="captionFacebook"
                                  render={({ field }) => <Textarea {...field} placeholder="Facebook caption (optional)" rows={3} />}
                                />
                                <Controller
                                  control={form.control}
                                  name="captionInstagram"
                                  render={({ field }) => <Textarea {...field} placeholder="Instagram caption (optional)" rows={3} />}
                                />
                                <Controller
                                  control={form.control}
                                  name="captionLinkedin"
                                  render={({ field }) => <Textarea {...field} placeholder="LinkedIn caption (optional)" rows={3} />}
                                />
                                <Controller
                                  control={form.control}
                                  name="captionX"
                                  render={({ field }) => <Textarea {...field} placeholder="X caption (optional)" rows={3} />}
                                />
                            </div>
                        )}
                    </div>
                </div>
                {/* Right Column */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Controller name="scheduledAtDate" control={form.control} render={({ field }) => (
                           <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn(!field.value && 'text-muted-foreground')}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'PPP') : 'Select date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                           </Popover>
                        )} />
                        <Controller name="scheduledAtTime" control={form.control} render={({ field }) => (
                            <Input type="time" {...field} />
                        )} />
                    </div>
                    {form.formState.errors.scheduledAtDate && <p className="text-sm text-destructive">{form.formState.errors.scheduledAtDate.message}</p>}
                    {form.formState.errors.scheduledAtTime && <p className="text-sm text-destructive">{form.formState.errors.scheduledAtTime.message}</p>}
                    
                    <div className="space-y-2">
                        <Label>Platforms</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {SocialPlatforms.map(platform => (
                                <div key={platform} className="flex items-center gap-2">
                                   <Checkbox
                                        id={platform}
                                        checked={watch('platforms').includes(platform)}
                                        onCheckedChange={(checked) => {
                                            const current = watch('platforms');
                                            const newPlatforms = checked ? [...current, platform] : current.filter(p => p !== platform);
                                            setValue('platforms', newPlatforms, { shouldValidate: true });
                                        }}
                                    />
                                    <Label htmlFor={platform} className="capitalize">{platform}</Label>
                                </div>
                            ))}
                        </div>
                         {form.formState.errors.platforms && <p className="text-sm text-destructive">{form.formState.errors.platforms.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Media</Label>
                        <div {...getRootProps()} className={cn('p-6 border-2 border-dashed rounded-md text-center cursor-pointer', isDragActive && 'border-primary')}>
                            <input {...getInputProps()} />
                            <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground"/>
                            <p className="text-sm text-muted-foreground mt-2">Drag & drop files or click to upload</p>
                        </div>
                        {mediaFiles && mediaFiles.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {mediaFiles.map((media, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        {media.fileType === 'image' ? (
                                            <Image src={media.fileUrl} alt={media.fileName} layout="fill" className="rounded-md object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-black rounded-md flex items-center justify-center">
                                                <Video className="h-8 w-8 text-white"/>
                                            </div>
                                        )}
                                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveMedia(media.fileUrl)}><X className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                         {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => processSubmit(form.getValues(), 'draft')} disabled={isUploading || form.formState.isSubmitting}>Save as Draft</Button>
                <Button onClick={() => processSubmit(form.getValues(), 'pending_approval')} disabled={isUploading || form.formState.isSubmitting}>Submit for Approval</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

    