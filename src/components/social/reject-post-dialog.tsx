'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

interface RejectPostDialogProps {
  children: React.ReactNode;
  onConfirm: (reason: string) => void;
}

export function RejectPostDialog({ children, onConfirm }: RejectPostDialogProps) {
  const [reason, setReason] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm(reason);
    setIsOpen(false);
    setReason('');
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Post</AlertDialogTitle>
          <AlertDialogDescription>
            Please provide a reason for rejecting this post. This will be shared with the creator.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
            <Label htmlFor="rejection-reason" className="sr-only">Rejection Reason</Label>
            <Textarea 
                id="rejection-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., The image quality is too low, or there is a typo in the caption."
            />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!reason.trim()} className="bg-destructive hover:bg-destructive/90">
            Confirm Rejection
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
