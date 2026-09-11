import { useEffect, useState } from "react";
import { api, getSignedInEmail, signOut } from "./api.js";
import LoginScreen from "./LoginScreen.jsx";
import { Sidebar, TopBar, MODULE_TITLES } from "./Shell.jsx";
import Dashboard from "./Dashboard.jsx";
import Planning from "./Planning.jsx";
import { LessonsList, CurriculumList, StrategiesList, ResourcesList, PDList, EvaluationList, SettingsView, ProfileView } from "./OtherModules.jsx";
import { T, Loading } from "./ui.jsx";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [module, setModule] = useState("dashboard");

  useEffect(() => {
    if (!getSignedInEmail()) { setCheckedSession(true); return; }
    api.get("/api/users/me")
      .then(setCurrentUser)
      .catch(() => signOut())
      .finally(() => setCheckedSession(true));
  }, []);

  if (!checkedSession) return <Loading label="Checking session..." />;

  if (!currentUser) {
    return (
      <LoginScreen onSignedIn={() => {
        api.get("/api/users/me").then(setCurrentUser);
      }} />
    );
  }

  function handleSignOut() {
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
          {module === "lessons" && <LessonsList />}
          {module === "curriculum" && <CurriculumList />}
          {module === "strategies" && <StrategiesList />}
          {module === "resources" && <ResourcesList />}
          {module === "pd" && <PDList />}
          {module === "evaluation" && <EvaluationList />}
          {module === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  );
}
