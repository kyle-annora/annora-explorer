import React, { useEffect, useRef, useState } from "react";
import {
  ActionGroup,
  Button,
  Evidence,
  Field,
  Glyph,
  Notice,
  Section,
  Status,
} from "../product-room/ui/components.jsx";
import { createRoomViewer } from "../product-room/viewer.js";
import { MODEL_CATALOG } from "../generated/catalog.js";
import { STUDIO_PRODUCT_ID, STUDIO_PARTS, STUDIO_ASSETS } from "./seed.js";
import { Check } from "./ui.jsx";
import { partOptions } from "./navigation.js";
import crankImage from "../product-room/assets/crank.png";

function PartViewer({ onSelection, onClose, selectedLabel, onEdit }) {
  const mount = useRef(null),
    viewer = useRef(null),
    selection = useRef(onSelection);
  const [state, setState] = useState("loading"),
    [error, setError] = useState("");
  selection.current = onSelection;
  useEffect(() => {
    let active = true;
    const api = createRoomViewer({
      mount: mount.current,
      explorerURL: new URL("../", location.href).href,
      onState(value) {
        if (
          active &&
          value.lifecycle === "ready" &&
          value.model?.id === STUDIO_PRODUCT_ID &&
          value.navigation?.selectedId
        )
          selection.current(value.navigation.selectedId);
      },
      onReady({ state: value }) {
        if (!active) return;
        if (value.model?.id !== STUDIO_PRODUCT_ID) {
          setError(
            "This editor is linked to the crank model. Close and reopen the picker to return to it.",
          );
          setState("error");
          return;
        }
        setState("ready");
      },
      onError(value) {
        if (active) {
          setError(value.message);
          setState("error");
        }
      },
    });
    viewer.current = api;
    api.mountModel(STUDIO_PRODUCT_ID).catch((value) => {
      if (active) {
        setError(value.message);
        setState("error");
      }
    });
    const hidden = () => {
      if (document.hidden) void api.pause().catch(() => {});
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", hidden);
      void api.dispose();
      viewer.current = null;
    };
  }, []);
  return (
    <section className="studio-picker" aria-label="Select a part in 3D">
      <header>
        <div>
          <strong>Pick a part in 3D</strong>
          <span>Select in the model or use its component tree.</span>
        </div>
        <Button variant="quiet" onClick={onClose} icon="close">
          Close picker
        </Button>
      </header>
      <div className="studio-picker-frame">
        <div ref={mount} className="studio-picker-mount" />
        {state !== "ready" && (
          <div className="studio-picker-status" role="status">
            <strong>
              {state === "error"
                ? "The model could not open."
                : "Preparing the assembly…"}
            </strong>
            <p>
              {error ||
                "Product editing remains available while the model loads."}
            </p>
          </div>
        )}
      </div>
      <div className="studio-picker-selection">
        <span aria-live="polite">
          <small>SELECTED PART</small>
          <strong>{selectedLabel}</strong>
        </span>
        <Button onClick={onEdit} disabled={state !== "ready"} icon="arrow">
          Edit part details
        </Button>
      </div>
    </section>
  );
}

export function ProductFields({ draft, change }) {
  const content = draft.content;
  const updateContent = (key, value) =>
    change((next) => {
      next.content[key] = value;
    });
  const updateFact = (group, fact, key, value) =>
    change((next) => {
      next.content.specGroups[group].facts[fact][key] = value;
    });
  return (
    <>
      <Section
        eyebrow="01 / PRODUCT INFORMATION"
        title="Product information"
        description="These details become the overview your customers read before starting an inquiry."
      >
        <div className="studio-product-top">
          <div className="studio-form-grid">
            <Field
              label="Product name"
              value={content.title}
              onChange={(e) => updateContent("title", e.target.value)}
              maxLength={120}
            />
            <Field
              label="Short name"
              value={content.shortTitle}
              onChange={(e) => updateContent("shortTitle", e.target.value)}
              maxLength={60}
            />
            <Field
              label="Opening headline"
              className="studio-span-all"
              value={content.tagline}
              onChange={(e) => updateContent("tagline", e.target.value)}
              maxLength={180}
            />
            <Field
              label="Product introduction"
              className="studio-span-all"
              textarea
              value={content.description}
              onChange={(e) => updateContent("description", e.target.value)}
              maxLength={2000}
            />
          </div>
          <figure className="studio-product-poster">
            <img
              src={crankImage}
              alt="Engineering view of the crank-slider mechanism"
              width="704"
              height="450"
            />
            <figcaption>
              Prepared model image
              <Evidence kind="model" />
            </figcaption>
          </figure>
        </div>
      </Section>
      <Section
        className="studio-separated"
        title="Technical facts"
        description="Keep the value and its source together. Illustrative values describe this model; they do not establish a manufacturing specification."
      >
        {content.specGroups.map((group, groupIndex) => (
          <details
            key={group.id}
            className="studio-fact-group"
            open={groupIndex === 0}
          >
            <summary>
              <span>{group.title}</span>
              <span>{group.facts.length} facts</span>
            </summary>
            <div className="studio-fact-list">
              {group.facts.map((fact, index) => (
                <div className="studio-fact" key={index}>
                  <div className="studio-form-grid studio-fact-main">
                    <Field
                      label="Fact label"
                      value={fact.label}
                      onChange={(e) =>
                        updateFact(groupIndex, index, "label", e.target.value)
                      }
                    />
                    <Field
                      label="Value / unit"
                      value={fact.value}
                      onChange={(e) =>
                        updateFact(groupIndex, index, "value", e.target.value)
                      }
                    />
                    <Field
                      label="Evidence status"
                      options={[
                        ["illustrative", "Illustrative model value"],
                        ["verified", "Verified product fact"],
                        ["unverified", "Awaiting review"],
                      ]}
                      value={fact.status || "illustrative"}
                      onChange={(e) =>
                        updateFact(groupIndex, index, "status", e.target.value)
                      }
                    />
                    <Field
                      label="Source"
                      value={fact.source || ""}
                      onChange={(e) =>
                        updateFact(groupIndex, index, "source", e.target.value)
                      }
                    />
                  </div>
                  <Field
                    label="Qualification or note"
                    optional
                    value={fact.note || ""}
                    onChange={(e) =>
                      updateFact(groupIndex, index, "note", e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
      </Section>
      <div className="studio-source-note">
        <Evidence kind="sample">Illustrative demonstration product</Evidence>
        <p>
          The prepared model and its source attribution stay attached to every
          release.
        </p>
      </div>
    </>
  );
}

export function PartsFields({ draft, change, busy, selectedPartId, onSelectPart, onOpenModel }) {
  const [localSelectedId, setLocalSelectedId] = useState("rod"),
    [picker, setPicker] = useState(false),
    [assetId, setAssetId] = useState(STUDIO_ASSETS[0]?.id || "");
  const selectedId = selectedPartId || localSelectedId;
  const setSelectedId = onSelectPart || setLocalSelectedId;
  const content = draft.content;
  const selectedPart = STUDIO_PARTS.find((part) => part.id === selectedId);
  const binding = (content.partContent || []).find(
    (part) => part.nodeId === selectedId,
  );
  const updatePart = (key, value) =>
    change((next) => {
      next.content.partContent ||= [];
      let current = next.content.partContent.find(
        (part) => part.nodeId === selectedId,
      );
      if (!current) {
        current = {
          nodeId: selectedId,
          title: selectedPart?.title || selectedId,
          description: "",
          documentIds: [],
        };
        next.content.partContent.push(current);
      }
      current[key] = value;
    });
  const updateDoc = (index, key, value) =>
    change((next) => {
      next.content.documents[index][key] = value;
    });
  function addDocument() {
    const asset = STUDIO_ASSETS.find((item) => item.id === assetId);
    if (!asset) return;
    change((next) => {
      next.content.documents.push({
        id: `document-${Date.now().toString(36)}`,
        title: asset.title,
        description: "Reference material for this product conversation.",
        assetId: asset.id,
        type: asset.type,
        revision: asset.revision,
        date: asset.date,
        fileName: asset.fileName,
        nodeId: selectedId,
        sample: true,
      });
    });
  }
  function removeDocument(id) {
    change((next) => {
      next.content.documents = next.content.documents.filter(
        (doc) => doc.id !== id,
      );
      (next.content.partContent || []).forEach((part) => {
        part.documentIds = part.documentIds.filter((value) => value !== id);
      });
    });
  }
  return (
    <>
      <Section
        eyebrow="02 / PARTS & DOCUMENTS"
        title="Parts & documents"
        description="Select an existing component, add a customer-facing explanation, and connect the documents that support it."
        actions={
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenModel ? onOpenModel() : setPicker((value) => !value)}
            icon={picker ? "close" : "external"}
          >
            {onOpenModel ? "View in 3D" : picker ? "Close 3D picker" : "Open 3D picker"}
          </Button>
        }
      >
        {picker && !onOpenModel && (
          <PartViewer
            selectedLabel={selectedPart?.title || "Whole assembly"}
            onEdit={() => {
              setPicker(false);
              requestAnimationFrame(() =>
                document.getElementById("studio-part-name")?.focus(),
              );
            }}
            onClose={() => setPicker(false)}
            onSelection={(id) => {
              if (STUDIO_PARTS.some((part) => part.id === id))
                setSelectedId(id);
            }}
          />
        )}
        <div className="studio-part-editor">
          <div className="studio-part-context">
            <Field
              label="Selected part"
              value={selectedId}
              options={STUDIO_PARTS.map((part) => [part.id, part.title])}
              onChange={(e) => setSelectedId(e.target.value)}
            />
            <p className="studio-metadata">
              MODEL REFERENCE <code>{selectedId}</code>
            </p>
            <Evidence kind="model">Exact prepared model revision</Evidence>
          </div>
          <div className="studio-part-details">
            <Field
              label="Customer-facing part name"
              id="studio-part-name"
              value={binding?.title ?? selectedPart?.title ?? ""}
              onChange={(e) => updatePart("title", e.target.value)}
            />
            <Field
              label="Part explanation"
              textarea
              placeholder="Explain what this part does and what the customer should know."
              value={binding?.description || ""}
              onChange={(e) => updatePart("description", e.target.value)}
            />
            <div className="studio-document-checks">
              <span className="studio-field-label">Related documents</span>
              {content.documents.length ? (
                content.documents.map((doc) => (
                  <Check
                    key={doc.id}
                    checked={binding?.documentIds?.includes(doc.id) || false}
                    onChange={(checked) =>
                      updatePart(
                        "documentIds",
                        checked
                          ? [...(binding?.documentIds || []), doc.id]
                          : (binding?.documentIds || []).filter(
                              (id) => id !== doc.id,
                            ),
                      )
                    }
                  >
                    {doc.title}
                    <small>{doc.revision}</small>
                  </Check>
                ))
              ) : (
                <p className="studio-muted">
                  Add a document below to link it to this part.
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>
      <Section
        className="studio-separated"
        title="Document library"
        description="Use the supplied sample documents. Document revisions and part links are saved with the product release."
      >
        <div className="studio-document-add">
          <Field
            label="Prepared document"
            options={STUDIO_ASSETS.map((asset) => [asset.id, asset.title])}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          />
          <Button variant="secondary" onClick={addDocument} icon="plus">
            Add document
          </Button>
        </div>
        <div className="studio-document-list">
          {content.documents.map((doc, index) => (
            <details
              className="studio-document-row"
              key={doc.id}
              open={index === 0}
            >
              <summary>
                <Glyph name="document" />
                <span>
                  <strong>{doc.title || "Untitled document"}</strong>
                  <small>
                    {doc.revision || "Revision needed"} ·{" "}
                    {STUDIO_PARTS.find((part) => part.id === doc.nodeId)
                      ?.title || "Whole product"}
                  </small>
                </span>
                <span className="studio-summary-edit">Edit</span>
              </summary>
              <div className="studio-document-fields">
                <div className="studio-form-grid">
                  <Field
                    label="Document title"
                    value={doc.title}
                    onChange={(e) => updateDoc(index, "title", e.target.value)}
                  />
                  <Field
                    label="Revision"
                    value={doc.revision}
                    onChange={(e) =>
                      updateDoc(index, "revision", e.target.value)
                    }
                  />
                  <Field
                    label="Reference file"
                    options={STUDIO_ASSETS.map((asset) => [
                      asset.id,
                      asset.title,
                    ])}
                    value={doc.assetId}
                    onChange={(e) => {
                      const asset = STUDIO_ASSETS.find(
                        (item) => item.id === e.target.value,
                      );
                      change((next) => {
                        Object.assign(next.content.documents[index], {
                          assetId: asset.id,
                          type: asset.type,
                          fileName: asset.fileName,
                        });
                      });
                    }}
                  />
                  <Field
                    label="Associated part"
                    options={partOptions()}
                    value={doc.nodeId || ""}
                    onChange={(e) =>
                      updateDoc(index, "nodeId", e.target.value || undefined)
                    }
                  />
                  <Field
                    label="Description"
                    textarea
                    className="studio-span-all"
                    value={doc.description || ""}
                    onChange={(e) =>
                      updateDoc(index, "description", e.target.value)
                    }
                  />
                </div>
                <ActionGroup align="between">
                  <a
                    className="studio-text-link"
                    href={
                      STUDIO_ASSETS.find((asset) => asset.id === doc.assetId)
                        ?.url
                    }
                    target="_blank"
                    rel="noopener"
                  >
                    Open reference file <Glyph name="external" />
                  </a>
                  <Button
                    variant="quiet"
                    onClick={() => removeDocument(doc.id)}
                  >
                    Remove document
                  </Button>
                </ActionGroup>
              </div>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}

export function PresentationFields({ draft, change }) {
  const questions = draft.content.questions;
  const model = MODEL_CATALOG[STUDIO_PRODUCT_ID];
  const chapters = model.tour?.chapters || [];
  const options = [
    ...STUDIO_PARTS.map((part) => [`part:${part.id}`, `Part · ${part.title}`]),
    ...chapters.map((chapter) => [
      `chapter:${chapter.id}`,
      `Guided tour · ${chapter.title || chapter.id}`,
    ]),
  ];
  const targetValue = (target) =>
    target.kind === "part"
      ? `part:${target.nodeId}`
      : `chapter:${target.chapterId}`;
  return (
    <>
      <Section
        eyebrow="03 / PRESENTATION"
        title="Presentation"
        description="Keep the existing Explorer controls and motion. These settings choose its starting view and the explanations linked from the Room."
      >
        <div className="studio-presentation-default">
          <Field
            label="Default rendering"
            options={[
              ["engineering", "Engineering materials"],
              ["linework", "Clear linework"],
              ["flat", "Linework + flat Ember"],
            ]}
            value={draft.presentation.defaultRenderStyle}
            onChange={(e) =>
              change((next) => {
                next.presentation.defaultRenderStyle = e.target.value;
              })
            }
          />
          <div className="studio-presentation-caption">
            <Evidence kind="model">Existing Explorer modes</Evidence>
            <p>Customers can continue switching modes and exploring freely.</p>
          </div>
        </div>
        <Field
          label="Explanation section heading"
          value={draft.content.summary}
          onChange={(e) =>
            change((next) => {
              next.content.summary = e.target.value;
            })
          }
        />
      </Section>
      <Section
        className="studio-separated"
        title="Questions that lead into 3D"
        description="Each explanation opens a prepared part or an existing chapter. Chapter motion and timing stay with the model package."
      >
        <div className="studio-question-list">
          {questions.map((question, index) => (
            <div className="studio-question-editor" key={question.id}>
              <div className="studio-question-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="studio-form-stack">
                <Field
                  label="Customer question"
                  value={question.title}
                  onChange={(e) =>
                    change((next) => {
                      next.content.questions[index].title = e.target.value;
                    })
                  }
                />
                <Field
                  label="Explanation"
                  textarea
                  value={question.description}
                  onChange={(e) =>
                    change((next) => {
                      next.content.questions[index].description =
                        e.target.value;
                    })
                  }
                />
                <div className="studio-form-grid">
                  <Field
                    label="Link label"
                    value={question.actionLabel}
                    onChange={(e) =>
                      change((next) => {
                        next.content.questions[index].actionLabel =
                          e.target.value;
                      })
                    }
                  />
                  <Field
                    label="Opens in 3D"
                    options={options}
                    value={targetValue(question.target)}
                    onChange={(e) => {
                      const [kind, ...rest] = e.target.value.split(":");
                      const id = rest.join(":");
                      change((next) => {
                        next.content.questions[index].target =
                          kind === "part"
                            ? { kind, nodeId: id }
                            : { kind, tourId: model.tour.id, chapterId: id };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

export function InquiryFields({ draft, change }) {
  const fields = draft.inquiryProfile.fields;
  const update = (index, key, value) =>
    change((next) => {
      next.inquiryProfile.fields[index][key] = value;
    });
  return (
    <>
      <Section
        eyebrow="04 / INQUIRY SETUP"
        title="Inquiry setup"
        description="Configure the existing inquiry fields. Their wording follows the customer from filling in the form to reviewing the saved request."
      >
        <div className="studio-inquiry-path">
          <span>
            <b>1</b> Your inquiry
          </span>
          <Glyph name="arrow" />
          <span>
            <b>2</b> Review & confirm
          </span>
          <small>Review stays required</small>
        </div>
        <div className="studio-inquiry-fields">
          {fields.map((field, index) => {
            const locked = ["application", "quantity"].includes(field.id);
            return (
              <details
                className="studio-inquiry-row"
                key={field.id}
                open={index < 2}
              >
                <summary>
                  <span>
                    <strong>{field.label}</strong>
                    <small>
                      {locked
                        ? "Required core field"
                        : field.enabled
                          ? "Optional field"
                          : "Hidden from new inquiries"}
                      {field.unit ? ` · ${field.unit}` : ""}
                    </small>
                  </span>
                  <Status
                    tone={
                      locked
                        ? "complete"
                        : field.enabled
                          ? "neutral"
                          : "pending"
                    }
                  >
                    {locked ? "Required" : field.enabled ? "Enabled" : "Hidden"}
                  </Status>
                </summary>
                <div className="studio-inquiry-field-editor">
                  <div className="studio-form-grid">
                    <Field
                      label="Field label"
                      value={field.label}
                      onChange={(e) => update(index, "label", e.target.value)}
                    />
                    <Field
                      label="Helpful guidance"
                      value={field.hint || ""}
                      onChange={(e) => update(index, "hint", e.target.value)}
                    />
                  </div>
                  {locked ? (
                    <p className="studio-muted studio-small">
                      Application and quantity remain required so the request
                      has a useful starting point.
                    </p>
                  ) : (
                    <Check
                      checked={field.enabled}
                      onChange={(checked) => update(index, "enabled", checked)}
                    >
                      Include this field in new inquiries
                    </Check>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </Section>
      <Notice title="Existing projects keep their original form.">
        New wording and field visibility apply to this product release. Saved
        drafts and submitted inquiries keep the version they started with.
      </Notice>
    </>
  );
}
