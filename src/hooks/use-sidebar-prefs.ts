'use client';

import { useSelectedWorkspace } from '@/app/(main)/layout';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { UserWorkspacePrefs, SidebarModule } from '@/lib/types';
import { useEffect } from 'react';

export const availableModules: (Omit<SidebarModule, 'order' | 'route' | 'hidden'> & {description: string})[] = [
    { id: 'files', label: 'Files', icon: 'Folder', description: 'Workspace filing system with folders.' },
    // Future modules can be added here
];

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
  
  const { data: prefs, isLoading, error } = useDoc<UserWorkspacePrefs>(prefsRef);

  useEffect(() => {
    if (!isLoading && !prefs && prefsRef && user && selectedWorkspace) {
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
  }, [isLoading, prefs, prefsRef, user, selectedWorkspace]);


  const addModule = async (moduleId: string) => {
    if (!prefsRef || !prefs || !selectedWorkspace) throw new Error("Preferences or workspace not loaded.");
    
    const moduleToAdd = availableModules.find(m => m.id === moduleId);
    if (!moduleToAdd) throw new Error("Module not found.");
    
    if (prefs.sidebarModules.some(m => m.id === moduleId)) {
      // Unhide if it exists but is hidden
      const newModules = prefs.sidebarModules.map(m => m.id === moduleId ? { ...m, hidden: false } : m);
      await setDoc(prefsRef, { sidebarModules: newModules, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      // Add new module
      const newModule: SidebarModule = {
        ...moduleToAdd,
        route: `/${moduleToAdd.id}`, // Adjust route logic if necessary
        hidden: false,
        order: prefs.sidebarModules.length,
      };
      await setDoc(prefsRef, { sidebarModules: [...prefs.sidebarModules, newModule], updatedAt: serverTimestamp() }, { merge: true });
    }
  };

  // Other functions like removeModule, reorderModules can be added here
  
  return { prefs, loading: isLoading, error, addModule };
};