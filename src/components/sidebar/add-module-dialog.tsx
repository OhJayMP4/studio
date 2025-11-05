'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSidebarPrefs, availableModules } from '@/hooks/use-sidebar-prefs';
import * as LucideIcons from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddModuleDialog({ open, onOpenChange }: AddModuleDialogProps) {
  const { prefs, addModule, loading } = useSidebarPrefs();
  const { toast } = useToast();

  const handleAddModule = async (moduleId: string) => {
    try {
      await addModule(moduleId);
      toast({
        title: 'Module Added',
        description: `The ${moduleId} module has been added to your sidebar.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Adding Module',
        description: error.message,
      });
    }
  };

  const Icon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
      const LucideIcon = (LucideIcons as any)[name];
      if (!LucideIcon) {
          return <LucideIcons.HelpCircle {...props} />; // Fallback icon
      }
      return <LucideIcon {...props} />;
  };

  const currentModuleIds = prefs?.sidebarModules.map(m => m.id) || [];
  const modulesToShow = availableModules.filter(m => !currentModuleIds.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Module</DialogTitle>
          <DialogDescription>
            Enhance your workspace by adding new features to your sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {modulesToShow.length > 0 ? modulesToShow.map(module => (
            <Card key={module.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className='flex items-center gap-4'>
                        <Icon name={module.icon} className="h-6 w-6 text-muted-foreground" />
                        <CardTitle className="text-lg">{module.label}</CardTitle>
                    </div>
                  <Button size="sm" onClick={() => handleAddModule(module.id)} disabled={loading}>
                    Add
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground pt-2">{module.description}</p>
              </CardHeader>
            </Card>
          )) : (
            <p className="text-sm text-muted-foreground text-center col-span-2">All available modules have been added.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

    