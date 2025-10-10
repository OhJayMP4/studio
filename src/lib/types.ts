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
  tasks?: Task[]; // Now optional as it's a subcollection
};

export type Project = {
  id: string;
  name: string;
  companyId: string;
  silos?: Silo[]; // Now optional as it's a subcollection
};

export type Company = {
  id: string;
  name: string;
  workspaceId: string;
  projects?: Project[]; // Now optional as it's a subcollection
};

export type WorkspaceUser = {
    userId: string;
    role: 'admin' | 'contributor' | 'viewer';
    name: string;
    email: string | null;
    avatarUrl?: string | null;
}

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  users?: { [key: string]: WorkspaceUser }; // Changed from User[] to a map
  companies?: Company[]; // Now optional as it's a subcollection
};

// This represents the top-level user profile stored in the /users collection
export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export type AppData = {
  workspaces: Workspace[];
  currentUser: User;
};
