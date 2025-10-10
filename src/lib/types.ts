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
  name: string;
  description: string;
  logoUrl?: string;
  yearlyTurnoverTarget?: number;
};
