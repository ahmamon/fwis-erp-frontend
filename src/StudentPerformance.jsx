import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { T, Button, ErrorBanner, FieldLabel, Input, Loading, Select, TextField } from "./ui.jsx";
import { useLang } from "./i18n.jsx";

const panel = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 };
const emptyScores = { academic: 0, behavior: 0, marks: 0 };
const initials = (name) => String(name || "?").split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
const scoreColor = (score) => score > 0 ? "#15803D" : score < 0 ? "#B91C1C" : T.ink600;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim()); value = "";
      if (row.some(Boolean)) rows.push(row); row = [];
    } else value += char;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const nameIndex = headers.findIndex((header) => ["name", "studentname", "fullname"].includes(header));
  const codeIndex = headers.findIndex((header) => ["studentcode", "studentid", "code", "id"].includes(header));
  const classIndex = headers.findIndex((header) => ["class", "classsection", "section"].includes(header));
  const dataRows = nameIndex >= 0 ? rows.slice(1) : rows;
  return dataRows.map((columns) => ({
    name: columns[nameIndex >= 0 ? nameIndex : 0] || "",
    studentCode: codeIndex >= 0 ? columns[codeIndex] || "" : "",
    classSection: classIndex >= 0 ? columns[classIndex] || "" : "",
  })).filter((student) => student.name);
}

function ScorePill({ label, value }) {
  return <span style={{ background: value < 0 ? "#FEE2E2" : value > 0 ? "#DCFCE7" : T.cream100, color: scoreColor(value), borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>{label} {value > 0 ? "+" : ""}{value}</span>;
}

function StudentCard({ student, selected, onClick }) {
  const scores = student.scores || emptyScores;
  return (
    <button onClick={onClick} style={{ ...panel, textAlign: "left", cursor: "pointer", border: selected ? `2px solid ${T.gold500}` : `1px solid ${T.line}`, padding: 14, width: "100%" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: T.navy900, color: "#fff", fontWeight: 800 }}>{initials(student.name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 750, color: T.ink900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
          <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 2 }}>{student.grade?.label}{student.classSection ? ` · ${student.classSection}` : ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        <ScorePill label="Academic" value={scores.academic || 0} />
        <ScorePill label="Behavior" value={scores.behavior || 0} />
      </div>
    </button>
  );
}

function ReportView({ report, onClose }) {
  if (!report) return null;
  const printReport = () => {
    const popup = window.open("", "_blank", "width=900,height=900");
    if (!popup) return;
    const domain = (title, data) => `<section><h2>${title}: ${data.score > 0 ? "+" : ""}${data.score}</h2><p>${escapeHtml(data.narrative)}</p><ul>${data.byCategory.map((item) => `<li>${escapeHtml(item.label)}: ${item.count} mark(s), score ${item.score > 0 ? "+" : ""}${item.score}</li>`).join("") || "<li>No marks recorded</li>"}</ul></section>`;
    const eleot = report.eleot ? `<section><h2>ELEOT observation: ${report.eleot.averageScore ?? "N/A"} / 4</h2><p>${escapeHtml(report.eleot.lessonTopic || "Learning observation")} · ${new Date(report.eleot.observedAt).toLocaleDateString()} · ${escapeHtml(report.eleot.observer?.name || "")}</p><ul>${report.eleot.ratings.map((item) => `<li><b>${item.criterionNumber}. ${escapeHtml(item.criterionLabel)}</b>: ${item.rating ?? "N/A"}${item.evidence ? ` — ${escapeHtml(item.evidence)}` : ""}</li>`).join("")}</ul></section>` : `<section><h2>ELEOT observation</h2><p>No observation recorded in this period.</p></section>`;
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(report.student.name)} performance report</title><style>body{font-family:Arial,sans-serif;color:#1c2733;margin:40px;line-height:1.5}header{border-bottom:3px solid #c6a15b;padding-bottom:16px}h1{color:#0b1f3a}h2{color:#1b3a63;margin-top:26px}small{color:#5b6472}li{margin:5px 0}@media print{button{display:none}}</style></head><body><header><small>FUTURE WINDOW INTERNATIONAL SCHOOL</small><h1>Student Performance Report</h1><p><b>${escapeHtml(report.student.name)}</b> · ${escapeHtml(report.student.grade?.label)} ${escapeHtml(report.student.classSection)}</p></header>${domain("Academic", report.academic)}${domain("Behavior", report.behavior)}${eleot}<p><small>Generated ${new Date().toLocaleString()}</small></p><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    popup.document.close(); popup.focus();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.45)", display: "grid", placeItems: "center", zIndex: 100, padding: 20 }}>
      <div style={{ ...panel, width: "min(760px, 95vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div><div style={{ fontSize: 12, color: T.gold600, fontWeight: 800, letterSpacing: 1 }}>STUDENT PERFORMANCE REPORT</div><h2 style={{ margin: "5px 0", color: T.navy900 }}>{report.student.name}</h2><div style={{ color: T.ink600 }}>{report.student.grade?.label} {report.student.classSection && `· ${report.student.classSection}`}</div></div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
        {[['Academic', report.academic], ['Behavior', report.behavior]].map(([title, data]) => (
          <div key={title} style={{ marginTop: 20, padding: 16, borderRadius: 12, background: T.cream50, border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ color: T.navy900 }}>{title}</strong><ScorePill label="Total" value={data.score} /></div>
            <p style={{ color: T.ink600, lineHeight: 1.55 }}>{data.narrative}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{data.byCategory.map((item) => <span key={item.label} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5 }}>{item.label} · {item.count} · <b style={{ color: scoreColor(item.score) }}>{item.score > 0 ? "+" : ""}{item.score}</b></span>)}</div>
          </div>
        ))}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "#F3F0FA", border: "1px solid #D9CFF0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong style={{ color: T.navy900 }}>ELEOT student observation</strong>{report.eleot && <span style={{ fontWeight: 800, color: "#6D3A8A" }}>{report.eleot.averageScore ?? "N/A"} / 4</span>}</div>
          {report.eleot ? <><p style={{ color: T.ink600 }}>{report.eleot.lessonTopic || "Learning observation"} · {new Date(report.eleot.observedAt).toLocaleDateString()} · {report.eleot.observer?.name}</p><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{report.eleot.ratings.map((item) => <span key={item.id} style={{ background: "#fff", border: "1px solid #D9CFF0", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>{item.criterionNumber}. {item.label || item.criterionLabel}: <b>{item.rating ?? "N/A"}</b></span>)}</div></> : <p style={{ color: T.ink600 }}>No ELEOT observation recorded in this period.</p>}
        </div>
        <Button onClick={printReport} style={{ marginTop: 20 }}>Print / Save report as PDF</Button>
      </div>
    </div>
  );
}

const environmentColors = {
  "Active & Engaged": ["#EAF3FF", "#1D4ED8"],
  "Rigorous & Relevant": ["#F4ECFF", "#7E22CE"],
  "Supportive & Well Managed": ["#ECFDF5", "#047857"],
  "Progress Monitoring & Feedback": ["#FFF7E6", "#B45309"],
};

function EleotPanel({ student, meta, onNotice, onError }) {
  const criteria = meta.eleotCriteria || [];
  const [observations, setObservations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ observedAt: new Date().toISOString().slice(0, 10), lessonTopic: "", context: "", notes: "" });
  const [ratings, setRatings] = useState({});

  const load = async () => {
    try { setObservations(await api.get(`/api/students/${student.id}/eleot`)); } catch (err) { onError(err.message); }
  };
  useEffect(() => {
    setRatings({});
    setForm({ observedAt: new Date().toISOString().slice(0, 10), lessonTopic: "", context: "", notes: "" });
    load();
  }, [student.id]);

  const setRating = (key, field, value) => setRatings((current) => ({ ...current, [key]: { rating: "", evidence: "", ...(current[key] || {}), [field]: value } }));
  const grouped = criteria.reduce((out, criterion) => { (out[criterion.environment] ||= []).push(criterion); return out; }, {});

  async function save() {
    const missing = criteria.filter((criterion) => !ratings[criterion.key]?.rating);
    if (missing.length) { onError(`Rate every ELEOT criterion or choose N/A. ${missing.length} still need a rating.`); return; }
    setSaving(true); onError("");
    try {
      const payload = {
        ...form,
        ratings: criteria.map((criterion) => ({ criterionKey: criterion.key, rating: ratings[criterion.key].rating, evidence: ratings[criterion.key].evidence || "" })),
      };
      await api.post(`/api/students/${student.id}/eleot`, payload);
      setRatings({});
      setForm({ observedAt: new Date().toISOString().slice(0, 10), lessonTopic: "", context: "", notes: "" });
      onNotice(`ELEOT observation saved for ${student.name}.`);
      await load();
    } catch (err) { onError(err.message); } finally { setSaving(false); }
  }

  return <div style={{ marginTop: 16 }}>
    <div style={{ padding: 14, borderRadius: 12, background: "#F8F5FC", border: "1px solid #DED5EE" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div><h3 style={{ margin: 0, color: T.navy900 }}>ELEOT learner observation</h3><p style={{ color: T.ink600, margin: "5px 0 0", fontSize: 13.5 }}>20 student-focused criteria adapted from Cognia’s ELEOT 3.0 form. Observe for at least 20 minutes.</p></div>
        <div style={{ fontSize: 12, color: T.ink600 }}>4 Very Evident · 3 Evident · 2 Somewhat · 1 Not Evident · N/A No opportunity</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 14 }}>
        <div><FieldLabel>Observation date</FieldLabel><input type="date" value={form.observedAt} onChange={(event) => setForm((current) => ({ ...current, observedAt: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 10px" }} /></div>
        <div><FieldLabel>Lesson / topic</FieldLabel><Input value={form.lessonTopic} onChange={(value) => setForm((current) => ({ ...current, lessonTopic: value }))} placeholder="e.g. Fractions review" /></div>
        <div><FieldLabel>Lesson segment</FieldLabel><Select value={form.context} onChange={(value) => setForm((current) => ({ ...current, context: value }))} placeholder="Choose segment" options={["Lesson beginning", "Lesson middle", "Lesson end"].map((value) => ({ value, label: value }))} /></div>
      </div>
    </div>
    {Object.entries(grouped).map(([environment, items]) => {
      const [background, accent] = environmentColors[environment] || [T.cream50, T.navy900];
      return <section key={environment} style={{ marginTop: 16, border: `1px solid ${accent}33`, borderRadius: 12, overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "11px 14px", background, color: accent, fontSize: 15 }}>{environment}</h3>
        {items.map((criterion) => <div key={criterion.key} style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) 150px minmax(180px,.8fr)", gap: 10, padding: 12, borderTop: `1px solid ${T.line}`, alignItems: "center" }}>
          <div><div style={{ fontWeight: 750, color: T.ink900 }}>{criterion.number}. {criterion.label}</div><div style={{ color: T.ink600, fontSize: 12.5, marginTop: 3, lineHeight: 1.4 }}>{criterion.description}</div></div>
          <select aria-label={`Rating for ${criterion.label}`} value={ratings[criterion.key]?.rating || ""} onChange={(event) => setRating(criterion.key, "rating", event.target.value)} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 8px", background: "#fff" }}>
            <option value="">Choose rating</option><option value="4">4 · Very Evident</option><option value="3">3 · Evident</option><option value="2">2 · Somewhat</option><option value="1">1 · Not Evident</option><option value="NA">N/A · No opportunity</option>
          </select>
          <Input value={ratings[criterion.key]?.evidence || ""} onChange={(value) => setRating(criterion.key, "evidence", value)} placeholder="Optional evidence" />
        </div>)}
      </section>;
    })}
    <div style={{ marginTop: 14 }}><FieldLabel>Observation notes</FieldLabel><TextField value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} rows={3} placeholder="Overall evidence, strengths, and suggested next steps…" /></div>
    <Button onClick={save} disabled={saving} style={{ marginTop: 10 }}>{saving ? "Saving observation…" : "Save ELEOT observation"}</Button>
    <div style={{ marginTop: 24 }}><h3 style={{ color: T.navy900, marginBottom: 10 }}>Previous ELEOT observations</h3>{observations.map((observation) => <div key={observation.id} style={{ padding: 12, borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", gap: 12 }}><div><b>{observation.lessonTopic || "Learning observation"}</b><div style={{ color: T.ink600, fontSize: 12.5, marginTop: 3 }}>{new Date(observation.observedAt).toLocaleDateString()} · {observation.observer?.name}{observation.context ? ` · ${observation.context}` : ""}</div></div><strong style={{ color: "#6D3A8A", whiteSpace: "nowrap" }}>{observation.averageScore ?? "N/A"} / 4</strong></div>)}{!observations.length && <p style={{ color: T.ink600 }}>No ELEOT observations recorded yet.</p>}</div>
  </div>;
}

export default function StudentPerformance() {
  const { t } = useLang();
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState([]);
  const [gradeId, setGradeId] = useState("");
  const [classSection, setClassSection] = useState("");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [domain, setDomain] = useState("academic");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [showRoster, setShowRoster] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", studentCode: "", classSection: "" });
  const fileRef = useRef(null);

  const selected = students.find((student) => student.id === selectedId) || null;
  const categories = useMemo(() => (meta?.categories || []).filter((category) => category.domain === domain), [meta, domain]);

  async function loadMeta() {
    setMetaLoading(true); setError("");
    try {
      const data = await api.get("/api/students/meta"); setMeta(data);
      if (!gradeId && data.grades.length === 1) setGradeId(data.grades[0].id);
    } catch (err) { setMeta(null); setError(err.message); } finally { setMetaLoading(false); }
  }
  async function loadStudents() {
    if (!meta) return;
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams();
      if (gradeId) params.set("gradeId", gradeId);
      if (classSection) params.set("classSection", classSection);
      if (search) params.set("search", search);
      const data = await api.get(`/api/students?${params}`); setStudents(data);
      if (selectedId && !data.some((student) => student.id === selectedId)) { setSelectedId(""); setHistory([]); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function loadHistory(id) {
    if (!id) return;
    try { setHistory(await api.get(`/api/students/${id}/history`)); } catch (err) { setError(err.message); }
  }
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { if (meta) loadStudents(); }, [meta, gradeId, classSection]);
  useEffect(() => { const timer = setTimeout(() => { if (meta) loadStudents(); }, 300); return () => clearTimeout(timer); }, [search]);

  async function award(category) {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post(`/api/students/${selected.id}/points`, { categoryId: category.id, note });
      setNotice(`${category.label} (${category.points > 0 ? "+" : ""}${category.points}) recorded for ${selected.name}.`);
      setNote(""); await Promise.all([loadStudents(), loadHistory(selected.id)]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function removeMark(point) {
    if (!window.confirm(`Remove “${point.categoryLabel}” from ${selected?.name}?`)) return;
    try { await api.del(`/api/students/points/${point.id}`); await Promise.all([loadStudents(), loadHistory(selected.id)]); } catch (err) { setError(err.message); }
  }

  async function generateReport() {
    if (!selected) return;
    setBusy(true); setError("");
    try { setReport(await api.get(`/api/students/${selected.id}/report`)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function addStudent() {
    if (!gradeId || !newStudent.name.trim()) { setError("Choose a grade and enter the student's name."); return; }
    try {
      await api.post("/api/students", { ...newStudent, gradeId, classSection: newStudent.classSection || classSection });
      setNewStudent({ name: "", studentCode: "", classSection: "" }); setNotice("Student added to the roster."); await loadStudents();
    } catch (err) { setError(err.message); }
  }

  async function importCsv(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!gradeId) { setError("Choose the grade before uploading the roster."); event.target.value = ""; return; }
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("No student names were found. Use columns: name, studentCode, classSection.");
      const result = await api.post("/api/students/import", { gradeId, classSection, rows });
      setNotice(`Roster uploaded: ${result.created} added, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}.`);
      await loadStudents();
    } catch (err) { setError(err.message); } finally { event.target.value = ""; }
  }

  function downloadTemplate() {
    const blob = new Blob(["name,studentCode,classSection\nStudent Name,STU-001,4A\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "student-roster-template.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  if (metaLoading) return <Loading label="Loading student performance..." />;
  if (!meta) return <div style={{ padding: 32 }}><ErrorBanner message={error || "Student performance could not be loaded."} /><Button onClick={loadMeta}>Try again</Button></div>;
  return (
    <div style={{ padding: "22px clamp(16px, 3vw, 34px) 50px", maxWidth: 1320, margin: "0 auto" }}>
      <ReportView report={report} onClose={() => setReport(null)} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div><h1 style={{ fontFamily: "Georgia, serif", color: T.navy900, margin: 0, fontSize: 25 }}>{t("Student Performance")}</h1><p style={{ color: T.ink600, margin: "6px 0 0" }}>Recognize learning and behavior, complete ELEOT observations, and generate a clear student report.</p></div>
        {meta.canManageRoster && <Button variant="outline" onClick={() => setShowRoster((value) => !value)}>{showRoster ? "Close roster tools" : "Manage student roster"}</Button>}
      </div>
      <ErrorBanner message={error} />
      {notice && <div style={{ background: "#DCFCE7", color: "#166534", border: "1px solid #BBF7D0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>{notice}</div>}

      {showRoster && meta.canManageRoster && <div style={{ ...panel, marginBottom: 18, borderTop: `4px solid ${T.gold500}` }}>
        <h3 style={{ margin: "0 0 4px", color: T.navy900 }}>Admin roster upload</h3><p style={{ color: T.ink600, marginTop: 0, fontSize: 13.5 }}>Choose a grade, then upload a CSV. Existing student IDs are updated instead of duplicated.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div><FieldLabel>Student name</FieldLabel><Input value={newStudent.name} onChange={(value) => setNewStudent((current) => ({ ...current, name: value }))} placeholder="Full name" /></div>
          <div><FieldLabel>Student ID</FieldLabel><Input value={newStudent.studentCode} onChange={(value) => setNewStudent((current) => ({ ...current, studentCode: value }))} placeholder="Optional" /></div>
          <div><FieldLabel>Class</FieldLabel><Input value={newStudent.classSection} onChange={(value) => setNewStudent((current) => ({ ...current, classSection: value }))} placeholder={classSection || "e.g. 4A"} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><Button onClick={addStudent}>Add student</Button><Button variant="outline" onClick={() => fileRef.current?.click()}>Upload CSV roster</Button><Button variant="outline" onClick={downloadTemplate}>Download CSV template</Button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCsv} style={{ display: "none" }} /></div>
      </div>}

      <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <div><FieldLabel>Grade</FieldLabel><Select value={gradeId} onChange={setGradeId} placeholder={meta.canManageRoster ? "All grades" : "Choose grade"} options={meta.grades.map((grade) => ({ value: grade.id, label: grade.label }))} /></div>
        <div><FieldLabel>Class</FieldLabel><Input value={classSection} onChange={setClassSection} placeholder="All classes" /></div>
        <div><FieldLabel>Find student</FieldLabel><Input value={search} onChange={setSearch} placeholder="Search by name" /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.ink600, marginBottom: 9 }}>{busy ? "Updating…" : `${students.length} student${students.length === 1 ? "" : "s"} visible`}</div>
          <div style={{ display: "grid", gap: 10, maxHeight: "68vh", overflowY: "auto", paddingRight: 4 }}>{students.map((student) => <StudentCard key={student.id} student={student} selected={student.id === selectedId} onClick={() => { setSelectedId(student.id); loadHistory(student.id); setNotice(""); }} />)}{!busy && !students.length && <div style={{ ...panel, color: T.ink600, textAlign: "center" }}>No students are available for this grade yet.</div>}</div>
        </div>

        <div style={{ ...panel, minWidth: 0 }}>
          {!selected ? <div style={{ textAlign: "center", padding: "60px 20px", color: T.ink600 }}><div style={{ fontSize: 36 }}>★</div><h3 style={{ color: T.navy900 }}>Select a student</h3><p>Choose a student to give an evaluation mark or generate a report.</p></div> : <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><h2 style={{ margin: 0, color: T.navy900 }}>{selected.name}</h2><div style={{ color: T.ink600, fontSize: 13, marginTop: 4 }}>{selected.grade?.label}{selected.classSection ? ` · ${selected.classSection}` : ""}{selected.studentCode ? ` · ID ${selected.studentCode}` : ""}</div></div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><ScorePill label="Academic" value={selected.scores?.academic || 0} /><ScorePill label="Behavior" value={selected.scores?.behavior || 0} /><Button variant="outline" onClick={generateReport}>Generate report</Button></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20, borderBottom: `1px solid ${T.line}`, paddingBottom: 10 }}><Button variant={domain === "academic" ? "primary" : "outline"} onClick={() => setDomain("academic")}>Academic marks</Button><Button variant={domain === "behavior" ? "primary" : "outline"} onClick={() => setDomain("behavior")}>Behavior marks</Button><Button variant={domain === "eleot" ? "primary" : "outline"} onClick={() => setDomain("eleot")}>ELEOT evaluation</Button></div>
            {domain === "eleot" ? <EleotPanel student={selected} meta={meta} onNotice={setNotice} onError={setError} /> : <>
              <div style={{ marginTop: 14 }}><FieldLabel>Optional note</FieldLabel><TextField value={note} onChange={setNote} rows={2} placeholder="Add brief evidence or context for this mark…" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 9, marginTop: 13 }}>{categories.map((category) => <button key={category.id} disabled={busy} onClick={() => award(category)} style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${category.color}55`, background: `${category.color}0D`, borderRadius: 11, padding: 11, color: T.ink900 }}><div style={{ color: category.color, fontSize: 19, fontWeight: 900 }}>{category.points > 0 ? "+" : ""}{category.points}</div><div style={{ fontWeight: 650, fontSize: 13, marginTop: 3 }}>{category.label}</div></button>)}</div>
              <div style={{ marginTop: 22 }}><h3 style={{ color: T.navy900, marginBottom: 10 }}>Recent evaluation marks</h3>{history.slice(0, 12).map((event) => <div key={event.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.line}` }}><div><span style={{ color: scoreColor(event.points), fontWeight: 800 }}>{event.points > 0 ? "+" : ""}{event.points}</span> <b style={{ marginLeft: 5 }}>{event.categoryLabel}</b><div style={{ color: T.ink600, fontSize: 12, marginTop: 2 }}>{event.teacher?.name} · {new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</div></div><button onClick={() => removeMark(event)} style={{ border: 0, background: "transparent", color: T.copper500, cursor: "pointer" }}>Remove</button></div>)}{!history.length && <p style={{ color: T.ink600 }}>No evaluation marks recorded yet.</p>}</div>
            </>}
          </>}
        </div>
      </div>
    </div>
  );
}
