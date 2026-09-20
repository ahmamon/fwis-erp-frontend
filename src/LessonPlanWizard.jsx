import { useState, useEffect } from "react";
import { api } from "./api.js";
import { T } from "./ui.jsx";

/**
 * New Lesson Plan Wizard - Multi-step setup flow
 */
export function LessonPlanWizard({ currentUser, onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Starting point
    startingMode: "blank", // 'blank' or 'example'

    // Step 2: Teaching model
    baseModel: "ppp", // 'ppp', 'esa', 'gradual_release', 'task_based', 'integrated_skills', 'custom'

    // Step 3: Visual style
    visualStyle: "formal", // 'formal', 'colorful', 'modern'

    // Step 4: Basic info
    title: "",
    teacherName: currentUser.name,
    grade: "",
    classSection: "",
    lessonDate: new Date().toISOString().split("T")[0],
    unitTopic: "",
    mainSkill: "reading",
    languageFocus: "grammar",
    locale: "en",
  });

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [formData.locale]);

  async function loadTemplates() {
    const data = await api.get(`/api/lesson-templates?locale=${formData.locale}`);
    setTemplates(data);
  }

  function updateForm(updates) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const plan = await api.post("/api/lesson-plans", formData);
      onComplete(plan);
    } catch (err) {
      alert("Failed to create lesson plan: " + err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
      {/* Progress indicator */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, justifyContent: "center" }}>
        {[1, 2, 3, 4].map((num) => (
          <div
            key={num}
            style={{
              width: step === num ? 40 : 32,
              height: 8,
              borderRadius: 4,
              background: step >= num ? T.navy900 : T.line,
              transition: "all 0.2s",
            }}
          />
        ))}
      </div>

      {/* Step 1: Starting point */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Choose your starting point</h2>
          <p style={{ fontSize: 14, color: T.ink600, marginBottom: 24 }}>Start from scratch or use a completed example</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <button
              onClick={() => updateForm({ startingMode: "blank" })}
              style={{
                border: `2px solid ${formData.startingMode === "blank" ? T.navy900 : T.line}`,
                borderRadius: 12,
                padding: 24,
                background: formData.startingMode === "blank" ? "#f0f4ff" : "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Blank Template</div>
              <div style={{ fontSize: 13, color: T.ink600 }}>
                Creates the full selected structure with helpful prompts and placeholders but no completed lesson content
              </div>
            </button>

            <button
              onClick={() => updateForm({ startingMode: "example" })}
              style={{
                border: `2px solid ${formData.startingMode === "example" ? T.navy900 : T.line}`,
                borderRadius: 12,
                padding: 24,
                background: formData.startingMode === "example" ? "#f0f4ff" : "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Example Lesson</div>
              <div style={{ fontSize: 13, color: T.ink600 }}>
                Creates a fully completed, editable example showing the expected quality and level of detail
              </div>
            </button>
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={onCancel} style={{ padding: "10px 20px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: T.navy900, color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Teaching model */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Choose instructional model</h2>
          <p style={{ fontSize: 14, color: T.ink600, marginBottom: 24 }}>Select one of five teaching models or create a custom mix</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {templates.map((template) => (
              <button
                key={template.templateKey}
                onClick={() => updateForm({ baseModel: template.baseModel })}
                style={{
                  border: `2px solid ${formData.baseModel === template.baseModel ? T.navy900 : T.line}`,
                  borderRadius: 12,
                  padding: 20,
                  background: formData.baseModel === template.baseModel ? "#f0f4ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.navy900, marginBottom: 6 }}>{template.name}</div>
                <div style={{ fontSize: 12, color: T.ink600, marginBottom: 10 }}>{template.bestFor}</div>
                <div style={{ fontSize: 11, color: T.ink500, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                  {template.stages.length} stages • 90 minutes
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button onClick={() => setStep(1)} style={{ padding: "10px 20px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: T.navy900, color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Visual style */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Choose appearance</h2>
          <p style={{ fontSize: 14, color: T.ink600, marginBottom: 24 }}>Select your preferred visual style</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { key: "formal", name: "Formal School Document", desc: "Traditional, professional, print-oriented" },
              { key: "colorful", name: "Colorful Teacher-Friendly", desc: "Warm, welcoming, tinted sections" },
              { key: "modern", name: "Clean Modern Dashboard", desc: "Minimal, crisp, efficient spacing" },
            ].map((style) => (
              <button
                key={style.key}
                onClick={() => updateForm({ visualStyle: style.key })}
                style={{
                  border: `2px solid ${formData.visualStyle === style.key ? T.navy900 : T.line}`,
                  borderRadius: 12,
                  padding: 20,
                  background: formData.visualStyle === style.key ? "#f0f4ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.navy900, marginBottom: 6 }}>{style.name}</div>
                <div style={{ fontSize: 12, color: T.ink600 }}>{style.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button onClick={() => setStep(2)} style={{ padding: "10px 20px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: T.navy900, color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Basic information */}
      {step === 4 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.navy900, marginBottom: 8 }}>Basic lesson information</h2>
          <p style={{ fontSize: 14, color: T.ink600, marginBottom: 24 }}>Fill in the details for your lesson plan</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Lesson Title *</label>
              <input
                value={formData.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="e.g., Using Past Simple to Describe Events"
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Teacher Name</label>
              <input
                value={formData.teacherName}
                onChange={(e) => updateForm({ teacherName: e.target.value })}
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Grade *</label>
              <input
                value={formData.grade}
                onChange={(e) => updateForm({ grade: e.target.value })}
                placeholder="e.g., Grade 7"
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Class/Section *</label>
              <input
                value={formData.classSection}
                onChange={(e) => updateForm({ classSection: e.target.value })}
                placeholder="e.g., 7A"
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Date *</label>
              <input
                type="date"
                value={formData.lessonDate}
                onChange={(e) => updateForm({ lessonDate: e.target.value })}
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Unit/Topic *</label>
              <input
                value={formData.unitTopic}
                onChange={(e) => updateForm({ unitTopic: e.target.value })}
                placeholder="e.g., Past Simple Tense"
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Main Skill</label>
              <select
                value={formData.mainSkill}
                onChange={(e) => updateForm({ mainSkill: e.target.value })}
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              >
                <option value="reading">Reading</option>
                <option value="writing">Writing</option>
                <option value="listening">Listening</option>
                <option value="speaking">Speaking</option>
                <option value="integrated">Integrated</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Language Focus</label>
              <select
                value={formData.languageFocus}
                onChange={(e) => updateForm({ languageFocus: e.target.value })}
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              >
                <option value="grammar">Grammar</option>
                <option value="vocabulary">Vocabulary</option>
                <option value="pronunciation">Pronunciation</option>
                <option value="functions">Functions</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.ink600, marginBottom: 6 }}>Language</label>
              <select
                value={formData.locale}
                onChange={(e) => updateForm({ locale: e.target.value })}
                style={{ width: "100%", padding: 10, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button onClick={() => setStep(3)} style={{ padding: "10px 20px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.title || !formData.grade || !formData.classSection || !formData.unitTopic}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: 8,
                background: loading || !formData.title ? T.ink300 : T.navy900,
                color: "#fff",
                fontWeight: 600,
                cursor: loading || !formData.title ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating..." : "Create Lesson Plan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
