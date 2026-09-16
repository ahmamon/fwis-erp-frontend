import { useEffect, useState } from "react";
import { api, setSignedInEmail } from "./api.js";
import { isAzureEnabled, signInWithMicrosoft } from "./auth.js";
import { T, roleLabel, Loading, ErrorBanner, LangSwitcher } from "./ui.jsx";
import { useLang } from "./i18n.jsx";

/* ---------- logo-ring keyframes (once per page load) ---------- */
const RING_KEYFRAMES_ID = "__fwis-logo-ring";
if (typeof document !== "undefined" && !document.getElementById(RING_KEYFRAMES_ID)) {
  const style = document.createElement("style");
  style.id = RING_KEYFRAMES_ID;
  style.textContent = `
    @keyframes fwis-ring-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default function LoginScreen({ onSignedIn, externalError = "", onClearExternalError }) {
  const { t } = useLang();
  const [showPicker, setShowPicker] = useState(false);
  const [azureBusy, setAzureBusy] = useState(false);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // `error` is set locally (dev picker / MSAL) and `externalError` is passed
  // down from App.jsx when the backend rejected the sign-in — show whichever.
  const shownError = error || externalError || "";

  async function signInMicrosoft() {
    setAzureBusy(true);
    setError("");
    onClearExternalError?.();
    try {
      await signInWithMicrosoft();
      // Redirect flow: signInWithMicrosoft() navigates the tab to Microsoft and
      // resolves as navigation starts. There's no session yet, so don't call
      // onSignedIn() — the bounce-back reload reports the user via App.jsx's
      // handleRedirectResult() + /api/users/me.
    } catch (e) {
      setError(e.message || t("Microsoft sign-in did not complete. Check the Azure AD app registration."));
    } finally {
      setAzureBusy(false);
    }
  }

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
    setError("");
    onClearExternalError?.();
    setSignedInEmail(email);
    onSignedIn();
  }

  return (
    <div style={{
      height: "100vh", width: "100%",
      background: `radial-gradient(circle at 50% 38%, ${T.navy700} 0%, ${T.navy900} 60%, #081729 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24,
      position: "relative",
    }}>
      {/* Language switch pinned to the corner so a non-English speaker can
          pick their language before signing in. */}
      <div style={{ position: "absolute", top: 18, insetInlineEnd: 18, zIndex: 5 }}>
        <LangSwitcher compact />
      </div>
      {!showPicker ? (
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: T.gold500, marginBottom: 8 }}>
            {t("Future Window International School")}
          </div>
          <div style={{ fontSize: 14, color: "rgba(250,248,243,0.75)", marginBottom: 40 }}>
            {t("Academic Planning & Performance System")}
          </div>

          {/* School logo, ringed by a slowly rotating gold halo */}
          <div style={{ position: "relative", width: 168, height: 168, margin: "0 auto 30px" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute", inset: -14,
                borderRadius: "50%",
                background: `conic-gradient(${T.gold500} 0deg, rgba(198,161,91,0.12) 30deg 200deg, rgba(198,161,91,0.55) 290deg, ${T.gold500} 360deg)`,
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))",
                animation: "fwis-ring-spin 24s linear infinite",
              }}
            />
            <img
              src="/fwis-logo.jpg"
              alt="Future Window International School logo"
              style={{
                width: "100%", height: "100%",
                borderRadius: "50%",
                objectFit: "cover", display: "block",
                boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          {shownError && <div style={{ maxWidth: 380, margin: "0 auto 18px", textAlign: "start" }}><ErrorBanner message={shownError} /></div>}
          {isAzureEnabled() ? (
            <button onClick={signInMicrosoft} disabled={azureBusy} style={{
              width: "100%", maxWidth: 340, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              background: "#fff", color: T.navy900, border: "none", borderRadius: 8, padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}>
              <svg width="20" height="20" viewBox="0 0 23 23" style={{ flexShrink: 0 }}>
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="13" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="13" width="9" height="9" fill="#00a4ef" />
                <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
              </svg>
              {azureBusy ? t("Signing in…") : t("Sign in with Microsoft 365")}
            </button>
          ) : (
            <button onClick={() => setShowPicker(true)} style={{
              width: "100%", maxWidth: 340, margin: "0 auto", display: "block",
              border: `1.5px solid ${T.gold500}`, background: "rgba(198,161,91,0.08)", color: T.gold500,
              borderRadius: 12, padding: "15px 0", fontSize: 15.5, fontWeight: 700, cursor: "pointer",
            }}>
              {t("Sign in")}
            </button>
          )}
          <p style={{ fontSize: 12, color: "rgba(250,248,243,0.55)", marginTop: 20, lineHeight: 1.6 }}>
            {isAzureEnabled()
              ? t("Sign in with your school's Microsoft 365 account. Access is limited to staff registered in the system.")
              : t("Development sign-in — lists real accounts from the live database. Real Microsoft 365 sign-in replaces this screen once Azure AD is configured.")}
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.navy900, marginBottom: 10 }}>{t("Pick an account")}</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search name or email...")}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {shownError && <div style={{ padding: 16 }}><ErrorBanner message={shownError} /></div>}
            {!users && !error && <Loading label="Loading accounts..." />}
            {visible.map((u) => (
              <button key={u.id} onClick={() => choose(u.email)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 22px",
                border: "none", borderBottom: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", textAlign: "start",
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
                  {roleLabel(u)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
