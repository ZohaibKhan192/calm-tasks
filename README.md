# Calm Tasks

Build a full-stack Task Tracker CRM MVP with Notion-like minimal, clean UI.

**Design System (Critical - This is NOT a colorful app):**

Color Palette:
- Background: #ffffff (pure white)
- Secondary bg: #f8f8f8 (very light gray)
- Text primary: #1f2937 (dark gray, not pure black)
- Text secondary: #6b7280 (medium gray for captions)
- Borders: #e5e7eb (light gray, very subtle)
- Accent: #3b82f6 (only blue, used sparingly for buttons/links)
- Danger: #ef4444 (red, only for delete)
- Success: #10b981 (green, only for done tasks)

Typography:
- Font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto (system fonts, no web fonts)
- Headings: 24px, weight 600
- Body: 14px, weight 400
- Small text: 12px, weight 400, color: #6b7280
- All text is antialiased, smooth rendering

Spacing:
- Use 8px grid (8px, 16px, 24px, 32px, 48px gaps)
- Generous whitespace, never cramped
- Padding inside cards: 16px

Components:
- Buttons: minimal, subtle gray hover (#f3f4f6), no shadows, thin border #e5e7eb
- Cards: white bg, border: 1px #e5e7eb, no shadow, rounded: 6px
- Inputs: border #e5e7eb, no shadow, bg white, focused: border #3b82f6
- Icons: 16-20px, stroke-based (like Lucide), color: #6b7280
- Dropdowns: dropdown open bg #f8f8f8, subtle border
- No gradients, no heavy shadows, no ornate effects

Layout:
- Sidebar: 280px, bg #f8f8f8, border-right #e5e7eb, navigation simple list
- Main content: full width minus sidebar, max-width 1400px, padded 32px
- Header: minimal, border-bottom #e5e7eb, 56px height
- Modals: simple white box, border #e5e7eb, no heavy shadow

**Tech Stack (Required for Vercel/Git deployment):**
- Frontend: Next.js 14+ with React 18, TypeScript, Tailwind CSS (custom config for this palette)
- Backend: Next.js API routes
- Database: PostgreSQL with Prisma ORM
- Authentication: NextAuth.js with Gmail OAuth provider
- Icons: Lucide React (stroke-based, minimal)
- Deployment: Git repo (GitHub/GitLab)

**Core Feature 1: Authentication & Organization Setup**

1. **Login Page (/login):**
   - Single column, centered, max-width 400px
   - Logo/wordmark at top (simple text "Task CRM")
   - Heading: "Sign in"
   - Text: "Sign in with your Google account"
   - Single button: "Sign in with Google" (blue, full width, 40px height)
   - Footer text: small gray caption
   - No background image, no decoration, just white + button

2. **Gmail OAuth Login Flow:**
   - After first login, user lands on Organization Setup page
   - User enters organization name (e.g., "Acme Corp")
   - System creates org and makes user the owner
   - Subsequent logins go straight to dashboard

3. **Organization Setup Page (/setup):**
   - Center column, max-width 500px
   - Heading: "Create your workspace"
   - Label: "Workspace name"
   - Input field: placeholder "e.g., Acme Corp"
   - Button: "Create workspace" (blue, full width)
   - No extra fields, no complexity

4. **Data Model:**
   - Users table: id, email, name, avatar, createdAt
   - Organizations table: id, name, ownerId, createdAt
   - Memberships table: id, userId, orgId, role (OWNER/ADMIN/MEMBER), joinedAt
   - Each user can belong to multiple orgs; dashboard shows org switcher dropdown

**Core Feature 2: Sidebar Navigation & Header**

Header (top, 56px, border-bottom #e5e7eb):
- Left: Logo/text "Task CRM", space 32px
- Middle: empty (reserved)
- Right: Org name, space 16px, User avatar dropdown (name, settings, logout)

Sidebar (280px, bg #f8f8f8, pinned):
- Top section: Workspace name + dropdown (switch orgs)
- Navigation items (list):
  * Tasks (icon: checklist)
  * Team (icon: people)
  * Settings (icon: gear)
- Bottom: collapsed but expandable "Invite" link
- Hover states: bg #efefef, cursor pointer, no transition
- Borders: subtle #e5e7eb dividers

**Core Feature 3: Roles & Permissions**

Three roles: OWNER, ADMIN, MEMBER
- OWNER: full access (manage members, create/edit/delete tasks, manage org settings)
- ADMIN: create/edit/delete any task, manage members
- MEMBER: create own tasks, edit own tasks, view all tasks
- All users can view all tasks within their org (read-only for non-owners)

**Core Feature 4: Task Tracker MVP**

1. **Task Data Model:**
   - Tasks table: id, orgId, createdBy (userId), title, description, status (TODO/IN_PROGRESS/DONE), priority (LOW/MEDIUM/HIGH), dueDate, assignedTo (userId), createdAt, updatedAt

2. **Task List Page (/dashboard/tasks):**
   - **Kanban view (default):**
     * Three columns: TODO | IN_PROGRESS | DONE
     * Column headers: 14px, bold, #1f2937, subtle border-bottom
     * Each column: min-width 320px, max-width 400px, scrollable if many tasks
     * Gaps between columns: 24px
   
 - **Task card appearance:**

  * White bg, border #e5e7eb (except left edge)

  * Left border: 3px, color per status:

    - TODO: #d1d5db (light gray)

    - IN_PROGRESS: #3b82f6 (blue)

    - DONE: #10b981 (green)

  * Title: 14px, bold, #1f2937

  * Description: 12px, #6b7280, one line truncated

  * Bottom row: assignee avatar (24px), due date (12px gray), priority badge

  * Hover: bg #f8f8f8, cursor pointer
   
   - **Priority badges (subtle):**
     * HIGH: small red text "HIGH" 
     * MEDIUM: small orange text "MEDIUM"
     * LOW: small gray text "LOW"
     * No background color, just colored text
   
   - **Due dates:**
     * Format: "Mon 15 Jan"
     * If overdue: red text
     * If today: bold
     * If in future: gray text
   
   - **Assignee:**
     * Small avatar (24px), show initials inside
     * Tooltip on hover: user name

3. **Create Task Modal:**
   - Modal: white box, border #e5e7eb, center screen, max-width 500px
   - Title: "New task"
   - Close button (X icon, top-right)
   - Form fields (stacked, 16px gap):
     * Label: "Task name" (12px, #6b7280)
     * Input: full width, placeholder "Enter task name"
     * Label: "Description" (12px, #6b7280)
     * Textarea: full width, 80px height, placeholder "Add notes..."
     * Label: "Assigned to" (12px, #6b7280)
     * Dropdown: org members, show avatar + name
     * Label: "Due date" (12px, #6b7280)
     * Date picker: simple text input or date picker
     * Label: "Priority" (12px, #6b7280)
     * Radio buttons: LOW | MEDIUM | HIGH (inline, left-aligned)
   - Buttons (16px gap):
     * "Create task" (blue, full width, 40px)
     * "Cancel" (gray border, full width, 40px)
   - No labels inside inputs, all labels outside above

4. **Edit Task Modal:**
   - Same layout as create, pre-filled
   - Status change: NOT in modal, drag card to column to update
   - Bottom: "Delete" button (red, left-aligned, small, only for OWNER/ADMIN)

5. **Delete Confirmation:**
   - Minimal modal
   - Text: "Delete this task?"
   - Two buttons: "Cancel" (gray) | "Delete" (red)

**Dashboard Layout:**
- Sidebar on left (pinned)
- Header on top
- Main area: Kanban board (Tasks page)
- If <10 tasks: show empty state (icon, text "No tasks yet", "Create your first task" button)

**Navigation & Pages:**

Routes:
- /login — login page (no sidebar/header)
- /setup — org setup (no sidebar, minimal header)
- /dashboard/tasks — Kanban board (sidebar + header)
- /dashboard/team — team members list (sidebar + header)
- /dashboard/settings — org settings (sidebar + header)

**Environment Setup:**
- Create .env.local with: NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL
- Prisma migrations auto-run on build
- Seed script creates demo org for testing

**Key Non-Functional Requirements:**
- Clean, spacious, minimal aesthetic at all times
- Hover states are subtle (bg color shift, not shadow)
- No transitions/animations (instant feedback)
- All fonts are system fonts (no @import Google Fonts)
- All dates/times show in user's local timezone
- API routes are protected (check NextAuth session)
- Pagination on task list if >100 tasks
- Loading skeletons while fetching (subtle gray boxes)
- Error handling with user-friendly messages (gray text, red if critical)
- No console errors or warnings

**Start with the login flow and org setup. Once that works, build the Kanban board and task CRUD. Make it feel like Notion—minimal, clean, functional.**

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/84ba89b3-d91b-40ef-b7c4-3968ca85e657).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
