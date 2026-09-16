import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, StatusBadge, Input, Select, hasRole } from "../ui";
import { StrategyPicker, ResourceLibraryPicker } from "./pickers.jsx";
import { useLang } from "../i18n.jsx";

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
  const { t } = useLang();
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
  const title = t("Lesson Preparation");
  if (openId) {
    return <LessonDetail id={openId} onBack={() => setOpenId(null)} onChanged={load} currentUser={currentUser} />;
  }

  return (
    <div>
      <SectionCard
        title={title}
        right={currentUser && hasRole(currentUser, "teacher") && (
          <Button onClick={createDraft} disabled={creating}>{creating ? t("Creating...") : t("New draft")}</Button>
        )}
      >
        <ErrorBanner message={error} />
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("No lessons yet.")}</div>
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
                    {item.subject || t("Lesson")} — {item.grade || ""}
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
  const { t } = useLang();
  const [lesson, setLesson] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const pdfRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState("");
  const [aiNote, setAiNote] = useState("");

  useEffect(() => {
    api.get(`/api/lessons/${id}`).then((data) => {
      setLesson(data);
      const f = {};
      for (const [key] of CONTENT_FIELDS) f[key] = data[key] || "";
      f.status = data.status || "draft";
      f.strategies = data.strategies || [];
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
    if (!window.confirm(t("Delete this lesson draft?"))) return;
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

  async function onAutofill() {
    const file = pdfRef.current?.files?.[0];
    if (!file) {
      setAiNote("");
      setPdfNote(t("Choose a PDF to read first."));
      return;
    }
    setPdfBusy(true);
    setPdfNote("");
    setAiNote("");
    setError("");
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const { fields } = await api.postForm(`/api/lessons/${id}/autofill`, fd);
      setForm((f) => ({ ...f, ...fields }));
      setPdfNote(t("From your PDF — review the fields below before saving."));
    } catch (e) {
      if (e.code === "AI_NOT_CONFIGURED") {
        setAiNote(t("AI isn't set up yet — add a free Gemini API key (no card required) to enable Fill from PDF."));
      } else {
        setPdfNote(e.message);
      }
    } finally {
      setPdfBusy(false);
    }
  }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <SectionCard title={lesson.subject || t("Lesson")}
      right={<Button onClick={onBack} variant="outline">{t("Back to list")}</Button>}>
      <ErrorBanner message={error} />
      {aiNote && (
        <div style={{ background: T.cream100, border: `1px solid ${T.gold500}`, borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: T.ink900, marginBottom: 14 }}>
          {aiNote}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input type="file" ref={pdfRef} accept="application/pdf" style={{ fontSize: 12.5, color: T.ink600 }} />
        <Button onClick={onAutofill} variant="outline" disabled={pdfBusy} style={{ padding: "6px 14px" }}>
          {pdfBusy ? t("Reading…") : t("Fill from PDF")}
        </Button>
        {pdfNote && <span style={{ fontSize: 12.5, color: T.ink600 }}>{pdfNote}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <div>
          <FieldLabel>{t("Status")}</FieldLabel>
          <Select value={form.status} onChange={set("status")} options={STATUS_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} />
        </div>
        {CONTENT_FIELDS.map(([key, label]) => (
          <div key={key}>
            <FieldLabel>{t(label)}</FieldLabel>
            {key === "resources" && (
              <ResourceLibraryPicker value={form.resources} onChange={set("resources")} disabled={!isOwner} />
            )}
            <TextField value={form[key]} onChange={set(key)} rows={key === "objectives" || key === "assessment" ? 4 : 3} />
          </div>
        ))}
        <div>
          <StrategyPicker
            value={form.strategies || []}
            onChange={(s) => setForm((f) => ({ ...f, strategies: s }))}
            disabled={!isOwner}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button onClick={onExport} variant="outline" disabled={exporting}>{exporting ? t("Exporting…") : t("Export PDF")}</Button>
        <Button onClick={save} disabled={saving}>{saving ? t("Saving...") : t("Save")}</Button>
        {isOwner && (
          <Button onClick={remove} variant="danger" disabled={deleting}>{deleting ? t("Deleting...") : t("Delete")}</Button>
        )}
      </div>
    </SectionCard>
  );
}