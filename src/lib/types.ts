
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
  isTimeTrackingEnabled?: boolean;
  memberIds: string[];
  users: {
    [uid: string]: {
      role: 'admin' | 'contributor' | 'viewer';
      name: string | null;
      email: string | null;
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
  updatedAt?: any; // Firestore Timestamp
  socialIntegration?: {
    facebook?: {
      pageId: string | null;
      pageName: string | null;
      pageAccessToken: string | null;
      connectedBy: string | null;
      connectedAt: any; // Firestore Timestamp
    }
  }
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
  status: 'active' | 'completed' | 'archived';
  completedAt: any | null; // Firestore Timestamp
};

export type Silo = {
    id: string;
    name: string;
    order: number;
    createdBy: string;
    workspaceId: string;
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
    workspaceId: string;
    createdBy: string;
    updatedBy?: string;
    timeSpentMinutes?: number;
};

export type Comment = {
    id: string;
    text: string;
    createdBy: string;
    createdAt: any; // Can be a server timestamp
    parentCommentId?: string | null;
    author?: {
        name: string;
        avatarUrl?: string | null;
    }
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
    timeSpentMinutes?: number;
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
    id:string;
    type: 'task_assigned' | 'task_completed' | 'silo_added' | 'project_added' | 'company_added' | 'sale_added' | 'task_deleted' | 'silo_deleted' | 'project_deleted' | 'company_deleted' | 'comment_added';
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
        commentText?: string;
    };
    timestamp: {
        seconds: number;
        nanoseconds: number;
    };
    readBy: string[];
    isRelevantTo: string[];
}

export type Presence = {
    id: string;
    lastSeen: any; // Firestore Timestamp
    color: string;
    user: {
        name: string;
        avatarUrl: string | null;
    }
}
    
export type SidebarModule = {
  id: string;
  label: string;
  icon: string;
  route: string;
  hidden: boolean;
  order: number;
};

export type UserWorkspacePrefs = {
  id?: string;
  uid: string;
  workspaceId: string;
  sidebarModules: SidebarModule[];
  updatedAt?: any;
};

export type WorkspaceFile = {
    id: string;
    type: 'file' | 'folder';
    name: string;
    fullPath: string; // storage path
    parentPath: string;
    size?: number;
    mimeType?: string;
    downloadURL?: string;
    uploadedBy: string;
    createdAt: any; // Firestore Timestamp
    workspaceId: string;
};

export const SocialPlatforms = ["facebook", "instagram", "linkedin", "x"] as const;
export type SocialPlatform = typeof SocialPlatforms[number];

export const SocialPostStatus = ["draft", "pending_approval", "approved", "scheduled", "published", "failed", "rejected"] as const;
export type SocialPostStatusType = typeof SocialPostStatus[number];

export type SocialPost = {
    id: string;
    companyId: string;
    workspaceId: string;
    createdByUserId: string;
    scheduledAt: any; // Firestore Timestamp
    platforms: SocialPlatform[];
    captionDefault: string;
    captionFacebook?: string;
    captionInstagram?: string;
    captionLinkedin?: string;
    captionX?: string;
    media: {
        fileUrl: string;
        fileName: string;
        fileType: 'image' | 'video';
    }[];
    status: SocialPostStatusType;
    rejectionReason?: string | null;
    errorMessage?: string | null;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export const SocialAccountStatus = ["connected", "expired", "revoked"] as const;
export type SocialAccountStatusType = typeof SocialAccountStatus[number];

export type SocialAccount = {
    id: string;
    companyId: string;
    workspaceId: string;
    platform: SocialPlatform;
    accountName: string; // e.g., "Acme Inc. Facebook Page"
    accountId: string;   // e.g., the page ID from the platform
    accessToken: string; // Encrypted or placeholder
    refreshToken?: string; // Encrypted or placeholder
    status: SocialAccountStatusType;
    expiresAt?: any; // Firestore Timestamp
}
