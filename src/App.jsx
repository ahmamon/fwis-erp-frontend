import { useEffect, useState } from "react";
import { api, isSignedIn, signOut } from "./api.js";
import { isAzureEnabled, refreshMicrosoftToken, signOutOfMicrosoft } from "./auth.js";
import LoginScreen from "./LoginScreen.jsx";
import { Sidebar, TopBar, MODULE_TITLES } from "./Shell.jsx";
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
import { T, Loading } from "./ui.jsx";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [module, setModule] = useState("dashboard");

  useEffect(() => {
    (async () => {
      if (!isSignedIn()) { setCheckedSession(true); return; }
      // Renew the Azure access token silently if a cached session exists, so a
      // returning visitor isn't forced through another sign-in popup.
      if (isAzureEnabled()) await refreshMicrosoftToken();
      api.get("/api/users/me")
        .then(setCurrentUser)
        .catch(() => signOut())
        .finally(() => setCheckedSession(true));
    })();
  }, []);

  if (!checkedSession) return <Loading label="Checking session..." />;

  if (!currentUser) {
    return (
      <LoginScreen onSignedIn={() => {
        api.get("/api/users/me").then(setCurrentUser);
      }} />
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
      <Sidebar active={module} onNavigate={setModule} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar currentUser={currentUser} onSignOut={handleSignOut} title={MODULE_TITLES[module]} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          {module === "dashboard" && <Dashboard currentUser={currentUser} />}
          {module === "profile" && <ProfileView currentUser={currentUser} onUpdated={setCurrentUser} />}
          {module === "planning" && <Planning currentUser={currentUser} />}
          {module === "lessons" && <LessonsEditor currentUser={currentUser} />}
          {module === "curriculum" && <CurriculumEditor currentUser={currentUser} />}
          {module === "strategies" && <StrategiesEditor currentUser={currentUser} />}
          {module === "resources" && <ResourcesEditor currentUser={currentUser} />}
          {module === "pd" && <PDEditor currentUser={currentUser} />}
          {module === "evaluation" && <EvaluationEditor currentUser={currentUser} />}
          {module === "settings" && <SettingsEditor currentUser={currentUser} />}
        </div>
      </div>
    </div>
  );
}
