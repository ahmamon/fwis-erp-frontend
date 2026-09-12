// Azure AD / Microsoft 365 sign-in (MSAL).
//
// How this plugs in:
//   - Set VITE_AZURE_CLIENT_ID + VITE_AZURE_TENANT_ID in the frontend's
//     environment (Vercel) and this file starts issuing real Microsoft
//     sign-in. Until then, isAzureEnabled() is false and the app keeps
//     using the dev-mode account picker (x-dev-email) unchanged.
//   - The backend (fwis-backend/src/middleware/auth.js) verifies the bearer
//     token against the same client/tenant, reads the user's email from
//     preferred_username, and looks up their role in our User table.
//   - The backend falls back to x-dev-email only while AZURE_TENANT_ID is
//     unset on the server — so the switch-over is controlled on the server
//     side, once Render has AZURE_CLIENT_ID/AZURE_TENANT_ID set.

import { PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "";
// Default scope asks for this app's own exposed API permission, which the portal
// pre-fills with the name `access_as_user` under "Expose an API". Requesting the
// bare api://<client-id> without a scope path returns AADSTS500011 ("resource
// principal not found"), so always include the scope path. If your scope is named
// differently, override it with VITE_AZURE_SCOPE.
const SCOPE = import.meta.env.VITE_AZURE_SCOPE || (CLIENT_ID ? `api://${CLIENT_ID}/access_as_user` : "");

export const isAzureEnabled = () => Boolean(CLIENT_ID && TENANT_ID);

let _instance = null;
let _initPromise = null;

function getMsalInstance() {
  if (!isAzureEnabled()) return null;
  if (!_instance) {
    _instance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    // MSAL v5 requires `initialize()` to complete before ANY instance method
    // (loginPopup, acquireTokenSilent, getActiveAccount, logoutPopup, ...) is
    // used — calling one first throws uninitialized_public_client_application.
    // Kick it off here; every entry point below awaits whenInitialized().
    // initialize() is idempotent, so concurrent callers share one in-flight run.
    const init = _instance.initialize();
    init.catch((e) => console.error("MSAL initialize() failed:", e));
    _initPromise = init;
  }
  return _instance;
}

// Resolves once the (lazily created) instance has finished initializing.
function whenInitialized() {
  const inst = getMsalInstance();
  return inst ? _initPromise : Promise.resolve();
}

// Bearer token lives in sessionStorage so a closed tab drops it; a refresh
// keeps the current tab's session alive.
const TOKEN_KEY = "fwis_azure_token";

export const getAuthToken = () => sessionStorage.getItem(TOKEN_KEY);
function setAuthToken(token) { sessionStorage.setItem(TOKEN_KEY, token); }
export function clearAuthToken() { sessionStorage.removeItem(TOKEN_KEY); }

// True when an Azure sign-in is active (token present or MSAL has an account).
export function hasAzureSession() {
  if (!isAzureEnabled()) return false;
  // The stored access token is the authoritative session signal on page load —
  // it survives a same-tab refresh via sessionStorage.
  if (getAuthToken()) return true;
  const inst = getMsalInstance();
  if (!inst) return false;
  // Fall back to the MSAL account cache. This is a synchronous check, so
  // initialize() may still be in flight; getActiveAccount() throws
  // uninitialized_public_client_application in that case. Treat it as "no
  // session" — the async flows below await initialization and decide.
  try {
    return Boolean(inst.getActiveAccount());
  } catch {
    return false;
  }
}

function accountEmail(account) {
  return account?.username || account?.idTokenClaims?.preferred_username || account?.idTokenClaims?.email || "";
}

// Redirect flow for Microsoft 365 sign-in. The whole tab navigates to Microsoft
// and bounces back with the token in the URL hash; the next page load picks it
// up via handleRedirectResult() in App.jsx. Redirect (rather than popup) avoids
// popup blockers and the block_nested_popups failures popup login hits when a
// token request fails. This only returns after navigation is underway.
export async function signInWithMicrosoft() {
  const inst = getMsalInstance();
  if (!inst) throw new Error("Azure AD is not configured (VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID).");
  await whenInitialized();

  await inst.loginRedirect({ scopes: SCOPE ? [SCOPE] : [] });
}

// Refresh the stored token using the cached MSAL session (used by App.jsx on
// startup so an open tab can renew rather than force another sign-in redirect).
export async function refreshMicrosoftToken() {
  try {
    const inst = getMsalInstance();
    if (!inst) return null;
    await whenInitialized();
    const account = inst.getActiveAccount() || inst.getAllAccounts()[0];
    if (!account) return null;
    inst.setActiveAccount(account);
    const req = { account, scopes: SCOPE ? [SCOPE] : [] };
    const result = await inst.acquireTokenSilent(req);
    setAuthToken(result.accessToken || "");
    return accountEmail(account);
  } catch {
    // No cached session or silent renewal failed — the App will show the
    // sign-in screen; the user can sign in again.
    clearAuthToken();
    return null;
  }
}

// On-page-load entry point for the redirect flow. MSAL requires
// handleRedirectPromise() to run before any other MSAL call on a page load that
// might be returning from a sign-in redirect. Resolves with the account email if
// the previous redirect completed a login (App.jsx then loads the user), or null
// if there's nothing pending.
export async function handleRedirectResult() {
  try {
    const inst = getMsalInstance();
    if (!inst) return null;
    await whenInitialized();
    const response = await inst.handleRedirectPromise();
    if (response?.account) {
      inst.setActiveAccount(response.account);
      setAuthToken(response.accessToken || "");
      return accountEmail(response.account);
    }
    return null;
  } catch {
    return null;
  }
}

// Sign the user out: clear local state first, then bounce through Microsoft's
// logout (redirect flow, matching how sign-in works).
export async function signOutOfMicrosoft() {
  if (isAzureEnabled()) {
    clearAuthToken();
    try {
      const inst = getMsalInstance();
      if (inst) {
        await whenInitialized();
        const account = inst.getActiveAccount();
        inst.setActiveAccount(null);
        if (account) await inst.logoutRedirect({ postLogoutRedirectUri: window.location.origin, account });
      }
    } catch {
      // Local state is already cleared above, so the user is signed out either way.
    }
  }
  clearAuthToken();
}

export function defaultAzureScope() {
  return SCOPE;
}