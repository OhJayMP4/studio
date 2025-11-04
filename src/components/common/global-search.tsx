'use client';

import { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import type { Company, Project, Silo, Task } from '@/lib/types';
import { Search, Building, Folder, Box, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DialogTitle } from '@/components/ui/dialog';

type SearchResult =
  | { type: 'company'; item: Company & { path: string } }
  | { type: 'project'; item: Project & { path: string; companyName: string } }
  | { type: 'silo'; item: Silo & { path: string; companyName: string; projectName: string } }
  | { type: 'task'; item: Task & { path: string; companyName: string; projectName: string; siloName: string } };


export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const router = useRouter();

  // Open on Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);


  useEffect(() => {
    const fetchSearchData = async () => {
        if (!open || !selectedWorkspace || !firestore) {
            setResults([]);
            return;
        };

        setLoading(true);
        try {
            const companiesRef = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
            const companiesSnap = await getDocs(companiesRef);
            const companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));

            const allProjects: Project[] = [];
            const allSilos: (Silo & { path: string })[] = [];
            const allTasks: (Task & { path: string })[] = [];

            for (const company of companies) {
                const projectsRef = collection(companiesRef, company.id, 'projects');
                const projectsSnap = await getDocs(projectsRef);
                const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
                allProjects.push(...projects);

                for (const project of projects) {
                    const silosRef = collection(projectsRef, project.id, 'silos');
                    const silosSnap = await getDocs(silosRef);
                    const silos = silosSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), path: doc.ref.path } as Silo & { path: string }));
                    allSilos.push(...silos);

                    for (const silo of silos) {
                        const tasksRef = collection(silosRef, silo.id, 'tasks');
                        const tasksSnap = await getDocs(tasksRef);
                        const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), path: doc.ref.path } as Task & { path: string }));
                        allTasks.push(...tasks);
                    }
                }
            }
            
            const searchData: SearchResult[] = [];

            companies.forEach(c => searchData.push({ type: 'company', item: { ...c, path: `company/${c.id}` } }));
            
            allProjects.forEach(p => {
                const company = companies.find(c => c.id === p.companyId);
                searchData.push({ type: 'project', item: { ...p, path: `company/${p.companyId}/project/${p.id}`, companyName: company?.name || '' } })
            });

            allSilos.forEach(s => {
                const pathParts = s.path.split('/');
                const companyId = pathParts[3];
                const projectId = pathParts[5];
                const company = companies.find(c => c.id === companyId);
                const project = allProjects.find(p => p.id === projectId);
                if (company && project) {
                    searchData.push({ type: 'silo', item: { ...s, path: `company/${companyId}/project/${projectId}`, companyName: company.name, projectName: project.name } })
                }
            });

            allTasks.forEach(t => {
                const project = allProjects.find(p => p.id === t.projectId);
                if (project) {
                    const company = companies.find(c => c.id === project.companyId);
                    const pathParts = t.path.split('/');
                    const siloId = pathParts[7];
                    const silo = allSilos.find(silo => silo.id === siloId);

                    if (company && project && silo) {
                        searchData.push({ type: 'task', item: { ...t, path: `company/${project.companyId}/project/${project.id}`, companyName: company.name, projectName: project.name, siloName: silo.name } })
                    }
                }
            });
            
            setResults(searchData);
        } catch (error) {
            console.error("Global search failed:", error);
            if (error instanceof Error && error.message.includes('permission-denied')) {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'list', path: 'documents in workspace' }));
            }
        } finally {
            setLoading(false);
        }
    }
    
    if (open && results.length === 0 && !loading) {
      fetchSearchData();
    }

  }, [open, selectedWorkspace, firestore, loading, results.length]);

  const onSelect = (path: string) => {
    router.push(`/${path}`);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground w-40 lg:w-64 flex items-center gap-2 border rounded-md px-3 py-1.5 hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        Search...
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle>
          <VisuallyHidden>Global Search</VisuallyHidden>
        </DialogTitle>
        <CommandInput placeholder="Search for companies, projects, tasks..." />
        <CommandList>
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {results.length === 0 && !loading ? <CommandEmpty>No results found.</CommandEmpty> : null}
              {results.some(r => r.type === 'company') && (
                <CommandGroup heading="Companies">
                  {results.filter(r => r.type === 'company').map(({ item }) => (
                    <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`company-${item.name}`}>
                      <Building className="mr-2 h-4 w-4" />
                      <span>{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.some(r => r.type === 'project') && (
                <CommandGroup heading="Projects">
                  {results.filter(r => r.type === 'project').map(({ item }) => (
                    <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`project-${item.name}`}>
                      <Folder className="mr-2 h-4 w-4" />
                      <span>{item.name}</span>
                      <span className='text-xs text-muted-foreground ml-2'>in {item.companyName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.some(r => r.type === 'silo') && (
                <CommandGroup heading="Silos">
                  {results.filter(r => r.type === 'silo').map(({ item }) => (
                    <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`silo-${item.name}`}>
                      <Box className="mr-2 h-4 w-4" />
                      <span>{item.name}</span>
                      <span className='text-xs text-muted-foreground ml-2'>in {item.projectName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.some(r => r.type === 'task') && (
                <CommandGroup heading="Tasks">
                  {results.filter(r => r.type === 'task').map(({ item }) => (
                    <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`task-${item.title}`}>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                      <span className='text-xs text-muted-foreground ml-2'>in {item.siloName}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
