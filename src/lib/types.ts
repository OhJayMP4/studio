export type UserProfile = {
  uid: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  workspaceIds?: string[];
};

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  logoUrl?: string | null;
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
  workspaceId: string;
  createdBy: string;
};

export type Project = {
  id: string;
  name: string;
  deadline: string; // ISO 8601 date string
  hasMonetaryValue: boolean;
  monetaryValue?: number;
  progress: number;
  companyId: string;
  workspaceId: string;
  totalSalesValue: number;
  createdBy: string;
};

export type Silo = {
    id: string;
    name: string;
    order: number;
    createdBy: string;
};

export type Task = {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate: string; // ISO 8601 date string
    priority: 'low' | 'medium' | 'high';
    assigneeId: string;
    projectId: string; 
    createdBy: string;
    updatedBy?: string;
};

export type UserTask = {
    id: string; // This will be the denormalized doc ID
    originalTaskId: string;
    workspaceId: string;
    companyId: string;
    projectId: string;
    siloId: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    assigneeId: string;
    companyName: string;
    projectName: string;
    siloName: string;
}

export type Sale = {
    id: string;
    date: string; // ISO 8601 date string
    source: string;
    value: number;
    projectId: string;
    createdBy: string;
}

export type Invite = {
    id: string;
    workspaceId: string;
    email: string;
    token: string;
    expires: number; // Unix timestamp
}

export type Notification = {
    id: string;
    type: 'task_assigned' | 'task_completed' | 'silo_added' | 'project_added' | 'company_added' | 'sale_added' | 'task_deleted' | 'silo_deleted' | 'project_deleted' | 'company_deleted';
    actorUid: string;
    actorName: string;
    target: {
        id: string;
        name: string;
        type: string;
        path: string;
    };
    assignee?: {
        uid: string;
        name: string;
    };
    context?: {
        companyName?: string;
        projectName?: string;
        siloName?: string;
    };
    timestamp: {
        seconds: number;
        nanoseconds: number;
    };
    readBy: string[];
    isRelevantTo: string[];
}
    
