import { useEffect, useState } from "react";
import { api, isSignedIn, signOut } from "./api.js";
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
import SettingsEditor from "./modules/SettingsEditor.jsx";
import ReportsCenter from "./modules/ReportsCenter.jsx";
import UsersEditor from "./modules/UsersEditor.jsx";
import { T, Loading } from "./ui.jsx";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [module, setModule] = useState("dashboard");
  // Set when the session check fails with a backend message (e.g. a rejected
  // login with a non-school-domain Microsoft account) so LoginScreen can show it.
  const [loginError, setLoginError] = useState("");

  // Sidebar collapsed/width preferences — persisted per browser via localStorage.
  const sidebar = useSidebarPreferences();

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
        .then(setCurrentUser)
        .catch((e) => { setLoginError(e.message || ""); signOut(); })
        .finally(() => setCheckedSession(true));
    })();
  }, []);

  if (!checkedSession) return <Loading label="Checking session..." />;

  if (!currentUser) {
    return (
      <LoginScreen
        externalError={loginError}
        onClearExternalError={() => setLoginError("")}
        onSignedIn={() => {
          api.get("/api/users/me")
            .then(setCurrentUser)
            .catch((e) => { setLoginError(e.message || ""); signOut(); });
        }}
      />
    );
  }

  async function handleSignOut() {
    await signOutOfMicrosoft();
    signOut();
    setCurrentUser(null);
    setModule("dashboard");
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: T.cream50, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow: "hidden" }}>
      <Sidebar active={module} onNavigate={setModule} collapsed={sidebar.collapsed} width={sidebar.width} onResize={sidebar.resize} role={currentUser.role} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar currentUser={currentUser} onSignOut={handleSignOut} title={MODULE_TITLES[module]} onToggleSidebar={sidebar.toggleCollapsed} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {module === "dashboard" && <Dashboard currentUser={currentUser} />}
          {module === "reports" && ["hod", "supervisor", "admin"].includes(currentUser.role) && <ReportsCenter currentUser={currentUser} />}
          {module === "profile" && <ProfileView currentUser={currentUser} onUpdated={setCurrentUser} />}
          {module === "planning" && <Planning currentUser={currentUser} />}
          {module === "lessons" && <LessonsEditor currentUser={currentUser} />}
          {module === "curriculum" && <CurriculumEditor currentUser={currentUser} />}
          {module === "strategies" && <StrategiesEditor currentUser={currentUser} />}
          {module === "resources" && <ResourcesEditor currentUser={currentUser} />}
          {module === "pd" && <PDEditor currentUser={currentUser} />}
          {module === "evaluation" && <EvaluationEditor currentUser={currentUser} />}
          {module === "settings" && <SettingsEditor currentUser={currentUser} />}
          {module === "admin" && currentUser.role === "admin" && <UsersEditor currentUser={currentUser} />}
        </div>
      </div>
    </div>
  );
}
