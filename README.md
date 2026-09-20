# FWIS Academic Progress — Frontend

The real, working interface for the ERP — connected to your live backend
at `academic.alsafwafuture.com`, not fake local data.

## What works right now

- **Sign in** — Microsoft 365 (Azure AD) sign-in when configured, with the
  dev-mode account picker as an automatic fallback until then (see
  "Microsoft 365 sign-in" below).
- **Dashboard** — computed live from real weekly plans.
- **Weekly Planning** — the complete real workflow: create, edit, submit,
  approve, return with comment — every action calls the real API and is
  permanently saved.
- **My Profile** — edit your phone/bio, saved for real.
- **Lesson Preparation, Curriculum Mapping, Teaching Strategies,
  Resources, Professional Development, Teacher Evaluation, Settings** —
  fully editable. Every action is saved against the live database, and the
  backend is hardened against crashes (each mutation is guarded, Prisma
  errors return proper 404/409 responses) so no editor can take the
  instance down.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` (already points at your live backend —
   no changes needed unless you want to test against a different one).
3. `npm run dev`
4. Open the URL it prints (usually `http://localhost:5173`).

## Microsoft 365 sign-in (Azure AD)

The app signs in with real Microsoft 365 accounts through MSAL. Sign-in uses
the **redirect flow** — the tab navigates to Microsoft and bounces back with the
token — which is more reliable than popup windows. It only activates when the
frontend environment has the Azure AD app-registration IDs set (and the backend
has its own matching `AZURE_*` envs).

Frontend environment variables (Vercel):

| Variable | Purpose |
|---|---|
| `VITE_AZURE_CLIENT_ID` | Application (client) ID of your Azure AD app registration |
| `VITE_AZURE_TENANT_ID` | Directory (tenant) ID of your Microsoft 365 tenant |
| `VITE_AZURE_SCOPE` | API scope requested (defaults to `api://<client-id>/access_as_user`); its resource is what the token's `aud` claim then carries |
| `VITE_AZURE_REDIRECT_URI` | Optional; defaults to `window.location.origin` |

While these are blank, the login screen falls back to the dev-mode account
picker so the app remains fully testable. Unsetting the vars (or leaving
them blank) is the switch that keeps dev mode on.

Azure-side steps to flip it live:

1. Create a **Single-page application** app registration in Entra, set the
   redirect URI to your frontend's origin (e.g. `https://app.alsafwafuture.com`),
   and expose an API scope under `api://<client-id>` named `access_as_user`
   (or set `VITE_AZURE_SCOPE` to the scope you create).
2. Grant the app `User.Read` so MSAL can return the account email.
3. Add the frontend vars above to Vercel; add `AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, and `AZURE_AUDIENCE=api://<client-id>` to the backend;
   deploy both.
4. The backend (`src/middleware/auth.js`) verifies each bearer token's
   audience and issuer, reads the user's email from `preferred_username`,
   and maps it to their saved role — so accounts must exist in the User
   table before they can sign in.

## Deploying this for real

This repo deploys on Vercel from `main` (auto-deploy on push). Point it at
a subdomain of your real domain, e.g. `app.alsafwafuture.com`.
