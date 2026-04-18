# Firesky Industries — Field Ops Manager
## User Manual

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [User Roles](#2-user-roles)
3. [Dashboard](#3-dashboard)
4. [Customers](#4-customers)
5. [Enquiries](#5-enquiries)
6. [Inspections](#6-inspections)
7. [Jobs Pipeline](#7-jobs-pipeline)
8. [Stock Control](#8-stock-control)
9. [Calendar](#9-calendar)
10. [Sky AI Assistant](#10-sky-ai-assistant)
11. [Admin Tools](#11-admin-tools)
12. [Mobile Use](#12-mobile-use)

---

## 1. Getting Started

### Signing In

Go to **fireskyops.tech** and sign in using your Google account or email address. Access is granted by an administrator — if you do not have an account, ask your branch admin to invite you.

### Navigation

- **Desktop**: A sidebar on the left contains all main sections.
- **Mobile**: A bottom navigation bar gives quick access to the most-used sections. A **+** button in the centre opens a quick-action menu to start a new Enquiry or Inspection without navigating.

---

## 2. User Roles

The system has four access levels. Your role determines what you can see and do.

| Role | Who it's for | What they can do |
|---|---|---|
| **Super Admin** | Head office / owner | Everything. Full access to all branches, users, stock, and admin tools. |
| **Branch Admin** | Regional manager | Full access within their assigned branch — customers, enquiries, jobs, stock. |
| **Field Worker** | Sales rep / installer | Customers, inspections, jobs, and stock movements for their branch. |
| **Guest** | External / prospective | Can only submit enquiries and chat with Sky AI for product guidance. |

Your role is set by a Super Admin. Contact them if you need a different level of access.

---

## 3. Dashboard

The dashboard is your starting point. What you see depends on your role.

### Admin Summary (Super Admin)

At the top you'll see a status HUD with:

- **New Records** — customers, enquiries, jobs and inspections added since the last check
- **Stale Enquiries / Jobs** — active records with no update in more than 48 hours
- **Urgent** — any enquiry or job marked as high priority
- **Data Quality** — records flagged for missing information:
  - No next action recorded
  - Overdue follow-up dates
  - Quoted jobs with no follow-up date set
  - Lost jobs with no reason recorded
  - Jobs flagged as high access risk

Tap any widget number to jump directly to the filtered list of matching records.

### Branch Overview (Super Admin)

Below the HUD, a branch breakdown card shows each branch's customer count, active enquiries, and open jobs.

### Recent Activity

The bottom of the dashboard lists the most recently updated enquiries and jobs. Each card shows a mini pipeline tracker (Enquiry → Inspection → Quote → Job) so you can see where things stand at a glance.

---

## 4. Customers

**Path:** Customers → list

### Finding a Customer

Use the **search bar** at the top to filter by name, farm name, or nearest town. Results update as you type.

### Adding a Customer

Tap **Add Customer**. Fill in:

- Name and farm/property name
- Phone number
- Nearest town and province
- GPS / WhatsApp location *(tap the crosshair icon to capture your current location, or paste a WhatsApp location link)*
- Any notes

### Customer Record

Tap a customer card to open their record. From there you can:

- Edit their details
- View all linked enquiries, inspections, and jobs
- See their GPS location on a map

### Map View

On the Customers list page, tap the **Map** toggle (top right). All customers who have a GPS location saved will appear as pins on an OpenStreetMap. Tap a pin to see the customer's name, farm, nearest town, phone number, and a link to their full record.

Customers without a GPS location are counted below the map with a reminder to capture it during your next visit.

---

## 5. Enquiries

**Path:** Enquiries → list

Enquiries are the entry point for every new lead or customer request.

### Statuses

| Status | Meaning |
|---|---|
| New | Just received, not yet actioned |
| In Progress | Being worked on |
| Inspection Done | Site visit completed |
| Quoted | Quote sent to customer |
| Won | Customer has accepted |
| Lost | Customer did not proceed |
| Closed | Archived |

A mini pipeline bar on each card shows progress visually.

### Filters

Use the **status dropdown** to filter by a single status. Quick-filter links from the dashboard (Stale, Urgent, Overdue Follow-up, No Next Action) open a pre-filtered list automatically.

### Creating an Enquiry

Tap **New Enquiry**. Fill in:

- Customer *(select from your customer list)*
- Title and description of what they need
- Tank size and quantity requested
- Priority (Low / Medium / High)
- Next action and follow-up due date
- Any notes

### Editing an Enquiry

Open the enquiry and tap **Edit**. You can update the status, add notes, set a next action, and link the enquiry to an inspection.

### Bulk Actions

To update multiple enquiries at once:

1. Tap the checkbox on one or more cards (or use **Select All** in the toolbar).
2. A floating action bar appears at the bottom of the screen.
3. Choose a new status from the dropdown and tap **Apply**.

All selected enquiries are updated simultaneously.

---

## 6. Inspections

**Path:** Inspections → New Inspection (or tap + → New Inspection on mobile)

A site inspection records everything needed to plan and price an installation.

### Quick Start Templates

Before filling in the form, optionally choose a **site type template**:

| Template | Pre-fills |
|---|---|
| **Flat Ground** | No stand, no plinth, truck and trailer access enabled |
| **Elevated Stand** | Stand required, 2m height, no trailer access |
| **Plinth + Pump** | Plinth required with concrete notes, no trailer access |
| **Sloped / Hillside** | Stand + plinth required, levelling note, limited access |

Select a template to pre-fill the relevant fields. You can still edit any field afterwards. Tap the active template again to clear it and start fresh.

### Site Photos

Tap any of the four photo slots to take a photo with your camera or pick one from your gallery. These appear on the PDF inspection report.

### Form Sections

The form is grouped into sections for easy navigation:

- **General** — which customer and linked enquiry
- **Location Details** — farm name, nearest town, GPS coordinates, manual directions, landmarks, access notes
- **Tank Requirements** — size and quantity
- **Installation Prep** — stand height, plinth details, pipe length and routing
- **Site Access & Offloading** — distances from road and house, truck/trailer access, ground condition, offloading constraints
- **Readiness & Notes** — whether the site is ready to quote, and general notes

The form **auto-saves a draft** every few seconds. If you navigate away and come back, your progress is restored. Tap **Clear** on the draft bar to start fresh.

### Submitting

Tap **Complete Inspection**. The inspection is saved and you are taken to the inspection record, where you can:

- Review all captured data
- Generate and download a **PDF inspection report**
- Capture a **customer signature**
- Open linked enquiry or job

---

## 7. Jobs Pipeline

**Path:** Jobs → Pipeline

The jobs pipeline tracks every installation from initial scope through to completion.

### Stages

| Stage | Meaning |
|---|---|
| Enquiry | Potential job, still in discussion |
| Inspection | Site visit scheduled or done |
| Quoting | Pricing being prepared |
| Quoted | Quote sent, awaiting decision |
| Won | Job confirmed, installation to proceed |
| Lost | Job not awarded |
| Cancelled | Job abandoned |

### Pipeline View (Kanban)

Each stage is a column. Cards show the customer name, job title, priority badge, and date. Use the **arrow buttons** on each card to move a job one stage left or right. The **× button** gives you the option to close the job as Won, Lost, or Cancelled.

### List View

Toggle to **List** mode (top right) to see all jobs in a scrollable list. This is especially useful with filters. In list mode you can also use **bulk actions**:

1. Check one or more jobs (or tap **Select All**).
2. Use the floating bar to choose a stage and tap **Apply**.

### Filters

Quick-filter links from the dashboard open list view pre-filtered. Available filters include: Stale, Urgent, Overdue Follow-up, No Next Action, Quoted No Follow-up, Lost No Reason, High Access Risk.

### Job Record

Open a job to see:

- Full details and notes
- Next action and follow-up date
- Access risk rating
- Linked inspection and customer

### Job Loads

Inside a job, the **Loads** section manages individual delivery runs:

- Add a load with driver name, vehicle, and scheduled date
- Update load status: Pending → Scheduled → In Transit → Delivered
- Print a **Delivery Note / Job Card** for each load

---

## 8. Stock Control

**Path:** Stock

Stock control tracks inventory levels per branch.

### Viewing Stock

The stock page lists all items in your branch's inventory with their current quantity and unit. Items below a warning level are highlighted.

### Recording a Movement

Tap **+ Movement** (or the relevant button on a stock item) and choose the type:

| Movement Type | Use for |
|---|---|
| **Stock In** | Receiving goods from a supplier or The Factory |
| **Stock Out** | Issuing stock for a job or site |
| **Adjustment** | Correcting a count error |

Enter the quantity and an optional note, then confirm.

### Movement History

Each stock item has a movement log showing every transaction — who recorded it, when, and the quantity change.

### Stock Catalogue (Super Admin only)

Super Admins can create and edit the global list of stock items, categories, and units of measure. Branch Admins and Field Workers can only record movements against existing items.

---

## 9. Calendar

**Path:** Calendar

The calendar shows scheduled appointments and delivery dates linked to customers and jobs. Tap any event to open the linked record. Use the calendar to plan site visits and delivery runs without double-booking.

---

## 10. Sky AI Assistant

Sky is your built-in AI assistant, available throughout the app via the **Sky button** (usually bottom right on most screens, or a dedicated button on detail pages).

### What Sky Can Do

**For staff (all roles):**

- Summarise your current pipeline — "How many open enquiries do we have?"
- Identify stalled or urgent records — "Which jobs have been sitting in Quoting for too long?"
- Give stock summaries — "What's our current stock level for 10,000L tanks?"
- Answer product questions — tank sizing, installation requirements, technical specs
- Help draft emails or WhatsApp messages to customers

**For Super Admins and Branch Admins, Sky can also take actions:**

- Move a job to a new stage
- Close a job as Won or Lost
- Record a stock movement
- Update a next action on an enquiry

**For guest users:**

- Recommend the right tank size based on their needs
- Explain installation options and costs
- Collect enquiry details and pass them to the sales team

### Sky Vision

On mobile, tap the **camera icon** in the Sky chat to activate Sky Vision. Point your camera at a site, installation, or document. Sky will analyse the image and offer relevant observations — spotting access constraints, estimating site readiness, or reading text from a document.

### Context Awareness

Sky automatically knows which record you are currently viewing. If you are on a job's detail page, Sky already has that job's data and can answer questions about it specifically without you needing to paste any information.

### Conversation History

Sky remembers your conversation within a session. Admins have their conversation saved between sessions so context is not lost between visits.

---

## 11. Admin Tools

Accessible via your profile photo / name at the bottom of the sidebar.

### User Management (Super Admin)

- View all users in the system
- Invite a new user via WhatsApp (a sign-up link is sent)
- Assign a role to any user
- Assign a user to a specific branch

### Branch Management (Super Admin)

- View all branches
- Create a new branch (name, location, contact details)
- Edit branch details
- See per-branch staff, customer, enquiry, and job counts

### Email Log (Super Admin)

A history of all system-generated emails — inspection reports, delivery notes, and any automated notifications.

### Sage Cloud Accounting

A shortcut link to your Sage Cloud accounting workspace for invoicing and financials.

---

## 12. Mobile Use

The app is designed to work entirely from your phone in the field.

### Bottom Navigation

Five icons give instant access to: Dashboard, Customers, Inspections, Jobs, Stock. The **+** button in the centre opens a quick-create menu.

### GPS Capture

On any form with a **GPS / WhatsApp Location** field, tap the **crosshair icon** to automatically capture your current coordinates. This works on both Android and iOS as long as you grant the browser location permission.

### Photos

Any photo field lets you either take a new photo with your camera or select one from your gallery.

### Offline Use

The app requires an internet connection. If your connection drops briefly while filling in a form, the auto-save draft will preserve your data locally — it will sync once you are back online.

### Tips for Field Use

- Capture GPS coordinates while you are physically on site — not from the office.
- Take all 4 site photo slots during an inspection. They appear on the PDF report sent to the customer.
- Use bulk actions when returning to the office after a day of visits — quickly mark multiple enquiries or jobs with updated statuses in one go.
- Check the **Map view** on the Customers page before planning a route — it shows all your customers as pins so you can group nearby visits.

---

*Firesky Industries Field Ops Manager — Internal Use*
*For support or access issues, contact your branch admin or system administrator.*
