# Firesky Industries Field Ops & Sky Vision — Full Capabilities Overview

---

## FIRESKY INDUSTRIES FIELD OPS

A mobile-first, role-based field operations platform built for Firesky Industries. Accessible at the root domain (fireskyops.tech). All users authenticate via secure login (Clerk).

---

### User Roles

| Role | Access Level |
|---|---|
| **Admin** | Full system access — all branches, all data, all tools |
| **Branch Admin** | Full access to their assigned branch — customers, jobs, stock, reports |
| **Field Worker** | Operational access — enquiries, jobs, inspections, calendar |
| **Guest / Customer** | Public-facing AI assistant and quote acceptance only |

---

### Core Business Modules

#### Customers
- Create and manage customer records with full contact details, address, and location notes
- Log access risk, delivery constraints, and site-specific notes
- Link customers to enquiries, site inspections, and jobs
- View complete history per customer

#### Enquiries
- Capture and track incoming enquiries through a structured pipeline
- Status tracking: New → In Progress → Quoted → Won / Lost
- Priority flagging (Normal, High, Urgent)
- Assign next actions and follow-up dates
- Convert enquiries directly into site inspections or jobs

#### Site Inspections
- Structured data capture for on-site assessments
- Tank size, quantity, type, and placement details
- Stand or plinth specification, pipe runs, inlet/outlet measurements
- Site access, delivery constraints, GPS coordinates, photos
- Mark as ready-to-quote; convert directly to a job
- Signature capture from customers on-site
- Photo picker with camera support

#### Jobs
- Full job lifecycle management: Inspection → Quote → Install → Complete → Invoice
- Stage-based status tracking with colour-coded indicators
- Assign field workers, track priority and next actions
- Overdue and stalled job alerts
- Convert to quote / invoice directly from the job record
- Signature capture and photo documentation

#### Quotes & Invoices
- Generate professional PDF quotes and invoices from job records
- Quote acceptance flow for customers (accessible without login)
- Branded PDF export with Firesky identity

#### Calendar
- Shared calendar view of scheduled jobs and inspections
- Date-filtered view across the team

#### Map View
- Interactive map of all active customers and jobs plotted by location
- Cluster view for dense areas

---

### Multi-Branch Operations

#### Branch Management (Admin)
- Create and manage multiple branches
- Assign users to specific branches
- View cross-branch performance in the admin dashboard

#### Stock Control (Per Branch)
- Full stock catalogue management — create, edit, and categorise items
- Per-branch stock levels tracked in real time
- Record stock movements: **In** (received), **Out** (used on a job), **Adjustment** (stock count correction)
- Movement history log per branch
- Low-stock visibility for branch admins

---

### Dashboards

#### Admin Dashboard (Cross-Branch)
- Live business-wide pipeline health
- Total customers, open enquiries, active jobs by stage
- Stalled jobs and overdue follow-ups flagged
- Branch breakdown cards for at-a-glance multi-branch view
- Scheduler: automated background alerts every 30 minutes for new records, stale items, and urgent jobs

#### Branch Dashboard (Branch Admin / Field Worker)
- Branch-scoped view: their enquiries, jobs, inspections, stock levels
- Key metrics for the branch only

---

### Sky AI — In-App Assistant (Firesky)

Sky is the built-in AI assistant available on every screen via the "Ask Sky" button.

#### What Sky can do in Firesky:

- **Reads live record context** — when opened on a job, inspection, enquiry, or customer record, Sky automatically reads that record and answers questions about it
- **Admin intelligence** — for admins, Sky reads the full live system snapshot: pipeline health, stale records, urgent jobs, overdue follow-ups
- **Branch admin stock tools** — Sky can check stock levels, record stock movements (in/out/adjustment), list the catalogue, and create new stock items entirely via conversation
- **Field guidance** — answers questions about tank sizing, site prep, SANS regulations, stand vs plinth, borehole/rainwater systems
- **Document upload** — attach a PDF, Word document, TXT, or CSV to any Sky conversation; Sky reads and discusses the document content
- **Photo/vision** — point the camera at a site, installation, or tank; Sky analyses the image and provides field guidance
- **Suggested actions** — context-aware quick prompts based on the current record type and user role
- **Conversation memory** — chat history is preserved per session for admin users

---

### Notifications & Alerts

- Push notification support (VAPID-based web push)
- Notification bell in the nav bar
- Background scheduler sends automated digest alerts for new records, stale enquiries/jobs, urgent items, and data quality issues

---

### User Management (Admin)

- View all users in the system
- Assign roles and branch assignments
- Manage field worker assignments

---

### Design & UX

- Mobile-first, fully responsive — designed for phones in the field
- Dark mode support
- Branded with Firesky orange and dark theme
- Bottom navigation on mobile per role
- Persistent sidebar on desktop

---
---

## SKY VISION

A standalone, general-purpose AI assistant web app at `/sky-vision/`. Dark grey and orange theme. Full ChatGPT-style interface with advanced features built specifically for the Firesky team and beyond.

---

### Conversations

- Persistent conversation history — all chats saved and reloadable
- Create new conversations, rename them, and delete them
- Conversation list in a collapsible sidebar
- **Search** conversations by keyword to find past chats instantly
- Streaming responses (text appears as it generates, not all at once)

---

### AI Models & Modes

- **Auto mode** — Sky selects the right model based on message complexity
- **Fast mode** — lightweight model for quick answers
- **Deep mode** — advanced model for complex analysis, coding, legal, research
- Model indicator in the chat header shows which model is active

---

### File & Document Upload

- Attach a **PDF, Word (.docx), TXT, or CSV** to any message
- Sky reads and understands the full document content (up to ~30,000 characters)
- A badge shows the attached file name; can be removed before sending
- Document context is included in the AI's response

---

### Image Capabilities

- **Image upload** — attach any image and ask Sky to analyse or describe it
- **Image generation** — ask Sky to create an image from a description
- **Image editing** — upload an image and ask Sky to modify it (change style, add elements, etc.)
- **Camera capture** — take a photo directly from your device camera

---

### Web Search

- Sky can search the web in real time for current information
- A "Searching the web..." indicator appears while the search runs
- Used automatically when the question requires up-to-date information

---

### Voice

- **Voice input** — speak your message instead of typing (microphone button)
- **Text-to-speech** — Sky can read responses aloud

---

### Follow-up Suggestions

- After each AI response, Sky generates 3 relevant follow-up question chips
- Click any chip to instantly send that follow-up

---

### Prompt Library

- Save frequently used prompts for instant reuse
- Open the prompt library from the chat input with the bookmark icon
- Search saved prompts and select one to pre-fill the input
- Create, edit, and delete saved prompts

---

### Sky's Memory

- Sky can remember facts about you across conversations
- Access and manage memory entries from the sidebar (Sky's Memory button)
- Add, edit, or delete individual memory items
- Memory is automatically included in Sky's system context

---

### Conversation Export

- Download any conversation as a formatted Markdown file
- Export button appears in the chat header once a conversation has messages

---

### Voice & Accessibility

- Text-to-speech playback of responses
- Microphone input for hands-free messaging

---

### User Experience

- Dark grey and orange theme throughout
- Fully responsive — works on mobile and desktop
- Sidebar collapses on mobile for full-screen chat
- Auto-scroll to latest message
- Copy-to-clipboard on AI responses
- Thinking/loading indicator while Sky is generating

---

## SHARED INFRASTRUCTURE

- **Single API server** handles all requests for both apps
- **PostgreSQL database** with full persistence for all records
- **Clerk authentication** — secure login, role management, user profiles
- **OpenAI GPT** backend for all AI capabilities
- **Object storage** for file and media uploads
- **Resend** for email delivery
- **Web push** for mobile notifications

---

*Document prepared April 2026.*
