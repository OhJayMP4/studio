'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (minutes: number) => Promise<void>;
  taskTitle: string;
}

type TimeUnit = 'minutes' | 'hours' | 'days';

export function TaskCompletionDialog({
  open,
  onOpenChange,
  onConfirm,
  taskTitle,
}: TaskCompletionDialogProps) {
  const [value, setValue] = useState<string>('');
  const [unit, setUnit] = useState<TimeUnit>('minutes');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please enter a valid amount of time.',
      });
      return;
    }

    // Convert everything to minutes for consistent storage
    let totalMinutes = 0;
    switch (unit) {
      case 'days':
        // Assuming a standard 8-hour workday for professional tasks
        totalMinutes = Math.round(numValue * 8 * 60);
        break;
      case 'hours':
        totalMinutes = Math.round(numValue * 60);
        break;
      case 'minutes':
      default:
        totalMinutes = Math.round(numValue);
        break;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(totalMinutes);
      setValue('');
      setUnit('minutes');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete task.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        if (!isSubmitting) onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
          <DialogDescription>
            Well done! How much time did you spend on <strong>{taskTitle}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="time-value">Amount</Label>
                <Input
                  id="time-value"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 1.5"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                />
              </div>
              <div className="w-[120px] space-y-2">
                <Label htmlFor="time-unit">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as TimeUnit)}>
                  <SelectTrigger id="time-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days (8h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This entry is mandatory for workspace reporting. 
              {unit === 'days' && " (1 Day is calculated as 8 business hours)"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || !value}>
            {isSubmitting ? 'Saving...' : 'Complete Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
