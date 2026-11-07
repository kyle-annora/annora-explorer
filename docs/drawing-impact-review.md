# SK08 drawing impact — delivery review

Status: implementation and compiled verification passed. Publication is recorded separately in the release receipt.

## Review route

[Open the SK08 seller example](https://kyle-annora.github.io/annora-explorer/studio/?impactDemo=sk08-a-b-v1) · [Open the buyer project](https://kyle-annora.github.io/annora-explorer/product-room/?impactDemo=sk08-a-b-v1)

Use the same browser for both roles. The isolated example already contains an A inquiry, three resolved questions, quotation v1 on A and a saved draft for the next quotation. Everything is fictional; nothing is transmitted to a supplier.

1. In the seller project, open **Drawing change impact** and choose the published B example.
2. Check affected work. The two drawing questions and two drawing scope items appear. The online handoff remains unaffected.
3. Inspect the previous and candidate drawings. For each scope item, choose the intended detail, explain the decision and select its quotation lines. Retain A for one question to demonstrate independent references.
4. Review all decisions, check the explicit confirmation and apply the impact. This updates the working draft while preserving its commercial terms. It does not issue a quotation.
5. Continue the draft. Review the commercial terms and update any wording that still names A where the accepted scope now uses B; the impact check deliberately preserves those terms. Review the complete customer-facing quotation, then explicitly issue v2.
6. Switch to the buyer. Compare v1 and v2; open each exact drawing and the individual reviewed references. The inquiry and original question history remain A. Reload to verify persistence.

## Design decisions

The current Annora Studio/Product Room is the visual authority: silver surfaces, graphite text, Ember actions, compact lists and fixed separators. The established [Linear activity reference](https://refero.design/pages/13774021-f998-4003-849d-ad1533489547) informs separation of immutable history from current work. The [Slab comparison reference](https://refero.design/pages/0cf40735-f75f-49db-b156-433364ade083) contributes aligned comparison rows only. Neither reference supplies a new palette or global navigation.

Only one affected item expands at a time. Old/candidate previews are opened on demand. On phones the reference pair and review rows stack; the final action follows the complete review and confirmation. This reuses the existing seller workspace instead of adding another top-level tab.

## Acceptance record

- `npm run verify`: 880 tests, 879 passed, one existing conditional skip, no failures; assets and production build passed. The bounded inquiry bundle also builds.
- Compiled repository subpath: 1280px, 390px and 320px completed 15 checkpoints each. Actual A/B previews, four dependent records, independent retained-A/adopted-B decisions, reviewed v2, exact B-to-3D return and reload passed without JavaScript errors or horizontal overflow.
- 390px concurrent-tab and failed-storage checks preserved decisions, invalidated stale review and recovered on retry. 320px touch actions were measured at least 44px.
- The prior crank independent-question journey and all three existing commercial walkthrough profiles passed. Each walkthrough retained 21 checkpoints and eight explicit confirmations.
- New questions added after B adoption require their own reference review; removed quote-line mappings block issue until repaired. Corrupt/dropped impact evidence and lossy adapters fail explicitly.
- `src/explorer/` has no changes. Normal project storage is unchanged.

The [acceptance record](evidence/drawing-impact/acceptance.json) preserves checks. The release receipt records publication separately; see it for the exact deployed commit, workflow and public-target verification.

## Limits

The B document rearranges views and includes a review note; it is not a new manufacturing design. This example demonstrates human-controlled reference impact, not automatic engineering equivalence. No backend, accounts, emails or real customer data were added. Hardware performance claims require testing on representative customer devices; this increment does not alter the Explorer renderer.

[API and data contract](drawing-impact.md) · [Program scope](product-expansion/scope.md)
