import React, { useEffect, useRef, useState } from "react";
import {
  ActionGroup,
  Button,
  Comparison,
  Evidence,
  Field,
  Notice,
  Section,
  Status,
  VersionSelector,
} from "./components.jsx";

/** Isolated component review. These interactions do not create customer records. */
export function ComponentCatalog({ onBack }) {
  const [name, setName] = useState("Example application");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [version, setVersion] = useState("v2");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const save = (fail) => {
    if (status === "pending") return;
    if (!name.trim()) {
      setError("Add a project name to continue.");
      return;
    }
    setError("");
    setStatus("pending");
    // A visible delay belongs only to this isolated state demonstrator.
    timer.current = setTimeout(
      () => setStatus(fail ? "error" : "success"),
      700,
    );
  };
  return (
    <div className="room-ui ar-catalog">
      <header className="ar-catalog-header">
        <p className="ar-eyebrow">ANNORA / COMPONENT LIBRARY</p>
        <h1>Product Room components.</h1>
        <p>
          Shared controls for the Product Room. These examples are isolated from
          your projects; they do not save records or send requests.
        </p>
        {onBack && (
          <Button variant="quiet" icon="back" onClick={onBack}>
            Back to projects
          </Button>
        )}
      </header>
      <Section
        title="Action hierarchy"
        description="One primary action per decision. Outlined actions are alternatives; quiet actions handle navigation."
      >
        <div className="ar-catalog-samples">
          <div className="ar-catalog-sample">
            <small>PRIMARY / CONFIRM A DECISION</small>
            <Button icon="arrow">Confirm inquiry</Button>
          </div>
          <div className="ar-catalog-sample">
            <small>SECONDARY / CHANGE THE DETAILS</small>
            <Button variant="secondary">Edit inquiry</Button>
          </div>
          <div className="ar-catalog-sample">
            <small>QUIET / NAVIGATE</small>
            <Button variant="quiet" icon="back">
              Back to product
            </Button>
          </div>
        </div>
      </Section>
      <Section
        title="Button states"
        description="Fixed appearance samples below. Tab through enabled controls to inspect real keyboard focus; disabled controls cannot activate."
      >
        <div className="ar-catalog-samples">
          {[
            ["Default", undefined],
            ["Hover", "hover"],
            ["Pressed", "pressed"],
            ["Keyboard focus", "focus"],
          ].map(([label, state]) => (
            <div className="ar-catalog-sample" key={label}>
              <small>{label.toUpperCase()}</small>
              <Button variant="secondary" data-preview-state={state}>
                Review changes
              </Button>
            </div>
          ))}
          <div className="ar-catalog-sample">
            <small>DISABLED</small>
            <Button variant="secondary" disabled>
              Review changes
            </Button>
          </div>
          <div className="ar-catalog-sample">
            <small>PENDING / ACTIVATION BLOCKED</small>
            <Button pending pendingLabel="Saving…">
              Confirm inquiry
            </Button>
          </div>
        </div>
      </Section>
      <Section
        title="Input and recovery"
        description="This live example retains your input after a simulated save failure. Pending and success are separate states."
      >
        <form
          className="ar-catalog-form"
          onSubmit={(event) => {
            event.preventDefault();
            save(false);
          }}
        >
          <Field
            label="Project name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
              setStatus("idle");
            }}
            error={error}
            hint="Example content only. No project is created."
            disabled={status === "pending"}
          />
          <Field
            label="Requested travel"
            defaultValue="70"
            type="number"
            min="1"
            unit="mm"
            hint="Customer input is distinct from verified product performance."
          />
          {status === "error" && (
            <Notice kind="error" title="Example save failed">
              Your input is still here. Try saving again.
            </Notice>
          )}
          {status === "success" && (
            <Notice kind="success" title="Example saved" role="status">
              This is a component demonstration, not a saved project.
            </Notice>
          )}
          <ActionGroup align="start">
            <Button type="submit" pending={status === "pending"}>
              {status === "error" ? "Try again" : "Save example"}
            </Button>
            <Button
              variant="secondary"
              disabled={status === "pending"}
              onClick={() => save(true)}
            >
              Simulate save failure
            </Button>
          </ActionGroup>
        </form>
      </Section>
      <Section
        title="State and evidence"
        description="A status describes the workflow. An evidence label explains where information came from; it never certifies engineering fit."
      >
        <div className="ar-catalog-statuses">
          <Status>Draft</Status>
          <Status tone="active">Your review</Status>
          <Status tone="pending">Awaiting reply</Status>
          <Status tone="complete">Inquiry saved</Status>
        </div>
        <div className="ar-catalog-statuses">
          <Evidence kind="model" />
          <Evidence kind="customer" />
          <Evidence kind="sample" />
          <Evidence kind="review" />
        </div>
      </Section>
      <Section
        title="Versions and comparison"
        description="Only existing versions can be selected. A changed detail is visible in text as well as through restrained background contrast."
      >
        <VersionSelector
          versions={[
            { id: "v1", version: 1 },
            { id: "v2", version: 2 },
          ]}
          value={version}
          onChange={setVersion}
        />
        <div style={{ marginTop: 22 }}>
          <Comparison
            caption="Illustrative quote comparison"
            beforeLabel="Version 1"
            afterLabel={version === "v2" ? "Version 2" : "Version 1"}
            rows={[
              {
                label: "Quantity",
                before: "12 assemblies",
                after: version === "v2" ? "16 assemblies" : "12 assemblies",
              },
              {
                label: "Requested timing",
                before: "8 weeks",
                after: version === "v2" ? "6 weeks" : "8 weeks",
              },
              {
                label: "Proposed lead time",
                before: "Engineering review required",
                after: "Engineering review required",
              },
              { label: "Final total", before: null, after: null },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}

export default ComponentCatalog;
