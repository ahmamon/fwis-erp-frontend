import { useState, useEffect } from "react";
import { api } from "./api.js";
import { T } from "./ui.jsx";

/**
 * Lesson Plan Dashboard - List/Grid view with search and filters
 */
export function LessonPlanDashboard({ currentUser, onNewPlan, onEditPlan }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    locale: "",
    baseModel: "",
    grade: "",
  });

  useEffect(() => {
    loadPlans();
  }, [filters]);

  async function loadPlans() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.status) params.append("status", filters.status);
      if (filters.locale) params.append("locale", filters.locale);
      if (filters.baseModel) params.append("baseModel", filters.baseModel);
      if (filters.grade) params.append("grade", filters.grade);

      const data = await api.get(`/api/lesson-plans?${params}`);
      setPlans(data);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDuplicate(planId) {
    if (!confirm("Duplicate this lesson plan?")) return;
    try {
      const duplicate = await api.post(`/api/lesson-plans/${planId}/duplicate`);
      setPlans((prev) => [duplicate, ...prev]);
    } catch (err) {
      alert("Failed to duplicate: " + err.message);
    }
  }

  async function handleArchive(planId) {
    if (!confirm("Archive this lesson plan?")) return;
    try {
      await api.delete(`/api/lesson-plans/${planId}`);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      alert("Failed to archive: " + err.message);
    }
  }

  async function handleExportPdf(plan) {
    try {
      const slug = (plan.title || "lesson-plan")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      await api.downloadPdf(`/api/lesson-plan-exports/${plan.id}/pdf`, `fwis-${slug || "lesson-plan"}.pdf`);
    } catch (err) {
      alert("Failed to export: " + err.message);
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.navy900, margin: 0 }}>Lesson Plans</h1>
          <p style={{ fontSize: 14, color: T.ink600, margin: "4px 0 0" }}>90-minute English lesson plans</p>
        </div>
        <button
          onClick={onNewPlan}
          style={{
            padding: "12px 24px",
            border: "none",
            borderRadius: 8,
            background: T.navy900,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Create Lesson Plan
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search by title or topic..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
          />

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.locale}
            onChange={(e) => updateFilter("locale", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
          >
            <option value="">All Languages</option>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
          </select>

          <select
            value={filters.baseModel}
            onChange={(e) => updateFilter("baseModel", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
          >
            <option value="">All Models</option>
            <option value="ppp">PPP</option>
            <option value="esa">ESA</option>
            <option value="gradual_release">Gradual Release</option>
            <option value="task_based">Task-Based</option>
            <option value="integrated_skills">Integrated Skills</option>
            <option value="custom">Custom Mix</option>
          </select>

          <input
            type="text"
            placeholder="Grade..."
            value={filters.grade}
            onChange={(e) => updateFilter("grade", e.target.value)}
            style={{ padding: "8px 12px", border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setViewMode("grid")}
            style={{
              padding: "6px 12px",
              border: `1px solid ${viewMode === "grid" ? T.navy900 : T.line}`,
              borderRadius: 6,
              background: viewMode === "grid" ? "#f0f4ff" : "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            style={{
              padding: "6px 12px",
              border: `1px solid ${viewMode === "list" ? T.navy900 : T.line}`,
              borderRadius: 6,
              background: viewMode === "list" ? "#f0f4ff" : "#fff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            List
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: T.ink600 }}>
          <div style={{ fontSize: 16 }}>Loading lesson plans...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && plans.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.navy900, marginBottom: 8 }}>No lesson plans yet</div>
          <div style={{ fontSize: 14, color: T.ink600, marginBottom: 20 }}>Create your first 90-minute lesson plan</div>
          <button
            onClick={onNewPlan}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: 8,
              background: T.navy900,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Create Lesson Plan
          </button>
        </div>
      )}

      {/* Grid view */}
      {!loading && plans.length > 0 && viewMode === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: "#fff",
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div onClick={() => onEditPlan(plan.id)}>
                <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.navy900, marginBottom: 4 }}>{plan.title}</div>
                    <div style={{ fontSize: 13, color: T.ink600 }}>
                      {plan.grade} • {plan.classSection}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: plan.status === "ready" ? "#d1fae5" : plan.status === "archived" ? "#fee" : "#fef3c7",
                      color: plan.status === "ready" ? "#065f46" : plan.status === "archived" ? "#991b1b" : "#92400e",
                    }}
                  >
                    {plan.status}
                  </div>
                </div>

                <div style={{ fontSize: 13, color: T.ink600, marginBottom: 12 }}>{plan.unitTopic}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: T.ink500, padding: "3px 8px", background: T.gray100, borderRadius: 4 }}>
                    {plan.baseModel.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: T.ink500, padding: "3px 8px", background: T.gray100, borderRadius: 4 }}>
                    {plan.locale.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: T.ink500, padding: "3px 8px", background: T.gray100, borderRadius: 4 }}>
                    {plan.totalMinutes} min
                  </div>
                </div>

                <div style={{ fontSize: 12, color: T.ink500, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
                  {new Date(plan.lessonDate).toLocaleDateString()} • Updated {new Date(plan.updatedAt).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPlan(plan.id);
                  }}
                  style={{ flex: 1, padding: "6px 12px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportPdf(plan);
                  }}
                  style={{ flex: 1, padding: "6px 12px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}
                >
                  PDF
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(plan.id);
                  }}
                  style={{ flex: 1, padding: "6px 12px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer" }}
                >
                  Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchive(plan.id);
                  }}
                  style={{ padding: "6px 12px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", color: "#991b1b" }}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && plans.length > 0 && viewMode === "list" && (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              style={{
                padding: 16,
                borderBottom: index < plans.length - 1 ? `1px solid ${T.line}` : "none",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.gray50)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              onClick={() => onEditPlan(plan.id)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.navy900, marginBottom: 4 }}>{plan.title}</div>
                  <div style={{ fontSize: 13, color: T.ink600 }}>
                    {plan.grade} • {plan.classSection} • {plan.unitTopic}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: T.ink500, textAlign: "right", minWidth: 120 }}>
                    <div>{new Date(plan.lessonDate).toLocaleDateString()}</div>
                    <div>{plan.totalMinutes} minutes</div>
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: plan.status === "ready" ? "#d1fae5" : plan.status === "archived" ? "#fee" : "#fef3c7",
                      color: plan.status === "ready" ? "#065f46" : plan.status === "archived" ? "#991b1b" : "#92400e",
                    }}
                  >
                    {plan.status}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
