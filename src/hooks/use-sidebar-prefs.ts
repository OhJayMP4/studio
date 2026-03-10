'use client';

import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import type { UserWorkspacePrefs, SidebarModule } from '@/lib/types';
import { useEffect, useMemo } from 'react';

export const availableModules: (Omit<SidebarModule, 'order' | 'hidden'> & {description: string})[] = [
    { id: 'files', label: 'Files', icon: 'Folder', route: '/files', description: 'Workspace filing system with folders.' },
    { id: 'social-scheduler', label: 'Social Scheduler', icon: 'CalendarDays', route: '/social-scheduler', description: 'Plan and schedule social media posts.' },
    { id: 'social-accounts', label: 'Social Accounts', icon: 'Settings2', route: '/admin/social-accounts', description: 'Manage connected social media accounts.' },
];

const coreModuleIds = ['dashboard', 'companies', 'reporting', 'my-tasks'];

const defaultSidebarModules: SidebarModule[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard', hidden: false, order: 0 },
    { id: 'companies', label: 'Companies', icon: 'Building', route: '/companies', hidden: false, order: 1 },
    { id: 'reporting', label: 'Reporting', icon: 'BarChart', route: '/reporting', hidden: false, order: 2 },
    { id: 'my-tasks', label: 'My Tasks', icon: 'ClipboardCheck', route: '/my-tasks', hidden: false, order: 3 },
]

export const useSidebarPrefs = () => {
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const firestore = useFirestore();

  const docId = user && selectedWorkspace ? `${user.uid}-${selectedWorkspace.id}` : null;
  const prefsRef = useMemoFirebase(() => docId ? doc(firestore, 'user-workspace-prefs', docId) : null, [firestore, docId]);
  
  const { data: rawPrefs, isLoading, error } = useDoc<UserWorkspacePrefs>(prefsRef);

  useEffect(() => {
    if (!isLoading && !rawPrefs && prefsRef && user && selectedWorkspace) {
        const createDefaultPrefs = async () => {
            try {
                // Double check it doesn't exist before writing to avoid race conditions
                const docSnap = await getDoc(prefsRef);
                if (!docSnap.exists()) {
                     await setDoc(prefsRef, {
                        uid: user.uid,
                        workspaceId: selectedWorkspace.id,
                        sidebarModules: defaultSidebarModules,
                        updatedAt: serverTimestamp(),
                    });
                }
            } catch (e) {
                console.error("Failed to create default sidebar preferences:", e);
            }
        };
        createDefaultPrefs();
    }
  }, [isLoading, rawPrefs, prefsRef, user, selectedWorkspace]);
  
  const prefs = useMemo(() => {
    if (!rawPrefs) return null;
    
    // Self-healing: Fix incorrect routes and ensure core modules are visible
    const correctedModules = rawPrefs.sidebarModules.map(module => {
        // 1. Ensure core modules are never hidden
        if (coreModuleIds.includes(module.id)) {
            return { ...module, hidden: false };
        }
        
        // 2. Ensure routes match current master definitions (fixes the /admin/ prefix bug)
        const masterModule = availableModules.find(am => am.id === module.id);
        if (masterModule && masterModule.route !== module.route) {
            return { ...module, route: masterModule.route };
        }
        
        return module;
    });
    
    return { ...rawPrefs, sidebarModules: correctedModules };
  }, [rawPrefs]);


  const addModule = async (moduleId: string) => {
    if (!prefsRef || !prefs || !selectedWorkspace) throw new Error("Preferences or workspace not loaded.");
    
    const moduleToAdd = availableModules.find(m => m.id === moduleId);
    if (!moduleToAdd) throw new Error("Module not found.");
    
    if (prefs.sidebarModules.some(m => m.id === moduleId)) {
      // Unhide if it exists but is hidden
      const newModules = prefs.sidebarModules.map(m => m.id === moduleId ? { ...m, hidden: false } : m);
      await updateDoc(prefsRef, { sidebarModules: newModules, updatedAt: serverTimestamp() });
    } else {
      // Add new module using its defined route
      const newModule: SidebarModule = {
        ...moduleToAdd,
        hidden: false,
        order: prefs.sidebarModules.length,
      };
      await updateDoc(prefsRef, { sidebarModules: [...prefs.sidebarModules, newModule], updatedAt: serverTimestamp() });
    }
  };

  const setModuleHidden = async (moduleId: string, hidden: boolean) => {
    if (!prefsRef || !prefs) throw new Error("Preferences not loaded.");
    if (coreModuleIds.includes(moduleId)) {
        console.warn("Attempted to hide a core module. This action is blocked.");
        return;
    }

    const newModules = prefs.sidebarModules.map(m => 
      m.id === moduleId ? { ...m, hidden } : m
    );

    await updateDoc(prefsRef, {
      sidebarModules: newModules,
      updatedAt: serverTimestamp(),
    });
  };
  
  return { prefs, loading: isLoading, error, addModule, setModuleHidden };
};
