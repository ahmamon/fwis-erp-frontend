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
// Default scope asks for a token whose audience is this app itself — the same
// audience the backend verifies (api://<client-id>). If you've exposed a named
// scope on the app registration, point VITE_AZURE_SCOPE at it instead.
const SCOPE = import.meta.env.VITE_AZURE_SCOPE || (CLIENT_ID ? `api://${CLIENT_ID}` : "");

export const isAzureEnabled = () => Boolean(CLIENT_ID && TENANT_ID);

let _instance = null;
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
  }
  return _instance;
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
  if (getAuthToken()) return true;
  const inst = getMsalInstance();
  return Boolean(inst && inst.getActiveAccount());
}

function accountEmail(account) {
  return account?.username || account?.idTokenClaims?.preferred_username || account?.idTokenClaims?.email || "";
}

// Popup prompt for Microsoft 365 sign-in, then stores the access token.
// Resolves with the account email so the caller can finish the login flow.
export async function signInWithMicrosoft() {
  const inst = getMsalInstance();
  if (!inst) throw new Error("Azure AD is not configured (VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID).");

  const request = { scopes: SCOPE ? [SCOPE] : [] };
  const result = await inst.loginPopup(request);
  inst.setActiveAccount(result.account);

  const email = accountEmail(result.account);
  if (!email) throw new Error("Microsoft did not return an email for this account.");

  setAuthToken(result.accessToken || "");
  return { email };
}

// Refresh the stored token using the cached MSAL session (used by App.jsx on
// startup so an open tab can renew rather than force another sign-in popup).
export async function refreshMicrosoftToken() {
  try {
    const inst = getMsalInstance();
    const account = inst && (inst.getActiveAccount() || inst.getAllAccounts()[0]);
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

// Sign the user out of this app (optionally popping the Microsoft session too).
export async function signOutOfMicrosoft() {
  if (isAzureEnabled()) {
    try {
      const inst = getMsalInstance();
      if (inst) {
        const account = inst.getActiveAccount();
        inst.setActiveAccount(null);
        if (account) await inst.logoutPopup({ postLogoutRedirectUri: window.location.origin });
      }
    } catch {
      // Popup may be blocked; clearing local state below still logs the
      // user out of the app.
    }
  }
  clearAuthToken();
}

export function defaultAzureScope() {
  return SCOPE;
}