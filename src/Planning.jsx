import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, StatusBadge, Loading, ErrorBanner, FieldLabel, TextField, Input, Button, SectionCard, hasRole } from "./ui.jsx";
import { StrategyPicker, ResourceLibraryPicker } from "./modules/pickers.jsx";

const FIELDS = [
  ["objectives", "Learning objectives"], ["topics", "Topics / content"], ["activities", "Activities"],
  ["differentiation", "Differentiation"], ["assessment", "Assessment"], ["homework", "Homework"],
  ["resources", "Resources"], ["technology", "Technology used"], ["reflection", "Reflection"],
];

export default function Planning({ currentUser, persona }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  // The create form is an inline "new draft" row with an optional due date.
  const [showCreate, setShowCreate] = useState(false);
  const [dueDate, setDueDate] = useState("");

  function reload() {
    api.get("/api/plans").then(setPlans).catch((e) => setError(e.message));
  }
  useEffect(reload, []);

  async function createDraft() {
    try {
      // NOTE: branchId and the subject/grade/term/week labels are hardcoded
      // placeholders for this pass — subject follows the teacher's department.
      const branches = await api.get("/api/settings/branches");
      const branch = branches[0];
      const created = await api.post("/api/plans", {
        branchId: branch.id, department: currentUser.department || "English",
        subject: currentUser.department || "English", grade: "Grade 8", term: "Term 1", week: "Week 1",
        dueDate: dueDate ? `${dueDate}T00:00:00` : null,
      });
      setDueDate("");
      setShowCreate(false);
      reload();
      setOpenId(created.id);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!plans) return <Loading />;

  if (openId) {
    return <PlanDetail id={openId} currentUser={currentUser} persona={persona} onBack={() => { setOpenId(null); reload(); }} />;
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>Weekly plans</h1>
        {hasRole(currentUser, "teacher") && !showCreate && <Button onClick={() => { setShowCreate(true); setDueDate(""); }}>+ New weekly plan</Button>}
        {hasRole(currentUser, "teacher") && showCreate && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <div>
              <FieldLabel>Due date (optional)</FieldLabel>
              <Input type="date" value={dueDate} onChange={setDueDate} />
            </div>
            <Button onClick={createDraft}>Create draft</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        )}
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        {plans.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.ink600, fontSize: 13.5 }}>No plans yet.</div>}
        {plans.map((p) => (
          <button key={p.id} onClick={() => setOpenId(p.id)} style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 18px", borderTop: `1px solid ${T.line}`, background: "#fff", textAlign: "left", cursor: "pointer",
          }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink900 }}>{p.teacher?.name}</div>
              <div style={{ fontSize: 12, color: T.ink600 }}>{p.subject} · {p.grade} · {p.term}, {p.week}</div>
              {p.dueDate && (
                <div style={{ fontSize: 11.5, color: T.gold600, marginTop: 2 }}>
                  Due {new Date(p.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              )}
            </div>
            <StatusBadge status={p.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

function slug(text) {
  return String(text || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plan";
}

function PlanDetail({ id, currentUser, persona, onBack }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [showReturnBox, setShowReturnBox] = useState(false);

  function reload() {
    api.get(`/api/plans/${id}`).then(setPlan).catch((e) => setError(e.message));
  }
  useEffect(reload, [id]);

  // A dueDate ISO string ↔ a <input type="date"> value ("YYYY-MM-DD"), in local
  // time so the day the teacher set round-trips without a UTC shift.
  const dateValue = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await api.downloadPdf(`/api/plans/${id}/export`, `fwis-weekly-plan-${slug(plan.subject)}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  async function save() {
    try {
      const data = {};
      FIELDS.forEach(([key]) => { data[key] = plan[key]; });
      data.strategies = plan.strategies || [];
      data.dueDate = plan.dueDate || null;
      await api.patch(`/api/plans/${id}`, data);
      reload();
    } catch (e) { setError(e.message); }
  }

  async function submit() {
    try { await api.post(`/api/plans/${id}/submit`); reload(); } catch (e) { setError(e.message); }
  }
  async function approve() {
    try { await api.post(`/api/plans/${id}/approve`); reload(); } catch (e) { setError(e.message); }
  }
  async function returnPlan() {
    if (!returnNote.trim()) return;
    try {
      await api.post(`/api/plans/${id}/return`, { comment: returnNote });
      setReturnNote(""); setShowReturnBox(false); reload();
    } catch (e) { setError(e.message); }
  }

  if (!plan) return <Loading />;

  const isOwner = hasRole(currentUser, "teacher") && plan.teacherId === currentUser.id;
  const canEdit = isOwner && ["draft", "returned"].includes(plan.status);
  const canReview = (persona === "hod" && plan.status === "submitted") ||
    (persona === "supervisor" && plan.status === "hod_approved");

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 900, margin: "0 auto" }}>
      <button onClick={onBack} style={{ border: "none", background: "transparent", color: T.ink600, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16 }}>
        ← Back to all plans
      </button>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.navy900, margin: 0 }}>{plan.subject} · {plan.grade}</h1>
        <StatusBadge status={plan.status} />
        {plan.dueDate && (
          <span style={{ fontSize: 12.5, color: T.gold600, fontWeight: 600 }}>
            Due {new Date(plan.dueDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ maxWidth: 260 }}>
          <FieldLabel>Due date {canEdit ? "(optional)" : ""}</FieldLabel>
          <Input
            type="date"
            value={dateValue(plan.dueDate)}
            onChange={(v) => setPlan({ ...plan, dueDate: v ? `${v}T00:00:00` : null })}
            disabled={!canEdit}
          />
        </div>
        {FIELDS.map(([key, label]) => (
          <div key={key}>
            <FieldLabel>{label}</FieldLabel>
            {key === "resources" && (
              <ResourceLibraryPicker value={plan.resources} onChange={(v) => setPlan({ ...plan, resources: v })} disabled={!canEdit} />
            )}
            <TextField value={plan[key]} onChange={(v) => setPlan({ ...plan, [key]: v })} disabled={!canEdit} />
          </div>
        ))}
        <div>
          <StrategyPicker value={plan.strategies || []} onChange={(s) => setPlan({ ...plan, strategies: s })} disabled={!canEdit} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.line}` }}>
        <Button variant="outline" onClick={onExport} disabled={exporting}>{exporting ? "Exporting…" : "Export PDF"}</Button>
        {canEdit && <Button variant="outline" onClick={save}>Save draft</Button>}
        {canEdit && <Button onClick={submit}>{plan.status === "returned" ? "Resubmit" : "Submit for review"}</Button>}
        {canReview && !showReturnBox && <Button variant="success" onClick={approve}>Approve</Button>}
        {canReview && !showReturnBox && <Button variant="outline" onClick={() => setShowReturnBox(true)}>Return with comment</Button>}
      </div>

      {showReturnBox && (
        <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream100 }}>
          <FieldLabel required>Comment for the teacher</FieldLabel>
          <TextField value={returnNote} onChange={setReturnNote} rows={3} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button variant="danger" onClick={returnPlan}>Send back</Button>
            <Button variant="outline" onClick={() => setShowReturnBox(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {plan.comments?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionCard title="Comments">
            {plan.comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.author?.name}</div>
                <div style={{ fontSize: 13 }}>{c.text}</div>
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {plan.auditLogs?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionCard title="Audit trail">
            {plan.auditLogs.map((a) => (
              <div key={a.id} style={{ fontSize: 12.5, color: T.ink600, padding: "6px 0" }}>
                <strong style={{ color: T.ink900 }}>{a.action}</strong> · {a.by?.name} · {new Date(a.at).toLocaleString()}
              </div>
            ))}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
