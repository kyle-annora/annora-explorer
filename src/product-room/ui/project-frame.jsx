import React from "react";
import { Glyph } from "./components.jsx";
import "./project-frame.css";

/** Display only. The caller supplies the context pinned to the visible record. */
export function ProjectContextBar({
  project,
  context = project?.context,
  role,
  recordLabel,
  back,
  actions,
  children,
}) {
  const product = context?.productTitle || "Product project";
  const part = context?.part?.title;
  const drawing = context?.drawing;
  return (
    <section className="ar-project-context" aria-label="Current project"
      data-project-id={project?.id} data-record-label={recordLabel} data-role={role}>
      <div className="ar-project-context-main">
        {back && <div className="ar-project-back">{back}</div>}
        <div className="ar-project-identity">
          <div className="ar-project-product"><strong>{product}</strong>
            {part && part !== product && <span>{part}</span>}
          </div>
          <div className="ar-project-record">
            {project?.id && <span>{project.id}</span>}
            {recordLabel && <strong>{recordLabel}</strong>}
            {drawing && <span>{drawing.title}{drawing.revisionLabel || drawing.revision
              ? ` · ${drawing.revisionLabel || drawing.revision}` : ""}</span>}
            {role && <span className="ar-project-role">{role === "seller" ? "Seller view" : "Buyer view"}</span>}
          </div>
        </div>
        {actions && <div className="ar-project-context-actions">{actions}</div>}
      </div>
      {children && <div className="ar-project-context-extra">{children}</div>}
    </section>
  );
}

export function ProjectTaskHeader({ title, description, status, actions, children, headingRef }) {
  return (
    <header className="ar-project-task">
      <div className="ar-project-task-copy">
        <div className="ar-project-task-title"><h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>{status}</div>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="ar-project-task-actions">{actions}</div>}
    </header>
  );
}

/** Secondary information stays accessible without competing with the task. */
export function ProjectDetails({ title, meta, children, open, className = "" }) {
  return (
    <details className={`ar-project-details ${className}`} open={open}>
      <summary><span>{title}</span>{meta && <small>{meta}</small>}<Glyph name="arrow" /></summary>
      <div className="ar-project-details-body">{children}</div>
    </details>
  );
}

/** The host still owns the action and review guard; the guide only presents it. */
export function ProjectActionBar({ children, primary, note, className = "" }) {
  return (
    <div className={`ar-project-actions ${className}`}>
      <div className="ar-project-action-controls">
        {children && <div className="ar-project-secondary">{children}</div>}
        {primary && <div className="ar-project-primary">{primary}</div>}
      </div>
      {note && <p className="ar-project-action-note">{note}</p>}
    </div>
  );
}
