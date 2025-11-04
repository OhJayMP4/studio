'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import type { Company, Project, Silo, Task } from '@/lib/types';
import { Search, Building, Folder, Box, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
        const workspacePath = `workspaces/${selectedWorkspace.id}`;
        
        const companiesQuery = query(collectionGroup(firestore, 'companies'), where('workspaceId', '==', selectedWorkspace.id));
        const projectsQuery = query(collectionGroup(firestore, 'projects'), where('workspaceId', '==', selectedWorkspace.id));
        const silosQuery = query(collectionGroup(firestore, 'silos'), where('__name__', '>=', `${workspacePath}/`), where('__name__', '<', `${workspacePath}0`));
        const tasksQuery = query(collectionGroup(firestore, 'tasks'), where('projectId', '!=', ''));

        const [companiesSnap, projectsSnap, silosSnap, tasksSnap] = await Promise.all([
            getDocs(companiesQuery),
            getDocs(projectsQuery),
            getDocs(silosQuery),
            getDocs(tasksQuery),
        ]);

        const companies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
        const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        const silos = silosSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), path: doc.ref.path } as Silo & { path: string }));
        const tasks = tasksSnap.docs.map(doc => {
            const taskData = doc.data() as Task;
             if (taskData.projectId) { // Filter tasks that belong to projects in the current workspace
                const project = projects.find(p => p.id === taskData.projectId);
                if (project) {
                    return { id: doc.id, ...taskData, path: doc.ref.path } as Task & { path: string };
                }
             }
             return null;
        }).filter((t): t is Task & { path: string } => t !== null);

        const searchData: SearchResult[] = [];

        companies.forEach(c => searchData.push({ type: 'company', item: { ...c, path: `company/${c.id}` } }));
        
        projects.forEach(p => {
            const company = companies.find(c => c.id === p.companyId);
            searchData.push({ type: 'project', item: { ...p, path: `company/${p.companyId}/project/${p.id}`, companyName: company?.name || '' } })
        });

        silos.forEach(s => {
            const pathParts = s.path.split('/');
            const companyId = pathParts[3];
            const projectId = pathParts[5];
            const company = companies.find(c => c.id === companyId);
            const project = projects.find(p => p.id === projectId);
            searchData.push({ type: 'silo', item: { ...s, path: `company/${companyId}/project/${projectId}`, companyName: company?.name || '', projectName: project?.name || '' } })
        });

        tasks.forEach(t => {
            const project = projects.find(p => p.id === t.projectId);
            if (project) {
                const company = companies.find(c => c.id === project.companyId);
                const pathParts = t.path.split('/');
                const siloId = pathParts[7];
                const silo = silos.find(silo => silo.id === siloId);

                searchData.push({ type: 'task', item: { ...t, path: `company/${project.companyId}/project/${project.id}`, companyName: company?.name || '', projectName: project?.name || '', siloName: silo?.name || '' } })
            }
        });
        
        setResults(searchData);
        setLoading(false);
    }
    
    fetchSearchData();

  }, [open, selectedWorkspace, firestore]);

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
        <CommandInput placeholder="Search for companies, projects, tasks..." />
        <CommandList>
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {results.length === 0 ? <CommandEmpty>No results found.</CommandEmpty> : null}
              <CommandGroup heading="Companies">
                {results.filter(r => r.type === 'company').map(({ item }) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`company-${item.name}`}>
                    <Building className="mr-2 h-4 w-4" />
                    <span>{item.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Projects">
                {results.filter(r => r.type === 'project').map(({ item }) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`project-${item.name}`}>
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{item.name}</span>
                    <span className='text-xs text-muted-foreground ml-2'>in {item.companyName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Silos">
                {results.filter(r => r.type === 'silo').map(({ item }) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`silo-${item.name}`}>
                    <Box className="mr-2 h-4 w-4" />
                    <span>{item.name}</span>
                    <span className='text-xs text-muted-foreground ml-2'>in {item.projectName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Tasks">
                {results.filter(r => r.type === 'task').map(({ item }) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item.path)} value={`task-${item.title}`}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                    <span className='text-xs text-muted-foreground ml-2'>in {item.siloName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
