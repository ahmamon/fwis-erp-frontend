import { useState, useEffect } from "react";
import { api } from "../api";
import { T, ROLE_LABELS, FieldLabel, Input, Select, TextField, Button, ErrorBanner, Loading, SectionCard } from "../ui";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

// An empty role select by definition belongs to the roster, so add/staff form
// never lets a user have no role.
function RoleSelect({ value, onChange, disabled }) {
  return <Select value={value} onChange={onChange} options={ROLE_OPTIONS} disabled={disabled} />;
}

function ChipSelector({ label, options, value = [], onChange, disabled }) {
  const isOn = (id) => value.includes(id);
  const toggle = (id) => onChange(isOn(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {options.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.ink600 }}>No options yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.id)}
              style={{
                border: isOn(opt.id) ? `1px solid ${T.gold600}` : `1px solid ${T.line}`,
                background: isOn(opt.id) ? "rgba(198,161,91,0.18)" : "#fff",
                color: T.ink900, borderRadius: 999, padding: "5px 12px", fontSize: 12.5,
                fontWeight: 600, cursor: disabled ? "default" : "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ActiveBadge = ({ active }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
    borderRadius: 999, padding: "3px 9px",
    background: active ? "#E4EFE2" : "#EFEDE7", color: active ? "#33622D" : null,
    ...(!active && { border: "1px solid #E4DFD1", color: "#5B5A52" }),
  }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#33622D" : "#5B5A52" }} />
    {active ? "Active" : "Deactivated"}
  </span>
);

export default function UsersEditor({ currentUser }) {
  const [users, setUsers] = useState(null);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [addForm, setAddForm] = useState({ name: "", email: "", role: "teacher", department: "", branchId: "" });
  const setAdd = (k) => (v) => setAddForm((f) => ({ ...f, [k]: v }));

  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const setEdit = (k) => (v) => setEditDraft((f) => ({ ...f, [k]: v }));

  async function load() {
    try {
      const [u, b, s, g] = await Promise.all([
        api.get("/api/users"),
        api.get("/api/settings/branches"),
        api.get("/api/settings/subjects"),
        api.get("/api/settings/grade-bands"),
      ]);
      setUsers(u);
      setBranches(b);
      setSubjects(s);
      setGrades(g);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const addUser = () => run(async () => {
    await api.post("/api/users", addForm);
    setAddForm({ name: "", email: "", role: "teacher", department: "", branchId: "" });
    await load();
  });

  const changeRole = (u) => (role) => run(async () => {
    await api.patch(`/api/users/${u.id}/role`, { role });
    await load();
  });

  const toggleActive = (u) => run(async () => {
    await api.patch(`/api/users/${u.id}`, { active: !u.active });
    await load();
  });

  const removeUser = (u) => run(async () => {
    if (!window.confirm(`Permanently delete ${u.name}? This only works if they have no plans, lessons, evaluations, or other records — otherwise, deactivate them instead.`)) return;
    await api.del(`/api/users/${u.id}`);
    await load();
  });

  const startEdit = (u) => {
    setEditDraft({
      name: u.name, department: u.department || "", branchId: u.branchId || "",
      phone: u.phone || "", bio: u.bio || "",
      assignedGrades: [...(u.assignedGrades || [])], assignedSubjects: [...(u.assignedSubjects || [])],
    });
    setEditId(u.id);
  };

  const saveEdit = (u) => run(async () => {
    await api.patch(`/api/users/${u.id}`, editDraft);
    setEditId(null);
    await load();
  });

  if (!users) return <Loading />;

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }));
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const gradeOptions = grades.map((g) => ({ value: g.id, label: g.label }));

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: T.navy900, margin: "0 0 18px" }}>Staff & Roles</h1>
      <ErrorBanner message={error} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard title="Add staff member">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "2 1 200px" }}>
              <FieldLabel required>Full name</FieldLabel>
              <Input value={addForm.name} onChange={setAdd("name")} />
            </div>
            <div style={{ flex: "2 1 220px" }}>
              <FieldLabel required>Email</FieldLabel>
              <Input value={addForm.email} onChange={setAdd("email")} />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <FieldLabel>Role</FieldLabel>
              <RoleSelect value={addForm.role} onChange={setAdd("role")} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <FieldLabel>Department</FieldLabel>
              <Input value={addForm.department} onChange={setAdd("department")} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <FieldLabel>Branch</FieldLabel>
              <Select value={addForm.branchId} onChange={setAdd("branchId")} options={branchOptions} placeholder="—" />
            </div>
            <Button onClick={addUser} disabled={busy || !addForm.name.trim() || !addForm.email.trim()}>Add</Button>
          </div>
          <div style={{ fontSize: 12, color: T.ink600, marginTop: 10 }}>
            New accounts start active, so their first sign-in is accepted; pick grades/subjects when editing them.
          </div>
        </SectionCard>

        <SectionCard title={`Staff (${users.length})`} right={busy ? <span style={{ fontSize: 12.5, color: T.ink600 }}>Saving…</span> : null}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.length === 0 && <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>No staff yet.</div>}
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;
              return (
                <div key={u.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
                  {editId === u.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "2 1 200px" }}>
                          <FieldLabel>Full name</FieldLabel>
                          <Input value={editDraft.name} onChange={setEdit("name")} />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                          <FieldLabel>Department</FieldLabel>
                          <Input value={editDraft.department} onChange={setEdit("department")} />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                          <FieldLabel>Branch</FieldLabel>
                          <Select value={editDraft.branchId} onChange={setEdit("branchId")} options={branchOptions} placeholder="—" />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                          <FieldLabel>Phone</FieldLabel>
                          <Input value={editDraft.phone} onChange={setEdit("phone")} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 300px" }}>
                          <ChipSelector label="Assigned grades" options={gradeOptions} value={editDraft.assignedGrades} onChange={setEdit("assignedGrades")} />
                        </div>
                        <div style={{ flex: "1 1 300px" }}>
                          <ChipSelector label="Assigned subjects" options={subjectOptions} value={editDraft.assignedSubjects} onChange={setEdit("assignedSubjects")} />
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Bio</FieldLabel>
                        <TextField value={editDraft.bio} onChange={setEdit("bio")} rows={2} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button onClick={() => saveEdit(u)} disabled={busy}>Save changes</Button>
                        <Button onClick={() => setEditId(null)} variant="outline">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: T.navy900 }}>
                          {u.name}
                          {isSelf && <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: T.gold600 }}>YOU</span>}
                          <span style={{ marginLeft: 8 }}><ActiveBadge active={u.active} /></span>
                        </div>
                        <div style={{ fontSize: 12.5, color: T.ink600 }}>{u.email}</div>
                        <div style={{ fontSize: 12, color: T.ink600 }}>
                          {ROLE_LABELS[u.role] || u.role}
                          {u.department ? ` · ${u.department}` : ""}
                          {u.branch?.name ? ` · ${u.branch.name}` : ""}
                          {(u.assignedGrades?.length ? ` · grades: ${u.assignedGrades.join(", ")}` : "")}
                          {(u.assignedSubjects?.length ? ` · subjects: ${u.assignedSubjects.join(", ")}` : "")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <div style={{ width: 160 }}>
                          <RoleSelect value={u.role} onChange={changeRole(u)} />
                        </div>
                        {!isSelf && (
                          <Button onClick={() => toggleActive(u)} variant="outline" style={{ padding: "6px 12px", whiteSpace: "nowrap" }} disabled={busy}>
                            {u.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                        <Button onClick={() => startEdit(u)} variant="outline" style={{ padding: "6px 12px" }}>Edit</Button>
                        {!isSelf && (
                          <Button onClick={() => removeUser(u)} variant="danger" style={{ padding: "6px 12px" }} disabled={busy}>Delete</Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}