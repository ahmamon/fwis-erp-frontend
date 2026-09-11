# FWIS Academic ERP — Frontend

The real, working interface for the ERP — connected to your live backend
at `academic.alsafwafuture.com`, not fake local data.

## What works right now

- **Sign in** — a real account picker fetched from your live database
  (dev-mode stand-in for real Outlook login, same pattern as the backend).
- **Dashboard** — computed live from real weekly plans.
- **Weekly Planning** — the complete real workflow: create, edit, submit,
  approve, return with comment — every action calls the real API and is
  permanently saved.
- **My Profile** — edit your phone/bio, saved for real.
- **Lesson Preparation, Curriculum Mapping, Teaching Strategies,
  Resources, Professional Development, Teacher Evaluation, Settings** —
  show real live data from your database as read-only lists for now.
  Full editing for each of these is the next round of work.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` (already points at your live backend —
   no changes needed unless you want to test against a different one).
3. `npm run dev`
4. Open the URL it prints (usually `http://localhost:5173`).

## Deploying this for real

Once you're happy with it locally, this can be deployed the same way the
backend was — pushed to GitHub and connected to a static hosting platform
(Vercel and Netlify are the simplest for a Vite app like this one), then
pointed at another subdomain of your real domain, e.g.
`app.alsafwafuture.com`.
