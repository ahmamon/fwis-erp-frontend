import { useEffect, useState } from "react";
import { api, setSignedInEmail } from "./api.js";
import { T, ROLE_LABELS, Loading, ErrorBanner } from "./ui.jsx";

export default function LoginScreen({ onSignedIn }) {
  const [showPicker, setShowPicker] = useState(false);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!showPicker) return;
    api.get("/api/dev/users")
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, [showPicker]);

  const visible = (users || []).filter(
    (u) => !query.trim() || `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase())
  );

  function choose(email) {
    setSignedInEmail(email);
    onSignedIn();
  }

  return (
    <div style={{
      height: "100vh", width: "100%",
      background: `radial-gradient(circle at 50% 38%, ${T.navy700} 0%, ${T.navy900} 60%, #081729 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
    }}>
      {!showPicker ? (
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: T.gold500, marginBottom: 8 }}>
            Future Window International School
          </div>
          <div style={{ fontSize: 14, color: "rgba(250,248,243,0.75)", marginBottom: 40 }}>
            Academic Planning &amp; Performance System
          </div>
          <button onClick={() => setShowPicker(true)} style={{
            width: "100%", maxWidth: 340, margin: "0 auto", display: "block",
            border: `1.5px solid ${T.gold500}`, background: "rgba(198,161,91,0.08)", color: T.gold500,
            borderRadius: 12, padding: "15px 0", fontSize: 15.5, fontWeight: 700, cursor: "pointer",
          }}>
            Sign in
          </button>
          <p style={{ fontSize: 12, color: "rgba(250,248,243,0.55)", marginTop: 20, lineHeight: 1.6 }}>
            Development sign-in — lists real accounts from the live database.
            Real Microsoft 365 sign-in replaces this screen once Azure AD is configured.
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.navy900, marginBottom: 10 }}>Pick an account</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email..."
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {error && <div style={{ padding: 16 }}><ErrorBanner message={error} /></div>}
            {!users && !error && <Loading label="Loading accounts..." />}
            {visible.map((u) => (
              <button key={u.id} onClick={() => choose(u.email)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 22px",
                border: "none", borderBottom: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", background: T.navy800, color: T.gold500,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {u.name.split(" ").filter((w) => !["Mr.", "Ms.", "Mrs."].includes(w)).map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: T.ink600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.navy700, background: T.cream100, borderRadius: 999, padding: "3px 8px" }}>
                  {ROLE_LABELS[u.role]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
