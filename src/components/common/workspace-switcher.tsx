'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { Workspace, UserProfile } from '@/lib/types';
import {
  ChevronsUpDown,
  PlusCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AddWorkspaceDialog } from './add-workspace-dialog';
import { Skeleton } from '../ui/skeleton';
import { useDocs } from '@/firebase/firestore/use-docs';


function useUserWorkspaces() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const userRef = doc(firestore, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        setError("User document not found.");
        setIsLoading(false);
        return;
      }
      
      const { workspaceIds = [] } = userSnap.data() as UserProfile;
      setWorkspaces([]); // Reset on new workspace list
      
      if (workspaceIds.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const unsubs: (() => void)[] = [];

      workspaceIds.forEach(wsId => {
        const wsRef = doc(firestore, 'workspaces', wsId);
        const wsUnsub = onSnapshot(wsRef, (wsSnap) => {
          if (wsSnap.exists()) {
            const wsData = wsSnap.data() as Omit<Workspace, 'id'>;
            // Add or update workspace in the local state
            setWorkspaces(prev => {
              const existing = prev.find(w => w.id === wsId);
              if (existing) {
                return prev.map(w => w.id === wsId ? { id: wsId, ...wsData } : w);
              }
              return [...prev, { id: wsId, ...wsData }];
            });
          } else {
             // If a workspace is deleted, remove it from local state
             setWorkspaces(prev => prev.filter(w => w.id !== wsId));
          }
        }, (err) => {
          console.error(`Error fetching workspace ${wsId}:`, err);
        });
        unsubs.push(wsUnsub);
      });

      setIsLoading(false);

      // Cleanup listeners for workspaces when workspaceIds array changes
      return () => unsubs.forEach(u => u());
    }, (err) => {
      console.error("Error fetching user profile:", err);
      setError(err.message);
      setIsLoading(false);
    });

    return unsubUser; // Cleanup user profile listener
  }, [user, firestore]);
  
  return { workspaces, isLoading, error };
}


export function WorkspaceSwitcher() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();
  const { workspaces, isLoading } = useUserWorkspaces();

  useEffect(() => {
    // When workspaces load, if no workspace is selected, or the selected one is no longer available, select the first one.
    if (!isLoading && workspaces) {
      if (!selectedWorkspace || !workspaces.find(w => w.id === selectedWorkspace.id)) {
        setSelectedWorkspace(workspaces[0] || null);
      }
    }
  }, [workspaces, isLoading, selectedWorkspace, setSelectedWorkspace]);


  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
         <Skeleton className="h-10 w-10 rounded-lg" />
         <Skeleton className="h-6 w-32" />
      </div>
    )
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 overflow-hidden">
             {selectedWorkspace ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                    {selectedWorkspace.name.charAt(0).toUpperCase()}
                </div>
            ) : (
                 <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                    -
                 </div>
            )}
            <span className="truncate">
              {selectedWorkspace
                ? selectedWorkspace.name
                : 'Select a workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--sidebar-width] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search workspace..." />
            <CommandEmpty>
                <div className='p-4 text-sm text-center'>
                    <p>No workspace found.</p>
                    <p className='text-muted-foreground'>Create one to get started.</p>
                </div>
            </CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces?.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  onSelect={() => {
                    setSelectedWorkspace(workspace);
                    setPopoverOpen(false);
                  }}
                  className="text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{workspace.name}</span>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      selectedWorkspace?.id === workspace.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
                <AddWorkspaceDialog>
                    <CommandItem
                        onSelect={() => {
                            setPopoverOpen(false);
                        }}
                    >
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Create Workspace
                    </CommandItem>
                </AddWorkspaceDialog>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
