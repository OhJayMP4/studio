'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { collection, getDocs } from 'firebase/firestore';
import type { Company, Project, Silo, Task } from '@/lib/types';
import { Search, Building, Folder, Box, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ResultType = 'company' | 'project' | 'silo' | 'task';

type SearchResult =
  | { type: 'company'; id: string; label: string; sublabel: null; path: string }
  | { type: 'project'; id: string; label: string; sublabel: string; path: string }
  | { type: 'silo'; id: string; label: string; sublabel: string; path: string }
  | { type: 'task'; id: string; label: string; sublabel: string; path: string };

// How many matches to actually render per group before summarizing the rest.
// Large workspaces can easily have 100+ matching tasks for a common term, and
// dumping all of them into the dropdown makes it unreadable, so we show the
// strongest matches and let the heading count communicate the full scale.
const MAX_VISIBLE_PER_GROUP = 6;

const GROUP_CONFIG: { type: ResultType; heading: string; icon: typeof Building }[] = [
  { type: 'company', heading: 'Companies', icon: Building },
  { type: 'project', heading: 'Projects', icon: Folder },
  { type: 'silo', heading: 'Silos', icon: Box },
  { type: 'task', heading: 'Tasks', icon: CheckSquare },
];

// Ranks a candidate string against the typed query: exact match first, then
// "starts with", then "contains anywhere". Returns -1 for no match at all.
function matchRank(candidate: string, needle: string): number {
  const c = candidate.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return 0;
  if (c === n) return 3;
  if (c.startsWith(n)) return 2;
  if (c.includes(n)) return 1;
  return -1;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [silos, setSilos] = useState<(Silo & { projectId: string; companyId: string })[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();
  const router = useRouter();

  const fetchedForWorkspaceRef = useRef<string | null>(null);

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
    if (!open || !selectedWorkspace || !firestore) return;

    // Only refetch when this workspace's data hasn't been loaded yet for this
    // session, or the user switched workspaces. Avoids re-running on every
    // keystroke and avoids showing stale data from a previously selected workspace.
    if (fetchedForWorkspaceRef.current === selectedWorkspace.id) return;

    let cancelled = false;

    const fetchSearchData = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const workspaceId = selectedWorkspace.id;

        // Firestore can't validate collection-group `list` queries when the rule
        // needs a get() call for membership (confirmed empirically — it denies the
        // request outright regardless of whether the check is keyed by path or by
        // field). So this stays as nested queries scoped by the real, known
        // workspace path, which Firestore can always prove — just run in parallel
        // "waves" per tree depth instead of the old fully-sequential N+1 walk.
        const companiesRef = collection(firestore, 'workspaces', workspaceId, 'companies');
        const companiesSnap = await getDocs(companiesRef);
        const fetchedCompanies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Company));

        const projectsPerCompany = await Promise.all(
          fetchedCompanies.map(async (company) => {
            const projectsRef = collection(companiesRef, company.id, 'projects');
            const snap = await getDocs(projectsRef);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
          })
        );
        const fetchedProjects = projectsPerCompany.flat();

        const silosPerProject = await Promise.all(
          fetchedProjects.map(async (project) => {
            const silosRef = collection(
              firestore,
              'workspaces', workspaceId,
              'companies', project.companyId,
              'projects', project.id,
              'silos'
            );
            const snap = await getDocs(silosRef);
            return snap.docs.map((d) => ({
              ...(d.data() as Silo),
              id: d.id,
              projectId: project.id,
              companyId: project.companyId,
            }));
          })
        );
        const fetchedSilos = silosPerProject.flat();

        const tasksPerSilo = await Promise.all(
          fetchedSilos.map(async (silo) => {
            const tasksRef = collection(
              firestore,
              'workspaces', workspaceId,
              'companies', silo.companyId,
              'projects', silo.projectId,
              'silos', silo.id,
              'tasks'
            );
            const snap = await getDocs(tasksRef);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
          })
        );
        const fetchedTasks = tasksPerSilo.flat();

        if (cancelled) return;

        fetchedForWorkspaceRef.current = workspaceId;
        setCompanies(fetchedCompanies);
        setProjects(fetchedProjects);
        setSilos(fetchedSilos);
        setTasks(fetchedTasks);
      } catch (error: any) {
        console.error('Global search failed:', error);
        setLoadError(true);
        if (error?.code === 'permission-denied') {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({ operation: 'list', path: `workspaces/${selectedWorkspace.id}` })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSearchData();

    return () => {
      cancelled = true;
    };
  }, [open, selectedWorkspace, firestore]);

  const groupedResults = useMemo(() => {
    const q = rawQuery.trim();

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const projectById = new Map(projects.map((p) => [p.id, p]));

    const rank = <T,>(items: T[], text: (item: T) => string) =>
      items
        .map((item) => ({ item, rank: matchRank(text(item), q) }))
        .filter((x) => x.rank >= 0)
        .sort((a, b) => b.rank - a.rank);

    const companyResults: SearchResult[] = rank(companies, (c) => c.name).map(({ item }) => ({
      type: 'company',
      id: item.id,
      label: item.name,
      sublabel: null,
      path: `company/${item.id}`,
    }));

    const projectResults: SearchResult[] = rank(projects, (p) => p.name).map(({ item }) => ({
      type: 'project',
      id: item.id,
      label: item.name,
      sublabel: companyById.get(item.companyId)?.name ?? 'Unknown company',
      path: `company/${item.companyId}/project/${item.id}`,
    }));

    const siloResults: SearchResult[] = rank(silos, (s) => s.name).map(({ item }) => ({
      type: 'silo',
      id: item.id,
      label: item.name,
      sublabel: projectById.get(item.projectId)?.name ?? 'Unknown project',
      path: `company/${item.companyId}/project/${item.projectId}`,
    }));

    const taskResults: SearchResult[] = rank(tasks, (t) => t.title).map(({ item }) => {
      const project = projectById.get(item.projectId);
      return {
        type: 'task',
        id: item.id,
        label: item.title,
        sublabel: project ? `in ${project.name}` : 'Unknown project',
        path: project ? `company/${project.companyId}/project/${project.id}` : '',
      };
    });

    return {
      company: companyResults,
      project: projectResults,
      silo: siloResults,
      task: taskResults,
    } as Record<ResultType, SearchResult[]>;
  }, [rawQuery, companies, projects, silos, tasks]);

  const totalMatches = Object.values(groupedResults).reduce((sum, list) => sum + list.length, 0);

  const onSelect = (path: string) => {
    if (!path) return;
    router.push(`/${path}`);
    setOpen(false);
  };

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
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <DialogTitle>
          <VisuallyHidden>Global Search</VisuallyHidden>
        </DialogTitle>
        <CommandInput
          placeholder="Search for companies, projects, silos, tasks..."
          value={rawQuery}
          onValueChange={setRawQuery}
        />
        <CommandList>
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : loadError ? (
            <div className="p-4 text-center text-sm text-destructive">
              Couldn't load search data. Try reopening search.
            </div>
          ) : (
            <>
              {totalMatches === 0 && <CommandEmpty>No results found.</CommandEmpty>}
              {GROUP_CONFIG.map(({ type, heading, icon: Icon }) => {
                const items = groupedResults[type];
                if (items.length === 0) return null;
                const visible = items.slice(0, MAX_VISIBLE_PER_GROUP);
                const hiddenCount = items.length - visible.length;

                return (
                  <CommandGroup key={type} heading={`${heading} (${items.length})`}>
                    {visible.map((result) => (
                      <CommandItem
                        key={result.id}
                        onSelect={() => onSelect(result.path)}
                        value={`${type}-${result.id}`}
                      >
                        <Icon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{result.label}</span>
                        {result.sublabel && (
                          <span className="text-xs text-muted-foreground ml-2 truncate">
                            {result.sublabel}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                    {hiddenCount > 0 && (
                      <div className={cn('px-2 py-1.5 text-xs text-muted-foreground')}>
                        +{hiddenCount} more {heading.toLowerCase()} matched — refine your search to narrow down
                      </div>
                    )}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
