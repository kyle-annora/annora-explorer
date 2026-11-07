# Project activity — delivery review

W32 · November 6, 2026 · Published and verified on GitHub Pages. The [release receipt](evidence/project-activity/release-receipt.json) identifies the exact source, deployment and public checks.

Studio now has a compact **Project activity** disclosure inside each customer
project. It presents saved business actions and a separate optional record of
explicit viewing actions. Explorer behavior, quotation confirmation, drawing
version rules and the existing buyer/seller navigation remain the authority.

## Review the same project

Use the same browser for both roles. Existing local projects are retained; a
fresh browser receives the fictional sample. Its seed dates and history are
sample records, not newly observed customers.

- [SK08 seller project](https://kyle-annora.github.io/annora-explorer/studio/?impactDemo=sk08-a-b-v1)
- [SK08 buyer project](https://kyle-annora.github.io/annora-explorer/product-room/?impactDemo=sk08-a-b-v1)
- [Crank seller project](https://kyle-annora.github.io/annora-explorer/studio/?optionDemo=crank-options-v1)
- [Crank buyer project](https://kyle-annora.github.io/annora-explorer/product-room/?optionDemo=crank-options-v1)

These routes use the verified published version. Open **Project activity** in the seller project to review this increment.

1. Open the SK08 seller project and expand **Project activity**. The compact
   summary shows available saved actions, issued quotations and resolved
   questions. Open **Record details** to inspect a saved action's exact source.
2. Run the existing A→B impact review if it has not already been completed.
   Explicitly confirm the individual reference decisions. Activity gains one
   drawing-impact confirmation; opening or reviewing the form alone adds none.
3. Review the quotation terms, then issue v2 through the existing confirmation.
   Activity identifies the new quotation while old inquiry, question and v1
   references remain A. Refreshing or reloading does not create another issue.
4. Open a saved quotation explicitly, or use a saved reference's navigation
   control. Return to Studio, refresh activity and expand **Local viewing
   activity**. These observations remain separate from saved project actions.
   A reference request does not claim that the destination finished loading.
5. Use the crank project to add, answer and separately resolve a component
   question. Confirmed actions appear with their actual buyer/seller role.
   An unconfirmed reply or canceled review is absent.
6. Inspect the compact phone layout. Activity starts collapsed, record details
   expand only when requested, and no action requires hovering or dragging.

Ordinary local projects, demo fixtures and presenter walkthrough sessions have
distinct provenance labels. None is a real-customer analytics dataset. The
viewing-session denominator remains unknown; this demo reports no conversion
rate or revenue effect.

## Design decisions

| Decision | Reference and bounded role |
| --- | --- |
| Preserve silver surfaces, graphite type, Ember actions and existing component rules | Current Annora Studio and the verified W31 seller project are the visual authority. This is an extension within that interface. |
| Use one collapsed activity area in the existing project | User requirement to reduce navigation and reveal secondary information on demand. The existing status remains responsible for the next action. |
| Keep quiet dates and compact vertical rhythm | [Linear changelog](https://linear.app/changelog), inspected through Refero: date hierarchy and compact spacing only. No new palette or page architecture. |
| Separate records with neutral rules and restrained controls | [Attio](https://attio.com), inspected through Refero: row separators and quiet control treatment only. |
| Show action, actor and time in a flat list | [Marathon activity reference](https://refero.design/pages/fb7c9dd7-32d0-4a86-8c6e-6a57fc333161): chronological activity structure without individual heavy cards. |
| Keep optional observations separate from saved actions | [Visitors reference](https://refero.design/pages/c43c04b2-b71a-4124-96b4-eaa3ecd60790) informs the distinction between observation data and business records. Customer profiles, heatmaps and revenue claims are deliberately outside this slice. |
| Stack metadata and wrap exact identifiers on mobile | Existing Annora responsive behavior and minimum 44px disclosure controls. Source details stay behind an explicit disclosure. |

## Scope and acceptance

The [API and evidence contract](project-evidence.md) defines safe envelopes,
namespace provenance, storage/retention limits, idempotency, unavailable states
and future host seams. Confirmed records derive from repository reads; optional
observations cannot mutate a project or block its workflow.

F6-07–10 passed in focused tests and compiled journeys. The [acceptance record](evidence/project-activity/acceptance.json) preserves the checks; publication is separate.

- Public GitHub Pages: desktop 1280px and mobile 390px each passed 25 checkpoints, including failed observation writes and unreadable-history recovery. Public Studio and Product Room entry hashes matched the compiled build.
- Required verification: 905 tests, 904 passed, one existing conditional skip, no failures; asset validation, production and bounded inquiry builds passed.
- Compiled crank journeys: 25 checkpoints each at 390px and 320px, including optional-storage failure and unknown-schema preservation.
- Compiled SK08 A→B: 15 checkpoints at 1280px, preserving original questions, inquiry and v1.
- Existing walkthrough: desktop, mobile and compact profiles each passed 21 checkpoints and eight explicit confirmations.
- Visual checks at 1280px, 390px and 320px: no horizontal overflow; disclosure targets at least 44px.

The following invariants were checked:

- Retry and reload do not double-count a confirmed operation or the same optional
  observation within the retained deduplication window.
- Failed project persistence produces no confirmed fact. Failed optional evidence
  storage leaves navigation, inquiry and quotation actions usable.
- Sample/presenter/ordinary provenance remains distinct from buyer/seller roles.
- Typed content, contact details, review tokens, prices, source URLs, camera state
  and raw assets never enter the event envelopes.
- Unknown/legacy/corrupt history and unavailable denominators remain explicit.
- SK08 A→B and the existing crank question/quotation paths retain their exact
  historical versions, confirmations and ordinary project storage.
- Desktop, phone and compact-phone evidence disclosures remain readable without
  horizontal overflow; original primary actions remain available.
- Required repository checks, compiled subpath verification and public-target
  replay identify the exact candidate and deployed assets.

## Limits

This increment uses fake/browser-local records and a local optional adapter. It
adds no backend, account integration, external messages, cross-browser sharing or
production telemetry. It does not measure customer comprehension or performance
on customer hardware. Story start/completion and pre-submission inquiry-review
instrumentation remain deferred; their occurrence is never reconstructed from
saved navigation state.
