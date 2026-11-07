# Project activity and bounded local evidence

W32 contract · November 6, 2026 · Candidate implementation; see the
[review and verification record](project-evidence-review.md) for delivery status.

Studio's existing customer project gains a collapsed **Project activity** area.
It reads saved inquiry, question, preference, drawing-impact and quotation
records. A separate **Local viewing activity** disclosure shows the optional
observations retained in this browser. Neither area changes a project, reviews a
requirement, adopts a drawing or issues a quotation.

This is a local demonstration, not an analytics service. Existing fictional
fixtures retain their original sample dates and records. No view count establishes
that a customer read, agreed to or purchased anything.

## Two independent streams

| Stream | Source of truth | Meaning |
| --- | --- | --- |
| Saved project actions | Fresh, validated reads from the existing project repository | A corresponding record was successfully persisted. Reviews and unsaved drafts are insufficient. |
| Local viewing activity | A separate bounded optional observation adapter | A specifically instrumented control was used in this browser. Earlier or uninstrumented activity remains unknown. |

Confirmed actions are projected on read. There is no second business-event ledger
and no mutation-time analytics call that can announce success before persistence.
A failed save therefore cannot create a confirmed action. Reading, refreshing,
rerendering or retrying the same idempotent operation does not increase its count.

The current observation integration records only:

- `reference.requested`: an explicit control requested navigation to a saved
  reference. It does **not** claim that the model or drawing finished loading.
- `quotation.opened`: an explicit quotation tab or saved-version control opened
  that quotation in Product Room or Studio. Automatic initial display and
  rerendering do not count.

`reference.opened` and `inquiry.reviewed` are reserved in the normalizer but are
not wired by this increment. Story start/completion collection is deferred. A
saved follow-up completion position is navigation state, not reading or acceptance.
Hover, rotation, hidden tabs and presenter auto-advance are not collected.
Reference navigation is never delayed to await optional storage. A page unload may
interrupt that best-effort write; missing observations remain unknown.

## Provenance and displayed counts

The project adapter exposes read-only local scope metadata:

```js
evidenceScope: {
  schemaVersion: 1,
  namespace: '<existing-project-storage-key>',
  storage: 'browser-local'
}
```

The host maps the repository origin to `demo`, `presenter`, `ordinary` or
`unknown`. Fixture wrappers are demo samples; walkthrough sessions are presenter
sessions. The regular built-in local project adapter is ordinary local use. That
label does not imply a real customer, production service or authenticated user.
Missing or unsupported scope metadata remains unknown. Viewing as buyer or seller
changes the event's role, never its provenance.

The UI shows available saved actions, reviewed issued quotations and resolved
questions out of the available question count. Sample-generated quotations have
a distinct `quotation.sample-created` event and do not enter the reviewed-issued
quotation count. Legacy projects without independent question history show an
unknown question denominator. Viewing-session denominators remain unknown.

There are no funnel percentages, unique-customer counts, revenue attribution,
causal uplift, engagement scores or inferred conversions. A bounded or unavailable
history is explicitly labeled; it is not filled with fabricated zeroes.

## Pure projection and event envelope

`src/product-room/evidence-domain.js` exports:

| API | Contract |
| --- | --- |
| `projectEvidence(project, {mode, limit})` | Accepts a project already read through the validating repository. Returns latest-first safe events, available counts, coverage and a bounded summary. Default display limit 120; caller limit is clamped to 1–200. |
| `safeEvidenceSource(context)` | Returns only allowlisted product/model/part/document/drawing/version/sheet/region identifiers, or `null` if the required model identity is unavailable. |
| `normalizeEvidenceObservation(input)` | Returns a normalized optional observation or `null`. It cannot produce a confirmed business event. |
| `EVIDENCE_EVENT_LABELS` | Fixed English action labels; no customer-authored text is used as an activity label. |
| `EVIDENCE_OBSERVATION_TYPES` | Explicit supported observation type allowlist, including reserved unwired types described above. |

A confirmed event has this shape:

```js
{
  schemaVersion: 1,
  id: '<fixed-type>:<persisted-record-id>',
  type: 'quotation.issued',
  stream: 'confirmed',
  role: 'seller',
  mode: 'demo',
  occurredAt: '<saved-ISO-time>',
  projectId: '<project-id>',
  projectRevision: 12, // absent only where legacy records lack it
  source: { modelId: '<id>', modelRevision: '<exact-revision>' },
  record: { kind: 'quotation', id: '<quote-id>', quoteId: '<quote-id>', quoteVersion: 2 }
}
```

`source` may additionally include `productId`, `roomReleaseId`, `partId`,
`documentId`, `documentRevision`, `drawingId`, `drawingRevision`, `drawingAssetId`,
`drawingAssetRevision`, `mappingRevision`, `overviewRevision`, `sheetId` and
`regionId`. These come from the record's pinned context. Historical events never
resolve to the project's latest active drawing implicitly.

The envelope excludes typed questions, notes, names, email, company, prices,
source URLs, filenames, titles, screenshots, camera positions, geometry and
snapshots. It never includes `reviewToken`: that existing internal value serializes
reviewed content and is not safe telemetry identity. Opaque identifiers are
bounded to 320 characters and a restricted identifier alphabet.

Question actions keep the actual author role. An answer is distinct from a
resolution; a seller resolution is not a buyer acknowledgement. A drawing-impact
confirmation and its accompanying primary-reference update appear once, as one
saved operation. Old quotations and question events retain their A references
while new confirmed records may identify B.

Projection result:

```js
{
  schemaVersion: 1, projectId, projectRevision, mode,
  events: [],
  counts: { available: 0, total: null, byType: {} },
  coverage: { history: 'unavailable', omittedCount: 0, invalidRecordCount: 0, missing: [] },
  summary: {
    questionCount: null, resolvedQuestions: null, pendingBlockingQuestions: null,
    latestQuoteVersion: null, lastAction: null,
    availableDenominators: { savedProjects: null, questions: null, issuedQuotations: null, viewingSessions: null }
  }
}
```

Available history means the supported persisted records were readable; it is not
a complete behavioral history. Display omission does not remove originals.
Conflicting identities or invalid records produce partial/unknown coverage rather
than a fabricated total.

## Optional observation adapter

`createEvidenceRepository(options)` in `evidence-repository.js` returns
`readProject(projectId)` and `recordObservation(input)`. Both resolve a status;
optional storage/schema/crypto failures do not reject business operations. The
adapter does not read or write the project store and does not send network data.

`recordObservation` accepts `type`, `projectId`, `projectRevision` when known,
`role`, stable `operationId`, a sanitized `source` or raw `context` to allowlist,
and an optional safe `record`. The adapter supplies the fixed namespace mode,
session identity and timestamp. Retry with the same operation ID and payload is
a duplicate, not a new observation. A conflicting payload for the same identity
is refused. The normalizer's length-prefixed session/operation identity avoids
collisions when identifiers contain colons.

Storage boundaries:

- Project-key-specific observation key: `annora.evidence.observations.v1:<scope>`.
- Session key in session storage: `annora.evidence.session.v1:<scope>`.
- At most 200 retained observations and 256,000 encoded bytes. Older observations
  may be removed to respect either bound; omission is reported.
- At most 1,024 recent hashed operation identities/payloads for deduplication.
  Retries outside that bounded window are not guaranteed lifetime deduplication.
- Writes within a host are serialized. Cross-tab raw-storage checks detect
  concurrent changes; an optional observation failure never retries the business
  action that preceded it.
- Unsupported/malformed stored schemas fail closed. Reading or recording does not
  reset or silently replace an unreadable observation store.

`readProject` reports `available`, `not-started` or `unavailable`, with retained
project events, collection start time, retention metadata and an unknown session
denominator. Retention totals apply to the namespace, not just the filtered
project. Even an available stream has partial coverage: collection began locally
and only specific controls are instrumented.

## Host seam and future service integration

`createProjectEvidenceController({repository, observations, ...options})` in
`evidence-host.js` joins the independent reads. `read(projectId)` loads the saved
project, derives its report, then attempts optional observation reading.
`observe(project, {type, role, context, record, operationId})` records a safe
observation and resolves failures without affecting navigation or mutation.
`projectEvidenceController(repository)` caches that controller per adapter.

Studio's `ProjectEvidencePanel` refreshes on project revision, explicit refresh,
focus and storage notifications. It performs reads only. The existing queue/status
continues to identify the next responsible role; activity adds no navigation tab
or competing primary action.

A production host must own authentication, authorization, retention, privacy,
service-side idempotency and its source of confirmed business records. It may
inject an observation adapter without changing the Explorer. Local role/mode
labels are descriptive metadata, not access control. This increment does not
implement a backend, account system, cross-browser sharing or customer tracking.

## Acceptance boundaries

F6-07 covers retry deduplication; F6-08 keeps presenter/sample provenance distinct;
F6-09 excludes sensitive payloads; F6-10 leaves unavailable history and denominators
unknown. Verification also covers failed persistence, corrupt optional storage,
retention bounds, A/B reference accuracy, mobile disclosures and prior question/
quotation workflows. See the review record for actual checks and publication.
