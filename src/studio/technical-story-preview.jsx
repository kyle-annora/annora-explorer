import React, { useEffect, useRef } from 'react';
import { DrawingPreview } from '../drawings/DrawingPreview.jsx';

/** Reuses the same exact-version reader as buyer records; no second 3D viewer. */
export function TechnicalStoryPreview({ resolved }) {
  const reader = useRef(null);
  const reference = resolved.reference, drawing = reference.context.drawing;
  useEffect(() => { reader.current?.setPresentation(reference.viewId || 'source'); }, [reference]);
  return <div className="studio-story-technical-preview" aria-label="Technical step preview">
    <DrawingPreview ref={reader} pkg={resolved.package} sheetId={drawing.sheetId} regionId={drawing.regionId}
      presentationSnapshot={resolved.presentationSnapshot} assetsResolved
      caption={`${drawing.regionLabel} · ${drawing.revisionLabel || drawing.revision}. This reference remains attached to the story step.`}/>
  </div>;
}
