import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, StatusBadge, Loading, ErrorBanner, FieldLabel, TextField, Button, SectionCard } from "./ui.jsx";

const FIELDS = [
  ["objectives", "Learning objectives"], ["topics", "Topics / content"], ["activities", "Activities"],
  ["differentiation", "Differentiation"], ["assessment", "Assessment"], ["homework", "Homework"],
  ["resources", "Resources"], ["technology", "Technology used"], ["reflection", "Reflection"],
];

export default function Planning({ currentUser }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  function reload() {
    api.get("/api/plans").then(setPlans).catch((e) => setError(e.message));
  }
  useEffect(reload, []);

  async function createDraft() {
    try {
      // NOTE: branchId is hardcoded here for this first pass — Settings
      // (branch picker) will replace this once that tab is wired up.
      const branches = await api.get("/api/settings/branches");
      const branch = branches[0];
      const created = await api.post("/api/plans", {
        branchId: branch.id, department: currentUser.department || "English",
        subject: currentUser.department || "English", grade: "Grade 8", term: "Term 1", week: "Week 1",
      });
      reload();
      setOpenId(created.id);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!plans) return <Loading />;

  if (openId) {
    return <PlanDetail id={openId} currentUser={currentUser} onBack={() => { setOpenId(null); reload(); }} />;
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>Weekly plans</h1>
        {currentUser.role === "teacher" && <Button onClick={createDraft}>+ New weekly plan</Button>}
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

function PlanDetail({ id, currentUser, onBack }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [showReturnBox, setShowReturnBox] = useState(false);

  function reload() {
    api.get(`/api/plans/${id}`).then(setPlan).catch((e) => setError(e.message));
  }
  useEffect(reload, [id]);

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

  const isOwner = currentUser.role === "teacher" && plan.teacherId === currentUser.id;
  const canEdit = isOwner && ["draft", "returned"].includes(plan.status);
  const canReview = (currentUser.role === "hod" && plan.status === "submitted") ||
    (currentUser.role === "supervisor" && plan.status === "hod_approved");

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 900, margin: "0 auto" }}>
      <button onClick={onBack} style={{ border: "none", background: "transparent", color: T.ink600, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16 }}>
        ← Back to all plans
      </button>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.navy900, margin: 0 }}>{plan.subject} · {plan.grade}</h1>
        <StatusBadge status={plan.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {FIELDS.map(([key, label]) => (
          <div key={key}>
            <FieldLabel>{label}</FieldLabel>
            <TextField value={plan[key]} onChange={(v) => setPlan({ ...plan, [key]: v })} disabled={!canEdit} />
          </div>
        ))}
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
