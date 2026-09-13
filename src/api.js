import { isAzureEnabled, getAuthToken, clearAuthToken, hasAzureSession } from "./auth.js";

const BASE_URL = import.meta.env.VITE_API_URL;

// AUTH: once Azure AD is configured (VITE_AZURE_CLIENT_ID + TENANT_SET and the
// server has its own AZURE_* envs), every request carries
//   Authorization: Bearer <access token>
// and the backend (src/middleware/auth.js) verifies it and looks the user up by
// email. Until then — or while the server still runs without Azure envs — the
// app sends the dev-mode `x-dev-email` header so the rest of the app can keep
// being tested against the live database.
function authHeaders() {
  if (isAzureEnabled()) {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  const email = localStorage.getItem("fwis_dev_email");
  return email ? { "x-dev-email": email } : {};
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
  clearAuthToken();
}