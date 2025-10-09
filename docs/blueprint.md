# **App Name**: SaturnSync

## Core Features:

- Workspace and User Management: Create and manage workspaces with role-based access control (admin, contributor, viewer) and invitation system. Real-time updates on workspace activities.
- Hierarchical Data Structure: Support a nested data model: Workspaces > Companies > Projects > Silos > Tasks. Includes automated completion percentage calculations at each level as well as a search functionality.
- Real-Time Collaboration: Enable multiple users to collaborate on tasks and projects in real-time with synchronized updates and change notifications.
- Global Quick Task Add: Implement a global modal/FAB to quickly add tasks from anywhere within the application. Includes dynamic dropdowns to select the parent Company > Project > Silo.
- Archiving Functionality: Provide admin-only functionality to archive completed tasks, silos, and projects, moving them to a separate archive collection.
- Report Generation: Generate reports including PDF overviews and live link reports (shareable URL with read-only access), offering visual representations of data (completion rates, turnover vs. target, etc.)
- AI-Powered Suggestion Tool for Task Completion: LLM-powered tool to evaluate the current task, and suggest supporting information from related documents or external resources in order to assist the user in task completion.

## Style Guidelines:

- Primary color: Deep sky blue (#FF6812), evoking clarity and focus.
- Background color: Very light cyan (#2E2F2E) for a clean, unobtrusive backdrop.
- Accent color: Emerald green (#F7E9D7) to highlight actionable items and success.
- Font pairing: 'Space Grotesk' (sans-serif) for headings, and 'Inter' (sans-serif) for body text. 'Source Code Pro' for code snippets.
- Sidebar with drill-down navigation: Workspace > Companies > Projects > Silos > Tasks. Use collapsible elements and breadcrumb trails.
- Consistent, modern icons from a minimalist set to represent workspaces, companies, projects, silos, and tasks. Use distinct icons for priority levels (low, medium, high).
- Subtle animations for task completion, data loading, and transitions to enhance user experience without being distracting.