import { useState } from "react";
import { LessonPlanDashboard } from "./LessonPlanDashboard.jsx";
import { LessonPlanWizard } from "./LessonPlanWizard.jsx";
import { LessonPlanEditor } from "./LessonPlanEditor.jsx";

/**
 * Main Lesson Planning Module - Routes between dashboard, wizard, and editor
 */
export function LessonPlanningModule({ currentUser }) {
  const [view, setView] = useState("dashboard"); // 'dashboard' | 'wizard' | 'editor'
  const [editingPlanId, setEditingPlanId] = useState(null);

  function handleNewPlan() {
    setView("wizard");
  }

  function handleEditPlan(planId) {
    setEditingPlanId(planId);
    setView("editor");
  }

  function handleWizardComplete(plan) {
    setEditingPlanId(plan.id);
    setView("editor");
  }

  function handleWizardCancel() {
    setView("dashboard");
  }

  function handleEditorBack() {
    setView("dashboard");
    setEditingPlanId(null);
  }

  if (view === "wizard") {
    return <LessonPlanWizard currentUser={currentUser} onComplete={handleWizardComplete} onCancel={handleWizardCancel} />;
  }

  if (view === "editor" && editingPlanId) {
    return <LessonPlanEditor planId={editingPlanId} currentUser={currentUser} onBack={handleEditorBack} onSaved={() => {}} />;
  }

  return <LessonPlanDashboard currentUser={currentUser} onNewPlan={handleNewPlan} onEditPlan={handleEditPlan} />;
}
