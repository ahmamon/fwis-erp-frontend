import { T, ROLE_LABELS } from "./ui.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "profile", label: "My Profile" },
  { id: "planning", label: "Weekly Planning" },
  { id: "lessons", label: "Lesson Preparation" },
  { id: "curriculum", label: "Curriculum Mapping" },
  { id: "strategies", label: "Teaching Strategies" },
  { id: "resources", label: "Resources" },
  { id: "pd", label: "Professional Development" },
  { id: "evaluation", label: "Teacher Evaluation" },
  { id: "settings", label: "Settings" },
];

export function Sidebar({ active, onNavigate }) {
  return (
    <aside style={{ width: 240, flexShrink: 0, background: T.navy900, color: T.cream50, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "22px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, color: T.gold500 }}>Future Window</div>
        <div style={{ fontSize: 10.5, letterSpacing: 1, color: "rgba(250,248,243,0.65)" }}>INTERNATIONAL SCHOOL</div>
      </div>
      <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              width: "100%", display: "block", padding: "9px 12px", marginBottom: 2, borderRadius: 8, border: "none",
              background: isActive ? "rgba(198,161,91,0.16)" : "transparent",
              color: isActive ? T.gold500 : "rgba(250,248,243,0.88)",
              fontSize: 13.5, fontWeight: isActive ? 600 : 500, textAlign: "left", cursor: "pointer",
            }}>
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function TopBar({ currentUser, onSignOut, title }) {
  return (
    <header style={{
      height: 60, flexShrink: 0, background: "#fff", borderBottom: `1px solid ${T.line}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px",
    }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: T.navy900 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink900 }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, color: T.ink600 }}>{ROLE_LABELS[currentUser.role]}</div>
        </div>
        <button onClick={onSignOut} style={{
          border: `1px solid ${T.line}`, background: "#fff", color: T.ink600, borderRadius: 8,
          padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}>
          Sign out
        </button>
      </div>
    </header>
  );
}

export const MODULE_TITLES = {
  dashboard: "Dashboard", profile: "My Profile", planning: "Weekly Planning",
  lessons: "Lesson Preparation", curriculum: "Curriculum Mapping", strategies: "Teaching Strategies",
  resources: "Resources", pd: "Professional Development", evaluation: "Teacher Evaluation", settings: "Settings",
};
