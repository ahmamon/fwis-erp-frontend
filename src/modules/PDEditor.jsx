import { useEffect, useState } from "react";
import { api } from "../api";
import { T, FieldLabel, Button, ErrorBanner, Loading, SectionCard, Input, hasRole } from "../ui";
import { useLang } from "../i18n.jsx";

const canLead = (user) => user && ["hod", "supervisor", "admin"].some((role) => hasRole(user, role));
const statusLabel = {
  applied: "Awaiting approval",
  approved: "Ready to start",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Application declined",
  locked: "Attempts used — admin review needed",
};

const panel = { border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: 16 };
const muted = { color: T.ink600, fontSize: 13 };

export default function PDEditor({ currentUser }) {
  const { t } = useLang();
  const leader = canLead(currentUser);
  const [catalog, setCatalog] = useState(null);
  const [record, setRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tab, setTab] = useState("catalog");
  const [courseSlug, setCourseSlug] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const requests = [api.get("/api/pd/catalog"), api.get("/api/pd/me")];
      if (leader) requests.push(api.get("/api/pd"), api.get("/api/pd/applications"));
      const [courseData, myRecord, allRecords = [], allApplications = []] = await Promise.all(requests);
      setCatalog(courseData);
      setRecord(myRecord);
      setRecords(allRecords);
      setApplications(allApplications);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [leader]);

  if (!catalog || !record) return <Loading />;
  if (courseSlug) return <CoursePlayer slug={courseSlug} onBack={() => setCourseSlug("")} onChanged={load} />;

  const tabs = [
    ["catalog", t("Course catalogue")],
    ["learning", t("My learning")],
    ["record", t("My PD record")],
    ...(leader ? [["applications", `${t("Applications")} (${applications.filter((item) => item.status === "applied").length})`], ["all", t("All PD records")]] : []),
  ];

  return (
    <div>
      <SectionCard title={t("Professional Development Academy")}>
        <ErrorBanner message={error} />
        <div style={{ ...panel, background: "linear-gradient(135deg, #0B1F3A, #163B67)", color: "white", marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{t("Grow one module at a time")}</div>
          <div style={{ marginTop: 6, maxWidth: 760, color: "#D8E3EF", lineHeight: 1.55 }}>
            {t("Each guided course includes five one-hour modules. Pass each module assessment to continue, complete all five, and earn an official five-hour certificate.")}
          </div>
          <div style={{ marginTop: 13, fontWeight: 700, color: "#F0D89D" }}>
            {record.cpdCompleted || 0} / {record.cpdTarget || 30} {t("annual PD hours")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {tabs.map(([id, label]) => (
            <Button key={id} variant={tab === id ? undefined : "outline"} onClick={() => setTab(id)}>{label}</Button>
          ))}
        </div>

        {tab === "catalog" && <CourseCatalogue courses={catalog} onChanged={load} onOpen={setCourseSlug} />}
        {tab === "learning" && <MyLearning courses={catalog} onOpen={setCourseSlug} />}
        {tab === "record" && <MyPD record={record} onChanged={load} />}
        {tab === "applications" && leader && <Applications items={applications} onChanged={load} />}
        {tab === "all" && leader && <AllRecords records={records} />}
      </SectionCard>
    </div>
  );
}

function CourseCatalogue({ courses, onChanged, onOpen }) {
  const { t } = useLang();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function apply(course) {
    setBusy(course.id); setError("");
    try {
      await api.post(`/api/pd/catalog/${course.id}/apply`);
      await onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {courses.map((course) => {
          const enrollment = course.enrollment;
          const passed = enrollment?.attempts?.filter((attempt) => attempt.passed).length || 0;
          return (
            <div key={course.id} style={{ ...panel, display: "flex", flexDirection: "column", minHeight: 265 }}>
              <div style={{ color: T.copper500, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{course.category}</div>
              <h3 style={{ color: T.navy900, fontSize: 17, margin: "7px 0" }}>{course.title}</h3>
              <p style={{ ...muted, lineHeight: 1.5, flex: 1 }}>{course.description}</p>
              <div style={{ ...muted, marginBottom: 10 }}>{course.hours} {t("hours")} · {course.modules.length} {t("modules")} · {course.passingScore}% {t("pass mark")}</div>
              {enrollment && (
                <div style={{ marginBottom: 10 }}>
                  <Progress value={enrollment.status === "completed" ? 5 : passed} max={5} />
                  <div style={{ ...muted, marginTop: 5 }}>{t(statusLabel[enrollment.status] || enrollment.status)}</div>
                </div>
              )}
              {!enrollment || enrollment.status === "rejected" ? (
                <Button disabled={busy === course.id} onClick={() => apply(course)}>{busy === course.id ? t("Applying…") : t("Apply for course")}</Button>
              ) : ["approved", "in_progress", "completed", "locked"].includes(enrollment.status) ? (
                <Button onClick={() => onOpen(course.slug)}>{enrollment.status === "completed" ? t("View course and certificate") : t("Open course")}</Button>
              ) : (
                <Button disabled variant="outline">{t("Awaiting administrator approval")}</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyLearning({ courses, onOpen }) {
  const { t } = useLang();
  const enrolled = courses.filter((course) => course.enrollment);
  if (!enrolled.length) return <Empty>{t("You have not applied for a guided course yet. Open Course catalogue to choose one.")}</Empty>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {enrolled.map((course) => {
        const enrollment = course.enrollment;
        const passed = enrollment.attempts?.filter((attempt) => attempt.passed).length || 0;
        return (
          <div key={course.id} style={{ ...panel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ fontWeight: 700, color: T.navy900 }}>{course.title}</div>
              <div style={{ ...muted, margin: "4px 0 8px" }}>{t(statusLabel[enrollment.status] || enrollment.status)}</div>
              <Progress value={enrollment.status === "completed" ? 5 : passed} max={5} />
            </div>
            {["approved", "in_progress", "completed", "locked"].includes(enrollment.status) && <Button onClick={() => onOpen(course.slug)}>{t("Open")}</Button>}
          </div>
        );
      })}
    </div>
  );
}

function CoursePlayer({ slug, onBack, onChanged }) {
  const { t } = useLang();
  const [course, setCourse] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api.get(`/api/pd/catalog/${slug}`);
      setCourse(data);
      const active = data.modules.find((item) => !item.locked && !item.passed) || data.modules.find((item) => item.passed) || data.modules[0];
      setSelected((current) => data.modules.find((item) => item.id === current?.id) || active);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [slug]);
  const module = course?.modules.find((item) => item.id === selected?.id);

  async function submit() {
    if (!module?.quiz || module.quiz.some((question) => answers[question.index] === undefined)) {
      setError(t("Answer every question before submitting.")); return;
    }
    setBusy(true); setError(""); setResult(null);
    try {
      const payload = module.quiz.map((question) => Number(answers[question.index]));
      const response = await api.post(`/api/pd/enrollments/${course.enrollment.id}/modules/${module.id}/attempt`, { answers: payload });
      setResult(response);
      setAnswers({});
      await load();
      await onChanged();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!course) return <Loading />;
  return (
    <SectionCard title={course.title}>
      <Button variant="outline" onClick={onBack} style={{ marginBottom: 14 }}>← {t("Back to Professional Development")}</Button>
      <ErrorBanner message={error} />
      <div style={{ ...panel, background: T.cream100, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: T.navy900 }}>{course.category} · {course.hours} {t("hours")}</div>
        <div style={{ ...muted, marginTop: 5 }}>{course.description}</div>
        <div style={{ marginTop: 10 }}><Progress value={course.enrollment?.status === "completed" ? 5 : course.modules.filter((item) => item.passed).length} max={5} /></div>
        {course.enrollment?.status === "completed" && course.enrollment.certificate && (
          <Button style={{ marginTop: 12 }} onClick={() => api.downloadPdf(`/api/pd/certificates/${course.enrollment.certificate.id}/pdf`, `${course.enrollment.certificate.certificateNumber}.pdf`)}>{t("Download certificate (PDF)")}</Button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(210px, 280px) minmax(0, 1fr)", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {course.modules.map((item) => (
            <button key={item.id} disabled={item.locked} onClick={() => { setSelected(item); setResult(null); setAnswers({}); }} style={{
              textAlign: "left", border: `1px solid ${selected?.id === item.id ? T.navy900 : T.line}`, borderRadius: 10,
              background: item.passed ? "#EAF7EE" : item.locked ? "#F3F4F6" : "#fff", padding: 12,
              cursor: item.locked ? "not-allowed" : "pointer", color: item.locked ? T.ink600 : T.navy900,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{item.passed ? "✓" : item.locked ? "🔒" : "▶"} {t("Module")} {item.position}</div>
              <div style={{ marginTop: 4, fontWeight: 600 }}>{item.title}</div>
              {item.bestScore !== null && <div style={{ ...muted, marginTop: 4 }}>{t("Best score")}: {item.bestScore}%</div>}
            </button>
          ))}
        </div>

        <div style={panel}>
          <h2 style={{ marginTop: 0, color: T.navy900 }}>{t("Module")} {module.position}: {module.title}</h2>
          <p style={{ ...muted, lineHeight: 1.6 }}>{module.summary}</p>
          {module.locked ? <Empty>{t("Pass the previous module to unlock this content.")}</Empty> : (
            <>
              <div style={{ whiteSpace: "pre-line", lineHeight: 1.7, color: T.ink900 }}>{module.content}</div>
              <div style={{ margin: "16px 0", background: T.cream100, borderLeft: `4px solid ${T.gold500}`, padding: 13 }}>
                <strong>{t("Professional activity")}</strong><div style={{ marginTop: 5 }}>{module.activity}</div>
              </div>
              {module.quiz && (
                <div>
                  <h3 style={{ color: T.navy900 }}>{t("Module assessment")}</h3>
                  <div style={{ ...muted, marginBottom: 12 }}>{t("Pass mark")}: {course.passingScore}% · {module.attemptsRemaining} {t("attempts remaining")}</div>
                  {module.quiz.map((question, qIndex) => (
                    <div key={question.index} style={{ marginBottom: 18 }}>
                      <div style={{ fontWeight: 650, color: T.ink900, marginBottom: 8 }}>{qIndex + 1}. {question.prompt}</div>
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", cursor: "pointer" }}>
                          <input type="radio" name={`${module.id}-${question.index}`} checked={answers[question.index] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.index]: optionIndex }))} />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                  <Button disabled={busy} onClick={submit}>{busy ? t("Marking…") : t("Submit assessment")}</Button>
                </div>
              )}
              {module.passed && <div style={{ color: "#167244", fontWeight: 700, marginTop: 14 }}>✓ {t("Module passed")}{module.bestScore !== null ? ` — ${module.bestScore}%` : ""}</div>}
              {result && <AssessmentResult result={result} />}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function AssessmentResult({ result }) {
  const { t } = useLang();
  return (
    <div style={{ marginTop: 16, borderRadius: 10, padding: 13, background: result.passed ? "#EAF7EE" : "#FFF2E8", color: result.passed ? "#135D38" : "#8A3F1E" }}>
      <strong>{result.passed ? t("Passed") : t("Not passed yet")} — {result.score}%</strong>
      <div style={{ marginTop: 5 }}>{result.completed ? t("Course complete. Your five PD hours and certificate are ready.") : result.passed ? t("The next module is now unlocked.") : `${result.attemptsRemaining} ${t("attempts remaining")}`}</div>
      {result.review?.map((item) => <div key={item.index} style={{ marginTop: 5, fontSize: 13 }}>{item.correct ? "✓" : "•"} {item.explanation}</div>)}
    </div>
  );
}

function Applications({ items, onChanged }) {
  const { t } = useLang();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function act(id, action) {
    setBusy(`${id}-${action}`); setError("");
    try { await api.post(`/api/pd/applications/${id}/${action}`); await onChanged(); }
    catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  return (
    <div>
      <ErrorBanner message={error} />
      {!items.length ? <Empty>{t("No course applications yet.")}</Empty> : items.map((item) => (
        <div key={item.id} style={{ ...panel, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, color: T.navy900 }}>{item.teacher.name} — {item.course.title}</div>
            <div style={{ ...muted, marginTop: 4 }}>{item.teacher.email} · {item.course.hours}h · {t(statusLabel[item.status] || item.status)}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {item.status === "applied" && <><Button disabled={busy} onClick={() => act(item.id, "approve")}>{t("Approve")}</Button><Button disabled={busy} variant="outline" onClick={() => act(item.id, "reject")}>{t("Decline")}</Button></>}
            {item.status === "locked" && <Button disabled={busy} onClick={() => act(item.id, "reopen")}>{t("Grant more attempts")}</Button>}
            {item.certificate && <Button variant="outline" onClick={() => api.downloadPdf(`/api/pd/certificates/${item.certificate.id}/pdf`, `${item.certificate.certificateNumber}.pdf`)}>{t("Certificate")}</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AllRecords({ records }) {
  const { t } = useLang();
  if (!records.length) return <Empty>{t("No PD records yet.")}</Empty>;
  return records.map((record) => (
    <div key={record.id} style={{ ...panel, marginBottom: 10 }}>
      <div style={{ fontWeight: 700, color: T.navy900 }}>{record.teacher?.name || record.teacherId}</div>
      <div style={{ ...muted, marginTop: 4 }}>{record.cpdCompleted || 0}/{record.cpdTarget || 30}h · {record.trainings.length} {t("trainings")} · {record.goals.length} {t("goals")} · {record.meetings.length} {t("meetings")}</div>
    </div>
  ));
}

function MyPD({ record, onChanged }) {
  const { t } = useLang();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [training, setTraining] = useState({ title: "", type: "Workshop", hours: "", date: "" });
  const [goal, setGoal] = useState("");
  const [meeting, setMeeting] = useState({ title: "", notes: "" });
  const setTrainingField = (key) => (value) => setTraining((current) => ({ ...current, [key]: value }));
  const setMeetingField = (key) => (value) => setMeeting((current) => ({ ...current, [key]: value }));

  async function add(path, body, reset) {
    setSaving(true); setError("");
    try { await api.post(path, body); reset(); await onChanged(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function remove(kind, id) {
    if (!window.confirm(t("Delete this item?"))) return;
    try { await api.del(`/api/pd/me/${kind}/${id}`); await onChanged(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div style={{ ...panel, marginBottom: 14 }}>
        <h3 style={{ color: T.navy900, marginTop: 0 }}>{t("Training record")} — {record.cpdCompleted || 0}/{record.cpdTarget || 30}h</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 90px 145px auto", gap: 8, alignItems: "end" }}>
          <div><FieldLabel>{t("Title")}</FieldLabel><Input value={training.title} onChange={setTrainingField("title")} /></div>
          <div><FieldLabel>{t("Type")}</FieldLabel><Input value={training.type} onChange={setTrainingField("type")} /></div>
          <div><FieldLabel>{t("Hours")}</FieldLabel><Input type="number" value={training.hours} onChange={setTrainingField("hours")} /></div>
          <div><FieldLabel>{t("Date")}</FieldLabel><Input type="date" value={training.date} onChange={setTrainingField("date")} /></div>
          <Button disabled={saving} onClick={() => add("/api/pd/me/trainings", { ...training, hours: Number(training.hours), date: training.date || new Date().toISOString().slice(0, 10) }, () => setTraining({ title: "", type: "Workshop", hours: "", date: "" }))}>{t("Add")}</Button>
        </div>
        <List items={record.trainings} empty={t("No trainings yet.")} render={(item) => <RecordRow key={item.id} title={item.title} detail={`${item.type} · ${item.hours}h${item.hasCertificate ? ` · ${t("Certificate earned")}` : ""}`} onDelete={item.courseEnrollmentId ? null : () => remove("trainings", item.id)} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={panel}>
          <h3 style={{ color: T.navy900, marginTop: 0 }}>{t("Professional goals")}</h3>
          <div style={{ display: "flex", gap: 8 }}><Input value={goal} onChange={setGoal} placeholder={t("New professional goal…")} /><Button disabled={saving} onClick={() => add("/api/pd/me/goals", { goal }, () => setGoal(""))}>{t("Add")}</Button></div>
          <List items={record.goals} empty={t("No goals yet.")} render={(item) => <RecordRow key={item.id} title={item.goal} detail={item.status} onDelete={() => remove("goals", item.id)} />} />
        </div>
        <div style={panel}>
          <h3 style={{ color: T.navy900, marginTop: 0 }}>{t("Coaching and meetings")}</h3>
          <FieldLabel>{t("Title")}</FieldLabel><Input value={meeting.title} onChange={setMeetingField("title")} />
          <div style={{ marginTop: 7 }}><FieldLabel>{t("Notes")}</FieldLabel><Input value={meeting.notes} onChange={setMeetingField("notes")} /></div>
          <Button style={{ marginTop: 8 }} disabled={saving} onClick={() => add("/api/pd/me/meetings", meeting, () => setMeeting({ title: "", notes: "" }))}>{t("Add")}</Button>
          <List items={record.meetings} empty={t("No meetings yet.")} render={(item) => <RecordRow key={item.id} title={item.title} detail={item.notes} onDelete={() => remove("meetings", item.id)} />} />
        </div>
      </div>
    </div>
  );
}

function Progress({ value, max }) {
  const percentage = Math.min(100, Math.round((value / max) * 100));
  return <div style={{ height: 8, borderRadius: 999, background: "#E8EBEF", overflow: "hidden" }}><div style={{ height: "100%", width: `${percentage}%`, background: "linear-gradient(90deg, #C6A15B, #A85C32)" }} /></div>;
}

function List({ items = [], empty, render }) {
  return <div style={{ marginTop: 12 }}>{items.length ? items.map(render) : <div style={muted}>{empty}</div>}</div>;
}

function RecordRow({ title, detail, onDelete }) {
  const { t } = useLang();
  return <div style={{ borderTop: `1px solid ${T.line}`, padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontWeight: 600 }}>{title}</div>{detail && <div style={muted}>{detail}</div>}</div>{onDelete && <Button variant="danger" style={{ padding: "5px 9px" }} onClick={onDelete}>{t("Delete")}</Button>}</div>;
}

function Empty({ children }) {
  return <div style={{ ...panel, color: T.ink600, textAlign: "center", padding: 24 }}>{children}</div>;
}
