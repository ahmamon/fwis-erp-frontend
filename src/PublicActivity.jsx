import { useEffect, useState } from "react";
import { api } from "./api.js";
import { T, Button, ErrorBanner, Loading, Input } from "./ui.jsx";

const PURPOSES = {
  worksheet: "Worksheet",
  exit_ticket: "Exit Ticket",
  homework: "Homework Practice",
  class_practice: "In-Class Practice",
};

export default function PublicActivity({ token }) {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("");
  const [classSection, setClassSection] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/api/activities/public/${encodeURIComponent(token)}`).then(setActivity).catch((e) => setError(e.message));
  }, [token]);

  function setAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function submit() {
    if (!studentName.trim()) { setError("Please enter your name."); return; }
    setSubmitting(true);
    setError("");
    try {
      setResult(await api.post(`/api/activities/public/${encodeURIComponent(token)}/submit`, { studentName, classSection, answers }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !activity) return <PublicShell><ErrorBanner message={error} /></PublicShell>;
  if (!activity) return <PublicShell><Loading label="Loading activity..." /></PublicShell>;

  return (
    <PublicShell>
      <div style={{ color: T.gold600, textTransform: "uppercase", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{PURPOSES[activity.purpose] || activity.purpose}</div>
      <h1 style={{ margin: "6px 0 4px", color: T.navy900, fontSize: 28 }}>{activity.title}</h1>
      <div style={{ color: T.ink600, fontSize: 13.5 }}>{[activity.subject, activity.grade, activity.createdBy?.name].filter(Boolean).join(" · ")}</div>
      {activity.instructions && <div style={{ background: T.cream100, borderLeft: `4px solid ${T.gold500}`, padding: 14, borderRadius: 8, marginTop: 18, whiteSpace: "pre-wrap" }}>{activity.instructions}</div>}
      <ErrorBanner message={error} />
      {result ? (
        <div style={{ marginTop: 24 }}>
          <div style={{ background: "#E9F7EF", border: "1px solid #82C89B", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#176B3A" }}>Submitted successfully</div>
            <div style={{ marginTop: 6, color: T.ink900 }}>{result.results ? `Score: ${result.score} / ${result.maxScore}` : "Your teacher has received your answers."}</div>
          </div>
          {result.results && result.results.map((row, index) => (
            <div key={row.itemId} style={{ marginTop: 10, padding: 12, borderRadius: 8, border: `1px solid ${row.correct ? "#82C89B" : "#E0A0A0"}` }}>
              <strong>{index + 1}. {row.correct ? "Correct" : "Review"}</strong>
              {!row.correct && <div style={{ marginTop: 4 }}>Correct answer: {row.answer}</div>}
              {row.explanation && <div style={{ color: T.ink600, marginTop: 4 }}>{row.explanation}</div>}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
            <Input value={studentName} onChange={setStudentName} placeholder="Student name" />
            <Input value={classSection} onChange={setClassSection} placeholder="Class / section" />
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {activity.items.map((item, index) => (
              <Question key={item.id} item={item} index={index} value={answers[item.id] || ""} onChange={(value) => setAnswer(item.id, value)} />
            ))}
          </div>
          <Button onClick={submit} disabled={submitting} style={{ marginTop: 22, minWidth: 160 }}>{submitting ? "Submitting..." : "Submit answers"}</Button>
        </>
      )}
    </PublicShell>
  );
}

function Question({ item, index, value, onChange }) {
  const options = item.kind === "true_false" ? ["True", "False"] : item.options || [];
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ fontWeight: 650, color: T.navy900, lineHeight: 1.5 }}>{index + 1}. {item.text}</div>
      {options.length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {options.map((option) => (
            <label key={option} style={{ display: "flex", gap: 9, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: T.cream50, cursor: "pointer" }}>
              <input type="radio" name={item.id} value={option} checked={value === option} onChange={(e) => onChange(e.target.value)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={item.kind === "short_answer" ? 3 : 2} style={{ width: "100%", boxSizing: "border-box", marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, font: "inherit" }} />
      )}
    </div>
  );
}

function PublicShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: T.cream50, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "30px 16px 60px" }}>
      <main style={{ maxWidth: 820, margin: "0 auto", background: "#fff", borderRadius: 16, boxShadow: "0 10px 36px rgba(11,31,58,.10)", padding: "28px clamp(18px, 5vw, 42px)" }}>
        <div style={{ color: T.navy900, fontWeight: 800, fontSize: 13, marginBottom: 18 }}>FUTURE WINDOW INTERNATIONAL SCHOOL</div>
        {children}
      </main>
    </div>
  );
}
