import { useState, useEffect } from "react";
import { api } from "./api.js";
import { T } from "./ui.jsx";
import { SectionNavigator } from "./SectionNavigator.jsx";
import { TimingSystem } from "./TimingSystem.jsx";

/**
 * Lesson Plan Editor - Main 3-panel layout for editing lesson plans
 */
export function LessonPlanEditor({ planId, currentUser, onBack, onSaved }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  async function loadPlan() {
    setLoading(true);
    try {
      const data = await api.get(`/api/lesson-plans/${planId}`);
      setPlan(data);
      if (data.sections.length > 0) {
        setSelectedSection(data.sections[0].id);
      }
    } catch (err) {
      alert("Failed to load plan: " + err.message);
      onBack();
    } finally {
      setLoading(false);
    }
  }

  async function updatePlanMetadata(updates) {
    try {
      const updated = await api.patch(`/api/lesson-plans/${planId}`, updates);
      setPlan(updated);
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  }

  async function updateSection(sectionId, updates) {
    try {
      const updated = await api.patch(`/api/lesson-sections/${sectionId}`, updates);
      setPlan((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => (s.id === sectionId ? updated : s)),
      }));
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
      if (selectedSection === sectionId && plan.sections.length > 1) {
        setSelectedSection(plan.sections[0].id);
      }
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  async function handleAutoBalance() {
    try {
      const updated = await api.post(`/api/lesson-plans/${planId}/auto-balance`);
      setPlan(updated);
    } catch (err) {
      alert("Failed to auto-balance: " + err.message);
    }
  }

  async function handleExportPdf() {
    try {
      const slug = (plan.title || "lesson-plan")
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
            onClick={onBack}
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
            value={plan.title}
            onChange={(e) => updatePlanMetadata({ title: e.target.value })}
            style={{
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              outline: "none",
              color: T.navy900,
              minWidth: 300,
            }}
          />
          <div style={{ fontSize: 12, color: T.ink500 }}>{saving ? "Saving..." : "Saved"}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={plan.locale}
            onChange={(e) => updatePlanMetadata({ locale: e.target.value })}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13 }}
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
          </select>

          <select
            value={plan.visualStyle}
            onChange={(e) => updatePlanMetadata({ visualStyle: e.target.value })}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 13 }}
          >
            <option value="formal">Formal</option>
            <option value="colorful">Colorful</option>
            <option value="modern">Modern</option>
          </select>

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

      {/* 3-panel layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Section Navigator */}
        <div style={{ width: 280, borderRight: `1px solid ${T.line}`, background: T.gray50, overflowY: "auto" }}>
          <SectionNavigator
            sections={plan.sections}
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
          {section ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Section Title</label>
                <input
                  value={section.customTitle || ""}
                  onChange={(e) => updateSection(section.id, { customTitle: e.target.value })}
                  placeholder={section.defaultTitleKey}
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
                    value={section.durationMinutes}
                    onChange={(e) => updateSection(section.id, { durationMinutes: parseInt(e.target.value) || 0 })}
                    style={{ width: 100, padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={section.durationLocked}
                      onChange={(e) => updateSection(section.id, { durationLocked: e.target.checked })}
                    />
                    Lock duration
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Section Content</label>
                <textarea
                  value={JSON.stringify(section.content, null, 2)}
                  onChange={(e) => {
                    try {
                      const content = JSON.parse(e.target.value);
                      updateSection(section.id, { content });
                    } catch (err) {
                      // Invalid JSON, ignore
                    }
                  }}
                  style={{
                    width: "100%",
                    minHeight: 400,
                    padding: 12,
                    border: `1px solid ${T.line}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                />
                <div style={{ fontSize: 11, color: T.ink500, marginTop: 4 }}>Edit as JSON (structured rich content editor coming soon)</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 60, color: T.ink600 }}>Select a section to edit</div>
          )}
        </div>

        {/* Right: Timing & Properties */}
        <div style={{ width: 280, borderLeft: `1px solid ${T.line}`, background: T.gray50, padding: 16, overflowY: "auto" }}>
          <TimingSystem totalMinutes={plan.totalMinutes} onAutoBalance={handleAutoBalance} />

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
