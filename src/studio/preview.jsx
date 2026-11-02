import React, { useState } from "react";
import {
  ActionGroup,
  Button,
  Evidence,
  Field,
  Glyph,
} from "../product-room/ui/components.jsx";
import { roomURL } from "./navigation.js";

export function Preview({ preview, onReview, onEdit, busy }) {
  const [size, setSize] = useState("desktop"),
    [page, setPage] = useState("overview");
  const src = roomURL({ preview: preview.id, page });
  return (
    <div className="studio-preview-page">
      <div className="studio-preview-intro">
        <div>
          <h1>See it as your customer will.</h1>
          <p>
            Draft {preview.draftRevision} · Explore the product, follow a part link, and try the inquiry review.
          </p>
        </div>
        <ActionGroup>
          <Button variant="secondary" onClick={onEdit} icon="back">
            Back to editor
          </Button>
          <Button
            onClick={onReview}
            pending={busy}
            pendingLabel="Checking…"
            icon="arrow"
          >
            Review release
          </Button>
        </ActionGroup>
      </div>
      <div className="studio-preview-toolbar">
        <details className="studio-preview-options">
          <summary>Preview options <span>{size === 'mobile' ? 'Phone · 390px' : 'Desktop'}</span></summary>
          <div className="studio-preview-option-fields">
            <Field label="Screen size" value={size} options={[["desktop", "Desktop"], ["mobile", "Phone · 390px"]]} onChange={event => setSize(event.target.value)} />
        <Field
          label="Start at"
          value={page}
          options={[
            ["overview", "Product overview"],
            ["explore", "3D Explorer"],
            ["specs", "Specs & documents"],
            ["inquiry", "Inquiry"],
          ]}
          onChange={(e) => setPage(e.target.value)}
        />
          </div>
        </details>
        <a
          className="studio-text-link"
          href={src}
          target="_blank"
          rel="noopener"
        >
          Open preview <Glyph name="external" />
        </a>
      </div>
      <div className="studio-preview-stage" data-size={size}>
        <iframe
          key={src}
          title="Buyer preview of the product draft"
          src={src}
          className="studio-room-frame"
        />
      </div>
      <p className="studio-preview-note">
        <Evidence kind="sample">Isolated preview</Evidence>
        <span>
          Preview inquiries use temporary sample data. Your existing customer
          projects are untouched.
        </span>
      </p>
    </div>
  );
}
