import { useState, useEffect } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, Select } from "../ui";

const UNIT_FIELDS = [
  ["branchId", "Branch", "branch-select"],
  ["department", "Department", "input"],
  ["subject", "Subject", "input"],
  ["grade", "Grade", "input"],
  ["term", "Term", "input"],
  ["weekRange", "Week range", "input"],
  ["unit", "Unit", "input"],
  ["topic", "Topic", "input"],
  ["objectives", "Objectives", "textarea"],
  ["standards", "Standards", "textarea"],
  ["assessment", "Assessment", "textarea"],
  ["resources", "Resources", "textarea"],
  ["plannedPct", "Planned %", "input"],
];

const REMEDIAL_FIELDS = [
  ["missingTopics", "Missing topics", "textarea"],
  ["reason", "Reason", "textarea"],
  ["lessonsRequired", "Lessons required", "input"],
  ["revisedDates", "Revised dates", "input"],
  ["responsibleTeacherId", "Responsible teacher", "teacher-select"],
  ["requiredResources", "Required resources", "textarea"],
  ["newTargetDate", "New target date", "input"],
];

const canManage = (user) => user && (user.role === "hod" || user.role === "supervisor");

export default function CurriculumEditor({ currentUser }) {
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api.get("/api/curriculum"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (!items) return <Loading />;
  if (openId) return <UnitDetail id={openId} onBack={() => setOpenId(null)} onChanged={load} currentUser={currentUser} />;

  return (
    <div>
      <SectionCard
        title="Curriculum Mapping"
        right={canManage(currentUser) && (
          <Button onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancel" : "New unit"}</Button>
        )}
      >
        <ErrorBanner message={error} />
        {showNew && <UnitForm onDone={async () => { setShowNew(false); await load(); }} onCancel={() => setShowNew(false)} />}
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>No curriculum units yet.</div>
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
                  <div style={{ fontWeight: 600, color: T.navy900 }}>{item.subject || "Unit"} — {item.unit}</div>
                  <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 3 }}>
                    {item.grade || ""} · {item.term || ""} · {item.topic || ""}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.navy700 }}>
                  {item.plannedPct ?? 0}% planned / {item.achievedPct ?? 0}% achieved
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function UnitForm({ initial, onDone, onCancel }) {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(initial ? buildFromInitial(initial) : buildEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/settings/branches").then((b) => {
      setBranches(b || []);
      setForm((f) => (f.branchId ? f : { ...f, branchId: b?.[0]?.id || "" }));
    }).catch(() => {});
  }, []);

  function buildEmpty() {
    const f = {};
    for (const [key] of UNIT_FIELDS) if (key === "plannedPct") f[key] = "100"; else f[key] = "";
    return f;
  }
  function buildFromInitial(u) {
    const f = {};
    for (const [key] of UNIT_FIELDS) f[key] = u[key] ?? "";
    return f;
  }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (initial) {
        await api.patch(`/api/curriculum/${initial.id}`, form);
      } else {
        await api.post("/api/curriculum", form);
      }
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream50, marginBottom: 14 }}>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {UNIT_FIELDS.map(([key, label, kind]) => (
          <div key={key} style={kind === "textarea" ? { gridColumn: "1 / -1" } : {}}>
            <FieldLabel>{label}</FieldLabel>
            {kind === "textarea"
              ? <TextField value={form[key]} onChange={set(key)} rows={3} />
              : kind === "branch-select"
                ? (
                  <select
                    value={form.branchId || ""}
                    onChange={(e) => set("branchId")(e.target.value)}
                    style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, color: T.ink900, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="">Select a branch...</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}
                  </select>
                )
                : <Input value={form[key]} onChange={set(key)} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : (initial ? "Save changes" : "Create unit")}</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
}

function UnitDetail({ id, onBack, onChanged, currentUser }) {
  const [unit, setUnit] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showRemedial, setShowRemedial] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadUnit() {
    try {
      setUnit(await api.get(`/api/curriculum/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { loadUnit(); }, [id]);

  if (!unit) return <Loading />;

  async function remove() {
    if (!window.confirm("Delete this curriculum unit?")) return;
    setDeleting(true);
    setError("");
    try {
      await api.del(`/api/curriculum/${id}`);
      onChanged();
      onBack();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  const fieldRow = (label, value) => (
    value ? (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <div style={{ fontSize: 14, color: T.ink900, whiteSpace: "pre-wrap", background: T.cream50, borderRadius: 8, padding: "8px 10px" }}>{value}</div>
      </div>
    ) : null
  );

  return (
    <SectionCard title={`${unit.subject || "Unit"} — ${unit.unit}`} right={<Button onClick={onBack} variant="outline">Back to list</Button>}>
      <ErrorBanner message={error} />
      {editing ? (
        <UnitForm initial={unit} onDone={async () => { setEditing(false); await loadUnit(); onChanged(); }} onCancel={() => setEditing(false)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fieldRow("Department", unit.department)}
          {fieldRow("Grade", unit.grade)}
          {fieldRow("Term", unit.term)}
          {fieldRow("Week range", unit.weekRange)}
          {fieldRow("Topic", unit.topic)}
          {fieldRow("Objectives", unit.objectives)}
          {fieldRow("Standards", unit.standards)}
          {fieldRow("Assessment", unit.assessment)}
          {fieldRow("Resources", unit.resources)}
          <div style={{ display: "flex", gap: 14, fontSize: 13.5 }}>
            <span><strong style={{ color: T.navy900 }}>{unit.plannedPct ?? 0}%</strong> planned</span>
            <span><strong style={{ color: T.navy900 }}>{unit.achievedPct ?? 0}%</strong> achieved</span>
          </div>
        </div>
      )}

      {canManage(currentUser) && !editing && (
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button onClick={() => setEditing(true)}>Edit unit</Button>
          <Button onClick={remove} variant="danger" disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
        </div>
      )}

      <div style={{ marginTop: 22, borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.navy900 }}>Remedial plans</div>
          {canManage(currentUser) && <Button onClick={() => setShowRemedial((s) => !s)} variant="outline">{showRemedial ? "Cancel" : "Add remedial"}</Button>}
        </div>
        {showRemedial && <RemedialForm unitId={id} onDone={async () => { setShowRemedial(false); await loadUnit(); }} onCancel={() => setShowRemedial(false)} />}
        {unit.remedialPlan && unit.remedialPlan.length === 0 && (
          <div style={{ color: T.ink600, fontSize: 13 }}>No remedial plans.</div>
        )}
        {unit.remedialPlan && unit.remedialPlan.map((r) => (
          <RemedialRow key={r.id} remedial={r} unitId={id} onChanged={loadUnit} currentUser={currentUser} />
        ))}
      </div>
    </SectionCard>
  );
}

function RemedialForm({ unitId, onDone, onCancel }) {
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(buildEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/users").then((users) => {
      setTeachers((users || []).filter((u) => u.role === "teacher"));
    }).catch(() => {});
  }, []);

  function buildEmpty() {
    const f = {};
    for (const [key] of REMEDIAL_FIELDS) f[key] = "";
    return f;
  }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = { ...form, lessonsRequired: Number(form.lessonsRequired) || 1 };
      await api.post(`/api/curriculum/${unitId}/remedial`, body);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.cream50, marginBottom: 12 }}>
      <ErrorBanner message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {REMEDIAL_FIELDS.map(([key, label, kind]) => (
          <div key={key} style={kind === "textarea" ? { gridColumn: "1 / -1" } : {}}>
            <FieldLabel>{label}</FieldLabel>
            {kind === "textarea"
              ? <TextField value={form[key]} onChange={set(key)} rows={3} />
              : kind === "teacher-select"
                ? (
                  <select
                    value={form.responsibleTeacherId || ""}
                    onChange={(e) => set("responsibleTeacherId")(e.target.value)}
                    style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, color: T.ink900, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }}
                  >
                    <option value="">Select a teacher...</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )
                : <Input value={form[key]} onChange={set(key)} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Create remedial"}</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
}

function RemedialRow({ remedial, unitId, onChanged, currentUser }) {
  const [status, setStatus] = useState(remedial.status || "open");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function changeStatus() {
    setWorking(true);
    setError("");
    try {
      await api.patch(`/api/curriculum/remedial/${remedial.id}`, { status });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function resolve() {
    if (!window.confirm("Mark this remedial plan as resolved? The unit's achieved % will be set to its planned %.")) return;
    setWorking(true);
    setError("");
    try {
      await api.post(`/api/curriculum/remedial/${remedial.id}/resolve`, {});
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, background: "#fff" }}>
      <ErrorBanner message={error} />
      <div style={{ fontSize: 13, color: T.ink600, whiteSpace: "pre-wrap" }}>{remedial.missingTopics || "Remedial plan"}</div>
      <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 4 }}>Status: {remedial.status}</div>
      {canManage(currentUser) && (
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Select value={status} onChange={setStatus} options={[
            { value: "open", label: "Open" },
            { value: "scheduled", label: "Scheduled" },
            { value: "in_progress", label: "In progress" },
            { value: "resolved", label: "Resolved" },
          ]} />
          <Button onClick={changeStatus} variant="outline" disabled={working}>{working ? "..." : "Update status"}</Button>
          <Button onClick={resolve} variant="success" disabled={working || remedial.status === "resolved"}>Resolve</Button>
        </div>
      )}
    </div>
  );
}