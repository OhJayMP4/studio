'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
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
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';

function useUserWorkspaces() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const workspaceListenersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!user) {
      workspaceListenersRef.current.forEach(unsub => unsub());
      workspaceListenersRef.current.clear();
      setWorkspaces([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const userRef = doc(firestore, 'users', user.uid);

    const unsubUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) {
        setError("User profile does not exist.");
        setIsLoading(false);
        setWorkspaces([]);
        return;
      }
      
      const userData = userSnap.data() as UserProfile;
      const workspaceIds = new Set(userData.workspaceIds || []);
      
      workspaceListenersRef.current.forEach((unsub, wsId) => {
        if (!workspaceIds.has(wsId)) {
          unsub();
          workspaceListenersRef.current.delete(wsId);
        }
      });

      setWorkspaces(prev => prev.filter(ws => workspaceIds.has(ws.id)));

      if (workspaceIds.size === 0) {
        setIsLoading(false);
      }

      workspaceIds.forEach(wsId => {
        if (!workspaceListenersRef.current.has(wsId)) {
          const workspaceRef = doc(firestore, 'workspaces', wsId);
          const unsubWorkspace = onSnapshot(workspaceRef, (wsSnap) => {
            if (wsSnap.exists()) {
              const wsData = { id: wsSnap.id, ...wsSnap.data() } as Workspace;
              setWorkspaces(prev => {
                const existingIndex = prev.findIndex(w => w.id === wsId);
                if (existingIndex > -1) {
                  const newWs = [...prev];
                  newWs[existingIndex] = wsData;
                  return newWs;
                } else {
                  return [...prev, wsData];
                }
              });
            } else {
              // Workspace was deleted, remove it from local state and user profile
              setWorkspaces(prev => prev.filter(w => w.id !== wsId));
              updateDoc(userRef, { workspaceIds: arrayRemove(wsId) });
            }
             setIsLoading(false);
          }, (wsErr) => {
            console.error(`Error listening to workspace ${wsId}:`, wsErr);
            setError(`Permission denied for workspace ${wsId}. It might have been deleted.`);
            // On error, assume it's a stale reference and remove it.
            setWorkspaces(prev => prev.filter(w => w.id !== wsId));
            updateDoc(userRef, { workspaceIds: arrayRemove(wsId) });
            setIsLoading(false);
          });

          workspaceListenersRef.current.set(wsId, unsubWorkspace);
        }
      });
    }, (userErr) => {
      console.error("Error listening to user document:", userErr);
      setError("Could not fetch user profile. " + userErr.message);
      setIsLoading(false);
    });

    return () => {
      unsubUser();
      workspaceListenersRef.current.forEach(unsub => unsub());
      workspaceListenersRef.current.clear();
    };
  }, [user, firestore]);
  
  return { workspaces, isLoading, error };
}


export function WorkspaceSwitcher() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { selectedWorkspace, setSelectedWorkspace } = useSelectedWorkspace();
  const { workspaces, isLoading, error } = useUserWorkspaces();

  useEffect(() => {
    if (!isLoading && workspaces) {
      if (!selectedWorkspace || !workspaces.find(w => w.id === selectedWorkspace.id)) {
        setSelectedWorkspace(workspaces[0] || null);
      }
    }
  }, [workspaces, isLoading, selectedWorkspace, setSelectedWorkspace]);


  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2">
         <Skeleton className="h-6 w-6 rounded-md" />
         <Skeleton className="h-5 w-32" />
         <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
      </div>
    )
  }

  if (error && workspaces.length === 0) {
     return (
        <div className="p-2 text-xs text-destructive-foreground bg-destructive rounded-md">
            <p>Error: {error}</p>
        </div>
     );
  }

  const renderWorkspaceAvatar = (workspace: Workspace | null) => {
    if (!workspace) {
        return (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                -
            </div>
        );
    }

    const fallback = workspace.name.charAt(0).toUpperCase();
    return (
        <Avatar className="h-6 w-6 text-xs">
            <AvatarImage src={workspace.logoUrl ?? undefined} alt={workspace.name} />
            <AvatarFallback className="font-bold bg-muted text-muted-foreground">{fallback}</AvatarFallback>
        </Avatar>
    );
  };

  return (
    <>
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-2"
        >
          <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:gap-0">
            <div className="group-data-[collapsible=icon]:[&>*]:!size-4">
              {renderWorkspaceAvatar(selectedWorkspace)}
            </div>
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {selectedWorkspace
                ? selectedWorkspace.name
                : 'Select a workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--sidebar-width] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search workspace..." />
            <CommandEmpty>
                <div className='p-4 text-sm text-center'>
                    <p>No workspace found.</p>
                     <Button variant="link" className='mt-2' onClick={() => {
                        setDialogOpen(true);
                        setPopoverOpen(false);
                     }}>Create your first workspace</Button>
                </div>
            </CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces?.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={workspace.id}
                  onSelect={(currentValue) => {
                    const selected = workspaces.find(ws => ws.id === currentValue);
                    if (selected) {
                      setSelectedWorkspace(selected);
                    }
                    setPopoverOpen(false);
                  }}
                  className="text-sm"
                >
                  <div className="flex items-center gap-2">
                    {renderWorkspaceAvatar(workspace)}
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
                <CommandItem
                    onSelect={() => {
                      setDialogOpen(true);
                      setPopoverOpen(false);
                    }}
                >
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create Workspace
                </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    <AddWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
