# Saturn Sync - Project Context

This document provides a comprehensive overview of the Saturn Sync application, its architecture, data models, and core features. It serves as a central knowledge base for understanding the platform's inner workings and critical constraints.

## 1. App Overview
**Saturn Sync** is a premium digital agency management platform designed to streamline operations for marketing and creative agencies. It provides a multi-tenant environment (Workspaces) where teams can manage clients (Companies), projects, tasks, and social media presence in one unified interface.

## 2. Tech Stack
- **Framework**: Next.js 15 (App Router, Server Actions, Turbopack)
- **Language**: TypeScript
- **Backend/Hosting**: Firebase
    - **Authentication**: Firebase Auth (with multi-tenancy support)
    - **Database**: Cloud Firestore (NoSQL, Real-time)
    - **Storage**: Firebase Storage (Post media, workspace files)
    - **Hosting**: Firebase App Hosting
- **AI Integration**: Google Genkit (with Google GenAI)
- **Styling**: Tailwind CSS, Lucide React (Icons), Next-themes (Dark mode)
- **UI Components**: Radix UI (Base primitives), Custom Shadcn-like components
- **State Management**: React Hooks + Firestore Real-time Listeners
- **Utilities**: Zod (Validation), React Hook Form, Date-fns, Recharts (Analytics)

## 3. Architecture & Multi-Tenancy
Saturn Sync is built on a strong multi-tenant foundation:
- **Workspaces**: The top-level container. All data (companies, projects, tasks, files) belongs to a specific workspace.
- **Hierarchical Data**: Most data is nested under workspaces to ensure strict isolation and easier permission management.
- **Denormalization**: To optimize performance and reduce Firestore read costs, certain data is denormalized.
    - **User Tasks**: `user-tasks/{uid}/tasks` contains a flattened view of all tasks assigned to a specific user across different companies/projects.
- **Server/Client Hybrid**: Uses React Server Components for initial data fetching where possible, but relies heavily on Client Components for real-time Firestore updates and interactive UI.

## 4. Project Structure
- `src/app`: Next.js App Router folders and pages.
    - `(main)`: The core authenticated app area.
    - `(legal)`: Privacy policy, terms, etc.
- `src/components`: Reusable UI and layout components.
- `src/firebase`: Firebase initialization, providers, and custom hooks (`useDoc`, `useCollection`).
- `src/lib`: Core business logic, TypeScript types (`types.ts`), and utility functions.
- `src/ai`: AI logic using Genkit.
    - `flows`: Specific AI workflows (summaries, feedback, etc.).
- `src/hooks`: Custom React hooks for local state and preferences.

## 5. Core Data Models
Refer to `src/lib/types.ts` for the full definitions. Key types include:

### UserProfile
Stores basic user information and the list of workspaces they belong to.

### Workspace
Contains workspace metadata, member lists, and user roles (Admin, Contributor, Viewer).

### Company
Represents a client within a workspace. Contains social media integration metadata.

### Project
Belongs to a Company. Tracks progress, deadlines, and financial value.

### Silo
A Kanban-style column within a Project.

### Task
The atomic unit of work. Nested under `Silo`.
- **Fields**: `title`, `description`, `assigneeId`, `priority`, `dueDate`, `completed`, `timeSpentMinutes`.

### SocialPost
Metadata for scheduled social media content.
- **Platforms**: Facebook, Instagram, LinkedIn, X.
- **Statuses**: `draft`, `pending_approval`, `approved`, `scheduled`, `published`, `failed`, `rejected`.

## 6. Core Features & Logic

### CRM & Project Management
- Organizes work into Workspaces -> Companies -> Projects.
- Projects track real-time progress and monetary value based on associated sales.

### Task Management (Silos)
- Projects use "Silos" (columns) to organize tasks.
- **Quick Tasks**: A special `general-tasks` project with an `inbox` silo for rapid entry.
- **Denormalization Logic**: When a task is added/updated in the project hierarchy, it is automatically synced to the `user-tasks` collection for the assignee.

### Social Media Scheduler
- Allows drafting and scheduling posts across multiple platforms.
- Includes an approval workflow (Draft -> Pending -> Approved/Rejected).
- Media files are stored in Firebase Storage under a path-based hierarchy: `workspaces/{wsId}/companies/{coId}/socialMedia/`.

### AI Integration (Genkit)
- **Workspace Summaries**: Generates AI reports of team activity within a date range.
- **Smart Suggestions**: Suggests task completion details or descriptions.
- **Communication**: Assists in generating invite emails and feedback.

### Notifications & Presence
- **Presence**: Tracks user online status and cursor position within the workspace.
- **Notifications**: Real-time alerts for task assignments, completions, and comments.

## 7. Firebase Structure & Security

### Firestore Hierarchy
```
/users/{uid}
/workspaces/{workspaceId}
  /companies/{companyId}
    /projects/{projectId}
      /silos/{siloId}
        /tasks/{taskId}
          /comments/{commentId}
    /socialPosts/{postId}
    /socialAccounts/{accountId}
/user-tasks/{uid}/tasks/{taskId} (Denormalized)
/user-workspace-prefs/{uid-workspaceId}
/workspace-files/{fileId}
```

### Security Rule Principles
- **Authentication**: All sensitive data requires a signed-in user (`isSignedIn()`).
- **Workspace Isolation**: Access to workspace data is strictly restricted to users listed in the workspace's `memberIds`.
- **Role-Based Access**:
    - **Admins**: Can update workspace settings, manage social accounts, and delete files.
    - **Members**: Can read/write most project data.
    - **Resource Ownership**: Users can generally only update/delete resources they created (e.g., chat messages, comments).

## 8. Critical Constraints & "Do Not Break" Rules
1. **Multi-tenancy Isolation**: Always ensure `workspaceId` checks are performed in both security rules and frontend logic. Never leak data between workspaces.
2. **Task Denormalization**: Any modification to a `Task` must be mirrored in the `user-tasks` collection. Use `writeBatch` for atomicity.
3. **Data Types**: Firestore `Timestamps` are used for `createdAt`/`updatedAt`, while ISO 8601 strings are typically used for `dueDate` and `deadline`. Maintain this distinction.
4. **User Preferences**: User-specific settings like theme and accent color are synced via `user-workspace-prefs` and applied globally via CSS variables.
5. **Role Hierarchy**: Be mindful of `Admin` vs `Member` permissions. Restricted actions (like workspace settings) should always check `isWorkspaceAdmin`.

---
*Last Updated: 2026-04-22*
