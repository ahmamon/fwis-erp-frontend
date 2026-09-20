import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, Select, hasRole } from "../ui";
import { useLang } from "../i18n.jsx";

const canManage = (user) => user && (hasRole(user, "admin") || hasRole(user, "supervisor"));
const canUseQuestionStudio = (user) => user && ["teacher", "hod", "supervisor", "admin"].some((role) => hasRole(user, role));

const PURPOSE_OPTIONS = [
  { value: "worksheet", label: "Worksheet" },
  { value: "exit_ticket", label: "Exit Ticket" },
  { value: "homework", label: "Homework Practice" },
  { value: "class_practice", label: "In-Class Practice" },
];
const DIFFICULTY_OPTIONS = [
  { value: "mixed", label: "Mixed difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "challenging", label: "Challenging" },
];

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
              <ResourceRow key={item.id} resource={item} currentUser={currentUser} canManage={canManage(currentUser)} canUseStudio={canUseQuestionStudio(currentUser)} onChanged={load} />
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

function ResourceRow({ resource, currentUser, canManage, canUseStudio, onChanged }) {
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
  const [request, setRequest] = useState("");
  const [purpose, setPurpose] = useState("worksheet");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState("6");
  const [kinds, setKinds] = useState(["mcq", "short_answer"]);
  const [selected, setSelected] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activityForm, setActivityForm] = useState({ title: "", instructions: "", purpose: "worksheet", isPublished: true, showResults: true });
  const [activityBusy, setActivityBusy] = useState(false);
  const [notice, setNotice] = useState("");

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

  async function loadStudio() {
    setAiError("");
    try {
      const [list, saved] = await Promise.all([
        api.get(`/api/resources/${resource.id}/questions`),
        api.get(`/api/activities?resourceId=${encodeURIComponent(resource.id)}`),
      ]);
      setQuestions(list);
      setActivities(saved);
      setBankOpen(true);
    } catch (e) {
      setAiError(e.message);
    }
  }

  async function generateQuestions() {
    setAiBusy(true);
    setAiError("");
    try {
      await api.post(`/api/resources/${resource.id}/generate-questions`, {
        count: Number(questionCount) || 6,
        request,
        purpose,
        difficulty,
        kinds,
      });
      const list = await api.get(`/api/resources/${resource.id}/questions`);
      setQuestions(list);
      setBankOpen(true);
      setNotice(t("New questions were added to the bank. Select the ones you want to use."));
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

  function toggleKind(kind) {
    setKinds((current) => current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]);
  }

  function toggleSelected(id) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function createActivity() {
    if (!selected.length) { setAiError(t("Select at least one question.")); return; }
    if (!activityForm.title.trim()) { setAiError(t("Enter an activity title.")); return; }
    setActivityBusy(true);
    setAiError("");
    try {
      const created = await api.post("/api/activities", {
        resourceId: resource.id,
        questionIds: selected,
        ...activityForm,
        subject: resource.subject,
        grade: resource.grade,
      });
      setActivities((current) => [created, ...current]);
      setSelected([]);
      setActivityForm((current) => ({ ...current, title: "", instructions: "" }));
      setNotice(created.isPublished ? t("Live activity created. Its link is ready for the Weekly Plan.") : t("Activity saved as a draft."));
    } catch (e) {
      setAiError(e.message);
    } finally {
      setActivityBusy(false);
    }
  }

  async function updateActivity(activity, updates) {
    try {
      const updated = await api.patch(`/api/activities/${activity.id}`, updates);
      setActivities((current) => current.map((row) => row.id === activity.id ? updated : row));
    } catch (e) { setAiError(e.message); }
  }

  async function deleteActivity(activity) {
    if (!window.confirm(`${t("Delete")} "${activity.title}"?`)) return;
    try {
      await api.del(`/api/activities/${activity.id}`);
      setActivities((current) => current.filter((row) => row.id !== activity.id));
    } catch (e) { setAiError(e.message); }
  }

  function liveUrl(activity) {
    return `${window.location.origin}/activity/${activity.publicToken}`;
  }

  async function copyLiveLink(activity) {
    const url = liveUrl(activity);
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t("Live activity link copied. Paste it into Weekly Planning → Digital Resources."));
    } catch {
      window.prompt(t("Copy this link for the Weekly Plan:"), url);
    }
  }

  async function downloadActivity(activity, format, answers = false) {
    try {
      const blob = await api.download(`/api/activities/${activity.id}/export.${format}${answers ? "?answers=1" : ""}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activity.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "activity"}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setAiError(e.message); }
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

      {/* Teacher Question Studio */}
      {canUseStudio && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          {!bankOpen && (
            <Button onClick={loadStudio} variant="outline" style={{ padding: "7px 14px" }}>{t("Open Question Studio")}</Button>
          )}
          {notice && <div style={{ margin: "10px 0", background: "#E9F7EF", border: "1px solid #82C89B", color: "#176B3A", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>{notice}</div>}
          {aiError === "__AI_NOT_CONFIGURED__" && (
            <div style={{ background: T.cream100, border: `1px solid ${T.gold500}`, borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: T.ink900, marginBottom: 10 }}>
              {t("AI questions aren't set up yet — add a free Gemini API key (no card required) to the backend to enable question generation.")}
            </div>
          )}
          {aiError && aiError !== "__AI_NOT_CONFIGURED__" && <ErrorBanner message={aiError} />}
          {bankOpen && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.navy900 }}>{t("Question Studio")}</div>
                  <div style={{ fontSize: 12.5, color: T.ink600 }}>{t("Ask for questions, select the best ones, then turn them into a learning activity.")}</div>
                </div>
                <Button onClick={() => setBankOpen(false)} variant="outline" style={{ padding: "5px 12px" }}>{t("Close studio")}</Button>
              </div>

              <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: T.cream50, border: `1px solid ${T.line}` }}>
                <FieldLabel>{t("Ask the question assistant")}</FieldLabel>
                <TextField value={request} onChange={setRequest} rows={3} placeholder={t("Example: Create inference questions from the passage, include two vocabulary questions, and avoid trick questions.")} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 10 }}>
                  <div><FieldLabel>{t("Use as")}</FieldLabel><Select value={purpose} onChange={setPurpose} options={PURPOSE_OPTIONS} /></div>
                  <div><FieldLabel>{t("Difficulty")}</FieldLabel><Select value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} /></div>
                  <div><FieldLabel>{t("Number of questions")}</FieldLabel><Input type="number" min="1" max="12" value={questionCount} onChange={setQuestionCount} /></div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
                  {[["mcq", "Multiple choice"], ["short_answer", "Short answer"], ["true_false", "True / False"], ["fill_blank", "Fill in the blank"]].map(([value, label]) => (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={kinds.includes(value)} onChange={() => toggleKind(value)} />{t(label)}</label>
                  ))}
                </div>
                <Button onClick={generateQuestions} disabled={aiBusy || !kinds.length} style={{ marginTop: 12 }}>
                  {aiBusy ? t("Generating…") : t("Send request and generate")}
                </Button>
              </div>

              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, color: T.navy900 }}>{t("Question bank")} ({questions.length})</div>
                {questions.length > 0 && <Button variant="outline" onClick={() => setSelected(selected.length === questions.length ? [] : questions.map((q) => q.id))} style={{ padding: "5px 12px" }}>{selected.length === questions.length ? t("Clear selection") : t("Select all")}</Button>}
              </div>
              {questions.length === 0 ? (
                <div style={{ marginTop: 8, color: T.ink600, fontSize: 13 }}>{t("No questions yet. Ask the assistant above to create the first set.")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {questions.map((q) => (
                    <QuestionRow key={q.id} question={q} selected={selected.includes(q.id)} onToggle={() => toggleSelected(q.id)} canEdit={q.createdById === currentUser.id} onSave={saveQuestion} onDelete={deleteQuestion} />
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, padding: 14, border: `1px solid ${T.gold500}`, borderRadius: 10, background: "#FFFCF4" }}>
                <div style={{ fontWeight: 700, color: T.navy900 }}>{t("Build an activity from selected questions")} · {selected.length} {t("selected")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) minmax(160px, 1fr)", gap: 10, marginTop: 10 }}>
                  <div><FieldLabel required>{t("Activity title")}</FieldLabel><Input value={activityForm.title} onChange={(value) => setActivityForm((current) => ({ ...current, title: value }))} placeholder={t("Example: Fractions exit ticket")} /></div>
                  <div><FieldLabel>{t("Activity type")}</FieldLabel><Select value={activityForm.purpose} onChange={(value) => setActivityForm((current) => ({ ...current, purpose: value }))} options={PURPOSE_OPTIONS} /></div>
                </div>
                <div style={{ marginTop: 10 }}><FieldLabel>{t("Student instructions")}</FieldLabel><TextField value={activityForm.instructions} onChange={(value) => setActivityForm((current) => ({ ...current, instructions: value }))} rows={2} /></div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
                  <label><input type="checkbox" checked={activityForm.isPublished} onChange={(e) => setActivityForm((current) => ({ ...current, isPublished: e.target.checked }))} /> {t("Create a live interactive link")}</label>
                  <label><input type="checkbox" checked={activityForm.showResults} onChange={(e) => setActivityForm((current) => ({ ...current, showResults: e.target.checked }))} /> {t("Show score and corrections after submission")}</label>
                </div>
                <Button onClick={createActivity} disabled={activityBusy || !selected.length || !activityForm.title.trim()} style={{ marginTop: 12 }}>{activityBusy ? t("Creating...") : t("Create activity")}</Button>
              </div>

              {activities.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, color: T.navy900, marginBottom: 8 }}>{t("Saved activities")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activities.map((activity) => (
                      <ActivityRow key={activity.id} activity={activity} liveUrl={liveUrl(activity)} onCopy={() => copyLiveLink(activity)} onDownload={downloadActivity} onUpdate={updateActivity} onDelete={deleteActivity} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ question, selected, onToggle, canEdit, onSave, onDelete }) {
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
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={t("Select question")} style={{ alignSelf: "flex-start", marginTop: 4 }} />
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
          ) : canEdit ? (
            <>
              <Button onClick={beginEdit} variant="outline" style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Edit")}</Button>
              <Button onClick={() => onDelete(question.id)} variant="danger" style={{ padding: "4px 12px", fontSize: 12.5 }}>{t("Discard")}</Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ activity, liveUrl, onCopy, onDownload, onUpdate, onDelete }) {
  const { t } = useLang();
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 650, color: T.navy900 }}>{activity.title}</div>
          <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 2 }}>{activity.purpose.replace(/_/g, " ")} · {activity.items.length} {t("questions")} · {activity._count?.submissions || 0} {t("submissions")}</div>
        </div>
        <label style={{ fontSize: 12.5, color: T.ink900, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={activity.isPublished} onChange={(e) => onUpdate(activity, { isPublished: e.target.checked })} /> {t("Live")}</label>
      </div>
      {activity.isPublished && <input readOnly value={liveUrl} onFocus={(e) => e.target.select()} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 7, padding: "7px 9px", marginTop: 9, color: T.ink600, background: T.cream50 }} />}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
        {activity.isPublished && <><Button onClick={onCopy} style={{ padding: "5px 10px", fontSize: 12 }}>{t("Copy link for Weekly Plan")}</Button><a href={liveUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Button variant="outline" style={{ padding: "5px 10px", fontSize: 12 }}>{t("Open live")}</Button></a></>}
        <Button onClick={() => onDownload(activity, "pdf")} variant="outline" style={{ padding: "5px 10px", fontSize: 12 }}>{t("PDF")}</Button>
        <Button onClick={() => onDownload(activity, "docx")} variant="outline" style={{ padding: "5px 10px", fontSize: 12 }}>{t("Word")}</Button>
        <Button onClick={() => onDownload(activity, "pdf", true)} variant="outline" style={{ padding: "5px 10px", fontSize: 12 }}>{t("PDF + answer key")}</Button>
        <Button onClick={() => onDelete(activity)} variant="danger" style={{ padding: "5px 10px", fontSize: 12 }}>{t("Delete")}</Button>
      </div>
    </div>
  );
}
