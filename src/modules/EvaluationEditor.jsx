import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, Select, hasRole } from "../ui";
import { useLang } from "../i18n.jsx";

const canManage = (user) => user && (hasRole(user, "hod") || hasRole(user, "supervisor"));
const RATING_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }));

export default function EvaluationEditor({ currentUser }) {
  const { t } = useLang();
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api.get("/api/evaluations"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!items) return <Loading />;
  if (openId) return <EvaluationDetail id={openId} onBack={() => setOpenId(null)} onChanged={load} currentUser={currentUser} />;

  return (
    <div>
      <SectionCard
        title={t("Teacher Evaluations")}
        right={canManage(currentUser) && <Button onClick={() => setShowNew((s) => !s)}>{showNew ? t("Cancel") : t("New evaluation")}</Button>}
      >
        <ErrorBanner message={error} />
        {showNew && <EvaluationForm onDone={async () => { setShowNew(false); await load(); }} onCancel={() => setShowNew(false)} />}
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("No evaluations yet.")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} role="button" tabIndex={0}
                onClick={() => setOpenId(item.id)}
                onKeyDown={(e) => { if (e.key === "Enter") setOpenId(item.id); }}
                style={{
                  border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px",
                  cursor: "pointer", background: "#fff", display: "flex",
                  justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                <div>
                  <div style={{ fontWeight: 600, color: T.navy900 }}>{item.teacher?.name || t("Evaluation")}</div>
                  <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 3 }}>
                    {t("Evaluated by")} {item.evaluator?.name || "—"} · {`${item.criteria?.length || 0} ${t("criteria")}`}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.navy700 }}>
                  {avgRating(item) ? `${avgRating(item).toFixed(1)} / 5` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function avgRating(evalItem) {
  if (!evalItem.criteria || evalItem.criteria.length === 0) return 0;
  const sum = evalItem.criteria.reduce((acc, c) => acc + Number(c.rating || 0), 0);
  return sum / evalItem.criteria.length;
}

function EvaluationForm({ initial, onDone, onCancel }) {
  const { t } = useLang();
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(initial ? buildFromInitial(initial) : buildEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/users").then((users) => {
      setTeachers((users || []).filter((u) => hasRole(u, "teacher")));
    }).catch((e) => setError(e.message));
  }, []);

  function buildEmpty() {
    return { teacherId: "", overallComment: "", criteria: [{ name: "", rating: 4, evidence: "", comment: "", action: "" }] };
  }
  function buildFromInitial(ev) {
    return {
      teacherId: ev.teacherId,
      overallComment: ev.overallComment || "",
      criteria: (ev.criteria && ev.criteria.length > 0 ? ev.criteria : [{}]).map((c) => ({
        name: c.name || "",
        rating: c.rating || 4,
        evidence: c.evidence || "",
        comment: c.comment || "",
        action: c.action || "",
      })),
    };
  }

  const setField = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setCriterion = (i) => (k) => (v) => {
    setForm((f) => {
      const criteria = f.criteria.map((c, idx) => (idx === i ? { ...c, [k]: k === "rating" ? Number(v) : v } : c));
      return { ...f, criteria };
    });
  };

  function addCriterion() {
    setForm((f) => ({ ...f, criteria: [...f.criteria, { name: "", rating: 4, evidence: "", comment: "", action: "" }] }));
  }
  function removeCriterion(i) {
    setForm((f) => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!form.teacherId) { setError(t("Pick the teacher being evaluated.")); return; }
    const criteria = form.criteria.filter((c) => c.name && c.name.trim());
    setSaving(true);
    setError("");
    try {
      if (initial) {
        await api.patch(`/api/evaluations/${initial.id}`, { overallComment: form.overallComment, criteria });
      } else {
        await api.post("/api/evaluations", { teacherId: form.teacherId, overallComment: form.overallComment, criteria });
      }
      setSaving(false);
      onDone();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream50, marginBottom: 14 }}>
      <ErrorBanner message={error} />
      {!initial && (
        <div style={{ marginBottom: 14 }}>
          <FieldLabel required>{t("Teacher")}</FieldLabel>
          <Select value={form.teacherId} onChange={setField("teacherId")} placeholder={t("Select a teacher...")}
            options={teachers.map((t) => ({ value: t.id, label: `${t.name} (${t.email})` }))} />
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>{t("Overall comment")}</FieldLabel>
        <TextField value={form.overallComment} onChange={setField("overallComment")} rows={3} />
      </div>

      <div style={{ color: T.navy900, fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{t("Criteria")}</div>
      {form.criteria.map((c, i) => (
        <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, marginBottom: 10, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <FieldLabel>{t("Name")}</FieldLabel>
              <Input value={c.name} onChange={setCriterion(i)("name")} placeholder={t("e.g. Lesson delivery")} />
            </div>
            <div>
              <FieldLabel>{t("Rating (1–5)")}</FieldLabel>
              <Select value={c.rating} onChange={setCriterion(i)("rating")} options={RATING_OPTIONS} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>{t("Evidence")}</FieldLabel>
            <TextField value={c.evidence} onChange={setCriterion(i)("evidence")} rows={2} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>{t("Comment")}</FieldLabel>
            <TextField value={c.comment} onChange={setCriterion(i)("comment")} rows={2} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>{t("Action")}</FieldLabel>
            <TextField value={c.action} onChange={setCriterion(i)("action")} rows={1} />
          </div>
          <Button onClick={() => removeCriterion(i)} variant="outline" style={{ padding: "6px 10px", fontSize: 12.5 }}>{t("Remove criterion")}</Button>
        </div>
      ))}
      <Button onClick={addCriterion} variant="outline">{t("+ Add criterion")}</Button>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving}>{saving ? t("Saving...") : (initial ? t("Save changes") : t("Create evaluation"))}</Button>
        <Button onClick={onCancel} variant="outline">{t("Cancel")}</Button>
      </div>
    </div>
  );
}

function EvaluationDetail({ id, onBack, onChanged, currentUser }) {
  const { t } = useLang();
  const [evaluation, setEvaluation] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/evaluations/${id}`).then(setEvaluation).catch((e) => setError(e.message));
  }, [id]);

  if (!evaluation) return <Loading />;

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const slug = String(evaluation.teacher?.name || "teacher").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "teacher";
      await api.downloadPdf(`/api/evaluations/${id}/export`, `fwis-evaluation-${slug}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("Delete this evaluation?"))) return;
    setDeleting(true);
    setError("");
    try {
      await api.del(`/api/evaluations/${id}`);
      onChanged();
      onBack();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  return (
    <SectionCard title={`${t("Evaluation")} — ${evaluation.teacher?.name || ""}`} right={
      <>
        <Button style={{ marginInlineEnd: 8 }} onClick={onExport} variant="outline" disabled={exporting}>{exporting ? t("Exporting…") : t("Export PDF")}</Button>
        <Button onClick={onBack} variant="outline">{t("Back to list")}</Button>
      </>
    }>
      <ErrorBanner message={error} />
      <div style={{ fontSize: 13, color: T.ink600, marginBottom: 14 }}>
        {t("By")} {evaluation.evaluator?.name || "—"} · {t("Average")} {avgRating(evaluation) ? `${avgRating(evaluation).toFixed(1)} / 5` : "—"}
      </div>
      {editing ? (
        <EvaluationForm initial={evaluation} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          {evaluation.overallComment && (
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>{t("Overall comment")}</FieldLabel>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", background: T.cream50, borderRadius: 8, padding: "10px 12px" }}>{evaluation.overallComment}</div>
            </div>
          )}
          {evaluation.criteria && evaluation.criteria.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {evaluation.criteria.map((c, i) => (
                <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: T.navy900 }}>{c.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.gold600 }}>{c.rating} / 5</div>
                  </div>
                  {c.evidence && <div style={{ fontSize: 13, color: T.ink600, marginTop: 6 }}><strong>{t("Evidence:")}</strong> {c.evidence}</div>}
                  {c.comment && <div style={{ fontSize: 13, color: T.ink600, marginTop: 4 }}><strong>{t("Comment:")}</strong> {c.comment}</div>}
                  {c.action && <div style={{ fontSize: 13, color: T.ink600, marginTop: 4 }}><strong>{t("Action:")}</strong> {c.action}</div>}
                </div>
              ))}
            </div>
          )}
          {canManage(currentUser) && (
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Button onClick={() => setEditing(true)}>{t("Edit")}</Button>
              <Button onClick={remove} variant="danger" disabled={deleting}>{deleting ? t("Deleting...") : t("Delete")}</Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
