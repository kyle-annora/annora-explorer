import React from 'react';
import { Button } from './ui/components.jsx';
import './inspection-reference.css';

/** A bounded still image identifies the saved view; reopening uses the host. */
export function InspectionReference({ context, onOpen, href, disabled = false }) {
  const inspection = context?.inspection;
  const external = context?.viewerReference;
  if (!inspection && !external) return null;
  const preview = inspection?.preview;
  const title = context.part?.title || context.productTitle;
  return <div className={`ar-inspection-reference${external ? ' ar-inspection-external' : ''}`}>
    {preview ? <img src={preview.dataUrl} width={preview.width} height={preview.height}
      alt={`Saved 3D view of ${title}`} /> : !external ? <span className="ar-inspection-no-preview">Preview unavailable</span> : null}
    <div className="ar-inspection-copy">
      <span className="ar-inspection-status">{external ? 'Saved viewer reference' : '3D view attached'}</span>
      <strong>{title}</strong>
      <small>{external ? 'Reopens the original viewer with the saved camera and component. Quote scope is set separately.' : 'Viewing reference only. Quote scope is set separately.'}</small>
      {onOpen ? <Button variant="quiet" disabled={disabled} onClick={() => onOpen(context)}>Reopen saved view <span aria-hidden="true">↗</span></Button>
        : href ? <a href={href}>Reopen saved view <span aria-hidden="true">↗</span></a> : null}
    </div>
  </div>;
}
