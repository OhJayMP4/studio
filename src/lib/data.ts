import type { AppData, Company, Project, Silo, Task, Workspace } from './types';
import fs from 'fs';
import path from 'path';

// Path to the JSON file that acts as a simple database.
const dbPath = path.join(process.cwd(), 'src', 'lib', 'db.json');

// Function to read data from the database file.
const readData = (): AppData => {
  if (!fs.existsSync(dbPath)) {
    // If the file doesn't exist, create it with initial data.
    writeData(initialMockData);
    return initialMockData;
  }
  const fileContent = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(fileContent);
};

// Function to write data to the database file.
const writeData = (data: AppData) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
};

// The initial data structure, used if the db.json file doesn't exist.
const initialMockData: AppData = {
  currentUser: {
    id: 'user-1',
    name: 'Alex Doe',
    email: 'alex.doe@example.com',
    avatarUrl: 'https://picsum.photos/seed/user-1/100/100',
    role: 'admin',
  },
  workspaces: [
    {
      id: 'ws-1',
      name: 'Q4 Innovations',
      users: [
        { id: 'user-1', name: 'Alex Doe', email: 'alex.doe@example.com', avatarUrl: 'https://picsum.photos/seed/user-1/100/100', role: 'admin' },
        { id: 'user-2', name: 'Jane Smith', email: 'jane.smith@example.com', avatarUrl: 'https://picsum.photos/seed/user-2/100/100', role: 'contributor' },
        { id: 'user-3', name: 'Bob Johnson', email: 'bob.j@example.com', avatarUrl: 'https://picsum.photos/seed/user-3/100/100', role: 'viewer' },
      ],
      companies: [
        {
          id: 'comp-1',
          name: 'FutureScape',
          workspaceId: 'ws-1',
          projects: [
            {
              id: 'proj-1a',
              name: 'Project Phoenix',
              companyId: 'comp-1',
              turnoverTarget: 500000,
              currentTurnover: 275000,
              silos: [
                {
                  id: 'silo-1a1',
                  name: 'Marketing',
                  projectId: 'proj-1a',
                  tasks: [
                    { id: 'task-1', name: 'Launch social media campaign', siloId: 'silo-1a1', completed: true, priority: 'high', description: 'Plan and execute a new social media campaign for Q4.' },
                    { id: 'task-2', name: 'Design new ad creatives', siloId: 'silo-1a1', completed: false, priority: 'medium', description: 'Create 10 new ad variations for A/B testing.' },
                    { id: 'task-3', name: 'Analyze Q3 campaign results', siloId: 'silo-1a1', completed: true, priority: 'low' },
                  ],
                },
                {
                  id: 'silo-1a2',
                  name: 'Development',
                  projectId: 'proj-1a',
                  tasks: [
                    { id: 'task-4', name: 'Develop new landing page', siloId: 'silo-1a2', completed: true, priority: 'high' },
                    { id: 'task-5', name: 'Fix login authentication bug', siloId: 'silo-1a2', completed: false, priority: 'high', description: 'Users are reporting being unable to log in via Google SSO.' },
                    { id: 'task-6', name: 'Refactor database schema', siloId: 'silo-1a2', completed: false, priority: 'medium' },
                  ],
                },
              ],
            },
            {
              id: 'proj-1b',
              name: 'Project Titan',
              companyId: 'comp-1',
              turnoverTarget: 1200000,
              currentTurnover: 950000,
              silos: [
                {
                  id: 'silo-1b1',
                  name: 'Client Outreach',
                  projectId: 'proj-1b',
                  tasks: [
                    { id: 'task-7', name: 'Onboard new enterprise client', siloId: 'silo-1b1', completed: false, priority: 'high' },
                  ]
                }
              ]
            }
          ],
        },
        {
          id: 'comp-2',
          name: 'Innovate LLC',
          workspaceId: 'ws-1',
          projects: [
            {
              id: 'proj-2a',
              name: 'Internal Tools',
              companyId: 'comp-2',
              silos: [
                {
                  id: 'silo-2a1',
                  name: 'HR Platform',
                  projectId: 'proj-2a',
                  tasks: [
                    { id: 'task-8', name: 'Implement vacation request form', siloId: 'silo-2a1', completed: true, priority: 'medium' },
                  ]
                }
              ]
            }
          ]
        },
      ],
    },
    {
      id: 'ws-2',
      name: 'Personal Projects',
      users: [
        { id: 'user-1', name: 'Alex Doe', email: 'alex.doe@example.com', avatarUrl: 'https://picsum.photos/seed/user-1/100/100', role: 'admin' },
      ],
      companies: []
    }
  ],
};


// --- Data Access Functions ---

export const getCurrentUser = () => {
    const data = readData();
    return data.currentUser;
};

export const getWorkspaces = () => {
    const data = readData();
    return data.workspaces;
};

export const getWorkspaceById = (id: string) => {
    const data = readData();
    return data.workspaces.find(ws => ws.id === id);
};

export const getCompanyById = (wsId: string, compId: string) => {
    const workspace = getWorkspaceById(wsId);
    return workspace?.companies.find(c => c.id === compId);
};

export const getProjectById = (wsId: string, compId: string, projId: string) => {
    const company = getCompanyById(wsId, compId);
    return company?.projects.find(p => p.id === projId);
};

export const getSiloById = (wsId: string, compId: string, projId: string, siloId: string) => {
    const project = getProjectById(wsId, compId, projId);
    return project?.silos.find(s => s.id === siloId);
};

export const getAllCompanies = () => {
    const data = readData();
    return data.workspaces.flatMap(ws => ws.companies);
}

export const getAllProjects = () => {
    return getAllCompanies().flatMap(c => c.projects);
}

export const getAllSilos = () => {
    return getAllProjects().flatMap(p => p.silos);
}

// --- Data Mutation Functions ---

export const addCompany = (workspaceId: string, companyName: string) => {
    const data = readData();
    const workspace = data.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return;
    const newCompany: Company = {
        id: `comp-${Date.now()}`,
        name: companyName,
        workspaceId,
        projects: [],
    };
    workspace.companies.push(newCompany);
    writeData(data);
};

export const addProject = (workspaceId: string, companyId: string, projectName: string) => {
    const data = readData();
    const company = data.workspaces
        .find(ws => ws.id === workspaceId)?.companies
        .find(c => c.id === companyId);
    if (!company) return;
    const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: projectName,
        companyId,
        silos: [],
    };
    company.projects.push(newProject);
    writeData(data);
};

export const addSilo = (workspaceId: string, companyId: string, projectId: string, siloName: string) => {
    const data = readData();
    const project = data.workspaces
        .find(ws => ws.id === workspaceId)?.companies
        .find(c => c.id === companyId)?.projects
        .find(p => p.id === projectId);
    if (!project) return;
    const newSilo: Silo = {
        id: `silo-${Date.now()}`,
        name: siloName,
        projectId,
        tasks: [],
    };
    project.silos.push(newSilo);
    writeData(data);
};

export const addTask = (workspaceId: string, companyId: string, projectId: string, siloId: string, task: Omit<Task, 'id' | 'siloId'>) => {
    const data = readData();
    const silo = data.workspaces
        .find(ws => ws.id === workspaceId)?.companies
        .find(c => c.id === companyId)?.projects
        .find(p => p.id === projectId)?.silos
        .find(s => s.id === siloId);
    if (!silo) return;
    const newTask: Task = {
        ...task,
        id: `task-${Date.now()}`,
        siloId,
    };
    silo.tasks.push(newTask);
    writeData(data);
}


// Helper function to calculate completion percentages
export const calculateCompletion = (items: { completed: boolean }[] | { silos: { tasks: { completed: boolean }[] }[] } | { projects: { silos: { tasks: { completed: boolean }[] }[] }[] }) => {
  let tasks: { completed: boolean }[] = [];

  if (Array.isArray(items) && items.length > 0 && 'completed' in items[0]) {
    tasks = items as { completed: boolean }[];
  } else if (typeof items === 'object' && items !== null && 'silos' in items) {
    const project = items as { silos: { tasks: { completed: boolean }[] }[] };
    tasks = project.silos.flatMap(silo => silo.tasks);
  } else if (typeof items === 'object' && items !== null && 'projects' in items) {
    const company = items as { projects: { silos: { tasks: { completed: boolean }[] }[] }[] };
    tasks = company.projects.flatMap(project => project.silos.flatMap(silo => silo.tasks));
  }


  if (tasks.length === 0) return 0;
  const completedTasks = tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / tasks.length) * 100);
};
