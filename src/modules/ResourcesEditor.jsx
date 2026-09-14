import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { T, FieldLabel, TextField, Button, ErrorBanner, Loading, SectionCard, Input, Select, hasRole } from "../ui";

const canManage = (user) => user && (hasRole(user, "admin") || hasRole(user, "supervisor"));

// Server enforces the same cap (multer limit); this just avoids uploading a
// file that would be rejected.
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const KIND_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
];

export default function ResourcesEditor({ currentUser }) {
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
        title="Learning Resources"
        right={<Button onClick={() => setShowNew((s) => !s)}>{showNew ? "Cancel" : "Add resource"}</Button>}
      >
        <ErrorBanner message={error} />
        <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 14 }}>
          Files are stored securely in the school's database (max 8 MB each) and streamed back when opened.
        </div>
        {showNew && <ResourceForm onDone={async () => { setShowNew(false); await load(); }} onCancel={() => setShowNew(false)} />}
        {items.length === 0 ? (
          <div style={{ color: T.ink600, fontSize: 13.5, padding: 8 }}>No resources yet.</div>
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
  const [form, setForm] = useState(initial || { kind: "link", name: "", category: "", subject: "", grade: "", description: "", externalUrl: "" });
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
    return body;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (form.kind === "link") {
        if (!form.externalUrl.trim()) {
          setError("A link resource needs a URL.");
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
          setError("Choose a file to upload.");
          return;
        }
        if (file && file.size > MAX_FILE_BYTES) {
          setError("File exceeds the 8 MB limit. Choose a smaller file.");
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
          <FieldLabel>Kind</FieldLabel>
          <Select value={form.kind} onChange={set("kind")} options={KIND_OPTIONS} />
        </div>
        <div>
          <FieldLabel required>Name</FieldLabel>
          <Input value={form.name} onChange={set("name")} />
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <Input value={form.category} onChange={set("category")} />
        </div>
        <div>
          <FieldLabel>Subject</FieldLabel>
          <Input value={form.subject} onChange={set("subject")} />
        </div>
        <div>
          <FieldLabel>Grade</FieldLabel>
          <Input value={form.grade} onChange={set("grade")} />
        </div>
        {form.kind === "link" ? (
          <div>
            <FieldLabel>URL</FieldLabel>
            <Input value={form.externalUrl} onChange={set("externalUrl")} placeholder="https://..." />
          </div>
        ) : (
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel>{initial ? "Replace file (optional)" : "File"}</FieldLabel>
            <input type="file" ref={fileRef} style={{ fontSize: 13.5, color: T.ink600 }} />
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Description</FieldLabel>
          <TextField value={form.description} onChange={set("description")} rows={2} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : (initial ? "Save changes" : "Add resource")}</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
}

function ResourceRow({ resource, canManage, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`Delete "${resource.name}"?`)) return;
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
      setError("Choose a file first.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File exceeds the 8 MB limit. Choose a smaller file.");
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
              <a href={resource.externalUrl} target="_blank" rel="noreferrer" style={{ color: T.gold600, marginLeft: 8, fontSize: 13, fontWeight: 600 }}>Open ↗</a>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.ink600, marginTop: 2 }}>
            {resource.kind} · {resource.category || "uncategorized"}{resource.subject ? ` · ${resource.subject}` : ""}{resource.grade ? ` · ${resource.grade}` : ""}
          </div>
          {resource.description && (
            <div style={{ fontSize: 13.5, color: T.ink900, marginTop: 8, whiteSpace: "pre-wrap" }}>{resource.description}</div>
          )}
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Button onClick={() => setEditing(true)} variant="outline" style={{ padding: "6px 12px" }}>Edit</Button>
            <Button onClick={remove} variant="danger" disabled={deleting} style={{ padding: "6px 12px" }}>{deleting ? "..." : "Delete"}</Button>
          </div>
        )}
      </div>
      {resource.versions && resource.versions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: T.ink600, marginBottom: 6 }}>
            {resource.versions.length} version{resource.versions.length > 1 ? "s" : ""} uploaded
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {resource.versions.filter((v) => v.fileName).map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: T.ink900 }}>
                <span style={{ fontWeight: 600, color: T.ink500, width: 26, flexShrink: 0 }}>v{v.version}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.fileName}</span>
                {v.fileSize && <span style={{ color: T.ink600, flexShrink: 0 }}>{v.fileSize}</span>}
                <Button onClick={() => openVersion(v)} variant="outline" style={{ padding: "3px 10px", fontSize: 12, marginLeft: "auto", flexShrink: 0 }}>Open</Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && (
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <input type="file" ref={fileRef} style={{ fontSize: 12.5, color: T.ink600 }} />
          <Button onClick={uploadVersion} variant="outline" disabled={uploading} style={{ padding: "6px 12px" }}>{uploading ? "Uploading..." : "Add version"}</Button>
        </div>
      )}
    </div>
  );
}