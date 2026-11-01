import React, { useEffect, useRef } from "react";
import { ActionGroup, Button, Glyph } from "../product-room/ui/components.jsx";
import { sections } from "./navigation.js";

export function LinkButton({
  children,
  href,
  variant = "secondary",
  icon = "external",
  ...props
}) {
  return (
    <a
      className="ar-button studio-link-button"
      data-variant={variant}
      href={href}
      {...props}
    >
      <span>{children}</span>
      {icon && <Glyph name={icon} />}
    </a>
  );
}
export function Check({ checked, onChange, children, disabled, ...props }) {
  return (
    <label className="studio-check">
      <input
        {...props}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
function issueTitle(issue, draft) {
  const path = issue.path || "";
  const simple = {
    "content.title": "Product name",
    "content.shortTitle": "Short name",
    "content.tagline": "Opening headline",
    "content.description": "Product introduction",
    "content.summary": "Explanation section heading",
    "presentation.defaultRenderStyle": "Default rendering",
    modelRevision: "Prepared model revision",
  };
  if (simple[path]) return simple[path];
  const doc = path.match(/^content\.documents\.(\d+)\.(.+)/);
  if (doc)
    return `${draft?.content.documents[+doc[1]]?.title || "Document"} · ${doc[2].replace(/([A-Z])/g, " $1").toLowerCase()}`;
  const fact = path.match(/^content\.specGroups\.(\d+)\.facts\.(\d+)/);
  if (fact)
    return (
      draft?.content.specGroups[+fact[1]]?.facts[+fact[2]]?.label ||
      "Technical fact"
    );
  const part = path.match(/^content\.partContent\.(\d+)/);
  if (part)
    return draft?.content.partContent[+part[1]]?.title || "Part information";
  return (
    sections.find((section) => section.id === issue.section)?.title ||
    "Release details"
  );
}
export function IssueList({ issues, onEdit, draft }) {
  if (!issues.length) return null;
  return (
    <ul className="studio-issues">
      {issues.map((issue, i) => (
        <li key={`${issue.path}-${i}`}>
          <span className="studio-issue-kind">
            {issue.severity === "error" ? "Fix" : "Review"}
          </span>
          <span>
            <strong>{issueTitle(issue, draft)}</strong>
            {issue.message}
          </span>
          <Button
            variant="quiet"
            onClick={() => onEdit(issue.section)}
            icon="arrow"
          >
            Open
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function UnsavedDialog({ open, pending, onKeep, onDiscard, onSave }) {
  const ref = useRef(null);
  useEffect(() => {
    if (open && !ref.current.open) ref.current.showModal();
    else if (!open && ref.current.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="studio-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onKeep();
      }}
      aria-labelledby="studio-unsaved-title"
    >
      <p className="ar-eyebrow">UNSAVED CHANGES</p>
      <h2 id="studio-unsaved-title">Keep your product edits?</h2>
      <p>
        Save this draft before leaving, or discard the edits from this session.
        The current Product Room will stay unchanged.
      </p>
      <ActionGroup>
        <Button variant="quiet" onClick={onKeep} disabled={pending}>
          Keep editing
        </Button>
        <Button variant="secondary" onClick={onDiscard} disabled={pending}>
          Discard edits
        </Button>
        <Button onClick={onSave} pending={pending}>
          Save & continue
        </Button>
      </ActionGroup>
    </dialog>
  );
}
