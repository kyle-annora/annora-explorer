import { DEFAULT_INQUIRY_PROFILE } from "../product-room/inquiry-profile.js";
import { contextForRelease } from "../product-room/release-content.js";
import { createInquiryDraft } from "../product-room/project-domain.js";
import { normalizeOverviewPresentation, overviewPresentationIssues } from "../drawings/overview-presentation.js";
import {
  normalizeDrawingPackage,
  resolveSheetContext,
} from "../drawings/package.js";

/** Freeze the exact source, sheet, part and association version into a reviewed
 * inquiry. Feature annotations never fill dimensions or requirements implicitly. */
export function createDrawingContext({
  drawing,
  sheetId,
  regionId,
  modelRevision,
  model = {},
  presentationSnapshot,
}) {
  if (!modelRevision?.trim())
    throw new TypeError("An exact prepared model revision is required.");
  const pkg = normalizeDrawingPackage(drawing, { modelRevision });
  if (pkg.modelRevision !== modelRevision)
    throw new TypeError(
      "The drawing and prepared model versions do not match.",
    );
  let presentation;
  if (presentationSnapshot !== undefined) {
    presentation = normalizeOverviewPresentation(presentationSnapshot);
    const issues = presentation && overviewPresentationIssues(presentation, pkg);
    if (issues?.some(issue => issue.severity !== 'warning'))
      throw new TypeError('The overview does not match this drawing source or its confirmed associations.');
  }
  const matches = pkg.sheets
    .filter((sheet) => !sheetId || sheet.id === sheetId)
    .flatMap((sheet) =>
      sheet.regions
        .filter((region) => region.id === regionId)
        .map((region) => ({ sheet, region })),
    );
  if (matches.length !== 1)
    throw new TypeError("Select one available detail on a drawing sheet.");
  const { sheet, region } = matches[0],
    { asset } = resolveSheetContext(pkg, sheet.id, region.id);
  if (region.mappingStatus !== "confirmed")
    throw new TypeError(
      "Confirm this drawing association before starting an inquiry.",
    );
  if (model.parts && !model.parts.some((part) => part.id === region.partId))
    throw new TypeError("This detail is not linked to an available part.");
  const title = model.title || pkg.title,
    shortTitle = model.shortTitle || title;
  const partTitle =
    model.parts?.find((part) => part.id === region.partId)?.title ||
    region.partId;
  const status = pkg.statusLabel || "Reference drawing · unreviewed";
  const statusNote =
    pkg.statusNote ||
    "Reference drawing only. Manufacturing tolerances and approval have not been supplied.";
  const profile = {
    id: "drawing-detail-inquiry",
    version: "drawing-detail-inquiry-v1",
    fields: DEFAULT_INQUIRY_PROFILE.fields.map((field) => ({
      ...field,
      enabled: !["stroke", "load"].includes(field.id),
      ...(field.id === "application"
        ? {
            label: "Question or application",
            hint: "Describe what needs review. The selected drawing detail stays attached.",
          }
        : {}),
      ...(field.id === "notes"
        ? {
            label: "Requirements to discuss",
            hint: "Add required material, tolerances or other details. Nothing is inferred from viewed geometry.",
          }
        : {}),
    })),
  };
  const release = {
    id: `drawing-preview:${pkg.id}:${pkg.revision}:${asset.sha256}:${pkg.mappingRevision}`,
    productId: pkg.modelId,
    modelRevision,
    version: 1,
    source: "bundled",
    createdAt: "2026-11-01T00:00:00.000Z",
    inquiryProfile: profile,
    content: {
      id: pkg.modelId,
      modelId: pkg.modelId,
      title,
      shortTitle,
      eyebrow: "3D / Drawings preview",
      tagline: "One part. The same drawing reference.",
      description: `${status}. ${statusNote}`,
      summary:
        region.note ||
        "A selected detail links the prepared model to its pinned source drawing.",
      demoNotice:
        "Fictional inquiry saved in this browser. Nothing is sent to a manufacturer.",
      roomRevision: "drawing-preview-room-v1",
      source: {
        label: "Paired STEP and drawing source",
        author: model.sourceLabel || "Published source",
        license: model.attribution || "See source attribution",
        url: pkg.sourceURL,
        note: statusNote,
      },
      highlights: [{ label: "Drawing status", value: status }],
      specGroups: [
        {
          id: "drawing-reference",
          title: "Drawing reference",
          facts: [
            {
              label: "Status",
              value: status,
              source: "Published source drawing and review",
            },
            {
              label: "Source version",
              value: pkg.revisionLabel || pkg.revision,
              source:
                "Pinned document version; not a manufacturer-issued revision",
            },
            {
              label: "Association version",
              value: pkg.mappingRevision,
              source: "Authored part and drawing associations",
            },
          ],
        },
      ],
      questions: [],
      documents: [
        {
          id: pkg.id,
          title: pkg.title,
          revision: pkg.revision,
          assetId: asset.id,
          description: statusNote,
          type: "Reference drawing",
          nodeId: region.partId,
        },
      ],
      partContent: [
        {
          nodeId: region.partId,
          title: partTitle,
          description:
            region.note || "The selected detail is linked to this source part.",
          documentIds: [pkg.id],
        },
      ],
    },
  };
  const context = contextForRelease(release, {
    part: { id: region.partId, title: partTitle },
    drawing: {
      id: pkg.id,
      title: pkg.title,
      revision: pkg.revision,
      ...(pkg.revisionLabel ? { revisionLabel: pkg.revisionLabel } : {}),
      assetId: asset.id,
      assetRevision: asset.sha256,
      partId: region.partId,
      sheetId: sheet.id,
      sheetTitle: sheet.title,
      regionId: region.id,
      regionLabel: region.label,
      sourceURL: pkg.sourceURL,
      ...(drawing.schemaVersion === 2
        ? { mappingRevision: pkg.mappingRevision }
        : {}),
      ...(presentationSnapshot !== undefined ? {
        presentationSnapshot: presentation,
        ...(presentation ? { presentationRevision: presentation.revision } : {}),
      } : {}),
    },
  });
  return createInquiryDraft(context, "drawing-context-validation").context;
}
