'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { MessageSquare, Star } from 'lucide-react';
import { sendFeedbackEmail } from '@/ai/flows/send-feedback-email-flow';
import { cn } from '@/lib/utils';

const feedbackSchema = z.object({
  rating: z.string().min(1, 'Please select a rating'),
  usage: z.string().min(1, 'Please describe your usage'),
  frustrated: z.enum(['yes', 'no']),
  frustrationsComment: z.string().optional(),
  improvement: z.string().min(1, 'Please suggest an improvement'),
  featureRequest: z.string().min(1, 'Please describe a desired feature'),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      frustrated: 'no',
    },
  });

  const frustrated = watch('frustrated');

  const onSubmit = async (data: FeedbackFormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await sendFeedbackEmail({
        userEmail: user.email || 'unknown@example.com',
        userName: user.displayName || 'SaturnSync User',
        rating: parseInt(data.rating),
        usage: data.usage,
        frustrated: data.frustrated === 'yes',
        frustrationsComment: data.frustrationsComment,
        improvement: data.improvement,
        featureRequest: data.featureRequest,
      });

      toast({
        title: 'Feedback Received!',
        description: 'Thank you for helping us improve SaturnSync.',
      });
      reset();
      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'Could not send feedback at this time.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
            variant="outline"
            className="w-full justify-center gap-2 font-medium bg-card hover:bg-accent transition-all active:scale-95 border-primary/20 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2"
        >
          <MessageSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Share Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-headline">App Feedback</DialogTitle>
          <DialogDescription>
            Your thoughts help us build a better workspace for everyone.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              How would you rate the app overall?
            </Label>
            <Controller
              name="rating"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex justify-between px-2"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <div key={val} className="flex flex-col items-center gap-1">
                      <RadioGroupItem
                        value={val.toString()}
                        id={`rating-${val}`}
                        className="sr-only"
                      />
                      <Label
                        htmlFor={`rating-${val}`}
                        className={cn(
                          "h-10 w-10 flex items-center justify-center rounded-full border-2 transition-all cursor-pointer",
                          field.value === val.toString()
                            ? "bg-primary border-primary text-primary-foreground shadow-md scale-110"
                            : "bg-background border-muted hover:border-primary/50"
                        )}
                      >
                        {val}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
            {errors.rating && <p className="text-xs text-destructive">{errors.rating.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              What do you mainly use the app for?
            </Label>
            <Input id="usage" {...register('usage')} placeholder="e.g., Managing social posts and project tasks" />
            {errors.usage && <p className="text-xs text-destructive">{errors.usage.message}</p>}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Did anything frustrate or confuse you?
            </Label>
            <Controller
              name="frustrated"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="frust-yes" />
                    <Label htmlFor="frust-yes">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="frust-no" />
                    <Label htmlFor="frust-no">No</Label>
                  </div>
                </RadioGroup>
              )}
            />
            {frustrated === 'yes' && (
              <Textarea
                {...register('frustrationsComment')}
                placeholder="What happened? We'd love to fix it."
                rows={2}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvement" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              What's the one thing we should improve?
            </Label>
            <Input id="improvement" {...register('improvement')} placeholder="Short answer" />
            {errors.improvement && <p className="text-xs text-destructive">{errors.improvement.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="featureRequest" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              What feature would you like to see?
            </Label>
            <Textarea 
                id="featureRequest" 
                {...register('featureRequest')} 
                placeholder="Long answer... tell us about your dream feature!"
                rows={4}
            />
            {errors.featureRequest && <p className="text-xs text-destructive">{errors.featureRequest.message}</p>}
          </div>
        </form>

        <DialogFooter className="p-6 pt-2 border-t bg-muted/5">
          <Button type="submit" className="w-full" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
