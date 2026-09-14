import { isAzureEnabled, getAuthToken, clearAuthToken, hasAzureSession } from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_URL;

// AUTH: once Azure AD is configured (VITE_AZURE_CLIENT_ID + TENANT_SET and the
// server has its own AZURE_* envs), every request carries
//   Authorization: Bearer <access token>
// and the backend (src/middleware/auth.js) verifies it and looks the user up by
// email. Until then — or while the server still runs without Azure envs — the
// app sends the dev-mode `x-dev-email` header so the rest of the app can keep
// being tested against the live database.
// The user's "acting as" role (set by the top-bar role switcher when someone
// holds several roles). Sent as x-active-role so the backend scopes views to
// that persona — it never changes what the account is allowed to do.
const LS_ACTIVE_ROLE = "fwis_active_role";
export function getActiveRole() {
  try {
    return localStorage.getItem(LS_ACTIVE_ROLE) || "";
  } catch {
    return "";
  }
}
export function setActiveRole(role) {
  try {
    localStorage.setItem(LS_ACTIVE_ROLE, role);
  } catch {
    // storage unavailable — the persona just won't persist
  }
}

function authHeaders() {
  const activeRole = getActiveRole();
  const personaHeader = activeRole ? { "x-active-role": activeRole } : {};
  if (isAzureEnabled()) {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}`, ...personaHeader } : personaHeader;
  }
  const email = localStorage.getItem("fwis_dev_email");
  return email ? { "x-dev-email": email, ...personaHeader } : personaHeader;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body || {}) }),
  del: (path) => request(path, { method: "DELETE" }),

  // Fetch a file with the auth header and return it as a Blob (used by the
  // resources "Open" button — the storage container is private, so downloads
  // go through the authenticated /file route).
  download: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body.error) message = body.error;
      } catch {
        // response wasn't JSON — keep the generic message
      }
      throw new Error(message);
    }
    return res.blob();
  },

  // Reuse the authenticated blob fetch above, then click it into a download.
  // Used by the Export PDF buttons on the record detail screens.
  downloadPdf: async (path, fallbackName) => {
    const blob = await api.download(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName || "export.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  // File uploads use multipart/form-data, not JSON
  postForm: async (path, formData) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  },
};

export function setSignedInEmail(email) {
  localStorage.setItem("fwis_dev_email", email);
}

export function getSignedInEmail() {
  return localStorage.getItem("fwis_dev_email");
}

// Unified "is someone signed in" check used by App.jsx — true for either a
// dev-mode email or a live Azure AD session.
export function isSignedIn() {
  if (isAzureEnabled()) return hasAzureSession();
  return Boolean(getSignedInEmail());
}

export function signOut() {
  localStorage.removeItem("fwis_dev_email");
  localStorage.removeItem("fwis_active_role");
  clearAuthToken();
}