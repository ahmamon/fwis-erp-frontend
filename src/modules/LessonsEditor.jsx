import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, StatusBadge, Input, Select, hasRole } from "../ui";

const CONTENT_FIELDS = [
  ["readingSelection", "Reading selection"],
  ["grammar", "Grammar focus"],
  ["vocabulary", "Vocabulary"],
  ["writing", "Writing"],
  ["objectives", "Objectives"],
  ["teachingAids", "Teaching aids"],
  ["resources", "Resources"],
  ["warmingUp", "Warming up"],
  ["presentation", "Presentation"],
  ["mainActivity", "Main activity"],
  ["differentiation", "Differentiation"],
  ["assessment", "Assessment"],
  ["plenary", "Plenary"],
  ["reflection", "Reflection"],
  ["timing", "Timing"],
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "final", label: "Final" },
];

export default function LessonsEditor({ currentUser }) {
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setItems(await api.get("/api/lessons"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function createDraft() {
    setCreating(true);
    setError("");
    try {
      const branches = await api.get("/api/settings/branches");
      const subjects = await api.get("/api/settings/subjects");
      const grades = await api.get("/api/settings/grade-bands");
      const lesson = await api.post("/api/lessons", {
        department: "English",
        subject: subjects[0]?.name || "English",
        grade: grades[0]?.label || "Grade 1-6",
        academicYear: "2026-2027",
        term: "Term 1",
        week: "Week 1",
      });
      setItems(await api.get("/api/lessons"));
      setOpenId(lesson.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (!items) return <Loading />;
  const title = "Lesson Preparation";
  if (openId) {
    return <LessonDetail id={openId} onBack={() => setOpenId(null)} onChanged={load} currentUser={currentUser} />;
  }

  return (
    <div>
      <SectionCard
        title={title}
        right={currentUser && hasRole(currentUser, "teacher") && (
          <Button onClick={createDraft} disabled={creating}>{creating ? "Creating..." : "New draft"}</Button>
        )}
      >
        <ErrorBanner message={error} />
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>No lessons yet.</div>
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
                  <div style={{ fontWeight: 600, color: T.navy900 }}>
                    {item.subject || "Lesson"} — {item.grade || ""}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 3 }}>
                    {item.department || "English"} · {item.academicYear || ""} · {item.term || ""} · {item.week || ""}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function LessonDetail({ id, onBack, onChanged, currentUser }) {
  const [lesson, setLesson] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/lessons/${id}`).then((data) => {
      setLesson(data);
      const f = {};
      for (const [key] of CONTENT_FIELDS) f[key] = data[key] || "";
      f.status = data.status || "draft";
      setForm(f);
    }).catch((e) => setError(e.message));
  }, [id]);

  if (!lesson) return <Loading />;
  const isOwner = currentUser && (!hasRole(currentUser, "teacher") || lesson.teacherId === currentUser.id);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/lessons/${id}`, form);
      onChanged();
      onBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this lesson draft?")) return;
    setDeleting(true);
    setError("");
    try {
      await api.del(`/api/lessons/${id}`);
      onChanged();
      onBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function onExport() {
    if (exporting || !lesson) return;
    setExporting(true);
    setError("");
    try {
      const slug = String(lesson.subject || "lesson").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lesson";
      await api.downloadPdf(`/api/lessons/${id}/export`, `fwis-lesson-${slug}.pdf`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <SectionCard title={lesson.subject || "Lesson"}
      right={<Button onClick={onBack} variant="outline">Back to list</Button>}>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div>
          <FieldLabel>Status</FieldLabel>
          <Select value={form.status} onChange={set("status")} options={STATUS_OPTIONS} />
        </div>
        {CONTENT_FIELDS.map(([key, label]) => (
          <div key={key}>
            <FieldLabel>{label}</FieldLabel>
            <TextField value={form[key]} onChange={set(key)} rows={key === "objectives" || key === "assessment" ? 4 : 3} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button onClick={onExport} variant="outline" disabled={exporting}>{exporting ? "Exporting…" : "Export PDF"}</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        {isOwner && (
          <Button onClick={remove} variant="danger" disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
        )}
      </div>
    </SectionCard>
  );
}