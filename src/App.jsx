import { useEffect, useState } from "react";
import { api, isSignedIn, signOut, setActiveRole, getActiveRole } from "./api.js";
import { isAzureEnabled, refreshMicrosoftToken, signOutOfMicrosoft, handleRedirectResult } from "./auth.js";
import LoginScreen from "./LoginScreen.jsx";
import { Sidebar, TopBar, MODULE_TITLES, useSidebarPreferences } from "./Shell.jsx";
import Dashboard from "./Dashboard.jsx";
import Planning from "./Planning.jsx";
import { ProfileView } from "./OtherModules.jsx";
import LessonsEditor from "./modules/LessonsEditor.jsx";
import CurriculumEditor from "./modules/CurriculumEditor.jsx";
import StrategiesEditor from "./modules/StrategiesEditor.jsx";
import ResourcesEditor from "./modules/ResourcesEditor.jsx";
import PDEditor from "./modules/PDEditor.jsx";
import EvaluationEditor from "./modules/EvaluationEditor.jsx";
import AdminPanel from "./modules/AdminPanel.jsx";
import ReportsCenter from "./modules/ReportsCenter.jsx";
import { T, Loading, hasRole } from "./ui.jsx";

// The "acting as" role for multi-role accounts (e.g. admin + teacher director).
// Stored per browser; falls back to the account's first role.
function initialActiveRole(user) {
  const stored = getActiveRole();
  if (Array.isArray(user?.roles) && user.roles.includes(stored)) return stored;
  return Array.isArray(user?.roles) && user.roles.length ? user.roles[0] : user?.role;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRoleState] = useState("");
  const [checkedSession, setCheckedSession] = useState(false);
  const [module, setModule] = useState("dashboard");
  // Set when the session check fails with a backend message (e.g. a rejected
  // login with a non-school-domain Microsoft account) so LoginScreen can show it.
  const [loginError, setLoginError] = useState("");
  // Total open reminders ("returned" plans, deadlines, CPD, review queues) —
  // shown as the bell count in the top bar and refreshed whenever the user
  // lands on the dashboard.
  const [reminderCount, setReminderCount] = useState(0);

  // Sidebar collapsed/width preferences — persisted per browser via localStorage.
  const sidebar = useSidebarPreferences();

  function refreshReminders() {
    api.get("/api/reminders").then((d) => setReminderCount(d.count || 0)).catch(() => {});
  }

  function applyUser(user) {
    setCurrentUser(user);
    setActiveRoleState(initialActiveRole(user));
  }

  useEffect(() => {
    (async () => {
      // 1) If this page load is the bounce-back from a Microsoft sign-in
      //    redirect, the token sits in the URL hash — MSAL requires
      //    handleRedirectPromise() to consume it before any other MSAL call.
      const redirectEmail = isAzureEnabled() ? await handleRedirectResult() : null;

      // 2) No session yet → login screen (its button redirects to Microsoft).
      if (!redirectEmail && !isSignedIn()) { setCheckedSession(true); return; }

      // 3) Cached session → renew silently so a returning visitor isn't sent
      //    through another redirect (skipped right after a fresh redirect sign-in).
      if (isAzureEnabled() && !redirectEmail) await refreshMicrosoftToken();

      api.get("/api/users/me")
        .then(applyUser)
        .catch((e) => { setLoginError(e.message || ""); signOut(); })
        .finally(() => setCheckedSession(true));
    })();
  }, []);

  // Keep the top-bar bell fresh with the current persona's reminder count —
  // refetch on session load and whenever the user re-enters the dashboard.
  useEffect(() => {
    if (currentUser && module === "dashboard") refreshReminders();
  }, [currentUser, module, activeRole]);

  if (!checkedSession) return <Loading label="Checking session..." />;

  if (!currentUser) {
    return (
      <LoginScreen
        externalError={loginError}
        onClearExternalError={() => setLoginError("")}
        onSignedIn={() => {
          api.get("/api/users/me")
            .then(applyUser)
            .catch((e) => { setLoginError(e.message || ""); signOut(); });
        }}
      />
    );
  }

  async function handleSignOut() {
    await signOutOfMicrosoft();
    signOut();
    setCurrentUser(null);
    setActiveRoleState("");
    setReminderCount(0);
    setModule("dashboard");
  }

  function handleRoleChange(role) {
    setActiveRoleState(role);
    setActiveRole(role);
    setModule("dashboard");
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: T.cream50, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: "hidden" }}>
      <Sidebar active={module} onNavigate={setModule} collapsed={sidebar.collapsed} width={sidebar.width} onResize={sidebar.resize} role={activeRole} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar currentUser={currentUser} onSignOut={handleSignOut} title={MODULE_TITLES[module]} onToggleSidebar={sidebar.toggleCollapsed} activeRole={activeRole} onActiveRoleChange={handleRoleChange} reminderCount={reminderCount} onReminderClick={() => setModule("dashboard")} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {module === "dashboard" && <Dashboard currentUser={currentUser} persona={activeRole} onNavigate={setModule} />}
          {module === "reports" && ["hod", "supervisor", "admin"].some((r) => hasRole(currentUser, r)) && <ReportsCenter currentUser={currentUser} />}
          {module === "profile" && <ProfileView currentUser={currentUser} onUpdated={applyUser} />}
          {module === "planning" && <Planning currentUser={currentUser} persona={activeRole} />}
          {module === "lessons" && <LessonsEditor currentUser={currentUser} />}
          {module === "curriculum" && <CurriculumEditor currentUser={currentUser} />}
          {module === "strategies" && <StrategiesEditor currentUser={currentUser} />}
          {module === "resources" && <ResourcesEditor currentUser={currentUser} />}
          {module === "pd" && <PDEditor currentUser={currentUser} />}
          {module === "evaluation" && <EvaluationEditor currentUser={currentUser} />}
          {module === "admin" && hasRole(currentUser, "admin") && <AdminPanel currentUser={currentUser} onNavigate={setModule} />}
        </div>
      </div>
    </div>
  );
}
