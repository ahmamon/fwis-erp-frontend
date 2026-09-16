import { useRef, useState } from "react";
import { T, ROLE_OPTIONS, roleLabel, LangSwitcher } from "./ui.jsx";
import { useLang } from "./i18n.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "School Calendar" },
  { id: "reports", label: "Report Center", roles: ["hod", "supervisor", "admin"] },
  { id: "profile", label: "My Profile" },
  { id: "planning", label: "Weekly Planning" },
  { id: "lessons", label: "Lesson Preparation" },
  { id: "curriculum", label: "Curriculum Mapping" },
  { id: "strategies", label: "Teaching Strategies" },
  { id: "resources", label: "Resources" },
  { id: "pd", label: "Professional Development" },
  { id: "evaluation", label: "Teacher Evaluation" },
  { id: "admin", label: "Admin Control Panel", roles: ["admin"] },
];

/* ---------------------------------------------------------------------------
 * Sidebar layout preferences — collapsed state and pixel width are remembered
 * per browser/device via localStorage so the layout survives reloads.
 * ------------------------------------------------------------------------- */
const LS_COLLAPSED = "fwis_sidebar.collapsed";
const LS_WIDTH = "fwis_sidebar.width";
const COLLAPSED_RAIL = 58;
const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 400;
const DEFAULT_WIDTH = 240;

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable (private mode etc.) — preference just won't persist
  }
}

export function useSidebarPreferences() {
  const [collapsed, setCollapsed] = useState(() => readLS(LS_COLLAPSED, "0") === "1");
  const [width, setWidth] = useState(() => {
    const n = Number(readLS(LS_WIDTH, ""));
    return Number.isFinite(n) && n >= MIN_SIDEBAR && n <= MAX_SIDEBAR ? n : DEFAULT_WIDTH;
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      writeLS(LS_COLLAPSED, c ? "0" : "1");
      return !c;
    });
  };

  // Called with raw cursor-x values during a drag (can be tiny/huge or < MIN);
  // clamp here so nothing outside [MIN, MAX] is ever stored.
  const resize = (w) => {
    const clamped = Math.round(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, w)));
    setWidth(clamped);
    writeLS(LS_WIDTH, clamped);
  };

  return { collapsed, toggleCollapsed, width, resize };
}

export function Sidebar({ active, onNavigate, collapsed = false, width = DEFAULT_WIDTH, onResize, role }) {
  const asideRef = useRef(null);
  const dragging = useRef(false);
  const { t } = useLang();

  function startDrag(e) {
    e.preventDefault();
    const aside = asideRef.current;
    if (!aside || dragging.current) return;
    dragging.current = true;
    aside.style.transition = "none"; // instant response while dragging

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function move(ev) {
      if (!dragging.current) return;
      const left = aside.getBoundingClientRect().left;
      onResize(ev.clientX - left);
    }
    function up() {
      dragging.current = false;
      aside.style.transition = "";
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const rail = collapsed;
  return (
    <aside
      ref={asideRef}
      style={{
        width: rail ? COLLAPSED_RAIL : width,
        flexShrink: 0,
        background: T.navy900,
        color: T.cream50,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "width 0.18s ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: rail ? "0" : "0 20px",
          justifyContent: rail ? "center" : "flex-start",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      >
        {rail ? (
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: T.gold500 }}>FW</div>
        ) : (
          <>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: T.gold500 }}>{t("Future Window")}</div>
            <div style={{ fontSize: 10.5, letterSpacing: 1, color: "rgba(250,248,243,0.65)", marginTop: 2 }}>
              {t("INTERNATIONAL SCHOOL")}
            </div>
          </>
        )}
      </div>
      <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.filter((item) => (!item.roles || item.roles.includes(role))).map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={rail ? t(item.label) : undefined}
              style={{
                width: "100%",
                display: "block",
                padding: rail ? "10px 0" : "9px 12px",
                marginBottom: 2,
                borderRadius: 8,
                border: "none",
                background: isActive ? "rgba(198,161,91,0.16)" : "transparent",
                color: isActive ? T.gold500 : "rgba(250,248,243,0.88)",
                fontSize: rail ? 13.5 : 13.5,
                fontWeight: isActive ? 700 : 500,
                textAlign: rail ? "center" : "left",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {rail ? t(item.label)[0] : t(item.label)}
            </button>
          );
        })}
      </nav>
      {!rail && (
        <div
          onMouseDown={startDrag}
          title={t("Drag to resize")}
          style={{
            position: "absolute",
            top: 0, insetInlineEnd: 0,
            width: 6, height: "100%",
            cursor: "col-resize",
            zIndex: 5,
            background: "transparent",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(198,161,91,0.35)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        />
      )}
    </aside>
  );
}

export function TopBar({ currentUser, onSignOut, title, onToggleSidebar, activeRole, onActiveRoleChange, reminderCount = 0, onReminderClick }) {
  const { t } = useLang();
  // Multi-role accounts (e.g. admin + teacher) get an "acting as" switcher; the
  // chosen persona only changes what views surface — it never narrows what the
  // account is allowed to do (that stays union over held roles on the backend).
  const multiRole = Array.isArray(currentUser?.roles) && currentUser.roles.length > 1;
  return (
    <header style={{
      height: 60, flexShrink: 0, background: "#fff", borderBottom: `1px solid ${T.line}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={t("Toggle sidebar")}
            style={{
              border: `1px solid ${T.line}`, background: "#fff", color: T.ink600, borderRadius: 8,
              padding: "6px 8px", display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11" />
            </svg>
          </button>
        )}
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: T.navy900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {t(title)}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LangSwitcher />
        <button
          onClick={onReminderClick}
          title={reminderCount > 0 ? `${reminderCount} ${t(reminderCount === 1 ? "open reminder" : "open reminders")}` : t("Reminders")}
          style={{
            position: "relative", border: `1px solid ${T.line}`, background: "#fff", color: T.ink600,
            borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {reminderCount > 0 && (
            <span style={{
              position: "absolute", top: -5, insetInlineEnd: -5, background: T.copper500, color: "#fff",
              fontSize: 10, fontWeight: 700, minWidth: 15, height: 15, borderRadius: 999,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            }}>
              {reminderCount > 99 ? "99+" : reminderCount}
            </span>
          )}
        </button>
        <div style={{ textAlign: "start" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink900 }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, color: T.ink600, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            {multiRole ? (
              <>
                <span style={{ color: T.ink600 }}>{t("Acting as")}</span>
                <select
                  value={activeRole}
                  onChange={(e) => onActiveRoleChange(e.target.value)}
                  title={t("Choose which role you're acting as this session")}
                  style={{
                    fontSize: 11.5, color: T.ink600, border: `1px solid ${T.line}`, borderRadius: 6,
                    padding: "1px 4px", background: "#fff", cursor: "pointer",
                  }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.label)}</option>
                  ))}
                </select>
              </>
            ) : (
              roleLabel(currentUser)
            )}
          </div>
        </div>
        <button onClick={onSignOut} style={{
          border: `1px solid ${T.line}`, background: "#fff", color: T.ink600, borderRadius: 8,
          padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}>
          {t("Sign out")}
        </button>
      </div>
    </header>
  );
}

export const MODULE_TITLES = {
  dashboard: "Dashboard", calendar: "School Calendar", reports: "Report Center", profile: "My Profile", planning: "Weekly Planning",
  lessons: "Lesson Preparation", curriculum: "Curriculum Mapping", strategies: "Teaching Strategies",
  resources: "Resources", pd: "Professional Development", evaluation: "Teacher Evaluation",
  admin: "Admin Control Panel",
};