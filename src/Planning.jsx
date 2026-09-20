import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { api } from "./api.js";
import { T, StatusBadge, Loading, ErrorBanner, FieldLabel, TextField, Input, Select, Button, SectionCard, hasRole } from "./ui.jsx";
import { useLang, fmtDate, fmtDateTime } from "./i18n.jsx";

const SCHOOL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const DAY_LABELS = { sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday" };
const EVENT_COLORS = { quiz: T.gold600, exam: T.copper500, event: T.navy700 };

function utcDayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function sundayKey(value = new Date()) {
  const day = new Date(value);
  const utc = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

function addDays(key, count) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function emptyDays(weekStart) {
  return SCHOOL_DAYS.map((dayKey, index) => ({ dayKey, date: `${addDays(weekStart, index)}T00:00:00.000Z`, classwork: "", homework: "", resources: [] }));
}

function normalizedDays(plan) {
  const start = plan.weekStart ? utcDayKey(plan.weekStart) : sundayKey();
  const defaults = emptyDays(start);
  return defaults.map((day, index) => {
    const saved = (plan.days || []).find((item) => item.dayKey === day.dayKey) || {};
    return {
      ...day,
      ...saved,
      classwork: saved.classwork || (index === 0 ? plan.activities || plan.topics || "" : ""),
      homework: saved.homework || (index === 0 ? plan.homework || "" : ""),
      resources: (saved.resources || []).map((resource) => ({ ...resource })),
    };
  });
}

function slug(text) {
  return String(text || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plan";
}

function AccessBanner({ access }) {
  const { t } = useLang();
  if (!access) return null;
  const message = access.lockedForEveryone
    ? "Friday is read-only for everyone."
    : access.teacherCanEdit
      ? "Teacher editing and review are open today."
      : "Teacher plans are read-only today; review remains open.";
  return (
    <div style={{ border: `1px solid ${access.lockedForEveryone ? T.copper500 : T.line}`, background: access.lockedForEveryone ? "rgba(168,92,50,.08)" : T.cream100, borderRadius: 10, padding: "9px 12px", color: T.ink700, fontSize: 12.5 }}>
      <strong>{t("Planning window")}:</strong> {t(message)}
    </div>
  );
}

function QrPreview({ url }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    if (!url) return undefined;
    QRCode.toDataURL(url, { width: 100, margin: 1 }).then((value) => live && setSrc(value)).catch(() => live && setSrc(""));
    return () => { live = false; };
  }, [url]);
  return src ? <img src={src} alt="QR code" width="58" height="58" style={{ borderRadius: 5, border: `1px solid ${T.line}` }} /> : null;
}

export default function Planning({ currentUser, persona }) {
  const adminView = persona === "admin" && hasRole(currentUser, "admin");
  return adminView
    ? <AdminWeeklyPlanning currentUser={currentUser} persona={persona} />
    : <TeacherWeeklyPlanning currentUser={currentUser} persona={persona} />;
}

function TeacherWeeklyPlanning({ currentUser, persona }) {
  const { t } = useLang();
  const [plans, setPlans] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [access, setAccess] = useState(null);
  const [weekStart, setWeekStart] = useState(sundayKey());
  const [assignmentId, setAssignmentId] = useState("");
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [planRows, accessInfo] = await Promise.all([
        api.get(`/api/plans?weekStart=${weekStart}`),
        api.get("/api/plans/access"),
      ]);
      setPlans(planRows);
      setAccess(accessInfo);
      if (hasRole(currentUser, "teacher")) {
        const rows = await api.get("/api/users/me/teaching-assignments");
        setAssignments(rows);
        setAssignmentId((current) => current || rows[0]?.id || "");
      } else {
        setAssignments([]);
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, [weekStart]);

  async function createPlan() {
    const assignment = assignments.find((row) => row.id === assignmentId);
    if (!assignment) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.post("/api/plans", { assignmentId, weekStart, days: emptyDays(weekStart) });
      setOpenId(created.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (openId) return <PlanDetail id={openId} currentUser={currentUser} persona={persona} onBack={() => { setOpenId(null); load(); }} />;
  if (!plans || assignments == null) return <Loading />;

  const assignmentOptions = assignments.map((row) => ({ value: row.id, label: `${row.grade} · ${row.classSection} · ${row.subject}` }));
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>{t("Weekly planning")}</h1>
          <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 3 }}>{t("Sunday through Thursday · classwork, homework, calendar, and digital resources")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <FieldLabel>{t("Week beginning Sunday")}</FieldLabel>
            <Input type="date" value={weekStart} onChange={(value) => setWeekStart(sundayKey(`${value}T00:00:00`))} />
          </div>
          {hasRole(currentUser, "teacher") && <div style={{ minWidth: 270 }}>
            <FieldLabel>{t("Assigned class")}</FieldLabel>
            <Select value={assignmentId} onChange={setAssignmentId} options={assignmentOptions} placeholder={t("Choose an assignment")} />
          </div>}
          {hasRole(currentUser, "teacher") && <Button onClick={createPlan} disabled={busy || !assignmentId || !access?.teacherCanEdit}>{busy ? t("Creating…") : t("+ New weekly plan")}</Button>}
        </div>
      </div>
      <AccessBanner access={access} />
      <ErrorBanner message={error} />
      {assignments.length === 0 && hasRole(currentUser, "teacher") && (
        <div style={{ marginTop: 14, padding: 20, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, color: T.ink600 }}>
          {t("No grade, class, and subject assignments have been configured for your account. Ask an administrator to add one in Staff & Roles.")}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 14 }}>
        {plans.map((plan) => (
          <button key={plan.id} onClick={() => setOpenId(plan.id)} style={{ textAlign: "start", border: `1px solid ${T.line}`, background: "#fff", borderRadius: 12, padding: 16, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ color: T.navy900 }}>{plan.subject}</strong>
              <StatusBadge status={plan.status} />
            </div>
            <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 6 }}>{plan.grade} · {plan.classSection || t("No class")}</div>
            <div style={{ color: T.ink600, fontSize: 12, marginTop: 3 }}>{plan.teacher?.name}</div>
          </button>
        ))}
        {plans.length === 0 && <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32, color: T.ink600, border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>{t("No plans for this week yet.")}</div>}
      </div>
    </div>
  );
}

function AdminWeeklyPlanning({ currentUser, persona }) {
  const { t } = useLang();
  const [weekStart, setWeekStart] = useState(sundayKey());
  const [grade, setGrade] = useState("Grade 1");
  const [classSection, setClassSection] = useState("A");
  const [branchId, setBranchId] = useState("");
  const [grades, setGrades] = useState([]);
  const [branches, setBranches] = useState([]);
  const [overview, setOverview] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    Promise.all([api.get("/api/settings/grade-bands"), api.get("/api/settings/branches")])
      .then(([gradeRows, branchRows]) => {
        setGrades(gradeRows);
        setBranches(branchRows);
        if (gradeRows[0]?.label) setGrade(gradeRows[0].label);
        if (branchRows[0]?.id) setBranchId(branchRows[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function load() {
    if (!grade || !classSection.trim()) return;
    setOverview(null);
    try {
      const params = new URLSearchParams({ weekStart, grade, classSection: classSection.trim() });
      if (branchId) params.set("branchId", branchId);
      setOverview(await api.get(`/api/plans/overview?${params}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, [weekStart, grade, classSection, branchId]);

  async function exportOverview(format) {
    setExporting(format);
    setError("");
    try {
      const params = new URLSearchParams({ weekStart, grade, classSection: classSection.trim() });
      if (branchId) params.set("branchId", branchId);
      await api.downloadPdf(`/api/plans/overview/export.${format}?${params}`, `fwis-weekly-${slug(grade)}-${slug(classSection)}.${format}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting("");
    }
  }

  if (openId) return <PlanDetail id={openId} currentUser={currentUser} persona={persona} onBack={() => { setOpenId(null); load(); }} />;
  const gradeOptions = grades.length ? grades.map((item) => ({ value: item.label, label: item.label })) : Array.from({ length: 12 }, (_, index) => ({ value: `Grade ${index + 1}`, label: `Grade ${index + 1}` }));
  const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }));

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>{t("Whole-school weekly plan")}</h1>
          <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 3 }}>{t("All subjects in the required school order")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><FieldLabel>{t("Week")}</FieldLabel><Input type="date" value={weekStart} onChange={(value) => setWeekStart(sundayKey(`${value}T00:00:00`))} /></div>
          <div style={{ minWidth: 125 }}><FieldLabel>{t("Grade")}</FieldLabel><Select value={grade} onChange={setGrade} options={gradeOptions} /></div>
          <div style={{ width: 115 }}><FieldLabel>{t("Class")}</FieldLabel><Input value={classSection} onChange={setClassSection} /></div>
          {branches.length > 1 && <div style={{ minWidth: 150 }}><FieldLabel>{t("Branch")}</FieldLabel><Select value={branchId} onChange={setBranchId} options={branchOptions} /></div>}
          <Button variant="outline" onClick={() => exportOverview("pdf")} disabled={!overview || exporting}>{exporting === "pdf" ? t("Exporting…") : t("Export PDF")}</Button>
          <Button variant="outline" onClick={() => exportOverview("docx")} disabled={!overview || exporting}>{exporting === "docx" ? t("Exporting…") : t("Export Word")}</Button>
        </div>
      </div>
      <AccessBanner access={overview?.access} />
      <ErrorBanner message={error} />
      {!overview ? <Loading /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {overview.subjects.map((subject, index) => {
            const plan = overview.plans.find((row) => row.subject === subject);
            return (
              <button key={subject} disabled={!plan} onClick={() => plan && setOpenId(plan.id)} style={{ display: "grid", gridTemplateColumns: "36px minmax(180px, .8fr) 1fr auto", gap: 12, alignItems: "center", textAlign: "start", border: `1px solid ${plan ? T.line : "#E8E5DD"}`, background: plan ? "#fff" : "#FAF9F6", borderRadius: 11, padding: "12px 14px", cursor: plan ? "pointer" : "default", opacity: plan ? 1 : .72 }}>
                <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "50%", background: T.navy900, color: T.gold500, fontWeight: 800, fontSize: 12 }}>{index + 1}</span>
                <strong style={{ color: T.navy900 }}>{t(subject)}</strong>
                <span style={{ color: T.ink600, fontSize: 12.5 }}>{plan ? `${plan.teacher?.name || "—"} · ${t("Submitted plan available")}` : t("No plan submitted")}</span>
                {plan ? <StatusBadge status={plan.status} /> : <span style={{ fontSize: 11.5, color: T.copper500 }}>{t("Missing")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventStrip({ events = [] }) {
  const { t } = useLang();
  if (!events.length) return <div style={{ fontSize: 12, color: T.ink600 }}>{t("No calendar items")}</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {events.map((event) => (
        <span key={event.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", borderRadius: 999, padding: "4px 9px", background: `${EVENT_COLORS[event.type] || T.navy700}15`, color: EVENT_COLORS[event.type] || T.navy700, fontSize: 11.5, fontWeight: 650 }}>
          {t(event.type === "quiz" ? "Quiz" : event.type === "exam" ? "Exam" : "Event")}: {event.title}
        </span>
      ))}
    </div>
  );
}

function DayEditor({ day, events, editable, onChange }) {
  const { t } = useLang();
  const updateResource = (index, key, value) => {
    const resources = day.resources.map((resource, i) => i === index ? { ...resource, [key]: value } : resource);
    onChange({ ...day, resources });
  };
  const addResource = () => onChange({ ...day, resources: [...day.resources, { label: "", url: "", qrEnabled: true }] });
  const removeResource = (index) => onChange({ ...day, resources: day.resources.filter((_, i) => i !== index) });
  return (
    <section style={{ border: `1px solid ${T.line}`, borderRadius: 13, overflow: "hidden", background: "#fff" }}>
      <div style={{ background: T.navy900, color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong style={{ color: T.gold500 }}>{t(DAY_LABELS[day.dayKey])}</strong>
        <span style={{ fontSize: 12 }}>{fmtDate(day.date, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div><FieldLabel>{t("Important dates, events, quizzes, and exams")}</FieldLabel><EventStrip events={events} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
          <div><FieldLabel>{t("Classwork")}</FieldLabel><TextField value={day.classwork} onChange={(value) => onChange({ ...day, classwork: value })} rows={5} disabled={!editable} /></div>
          <div><FieldLabel>{t("Homework")}</FieldLabel><TextField value={day.homework} onChange={(value) => onChange({ ...day, homework: value })} rows={5} disabled={!editable} /></div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <FieldLabel>{t("Digital resources")}</FieldLabel>
            {editable && <Button variant="outline" onClick={addResource} style={{ padding: "5px 10px", fontSize: 12 }}>{t("+ Add link / QR")}</Button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {day.resources.map((resource, index) => (
              <div key={resource.id || index} style={{ display: "grid", gridTemplateColumns: "minmax(120px,.5fr) minmax(220px,1fr) auto auto", gap: 8, alignItems: "center", border: `1px solid ${T.line}`, borderRadius: 9, padding: 8 }}>
                <Input value={resource.label} onChange={(value) => updateResource(index, "label", value)} placeholder={t("Resource label")} disabled={!editable} />
                <Input value={resource.url} onChange={(value) => updateResource(index, "url", value)} placeholder="https://…" disabled={!editable} />
                {resource.qrEnabled !== false && resource.url && <QrPreview url={resource.url} />}
                {editable && <Button variant="danger" onClick={() => removeResource(index)} style={{ padding: "6px 9px" }}>{t("Remove")}</Button>}
              </div>
            ))}
            {day.resources.length === 0 && <div style={{ color: T.ink600, fontSize: 12 }}>{t("No digital resources added.")}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanDetail({ id, currentUser, persona, onBack }) {
  const { t } = useLang();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [showReturn, setShowReturn] = useState(false);

  async function reload() {
    try {
      const loaded = await api.get(`/api/plans/${id}`);
      setPlan({ ...loaded, days: normalizedDays(loaded) });
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { reload(); }, [id]);

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const event of plan?.calendarEvents || []) (map[String(event.date).slice(0, 10)] ||= []).push(event);
    return map;
  }, [plan?.calendarEvents]);

  if (!plan) return <Loading />;
  const owner = plan.teacherId === currentUser.id;
  const actingAdmin = persona === "admin" && hasRole(currentUser, "admin");
  const teacherEditable = owner && ["draft", "returned"].includes(plan.status) && plan.access?.teacherCanEdit;
  const adminEditable = actingAdmin && plan.status !== "draft" && plan.access?.adminCanEdit;
  const editable = teacherEditable || adminEditable;
  const canReview = plan.access?.reviewerCanReview && (
    (actingAdmin && ["submitted", "hod_approved"].includes(plan.status))
    || (persona === "hod" && plan.status === "submitted")
    || (persona === "supervisor" && plan.status === "hod_approved")
  );

  function changeDay(index, value) {
    setPlan((current) => ({ ...current, days: current.days.map((day, i) => i === index ? value : day) }));
  }

  async function action(name, fn) {
    setBusy(name);
    setError("");
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  const save = () => action("save", async () => { await api.patch(`/api/plans/${id}`, { days: plan.days }); await reload(); });
  const submit = () => action("submit", async () => { await api.post(`/api/plans/${id}/submit`); await reload(); });
  const approve = () => action("approve", async () => { await api.post(`/api/plans/${id}/approve`); await reload(); });
  const returnPlan = () => action("return", async () => { await api.post(`/api/plans/${id}/return`, { comment: returnNote }); setReturnNote(""); setShowReturn(false); await reload(); });
  const exportFile = (format) => action(format, async () => api.downloadPdf(`/api/plans/${id}/export.${format}`, `fwis-weekly-${slug(plan.subject)}.${format}`));

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1120, margin: "0 auto" }}>
      <button onClick={onBack} style={{ border: 0, background: "transparent", color: T.ink600, cursor: "pointer", padding: 0, marginBottom: 14 }}>{t("← Back to weekly plans")}</button>
      <ErrorBanner message={error} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, color: T.navy900, margin: 0 }}>{plan.subject}</h1>
            <StatusBadge status={plan.status} />
          </div>
          <div style={{ color: T.ink600, fontSize: 12.5, marginTop: 5 }}>{plan.grade} · {plan.classSection} · {plan.teacher?.name} · {plan.weekStart ? fmtDate(plan.weekStart, { timeZone: "UTC" }) : plan.week}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={() => exportFile("pdf")} disabled={busy}>{busy === "pdf" ? t("Exporting…") : t("Export PDF")}</Button>
          <Button variant="outline" onClick={() => exportFile("docx")} disabled={busy}>{busy === "docx" ? t("Exporting…") : t("Export Word")}</Button>
          {editable && <Button variant="outline" onClick={save} disabled={busy}>{busy === "save" ? t("Saving…") : actingAdmin ? t("Save admin changes") : t("Save draft")}</Button>}
          {teacherEditable && <Button onClick={submit} disabled={busy}>{plan.status === "returned" ? t("Resubmit") : t("Submit for review")}</Button>}
          {canReview && <Button variant="success" onClick={approve} disabled={busy}>{t("Approve")}</Button>}
          {canReview && <Button variant="outline" onClick={() => setShowReturn(true)} disabled={busy}>{t("Return with comment")}</Button>}
        </div>
      </div>
      <AccessBanner access={plan.access} />
      {!editable && <div style={{ marginTop: 10, fontSize: 12.5, color: T.ink600 }}>{t("This plan is currently read-only.")}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        {plan.days.map((day, index) => <DayEditor key={day.dayKey} day={day} events={eventsByDay[String(day.date).slice(0, 10)] || []} editable={editable} onChange={(value) => changeDay(index, value)} />)}
      </div>
      {showReturn && (
        <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream100 }}>
          <FieldLabel required>{t("Comment for the teacher")}</FieldLabel>
          <TextField value={returnNote} onChange={setReturnNote} rows={3} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}><Button variant="danger" onClick={returnPlan} disabled={!returnNote.trim() || busy}>{t("Send back")}</Button><Button variant="outline" onClick={() => setShowReturn(false)}>{t("Cancel")}</Button></div>
        </div>
      )}
      {plan.comments?.length > 0 && <div style={{ marginTop: 16 }}><SectionCard title={t("Comments")}>{plan.comments.map((comment) => <div key={comment.id} style={{ borderBottom: `1px solid ${T.line}`, padding: "7px 0", fontSize: 12.5 }}><strong>{comment.author?.name}</strong> · {comment.text}</div>)}</SectionCard></div>}
      {plan.auditLogs?.length > 0 && <div style={{ marginTop: 16 }}><SectionCard title={t("Audit trail")}>{plan.auditLogs.map((entry) => <div key={entry.id} style={{ padding: "5px 0", fontSize: 12, color: T.ink600 }}><strong style={{ color: T.ink900 }}>{entry.action}</strong> · {entry.by?.name} · {fmtDateTime(entry.at)}</div>)}</SectionCard></div>}
    </div>
  );
}
