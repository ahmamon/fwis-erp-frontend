const BASE_URL = import.meta.env.VITE_API_URL;

// DEV-MODE AUTH: sends the signed-in account's email on every request.
// The backend uses this to look up who's asking (see fwis-backend's
// src/middleware/auth.js). Once real Azure AD sign-in is wired up, this
// header goes away and a real bearer token takes its place instead —
// nothing else about how this file is used needs to change.
function authHeaders() {
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

export function signOut() {
  localStorage.removeItem("fwis_dev_email");
}
