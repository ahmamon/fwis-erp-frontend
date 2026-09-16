import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, Select, hasRole } from "../ui";
import { useLang } from "../i18n.jsx";

const canManage = (user) => user && (hasRole(user, "admin") || hasRole(user, "supervisor"));

// Server enforces the same cap (multer limit); this just avoids uploading a
// file that would be rejected.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const KIND_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
  { value: "text", label: "Text" },
];

export default function ResourcesEditor({ currentUser }) {
  const { t } = useLang();
  const [items, setItems] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api.get("/api/resources"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!items) return <Loading />;

  return (
    <div>
      <SectionCard
        title={t("Learning Resources")}
        right={<Button onClick={() => setShowNew((s) => !s)}>{showNew ? t("Cancel") : t("Add resource")}</Button>}
      >
        <ErrorBanner message={error} />
        <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 14 }}>
          {t("Files are stored securely in the school's database (max 8 MB each) and streamed back when opened.")}
        </div>
        {showNew && <ResourceForm onDone={async () => { setShowNew(false); await load(); }} onCancel={() => setShowNew(false)} />}
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>{t("No resources yet.")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <ResourceRow key={item.id} resource={item} canManage={canManage(currentUser)} onChanged={load} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ResourceForm({ initial, onDone, onCancel }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial || { kind: "link", name: "", category: "", subject: "", grade: "", description: "", externalUrl: "", sourceText: "" });
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  function buildBody() {
    const body = {
      kind: form.kind,
      name: form.name,
      category: form.category,
      subject: form.subject,
      grade: form.grade,
      description: form.description,
    };
    if (form.kind === "link") body.externalUrl = form.externalUrl;
    if (form.kind === "text") body.sourceText = form.sourceText;
    return body;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (form.kind === "link" || form.kind === "text") {
        if (form.kind === "link" && !form.externalUrl.trim()) {
          setError(t("A link resource needs a URL."));
          return;
        }
        if (form.kind === "text" && !form.sourceText.trim()) {
          setError(t("Pasted text is required for text resources."));
          return;
        }
        if (initial) {
          await api.patch(`/api/resources/${initial.id}`, buildBody());
        } else {
          await api.post("/api/resources", buildBody());
        }
      } else {
        const file = (initial && !fileRef.current?.files?.length) ? null : fileRef.current?.files?.[0];
        if (!initial && !file) {
          setError(t("Choose a file to upload."));
          return;
        }
        if (file && file.size > MAX_FILE_BYTES) {
          setError(t("File exceeds the 8 MB limit. Choose a smaller file."));
          return;
        }
        if (file) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(buildBody())) if (v) fd.append(k, v);
          fd.append("file", file);
          await api.postForm("/api/resources", fd);
        } else if (initial) {
          await api.patch(`/api/resources/${initial.id}`, buildBody());
        }
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <FieldLabel>{t("Kind")}</FieldLabel>
          <Select value={form.kind} onChange={set("kind")} options={KIND_OPTIONS} />
        </div>
        <div>
          <FieldLabel required>{t("Name")}</FieldLabel>
          <Input value={form.name} onChange={set("name")} />
        </div>
        <div>
          <FieldLabel>{t("Category")}</FieldLabel>
          <Input value={form.category} onChange={set("category")} />
        </div>
        <div>
          <FieldLabel>{t("Subject")}</FieldLabel>
          <Input value={form.subject} onChange={set("subject")} />
        </div>
        <div>
          <FieldLabel>{t("Grade")}</FieldLabel>
          <Input value={form.grade} onChange={set("grade")} />
        </div>
        {form.kind === "link" ? (
          <div>
            <FieldLabel>{t("URL")}</FieldLabel>
            <Input value={form.externalUrl} onChange={set("externalUrl")} placeholder="https://..." />
          </div>
        ) : form.kind === "text" ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel required>{t("Pasted text")}</FieldLabel>
            <TextField value={form.sourceText} onChange={set("sourceText")} rows={5} placeholder={t("Paste the reading, notes, or passage you want practice questions from...")} />
          </div>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel>{initial ? t("Replace file (optional)") : t("File")}</FieldLabel>
            <input type="file" ref={fileRef} style={{ fontSize: 13.5, color: T.ink600 }} />
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>{t("Description")}</FieldLabel>
          <TextField value={form.description} onChange={set("description")} rows={2} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? t("Saving...") : (initial ? t("Save changes") : t("Add resource"))}</Button>
        <Button onClick={onCancel} variant="outline">{t("Cancel")}</Button>
      </div>
    </div>
  );
}

function ResourceRow({ resource, canManage, onChanged }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  async function remove() {
    if (!window.confirm(`${t("Delete")} "${resource.name}"?`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.del(`/api/resources/${resource.id}`);
      onChanged();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  async function uploadVersion() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("Choose a file first."));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t("File exceeds the 8 MB limit. Choose a smaller file."));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.postForm(`/api/resources/${resource.id}/versions`, fd);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function openVersion(v) {
    setError("");
    try {
      const blob = await api.download(`/api/resources/${resource.id}/versions/${v.id}/file`);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      setError(e.message);
    }
  }

  // --- AI question bank ---
  async function loadBank() {
    setAiError("");
    try {
      const list = await api.get(`/api/resources/${resource.id}/questions`);
      setQuestions(list);
      setBankOpen(true);
    } catch (e) {
      setAiError(e.message);
    }
  }

  async function generateQuestions() {
    setAiBusy(true);
    setAiError("");
    try {
      await api.post(`/api/resources/${resource.id}/generate-questions`, { count: 6 });
      const list = await api.get(`/api/resources/${resource.id}/questions`);
      setQuestions(list);
      setBankOpen(true);
    } catch (e) {
      if (e.code === "AI_NOT_CONFIGURED") {
        setAiError("__AI_NOT_CONFIGURED__");
      } else {
        setAiError(e.message);
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function saveQuestion(id, updates) {
    setAiError("");
    try {
      await api.patch(`/api/questions/${id}`, updates);
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    } catch (e) {
      setAiError(e.message);
    }
  }

  async function deleteQuestion(id) {
    if (!window.confirm(t("Discard this question?"))) return;
    setAiError("");
    try {
      await api.del(`/api/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      setAiError(e.message);
    }
  }

  if (editing) {
    return <ResourceForm initial={resource} onDone={async () => { setEditing(false); await onChanged(); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, color: T.navy900 }}>
            {resource.name}
            {resource.externalUrl && (
              <a href={resource.externalUrl} target="_blank" rel="noreferrer" style={{ color: T.gold600, marginInlineStart: 8, fontSize: 13, fontWeight: 600 }}>{t("Open ↗")}</a>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 2 }}>
            {resource.kind} · {resource.category || t("uncategorized")}{resource.subject ? ` · ${resource.subject}` : ""}{resource.grade ? ` · ${resource.grade}` : ""}
          </div>
          {resource.description && (
            <div style={{ fontSize: 13.5, color: T.ink900, marginTop: 8, whiteSpace: "pre-wrap" }}>{resource.description}</div>
          )}
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Button onClick={() => setEditing(true)} variant="outline" style={{ padding: "6px 12px" }}>{t("Edit")}</Button>
            <Button onClick={remove} variant="danger" disabled={deleting} style={{ padding: "6px 12px" }}>{deleting ? "..." : t("Delete")}</Button>
          </div>
        )}
      </div>
      {resource.versions && resource.versions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 6 }}>
            {`${resource.versions.length} ${t(resource.versions.length === 1 ? "version" : "versions")} ${t("uploaded")}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {resource.versions.filter((v) => v.fileName).map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: T.ink900 }}>
                <span style={{ fontWeight: 600, color: T.ink500, width: 26, flexShrink: 0 }}>v{v.version}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.fileName}</span>
                {v.fileSize && <span style={{ color: T.ink600, flexShrink: 0 }}>{v.fileSize}</span>}
                <Button onClick={() => openVersion(v)} variant="outline" style={{ padding: "3px 10px", fontSize: 12, marginInlineStart: "auto", flexShrink: 0 }}>{t("Open")}</Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && (
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" ref={fileRef} style={{ fontSize: 12.5, color: T.ink600 }} />
          <Button onClick={uploadVersion} variant="outline" disabled={uploading} style={{ padding: "6px 12px" }}>{uploading ? t("Uploading...") : t("Add version")}</Button>
        </div>
      )}

      {/* AI question bank */}
      {canManage && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          {aiError === "__AI_NOT_CONFIGURED__" && (
            <div style={{ background: T.cream100, border: `1px solid ${T.gold500}`, borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: T.ink900, marginBottom: 10 }}>
              {t("AI questions aren't set up yet — add a free Gemini API key (no card required) to the backend to enable question generation.")}
            </div>
          )}
          {aiError && aiError !== "__AI_NOT_CONFIGURED__" && <ErrorBanner message={aiError} />}
          <div style={{ display: "flex", gap: 8, marginBottom: bankOpen && questions.length ? 10 : 0 }}>
            <Button onClick={generateQuestions} variant="outline" disabled={aiBusy} style={{ padding: "6px 14px" }}>
              {aiBusy ? t("Generating…") : t("Generate Questions")}
            </Button>
            {questions.length > 0 && (
              <Button onClick={() => (bankOpen ? setBankOpen(false) : loadBank())} variant="outline" style={{ padding: "6px 14px" }}>
                {bankOpen ? t("Hide bank") : `${t("View bank")} (${questions.length})`}
              </Button>
            )}
          </div>
          {bankOpen && questions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {questions.map((q) => (
                <QuestionRow key={q.id} question={q} onSave={saveQuestion} onDelete={deleteQuestion} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ question, onSave, onDelete }) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    text: question.text,
    answer: question.answer,
    explanation: question.explanation,
    options: (question.options || []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  function beginEdit() {
    setDraft({
      text: question.text,
      answer: question.answer,
      explanation: question.explanation,
      options: (question.options || []).join(", "),
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const options = question.kind === "mcq" ? draft.options.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean) : undefined;
      const updates = {
        text: draft.text.trim(),
        answer: draft.answer.trim(),
        explanation: draft.explanation.trim(),
      };
      if (options) updates.options = options;
      await onSave(question.id, updates);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (v) => setDraft((d) => ({ ...d, [key]: v }));

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px", background: T.cream50 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: T.navy700, color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {question.kind}
            </span>
            <span style={{ fontSize: 12, color: T.ink900 }}>{t("Answer:")} <strong>{question.answer}</strong></span>
            {question.createdBy?.name && <span style={{ fontSize: 12, color: T.ink600 }}>{t("by")} {question.createdBy.name}</span>}
          </div>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <TextField value={draft.text} onChange={set("text")} rows={2} placeholder={t("Question")} />
              {question.kind === "mcq" && (
                <TextField value={draft.options} onChange={set("options")} rows={2} placeholder={t("Options, comma-separated")} />
              )}
              <TextField value={draft.answer} onChange={set("answer")} rows={1} placeholder={t("Answer")} />
              <TextField value={draft.explanation} onChange={set("explanation")} rows={2} placeholder={t("Explanation (optional)")} />
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: T.ink900, marginTop: 6 }}>
              {question.text}
              {question.kind === "mcq" && question.options && question.options.length > 0 && (
                <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 4 }}>{question.options.join(" · ")}</div>
              )}
              {question.explanation && <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 4, fontStyle: "italic" }}>{question.explanation}</div>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
          {editing && !saving ? (
            <>
              <Button onClick={save} style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Save")}</Button>
              <Button onClick={() => setEditing(false)} variant="outline" style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Cancel")}</Button>
            </>
          ) : (
            <>
              <Button onClick={beginEdit} variant="outline" style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Edit")}</Button>
              <Button onClick={() => onDelete(question.id)} variant="danger" style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Discard")}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}