import { useState, useEffect } from "react";
import { api } from "./api.js";
import { T } from "./ui.jsx";
import { SectionNavigator } from "./SectionNavigator.jsx";
import { TimingSystem } from "./TimingSystem.jsx";

const DEFAULT_CONTENT_FIELDS = ["purpose", "teacherActions", "studentActions", "evidence"];
const CONTENT_LABELS = {
  purpose: "Purpose / Learning focus",
  teacherActions: "Teacher actions",
  studentActions: "Student actions",
  evidence: "Evidence of learning",
  materials: "Materials and resources",
  differentiation: "Differentiation",
  assessment: "Assessment",
};

function copyContent(content) {
  return content && typeof content === "object" && !Array.isArray(content)
    ? JSON.parse(JSON.stringify(content))
    : {};
}

function sectionDraft(section) {
  return {
    customTitle: section.customTitle || "",
    durationMinutes: Number(section.durationMinutes) || 0,
    durationLocked: Boolean(section.durationLocked),
    content: copyContent(section.content),
  };
}

function draftsFromPlan(plan) {
  return Object.fromEntries((plan.sections || []).map((section) => [section.id, sectionDraft(section)]));
}

function humanize(value) {
  return String(value || "")
    .replace(/^section\./, "")
    .replace(/\.title$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldText(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value || "");
}

function fieldValue(previous, value) {
  if (Array.isArray(previous)) return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return value;
}

/**
 * Lesson Plan Editor - Main 3-panel layout for editing lesson plans
 */
export function LessonPlanEditor({ planId, currentUser, onBack, onSaved }) {
  const [plan, setPlan] = useState(null);
  const [planDraft, setPlanDraft] = useState({ title: "", locale: "en", visualStyle: "formal" });
  const [sectionDrafts, setSectionDrafts] = useState({});
  const [planDirty, setPlanDirty] = useState(false);
  const [dirtySectionIds, setDirtySectionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [selectedSection, setSelectedSection] = useState(null);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (!planDirty && dirtySectionIds.length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [planDirty, dirtySectionIds]);

  async function loadPlan() {
    setLoading(true);
    try {
      const data = await api.get(`/api/lesson-plans/${planId}`);
      setPlan(data);
      setPlanDraft({ title: data.title || "", locale: data.locale || "en", visualStyle: data.visualStyle || "formal" });
      setSectionDrafts(draftsFromPlan(data));
      setPlanDirty(false);
      setDirtySectionIds([]);
      setSelectedSection((current) => data.sections.some((section) => section.id === current) ? current : data.sections[0]?.id || null);
    } catch (err) {
      alert("Failed to load plan: " + err.message);
      onBack();
    } finally {
      setLoading(false);
    }
  }

  function changePlan(field, value) {
    setPlanDraft((previous) => ({ ...previous, [field]: value }));
    setPlanDirty(true);
    setSaveNotice("");
  }

  function changeSection(sectionId, updates) {
    setSectionDrafts((previous) => ({
      ...previous,
      [sectionId]: { ...previous[sectionId], ...updates },
    }));
    setDirtySectionIds((previous) => previous.includes(sectionId) ? previous : [...previous, sectionId]);
    setSaveNotice("");
  }

  function changeContent(sectionId, field, value) {
    const current = sectionDrafts[sectionId]?.content || {};
    changeSection(sectionId, { content: { ...current, [field]: fieldValue(current[field], value) } });
  }

  async function saveChanges() {
    if (saving || (!planDirty && dirtySectionIds.length === 0)) return true;
    setSaving(true);
    setSaveError("");
    setSaveNotice("");
    try {
      await Promise.all(dirtySectionIds.map((sectionId) => api.patch(`/api/lesson-sections/${sectionId}`, sectionDrafts[sectionId])));
      if (planDirty) await api.patch(`/api/lesson-plans/${planId}`, planDraft);
      const refreshed = await api.get(`/api/lesson-plans/${planId}`);
      setPlan(refreshed);
      setPlanDraft({ title: refreshed.title || "", locale: refreshed.locale || "en", visualStyle: refreshed.visualStyle || "formal" });
      setSectionDrafts(draftsFromPlan(refreshed));
      setPlanDirty(false);
      setDirtySectionIds([]);
      setSaveNotice("Changes saved.");
      onSaved?.(refreshed);
      return true;
    } catch (err) {
      setSaveError("Could not save changes: " + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if ((planDirty || dirtySectionIds.length > 0) && !confirm("Leave without saving your changes?")) return;
    onBack();
  }

  async function updateSection(sectionId, updates) {
    try {
      const updated = await api.patch(`/api/lesson-sections/${sectionId}`, updates);
      setPlan((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => (s.id === sectionId ? updated : s)),
      }));
      if (sectionDrafts[sectionId]) {
        setSectionDrafts((previous) => ({
          ...previous,
          [sectionId]: { ...previous[sectionId], ...updates },
        }));
      }
    } catch (err) {
      alert("Failed to update section: " + err.message);
    }
  }

  async function handleReorder(sectionIds) {
    try {
      const updated = await api.post("/api/lesson-sections/reorder", {
        lessonPlanId: planId,
        sectionIds,
      });
      setPlan((prev) => ({ ...prev, sections: updated }));
    } catch (err) {
      alert("Failed to reorder: " + err.message);
    }
  }

  async function handleToggleVisibility(sectionId) {
    const section = plan.sections.find((s) => s.id === sectionId);
    await updateSection(sectionId, { isVisible: !section.isVisible });
  }

  async function handleDuplicateSection(sectionId) {
    try {
      const duplicate = await api.post(`/api/lesson-sections/${sectionId}/duplicate`);
      setPlan((prev) => ({
        ...prev,
        sections: [...prev.sections, duplicate],
      }));
      setSectionDrafts((previous) => ({ ...previous, [duplicate.id]: sectionDraft(duplicate) }));
      setSelectedSection(duplicate.id);
    } catch (err) {
      alert("Failed to duplicate: " + err.message);
    }
  }

  async function handleDeleteSection(sectionId) {
    if (!confirm("Delete this section?")) return;
    try {
      await api.delete(`/api/lesson-sections/${sectionId}`);
      setPlan((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== sectionId),
      }));
      setSectionDrafts((previous) => {
        const next = { ...previous };
        delete next[sectionId];
        return next;
      });
      setDirtySectionIds((previous) => previous.filter((id) => id !== sectionId));
      if (selectedSection === sectionId) setSelectedSection(plan.sections.find((item) => item.id !== sectionId)?.id || null);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  async function handleAutoBalance() {
    try {
      if (!(await saveChanges())) return;
      const updated = await api.post(`/api/lesson-plans/${planId}/auto-balance`);
      setPlan(updated);
      setSectionDrafts(draftsFromPlan(updated));
      setDirtySectionIds([]);
      setSaveNotice("Timing balanced and saved.");
    } catch (err) {
      alert("Failed to auto-balance: " + err.message);
    }
  }

  async function handleExportPdf() {
    try {
      if (!(await saveChanges())) return;
      const slug = (planDraft.title || "lesson-plan")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      await api.downloadPdf(`/api/lesson-plan-exports/${planId}/pdf`, `fwis-${slug || "lesson-plan"}.pdf`);
    } catch (err) {
      alert("Failed to export: " + err.message);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 16, color: T.ink600 }}>Loading lesson plan...</div>
      </div>
    );
  }

  if (!plan) return null;

  const section = plan.sections.find((s) => s.id === selectedSection);
  const draft = section ? sectionDrafts[section.id] || sectionDraft(section) : null;
  const contentFields = draft ? (Object.keys(draft.content).length ? Object.keys(draft.content) : DEFAULT_CONTENT_FIELDS) : [];
  const hasUnsavedChanges = planDirty || dirtySectionIds.length > 0;
  const displaySections = plan.sections.map((item) => ({ ...item, ...(sectionDrafts[item.id] || {}) }));
  const draftTotalMinutes = displaySections.reduce((total, item) => total + Number(item.durationMinutes || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: `1px solid ${T.line}`,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={handleBack}
            style={{
              padding: "8px 16px",
              border: `1px solid ${T.line}`,
              borderRadius: 8,
              background: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <input
            value={planDraft.title}
            onChange={(e) => changePlan("title", e.target.value)}
            style={{
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              outline: "none",
              color: T.navy900,
              minWidth: 300,
            }}
          />
          <div style={{ fontSize: 12, color: saving ? T.ink600 : hasUnsavedChanges ? "#92400e" : "#166534", fontWeight: 600 }}>
            {saving ? "Saving…" : hasUnsavedChanges ? "Unsaved changes" : "Saved"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={planDraft.locale}
            onChange={(e) => changePlan("locale", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13 }}
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
          </select>

          <select
            value={planDraft.visualStyle}
            onChange={(e) => changePlan("visualStyle", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13 }}
          >
            <option value="formal">Formal</option>
            <option value="colorful">Colorful</option>
            <option value="modern">Modern</option>
          </select>

          <button
            onClick={saveChanges}
            disabled={saving || !hasUnsavedChanges}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: saving || !hasUnsavedChanges ? T.ink300 : "#166534",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || !hasUnsavedChanges ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            onClick={handleExportPdf}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: T.navy900,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {(saveError || saveNotice) && (
        <div style={{ padding: "9px 20px", background: saveError ? "#fff1f2" : "#ecfdf5", color: saveError ? "#9f1239" : "#166534", borderBottom: `1px solid ${saveError ? "#fecdd3" : "#a7f3d0"}`, fontSize: 13, fontWeight: 600 }}>
          {saveError || saveNotice}
        </div>
      )}

      {/* 3-panel layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Section Navigator */}
        <div style={{ width: 280, borderRight: `1px solid ${T.line}`, background: T.gray50, overflowY: "auto" }}>
          <SectionNavigator
            sections={displaySections}
            onReorder={handleReorder}
            onToggleVisibility={handleToggleVisibility}
            onEditSection={setSelectedSection}
            onDuplicateSection={handleDuplicateSection}
            onDeleteSection={handleDeleteSection}
            onAddSection={() => alert("Add section from library (to be implemented)")}
          />
        </div>

        {/* Center: Section Editor */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#fff" }}>
          {section && draft ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Section Title</label>
                <input
                  value={draft.customTitle}
                  onChange={(e) => changeSection(section.id, { customTitle: e.target.value })}
                  placeholder={humanize(section.sectionKey || section.defaultTitleKey)}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: `1px solid ${T.line}`,
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Duration (minutes)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={draft.durationMinutes}
                    onChange={(e) => changeSection(section.id, { durationMinutes: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                    style={{ width: 100, padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={draft.durationLocked}
                      onChange={(e) => changeSection(section.id, { durationLocked: e.target.checked })}
                    />
                    Lock duration
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900, marginBottom: 12 }}>Section Content</div>
                <div style={{ display: "grid", gap: 16 }}>
                  {contentFields.map((field) => (
                    <div key={field}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>
                        {CONTENT_LABELS[field] || humanize(field)}
                      </label>
                      <textarea
                        value={fieldText(draft.content[field])}
                        onChange={(e) => changeContent(section.id, field, e.target.value)}
                        rows={field === "teacherActions" || field === "studentActions" ? 5 : 3}
                        dir="auto"
                        placeholder={`Enter ${String(CONTENT_LABELS[field] || humanize(field)).toLowerCase()}…`}
                        style={{
                          width: "100%",
                          resize: "vertical",
                          padding: 12,
                          border: `1px solid ${T.line}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: "inherit",
                          lineHeight: 1.5,
                          boxSizing: "border-box",
                        }}
                      />
                      {Array.isArray(draft.content[field]) && <div style={{ fontSize: 11, color: T.ink500, marginTop: 4 }}>Enter one item per line.</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 60, color: T.ink600 }}>Select a section to edit</div>
          )}
        </div>

        {/* Right: Timing & Properties */}
        <div style={{ width: 280, borderLeft: `1px solid ${T.line}`, background: T.gray50, padding: 16, overflowY: "auto" }}>
          <TimingSystem totalMinutes={draftTotalMinutes} onAutoBalance={handleAutoBalance} />

          <div style={{ marginTop: 24, padding: 16, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.navy900, marginBottom: 12 }}>Lesson Info</h4>
            <div style={{ fontSize: 12, color: T.ink600, marginBottom: 8 }}>
              <strong>Grade:</strong> {plan.grade}
            </div>
            <div style={{ fontSize: 12, color: T.ink600, marginBottom: 8 }}>
              <strong>Class:</strong> {plan.classSection}
            </div>
            <div style={{ fontSize: 12, color: T.ink600, marginBottom: 8 }}>
              <strong>Date:</strong> {new Date(plan.lessonDate).toLocaleDateString()}
            </div>
            <div style={{ fontSize: 12, color: T.ink600, marginBottom: 8 }}>
              <strong>Model:</strong> {plan.baseModel.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: T.ink600 }}>
              <strong>Sections:</strong> {plan.sections.filter((s) => s.isVisible).length} / {plan.sections.length} visible
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
