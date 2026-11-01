# Product Room component library

This is a repository-local, shared presentation layer for the customer project.
It is not a published Annora registry or a complete Studio implementation.

## Ownership

| File or layer | Responsibility |
| --- | --- |
| `src/product-room/ui/tokens.css` | Scoped semantic colors, typography and geometry |
| `src/product-room/ui/components.css` | Shared interaction states and responsive presentation |
| `src/product-room/ui/components.jsx` | React presentation primitives and reusable patterns |
| `src/product-room/ui/catalog.jsx` | Isolated fixed-state samples and a live recovery demonstration |
| `src/product-room/project-workspace.jsx` | Customer project composition and transient view state |
| Product project domain and repository | Validation, saved snapshots, quote relationships and persistence |
| Existing Product Room host | Routing, product context and Explorer lifecycle |
| Existing Explorer runtime | Model display, interaction, animation and public JSON controller |

The library uses a Base UI button for native button and focus behavior. Native
inputs, selects and semantic tables cover the remaining simple controls. It does
not install a global CSS reset or modify the embedded Explorer. The component
approach follows the NHI React/shadcn/Base UI separation, but the code here is a
small Annora-specific layer rather than an imported NHI screen or pricing engine.

## Public component contract

All consumers wrap their content in `.room-ui`. Import `ui/components.jsx`; it
loads the scoped tokens and component styles.

| Export | Main properties |
| --- | --- |
| `Button` | `variant`: `primary`, `secondary`, `quiet` (`ghost` alias); `pending`, `pendingLabel`, `disabled`, `icon`, native button properties |
| `ActionGroup` | `align`: `start`, `end`, `between`; children and class name |
| `Field` | `label`, `hint`, `error`, `optional`, `unit`; native input props, `textarea`, or `options`; alternatively one native control child |
| `Status` / `Badge` | `tone`: `neutral`, `active`, `pending`, `complete`; visible label |
| `Evidence` | `kind`: `model`, `customer`, `sample`, `review`; optional custom label |
| `Notice` | `kind` (`tone` alias): `neutral`, `error`, `success`; title, content and optional role |
| `Section` | title, eyebrow, description, actions and content |
| `EmptyState` | title, description and action content |
| `VersionSelector` | existing `versions: [{id, version, label?}]`, selected ID in `value`, `onChange(id)` |
| `Comparison` | `rows: [{label, before, after, changed?}]` or triples; column labels and accessible caption |
| `Glyph` | small decorative SVG glyph by name |

`ComponentCatalog` is exported from `ui/catalog.jsx`. It accepts an optional
`onBack` callback and holds only isolated demonstration state. It does not read
or mutate project storage.

## Behavior and accessibility

- The whole visible button is its hit target. The components do not nest links
  or buttons. Callers must not wrap an action inside another clickable row.
- A pending button remains focusable but blocks activation. The normal and
  pending labels share reserved space, avoiding a width jump. Disabled and
  pending are visibly distinct.
- Focus uses a separate ring. Hover does not become a persistent selection style.
  Touch devices do not depend on hover to expose a required action.
- Field labels, hints, units and errors are connected by ID. Native controls keep
  their form semantics. Errors preserve the value managed by the caller.
- Source evidence is not a workflow completion badge. Example data and customer
  inputs never imply manufacturer approval.
- Version controls list existing versions only. The domain supplies the records;
  changing the selection does not create or overwrite a quotation.
- Comparison rows label changes in text. Empty amounts render “To confirm,”
  rather than zero. On narrow screens each detail displays a labelled before/after
  pair with no wide, clipped table.
- Text is allowed to wrap. Controls maintain 44px minimum touch targets, mobile
  fields use 16px type, and reduced motion disables spinner rotation.

## Review catalog

The catalog covers action hierarchy; fixed default, hover, pressed, keyboard
focus, disabled and pending appearances; live field validation and save recovery;
workflow statuses and evidence labels; and version comparison at desktop/mobile
widths. Fixed previews are labelled as such, and the live example clearly states
that it does not create a project.

Production workflows must use actual operation state. No timer or simulated
response belongs inside a shared button or field. The catalog's short delay is
isolated to its demonstration.

## Reuse boundary

Keep pricing, quote IDs, status transitions, immutable snapshots and API calls out
of presentation primitives. A future Studio or customer host can reuse these
components with a different adapter and brand tokens. Before publishing them as
a package, verify another consumer, document stable versioning, and separate
host-specific composition styles from the component contract.
