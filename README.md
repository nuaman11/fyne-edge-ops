# FYNE EDGE Ops

Internal operations app for FYNE EDGE: tickets, client onboarding and closings, department-wise hiring approvals, a calendar and the sales pipeline, with email/password login and Admin/User access levels.

**Stack:** Next.js 15 (App Router, server actions) · PostgreSQL (Neon on Vercel) · Drizzle ORM · bcrypt password hashing · signed, httpOnly session cookies.

---

## Deploy to Vercel (about 10 minutes)

1. **Put the code on GitHub.** Create a new private repository and push this folder to it:
   ```bash
   git init && git add . && git commit -m "FYNE EDGE Ops"
   git branch -M main
   git remote add origin https://github.com/<your-account>/fyne-edge-ops.git
   git push -u origin main
   ```
2. **Import it in Vercel.** vercel.com → **Add New… → Project** → pick the repository. Framework is detected as Next.js; leave the build settings as they are. The first deploy will fail because there's no database yet. That's expected.
3. **Add the database.** In the project: **Storage → Create Database → Neon (Serverless Postgres)** → create it and **Connect** it to the project for all environments. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.
4. **Add the session secret.** **Settings → Environment Variables** → add `AUTH_SECRET` with a long random value for all environments. Generate one with:
   ```bash
   openssl rand -base64 32
   ```
5. **Redeploy.** **Deployments → … → Redeploy**. The build applies the database migrations automatically, then builds the app.
6. **Create your admin account.** Open your site. You'll be sent to `/setup` to create the first admin (name, email, password). The setup page locks itself as soon as one account exists.
7. **Add your team.** Go to **Users → + Add user**. Choose **User** (limited) or **Admin** (full), set a temporary password and share it privately. They can change it under **My account**.

8. **Connect file storage for Documents.** In the project: **Storage → Create → Blob** → create the store and **Connect** it to this project for all environments, then **Redeploy**. This sets `BLOB_READ_WRITE_TOKEN`. Files are stored as **private** blobs: nobody can open them by URL, every download goes through the app's sign-in check.

Custom domain (for example `ops.fyneedge.com`): **Settings → Domains** in Vercel.

---

## Access levels

| | Admin | User |
|---|---|---|
| Add, edit, disable and delete users and admins; reset passwords | ✓ | |
| Create and edit tickets, change ticket status | ✓ | ✓ |
| Delete tickets | ✓ | |
| Create and edit clients, assign developers, move stages, close clients | ✓ | |
| Tick onboarding and closing checklists | ✓ | ✓ |
| Create and edit leads, move deals, convert won deals to clients | ✓ | |
| Create hiring requests | ✓ | |
| Approve or reject a hire for a department | Any department | Only their own department, and only if marked **Department head** |
| View overview, calendar, clients, pipeline and hiring | ✓ | ✓ |
| Upload documents and send them for signing | ✓ | ✓ |
| Sign or decline documents sent to them | ✓ | ✓ |
| See a document | All | Only ones they sent or must sign |
| Void, duplicate or delete a document | Any | Only ones they sent (signed documents: admins only) |

Every permission is checked **on the server** in `app/actions/*`, not just hidden in the interface.

## Security built in

- Passwords hashed with bcrypt (cost 12); minimum 10 characters.
- Sessions are signed JWTs in an `httpOnly`, `secure`, `SameSite=Lax` cookie, valid for 7 days.
- Each request re-checks the user in the database, so **disabling a user, changing their role or resetting their password signs them out immediately**.
- 5 wrong passwords lock the account for 15 minutes. Login errors don't reveal whether an email exists.
- There must always be at least one active admin; admins can't demote, disable or delete themselves.
- The first-admin setup only works while there are no accounts.
- Pages are marked `noindex` and the site sends anti-framing headers.

## Locked out of the admin account?

Run this from your computer with the production database URL (Vercel → Storage → your database → `.env.local` tab):
```bash
npm install
DATABASE_URL="postgresql://..." npm run create-admin -- "Your Name" you@fyneedge.com "a-new-strong-password"
```
It creates the admin, or resets the password and admin access if the email already exists.

## Run locally

```bash
cp .env.example .env        # fill in DATABASE_URL (any Postgres) and AUTH_SECRET
npm install
npm run db:migrate
npm run dev                 # http://localhost:3000
```

## Ticket comments, activity and lost deals

- Every ticket has **Comments** and an **Activity** log (who changed status, assignee, priority, due date or client, and when). Changes made before this feature existed aren't in the log.
- Ticket numbers come from a database sequence, so two people creating tickets at the same time never get the same number.
- Moving a deal to **Lost** asks for a reason; the Pipeline page shows a "Why deals are lost" summary.
- Closing a client that still has open tickets asks, per ticket, to mark it done or keep it open and reassign it.

## Documents and e-signing

**Documents** in the sidebar lets the team sign PDFs inside the app:

1. **Upload** a PDF (up to 25 MB, 200 pages) and give it a title. Optionally link a client.
2. **Prepare** it: add the team members who must sign, pick a box type (Signature, Initials, Date signed, Full name, Text) and click on the page to place it for the selected person. Drag to move, drag the corner to resize, press Delete to remove.
3. **Send.** Each signer sees it under **Needs my signature**, on the Overview and as a count in the sidebar.
4. **Sign.** Signers draw or type their signature, fill their boxes and confirm. Date signed and Full name fill in automatically. A signer can also **decline** with a reason, which voids the document.
5. When the last person signs, the app creates the **signed PDF**: signatures are stamped onto the pages and a **signature certificate** page is added with each signer's name, email, time, IP address and device, plus the SHA-256 fingerprint of the original file.

Every step (upload, send, open, sign, decline, void) is recorded in the document's activity. Voided or declined documents can be copied into a new draft with **Make a new version**. Completed documents are kept as records; only admins can delete them.

This is a simple electronic signature with an audit trail, suitable for internal approvals, NDAs, offer letters and most commercial agreements. Some documents need a qualified or notarised signature by law; check before using it for those.

## Changing the database schema

Edit `lib/db/schema.ts`, then:
```bash
npm run db:generate         # writes a new SQL migration in ./drizzle
```
Commit the new migration file; it's applied automatically on the next Vercel deploy.

## Project layout

```
app/
  (app)/            signed-in pages: overview, tickets, calendar, clients, hiring, pipeline, users, account
  actions/          server actions (all permission checks live here)
  login/ setup/     public pages
components/         interface (boards, forms, modals)
lib/
  db/schema.ts      database tables
  auth.ts           sessions and current user
  queries.ts        data loading
middleware.ts       sends signed-out visitors to /login
drizzle/            SQL migrations
scripts/            migrate + create-admin
```

Business timezone for "today" and overdue checks defaults to Asia/Dubai. Override it with `NEXT_PUBLIC_APP_TIMEZONE`.
