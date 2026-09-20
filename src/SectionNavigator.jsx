import { useState } from "react";
import { T } from "./ui.jsx";

/**
 * Section Navigator - Drag-and-drop section list with visibility controls
 */
export function SectionNavigator({ sections, onReorder, onToggleVisibility, onEditSection, onDuplicateSection, onDeleteSection, onAddSection }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  function handleDragStart(e, index) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder sections
    const newSections = [...sections];
    const draggedSection = newSections[draggedIndex];
    newSections.splice(draggedIndex, 1);
    newSections.splice(index, 0, draggedSection);

    onReorder(newSections.map((s) => s.id));
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${T.line}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.navy900, margin: "0 0 12px" }}>Plan Sections</h3>
        <button
          onClick={onAddSection}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: `1px dashed ${T.line}`,
            borderRadius: 8,
            background: "#fff",
            fontSize: 13,
            color: T.navy900,
            cursor: "pointer",
          }}
        >
          + Add Section
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {sections.map((section, index) => (
          <div
            key={section.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            style={{
              padding: "12px 16px",
              margin: "0 8px 8px",
              background: draggedIndex === index ? "#f0f4ff" : "#fff",
              border: `1px solid ${section.isVisible ? T.line : T.ink300}`,
              borderRadius: 8,
              cursor: "move",
              opacity: section.isVisible ? 1 : 0.5,
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 18, color: T.ink400, cursor: "grab" }}>⋮⋮</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.navy900, marginBottom: 2 }}>
                  {section.customTitle || section.defaultTitleKey}
                </div>
                <div style={{ fontSize: 11, color: T.ink600 }}>
                  {section.durationMinutes} minutes {section.durationLocked && "🔒"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => onToggleVisibility(section.id)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: `1px solid ${T.line}`,
                  borderRadius: 4,
                  background: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
                title={section.isVisible ? "Hide" : "Show"}
              >
                {section.isVisible ? "👁" : "👁‍🗨"}
              </button>
              <button
                onClick={() => onEditSection(section.id)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: `1px solid ${T.line}`,
                  borderRadius: 4,
                  background: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
              <button
                onClick={() => onDuplicateSection(section.id)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  border: `1px solid ${T.line}`,
                  borderRadius: 4,
                  background: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
              <button
                onClick={() => onDeleteSection(section.id)}
                style={{
                  padding: "4px 8px",
                  border: `1px solid ${T.line}`,
                  borderRadius: 4,
                  background: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  color: "#991b1b",
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
