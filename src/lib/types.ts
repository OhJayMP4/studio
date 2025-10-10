export type UserProfile = {
  uid: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  users: {
    [uid: string]: {
      role: 'admin' | 'contributor' | 'viewer';
      name: string | null;
      avatarUrl: string | null;
    };
  };
};

export type Company = {
  id: string;
  name:string;
  description: string;
  logoUrl?: string;
  yearlyTurnoverTarget?: number;
};

export type Project = {
  id: string;
  name: string;
  deadline: string; // ISO 8601 date string
  hasMonetaryValue: boolean;
  monetaryValue?: number;
  progress: number;
  companyId: string;
  totalSalesValue: number;
};

export type Silo = {
    id: string;
    name: string;
    order: number;
};

export type Task = {
    id: string;
    title: string;
    completed: boolean;
    dueDate: string; // ISO 8601 date string
    priority: 'low' | 'medium' | 'high';
    assigneeId: string;
    projectId: string; // Added to link task to project
};

export type UserTask = {
    id: string; // This will be the denormalized doc ID
    originalTaskId: string;
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    task: Omit<Task, 'id'>;
    project: Omit<Project, 'id'>;
}

export type Sale = {
    id: string;
    date: string; // ISO 8601 date string
    source: string;
    value: number;
    projectId: string;
}

    