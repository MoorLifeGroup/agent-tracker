# Agent Tracker

Sales activity, client pipeline, and metrics tracker for Tavon's insurance team.
Agents log in with usernames, log daily activity and sales from their phones,
and key events post automatically to Discord. Tavon has full admin control.

**Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Vercel Postgres,
bcryptjs password hashing, stateless JWT sessions via `jose`. No external auth.

## What it tracks

- **Daily activity** (per agent, per day): auto dials, hand dials, pickups,
  screeners, quotes, talk minutes, appointments set, callbacks, not interested,
  bad/DNC, looking. Every ratio (dials/pickup, pickup→quote %, quote→close %,
  AP/dial, AP/hour, dials/close…) computes live — agents never type a percentage.
- **Sales log**: client, carrier (15-carrier dropdown), product, face amount,
  monthly premium → annualized auto-calculated, dialed vs warm source.
- **Client pipeline**: lead → contacted → appointment set → shown → sold / dead.
- **To-dos**: per agent, due dates, overdue highlighting; admin can assign.
- **Leaderboard**: rank by AP, sales, AP/dial, or dials — 7d / 30d / MTD.
- **Dashboard**: rolling 7-day AP vs weekly target, dial efficiency panel,
  month-to-date, per-day breakdown table.

## Discord integration

Admin → Discord webhooks. Paste a webhook URL for each event:

| Event | Fires when |
|---|---|
| Sale logged | anyone logs a sale (client, carrier, AP) |
| Daily activity | anyone submits their day |
| New agent joined | you create an agent account |
| Weekly summary | auto every Monday 8 AM ET — each agent's 7-day stats |

Each webhook has a **Send test** button. No webhook configured = skipped silently.
To create one in Discord: channel settings → Integrations → Webhooks → New Webhook.

## Deploy on Vercel

1. **Push this folder to a GitHub repo** (or `vercel` CLI from this directory).
2. **Import the repo in Vercel** → it auto-detects Next.js.
3. **Add Postgres**: Vercel dashboard → Storage → Create → Postgres → connect to
   the project. This adds `POSTGRES_URL` automatically.
4. **Environment variables** (Project Settings → Environment Variables):
   - `JWT_SECRET` — random 32+ chars: `openssl rand -base64 32`
   - `ADMIN_PASSWORD` — your admin password (min 8 chars, used once by seed)
   - `CRON_SECRET` — random 32+ chars: `openssl rand -base64 32`
5. **Deploy**, then **run the seed** once to create your admin account
   (username `tavon`):
   ```bash
   # locally, with the same env vars:
   POSTGRES_URL="..." ADMIN_PASSWORD="..." npm run seed
   ```
   Or via Vercel CLI: `vercel env pull .env.local` then `npm run seed`.
   Safe to re-run — it does nothing if `tavon` already exists.
6. **Log in** at `your-app.vercel.app/login` → Admin → paste Discord webhook URLs.

The Monday 8 AM ET weekly summary is wired via `vercel.json`
(`0 12 * * 1` = 12:00 UTC = 8:00 AM ET). Vercel Cron calls
`/api/cron/weekly-summary` with `CRON_SECRET` as the Bearer token.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in POSTGRES_URL, JWT_SECRET
npm run dev
```

## Project layout

```
app/
  login/            username + password
  page.tsx          agent dashboard (7-day, efficiency, MTD, per-day table)
  activity/         daily activity log form + history
  sales/            sales log form + history
  clients/          pipeline kanban
  todos/            to-dos with overdue highlighting
  leaderboard/      rankings with metric toggles
  admin/            agents, weekly targets, Discord webhooks
  api/
    auth/           login / logout / me
    dashboard/      7-day + MTD aggregates (one call)
    activity/       daily activity CRUD
    sales/          sales CRUD
    clients/        client pipeline CRUD
    todos/          to-do CRUD
    leaderboard/    per-agent aggregates
    agents/         admin user management
    settings/       webhook URLs + test sends
    cron/weekly-summary  Monday auto-post (CRON_SECRET)
lib/
  db.ts             @vercel/postgres + auto schema init
  auth.ts           jose JWT session (httpOnly cookie)
  discord.ts        webhook sender (server-side only)
  stats.ts          all derived computations (ratios, totals, formatters)
  types.ts          shared types + carrier list
middleware.ts       route protection (login required; /admin = admin only)
scripts/seed.mjs    creates admin user `tavon`
vercel.json         Monday 8 AM ET cron
```

## Notes

- Sessions are stateless JWTs in an httpOnly cookie (30-day expiry). No sessions table.
- Deactivating an agent hides them from the leaderboard but keeps their history.
- You can't demote or deactivate your own admin account.
- Agents only ever see their own data, except the leaderboard (names + numbers).
