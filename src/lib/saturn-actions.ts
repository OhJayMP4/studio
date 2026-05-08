'use client';

import { addDoc, collection, getDocs, getDoc, doc, query, where, serverTimestamp, Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Workspace } from './types';
import { addTask } from './tasks';

export type SaturnActionType = 'create_task' | 'create_silo' | 'create_company' | 'create_project';

export type SaturnAction = {
  type: SaturnActionType;
  data: Record<string, any>;
};

export function parseSaturnResponse(raw: string): { content: string; action: SaturnAction | null } {
  const match = raw.match(/__SATURN_ACTION__(\{[\s\S]+\})$/);
  if (!match) return { content: raw.trim(), action: null };
  try {
    const action = JSON.parse(match[1]) as SaturnAction;
    const content = raw.replace(/__SATURN_ACTION__[\s\S]+$/, '').trim();
    return { content, action };
  } catch {
    return { content: raw.trim(), action: null };
  }
}

async function findCompanyByName(
  firestore: Firestore,
  workspaceId: string,
  companyName: string,
): Promise<{ companyId: string; companyData: any } | null> {
  const snap = await getDocs(collection(firestore, 'workspaces', workspaceId, 'companies'));
  const match = snap.docs.find(d =>
    (d.data().name as string).toLowerCase().trim() === companyName.toLowerCase().trim()
  );
  if (!match) return null;
  return { companyId: match.id, companyData: match.data() };
}

async function findProjectId(
  firestore: Firestore,
  workspaceId: string,
  companyId: string,
  projectName: string,
): Promise<{ projectId: string; projectData: any } | null> {
  const snap = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects'),
      where('name', '==', projectName),
    )
  );
  if (snap.empty) return null;
  return { projectId: snap.docs[0].id, projectData: snap.docs[0].data() };
}

async function findOrFirstSilo(
  firestore: Firestore,
  workspaceId: string,
  companyId: string,
  projectId: string,
  siloName?: string,
): Promise<{ siloId: string; siloData: any } | null> {
  const snap = await getDocs(
    collection(firestore, 'workspaces', workspaceId, 'companies', companyId, 'projects', projectId, 'silos')
  );
  if (snap.empty) return null;
  const sorted = snap.docs.sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0));
  if (!siloName) return { siloId: sorted[0].id, siloData: sorted[0].data() };
  const match = snap.docs.find(d => d.data().name.toLowerCase() === siloName.toLowerCase());
  return match
    ? { siloId: match.id, siloData: match.data() }
    : { siloId: sorted[0].id, siloData: sorted[0].data() };
}

export async function executeSaturnAction(
  action: SaturnAction,
  opts: { firestore: Firestore; user: User; selectedWorkspace: Workspace },
): Promise<string> {
  const { firestore, user, selectedWorkspace } = opts;
  const wid = selectedWorkspace.id;

  switch (action.type) {

    case 'create_task': {
      const { title, companyName, projectName, siloName, priority, dueDate, description, assigneeName } = action.data;

      const company = await findCompanyByName(firestore, wid, companyName);
      if (!company) throw new Error(`Company "${companyName}" not found in this workspace.`);

      const project = await findProjectId(firestore, wid, company.companyId, projectName);
      if (!project) throw new Error(`Project "${projectName}" not found under "${companyName}".`);

      const silo = await findOrFirstSilo(firestore, wid, company.companyId, project.projectId, siloName);
      if (!silo) throw new Error(`No silos found in "${projectName}". Please create a silo first.`);

      let assigneeId = user.uid;
      if (assigneeName) {
        const wsUsers = selectedWorkspace.users || {};
        const nameLower = assigneeName.toLowerCase();

        // First pass: match against denormalized workspace user record
        const wsMatch = Object.entries(wsUsers).find(([_, u]) =>
          (u.name || '').toLowerCase().includes(nameLower) ||
          (u.email || '').toLowerCase().includes(nameLower)
        );

        if (wsMatch) {
          assigneeId = wsMatch[0];
        } else {
          // Second pass: fetch real user profiles — workspace copy may be stale or null
          const profileResults = await Promise.all(
            Object.keys(wsUsers).map(async uid => {
              try {
                const snap = await getDoc(doc(firestore, 'users', uid));
                const p = snap.data();
                return { uid, name: (p?.name || '').toLowerCase(), email: (p?.email || '').toLowerCase() };
              } catch { return null; }
            })
          );
          const profileMatch = profileResults.find(p =>
            p && (p.name.includes(nameLower) || p.email.includes(nameLower))
          );
          if (profileMatch) assigneeId = profileMatch.uid;
        }
      }

      await addTask(firestore, {
        workspaceId: wid,
        companyId: company.companyId,
        projectId: project.projectId,
        siloId: silo.siloId,
        taskData: {
          title,
          description: description || '',
          dueDate: new Date(dueDate).toISOString(),
          priority: priority || 'medium',
          assigneeId,
          completed: false,
          createdBy: user.uid,
        },
      });

      const assigneeLabel = assigneeName || 'you';
      return `Task **"${title}"** was created in **${companyName} / ${projectName}** → ${silo.siloData.name}, assigned to ${assigneeLabel}.`;
    }

    case 'create_silo': {
      const { name, companyName, projectName } = action.data;

      const company = await findCompanyByName(firestore, wid, companyName);
      if (!company) throw new Error(`Company "${companyName}" not found.`);

      const project = await findProjectId(firestore, wid, company.companyId, projectName);
      if (!project) throw new Error(`Project "${projectName}" not found.`);

      const silosCol = collection(firestore, 'workspaces', wid, 'companies', company.companyId, 'projects', project.projectId, 'silos');
      const existing = await getDocs(silosCol);

      await addDoc(silosCol, {
        name,
        order: existing.size,
        workspaceId: wid,
        createdBy: user.uid,
      });

      return `Silo **"${name}"** was created in **${companyName} / ${projectName}**.`;
    }

    case 'create_company': {
      const { name, description } = action.data;

      await addDoc(collection(firestore, 'workspaces', wid, 'companies'), {
        name,
        description: description || '',
        workspaceId: wid,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      return `Company **"${name}"** has been added to the workspace.`;
    }

    case 'create_project': {
      const { name, companyName, deadline, hasMonetaryValue, monetaryValue } = action.data;

      const company = await findCompanyByName(firestore, wid, companyName);
      if (!company) throw new Error(`Company "${companyName}" not found.`);

      await addDoc(collection(firestore, 'workspaces', wid, 'companies', company.companyId, 'projects'), {
        name,
        companyId: company.companyId,
        workspaceId: wid,
        deadline: new Date(deadline).toISOString(),
        hasMonetaryValue: !!hasMonetaryValue,
        monetaryValue: hasMonetaryValue ? (monetaryValue || 0) : null,
        progress: 0,
        totalSalesValue: 0,
        status: 'active',
        createdBy: user.uid,
      });

      return `Project **"${name}"** was created under **${companyName}** with deadline ${deadline}.`;
    }

    default:
      throw new Error('Unknown action type.');
  }
}

export async function resolveNavigationPath(
  firestore: Firestore,
  workspaceId: string,
  companyName?: string,
  projectName?: string,
): Promise<string | null> {
  if (!companyName) return null;
  const company = await findCompanyByName(firestore, workspaceId, companyName);
  if (!company) return null;
  if (!projectName) return `/company/${company.companyId}`;
  const project = await findProjectId(firestore, workspaceId, company.companyId, projectName);
  if (!project) return `/company/${company.companyId}`;
  return `/company/${company.companyId}/project/${project.projectId}`;
}

export const ACTION_LABELS: Record<SaturnActionType, string> = {
  create_task: 'Create Task',
  create_silo: 'Create Silo',
  create_company: 'Add Company',
  create_project: 'Create Project',
};

export const ACTION_ICONS: Record<SaturnActionType, string> = {
  create_task: '📋',
  create_silo: '🗂',
  create_company: '🏢',
  create_project: '📁',
};

export const ACTION_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  name: 'Name',
  companyName: 'Company',
  projectName: 'Project',
  siloName: 'Silo',
  priority: 'Priority',
  dueDate: 'Due Date',
  deadline: 'Deadline',
  description: 'Description',
  assigneeName: 'Assignee',
  hasMonetaryValue: 'Has Value',
  monetaryValue: 'Value (ZAR)',
};
