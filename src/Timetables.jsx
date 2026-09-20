import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { useLang } from "./i18n.jsx";
import { Button, ErrorBanner, FieldLabel, Input, Loading, Select, T, TextField } from "./ui.jsx";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const DAY_LABELS = { sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday" };
const DUTIES = [
  { value: "morning_duty", label: "Morning Duty" },
  { value: "first_recess_duty", label: "First Recess Duty" },
  { value: "dhuhr_duty", label: "Dhuhr Prayer Duty" },
  { value: "afternoon_duty", label: "Afternoon Duty" },
];
const TYPE_META = {
  teaching: { bg: "#F4F7FB", border: "#9FB3C8", label: "Teaching" },
  morning_duty: { bg: "#DDEBFF", border: "#5B8CC9", label: "Morning Duty" },
  first_recess_duty: { bg: "#FFE5A8", border: "#D6A52A", label: "First Recess Duty" },
  dhuhr_duty: { bg: "#D8F0E2", border: "#4C9A68", label: "Dhuhr Prayer Duty" },
  afternoon_duty: { bg: "#F2D0C2", border: "#B86B48", label: "Afternoon Duty" },
};
const EMPTY_LESSON = { dayKey: "sunday", periodKey: "session1", grade: "", classSection: "", subject: "", room: "", notes: "" };
const EMPTY_DUTY = { dayKey: "sunday", entryType: "morning_duty", gradeBand: "primary", room: "", notes: "" };

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function EntryCard({ entry, admin, onEdit, onDelete, onRespond, onConfirm, t }) {
  const meta = TYPE_META[entry.entryType] || TYPE_META.teaching;
  const pending = entry.status === "pending";
  return (
    <div style={{ background: meta.bg, border: `1px ${pending ? "dashed" : "solid"} ${meta.border}`, borderRadius: 9, padding: 9, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <strong style={{ color: T.navy900, fontSize: 12.5 }}>{entry.startTime}–{entry.endTime}</strong>
        <span style={{ fontSize: 10.5, color: T.ink600, textTransform: "capitalize" }}>{t(entry.status)}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink900, marginTop: 3 }}>
        {entry.entryType === "teaching" ? entry.subject : t(meta.label)}
      </div>
      {entry.entryType === "teaching" && <div style={{ fontSize: 11.5, color: T.ink600 }}>{entry.grade} · {entry.classSection}{entry.room ? ` · ${entry.room}` : ""}</div>}
      {entry.entryType !== "teaching" && entry.room && <div style={{ fontSize: 11.5, color: T.ink600 }}>{entry.room}</div>}
      {entry.notes && <div style={{ fontSize: 11, color: T.ink600, marginTop: 3 }}>{entry.notes}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
        {entry.entryType === "teaching" && <Small onClick={() => onEdit(entry)}>{t("Edit")}</Small>}
        {pending && !admin && <><Small onClick={() => onRespond(entry.id, "accept")}>{t("Accept")}</Small><Small onClick={() => onRespond(entry.id, "decline")}>{t("Decline")}</Small></>}
        {admin && entry.entryType !== "teaching" && entry.status !== "confirmed" && entry.status !== "declined" && <Small onClick={() => onConfirm(entry.id)}>{t("Confirm")}</Small>}
        {(admin || entry.entryType === "teaching" || (entry.source === "self" && entry.status !== "confirmed")) && <Small onClick={() => onDelete(entry.id)} danger>{t(entry.entryType === "teaching" ? "Delete" : "Remove")}</Small>}
      </div>
    </div>
  );
}
function Small({ children, onClick, danger }) {
  return <button onClick={onClick} style={{ border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", background: danger ? "#A85C32" : "#fff", color: danger ? "#fff" : T.navy900 }}>{children}</button>;
}

function BellSchedule({ config, t }) {
  if (!config) return null;
  return (
    <details style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: T.navy900 }}>{t("Bell schedule and recess times")}</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 12 }}>
        {[{ key: "primary", label: "Grades 1–6" }, { key: "secondary", label: "Grades 7–12" }].map((band) => (
          <div key={band.key}>
            <strong style={{ fontSize: 12.5 }}>{t(band.label)}</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {config[band.key].map((row) => <span key={row.periodKey} style={{ fontSize: 10.5, padding: "4px 7px", borderRadius: 6, background: TYPE_META[row.entryType]?.bg || "#eee" }}>{t(row.label)} {row.startTime}–{row.endTime}</span>)}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Timetables({ currentUser, persona }) {
  const { t } = useLang();
  const admin = persona === "admin";
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState(admin ? "" : currentUser.id);
  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lesson, setLesson] = useState(EMPTY_LESSON);
  const [duty, setDuty] = useState(EMPTY_DUTY);
  const [editingId, setEditingId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  function load(id = teacherId) {
    if (admin && !id) { setData(null); return; }
    setError("");
    api.get(`/api/timetables${id ? `?teacherId=${encodeURIComponent(id)}` : ""}`).then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => {
    api.get("/api/timetables/config").then(setConfig).catch((e) => setError(e.message));
    if (admin) {
      api.get("/api/timetables/teachers").then(({ teachers: rows }) => {
        setTeachers(rows);
        if (rows[0]) setTeacherId((old) => old || rows[0].id);
      }).catch((e) => setError(e.message));
    }
  }, []);
  useEffect(() => { if (teacherId) load(teacherId); }, [teacherId]);

  const byDay = useMemo(() => Object.fromEntries(DAYS.map((day) => [day, (data?.entries || []).filter((x) => x.dayKey === day).sort((a, b) => a.startTime.localeCompare(b.startTime))])), [data]);
  const teacherOptions = teachers.map((x) => ({ value: x.id, label: `${x.name} · ${x.email}` }));
  const periodOptions = Array.from({ length: 8 }, (_, i) => ({ value: `session${i + 1}`, label: `${t("Session")} ${i + 1}` }));

  async function submitLesson() {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { ...lesson, teacherId };
      if (editingId) await api.patch(`/api/timetables/entries/${editingId}`, body);
      else await api.post("/api/timetables/entries", body);
      setLesson(EMPTY_LESSON); setEditingId(""); setNotice(t(editingId ? "Lesson updated." : "Lesson added.")); load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function editEntry(entry) {
    setEditingId(entry.id);
    setLesson({ dayKey: entry.dayKey, periodKey: entry.periodKey, grade: entry.grade, classSection: entry.classSection, subject: entry.subject, room: entry.room, notes: entry.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function removeEntry(id) {
    if (!window.confirm(t("Remove this timetable entry?"))) return;
    try { await api.del(`/api/timetables/entries/${id}`); load(); } catch (e) { setError(e.message); }
  }
  async function submitDuty() {
    setBusy(true); setError(""); setNotice("");
    try {
      const path = admin ? "/api/timetables/duties/assign" : "/api/timetables/duties/self";
      await api.post(path, { ...duty, teacherId });
      setDuty(EMPTY_DUTY); setNotice(t(admin ? "Duty request sent to the teacher." : "Duty added to your timetable.")); load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function respond(id, response) { try { await api.patch(`/api/timetables/duties/${id}/respond`, { response }); load(); } catch (e) { setError(e.message); } }
  async function confirm(id) { try { await api.patch(`/api/timetables/duties/${id}/confirm`, {}); load(); } catch (e) { setError(e.message); } }

  async function previewFile() {
    if (!file) return setError(t("Choose an Excel file first."));
    setBusy(true); setError(""); setPreview(null);
    const form = new FormData(); form.append("file", file);
    try { setPreview(await api.postForm("/api/timetables/import/preview", form)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function commitImport(mode) {
    if (!file || !preview?.valid) return;
    if (mode === "replace" && !window.confirm(t("Replace the existing timetable with this validated upload?"))) return;
    setBusy(true); setError("");
    const form = new FormData(); form.append("file", file); form.append("mode", mode);
    try {
      const result = await api.postForm("/api/timetables/import", form);
      setNotice(t("Imported {count} timetable entries.").replace("{count}", result.imported)); setPreview(null); setFile(null); load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function download(path, name) { try { saveBlob(await api.download(path), name); } catch (e) { setError(e.message); } }

  if (!config || (!data && (!admin || teacherId))) return <Loading label="Loading timetable..." />;
  return (
    <div style={{ padding: "24px 28px", maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 23, color: T.navy900, margin: 0 }}>{t("Teacher Timetables")}</h1>
          <p style={{ color: T.ink600, fontSize: 13, margin: "5px 0 0" }}>{t("Eight daily sessions, two recess duties, and before/after-school duty in one place.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={() => download("/api/timetables/template.xlsx", "FWIS-timetable-template.xlsx")}>{t("Download Excel template")}</Button>
          <Button variant="outline" onClick={() => download(`/api/timetables/export.xlsx${admin && teacherId ? `?teacherId=${teacherId}` : ""}`, "FWIS-teacher-timetable.xlsx")}>{t("Export Excel")}</Button>
          <Button variant="outline" onClick={() => download(`/api/timetables/export.pdf${admin && teacherId ? `?teacherId=${teacherId}` : ""}`, "FWIS-teacher-timetable.pdf")}>{t("Export PDF")}</Button>
          {admin && <Button onClick={() => download("/api/timetables/export.xlsx", "FWIS-all-teacher-timetables.xlsx")}>{t("Export all teachers")}</Button>}
        </div>
      </div>
      <ErrorBanner message={error} />
      {notice && <div style={{ background: "#E4EFE2", color: "#33622D", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{notice}</div>}
      {admin && <div style={{ marginBottom: 14 }}>
        <FieldLabel>{t("Teacher timetable tabs")}</FieldLabel>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 7 }}>
          {teachers.map((teacher) => <button key={teacher.id} onClick={() => setTeacherId(teacher.id)} style={{ flexShrink: 0, border: `1px solid ${teacherId === teacher.id ? T.gold500 : T.line}`, background: teacherId === teacher.id ? T.navy900 : "#fff", color: teacherId === teacher.id ? "#fff" : T.ink900, borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{teacher.name}</button>)}
        </div>
        <div style={{ maxWidth: 520 }}><Select value={teacherId} onChange={setTeacherId} options={teacherOptions} placeholder={t("Select a teacher")} /></div>
      </div>}
      <BellSchedule config={config} t={t} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, marginBottom: 16 }}>
        <div style={cardStyle}>
          <h2 style={headingStyle}>{t(editingId ? "Edit teaching period" : "Add teaching period")}</h2>
          <div style={formGrid}>
            <Field label={t("Day")}><Select value={lesson.dayKey} onChange={(v) => setLesson({ ...lesson, dayKey: v })} options={DAYS.map((x) => ({ value: x, label: t(DAY_LABELS[x]) }))} /></Field>
            <Field label={t("Session")}><Select value={lesson.periodKey} onChange={(v) => setLesson({ ...lesson, periodKey: v })} options={periodOptions} /></Field>
            <Field label={t("Grade")}><Input value={lesson.grade} onChange={(v) => setLesson({ ...lesson, grade: v })} placeholder={t("e.g. Grade 4")} /></Field>
            <Field label={t("Class")}><Input value={lesson.classSection} onChange={(v) => setLesson({ ...lesson, classSection: v })} placeholder="4A" /></Field>
            <Field label={t("Subject")}><Input value={lesson.subject} onChange={(v) => setLesson({ ...lesson, subject: v })} /></Field>
            <Field label={t("Room")}><Input value={lesson.room} onChange={(v) => setLesson({ ...lesson, room: v })} /></Field>
          </div>
          <Field label={t("Notes")}><TextField rows={2} value={lesson.notes} onChange={(v) => setLesson({ ...lesson, notes: v })} /></Field>
          <div style={{ display: "flex", gap: 8 }}><Button disabled={busy} onClick={submitLesson}>{t(editingId ? "Save changes" : "Add lesson")}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(""); setLesson(EMPTY_LESSON); }}>{t("Cancel")}</Button>}</div>
        </div>
        <div style={cardStyle}>
          <h2 style={headingStyle}>{t(admin ? "Assign duty" : "Assign myself to duty")}</h2>
          <div style={formGrid}>
            <Field label={t("Day")}><Select value={duty.dayKey} onChange={(v) => setDuty({ ...duty, dayKey: v })} options={DAYS.map((x) => ({ value: x, label: t(DAY_LABELS[x]) }))} /></Field>
            <Field label={t("Duty time")}><Select value={duty.entryType} onChange={(v) => setDuty({ ...duty, entryType: v })} options={DUTIES.map((x) => ({ ...x, label: t(x.label) }))} /></Field>
            {duty.entryType === "first_recess_duty" && <Field label={t("Grade band")}><Select value={duty.gradeBand} onChange={(v) => setDuty({ ...duty, gradeBand: v })} options={[{ value: "primary", label: t("Grades 1–6") }, { value: "secondary", label: t("Grades 7–12") }]} /></Field>}
            <Field label={t("Location")}><Input value={duty.room} onChange={(v) => setDuty({ ...duty, room: v })} placeholder={t("e.g. Playground")} /></Field>
          </div>
          <Field label={t("Notes")}><TextField rows={2} value={duty.notes} onChange={(v) => setDuty({ ...duty, notes: v })} /></Field>
          <Button disabled={busy} onClick={submitDuty}>{t(admin ? "Send duty request" : "Add duty")}</Button>
        </div>
        <div style={cardStyle}>
          <h2 style={headingStyle}>{t("Upload timetable")}</h2>
          <p style={{ color: T.ink600, fontSize: 12.5 }}>{t("Preview and validate the workbook before anything is replaced.")}</p>
          <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} />
          <div style={{ marginTop: 12 }}><Button variant="outline" disabled={!file || busy} onClick={previewFile}>{t("Preview upload")}</Button></div>
          {preview && <div style={{ marginTop: 12, fontSize: 12.5 }}>
            <strong>{preview.rows.length} {t("valid rows")}</strong>
            {preview.errors.map((e) => <div key={`${e.row}:${e.message}`} style={{ color: "#93401A" }}>{t("Row")} {e.row}: {e.message}</div>)}
            {preview.valid && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><Button onClick={() => commitImport("replace")}>{t("Replace timetable")}</Button><Button variant="outline" onClick={() => commitImport("merge")}>{t("Merge rows")}</Button></div>}
          </div>}
        </div>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(230px, 1fr))", gap: 10, minWidth: 1180 }}>
          {DAYS.map((day) => <div key={day} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: T.navy900, color: "#fff", padding: "10px 12px", fontWeight: 700, fontSize: 13 }}>{t(DAY_LABELS[day])}</div>
            <div style={{ padding: 9, minHeight: 300 }}>
              {!byDay[day]?.length && <div style={{ color: T.ink600, fontSize: 12, padding: 8 }}>{t("No entries")}</div>}
              {byDay[day]?.map((entry) => <EntryCard key={entry.id} entry={entry} admin={admin} onEdit={editEntry} onDelete={removeEntry} onRespond={respond} onConfirm={confirm} t={t} />)}
            </div>
          </div>)}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) { return <div><FieldLabel>{label}</FieldLabel>{children}</div>; }
const cardStyle = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 };
const headingStyle = { fontSize: 15, color: T.navy900, margin: "0 0 12px" };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 10 };
