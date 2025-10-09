export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'admin' | 'contributor' | 'viewer';
};

export type Task = {
  id: string;
  name: string;
  siloId: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  relatedDocuments?: string[];
};

export type Silo = {
  id: string;
  name: string;
  projectId: string;
  tasks: Task[];
};

export type Project = {
  id: string;
  name: string;
  companyId: string;
  silos: Silo[];
  turnoverTarget?: number;
  currentTurnover?: number;
};

export type Company = {
  id: string;
  name: string;
  workspaceId: string;
  projects: Project[];
};

export type Workspace = {
  id: string;
  name: string;
  users: User[];
  companies: Company[];
};

export type AppData = {
  workspaces: Workspace[];
  currentUser: User;
};
