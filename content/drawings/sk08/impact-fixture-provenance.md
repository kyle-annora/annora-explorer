# SK08 drawing-impact example sources

The isolated `impactDemo=sk08-a-b-v1` workflow uses two prepared release snapshots. Neither replaces `package.json` or changes the deployed model.

- **A:** the existing `reference.pdf`, including its original-source page and enlarged detail page. The release adds explicit fixture pairing evidence. It does not add manufacturing approval.
- **B:** the existing `demo-revision-b.pdf` made by `source-tools/make-demo-revision.py`. Page 1 retains `source.pdf`. Page 2 repositions vector crops of that same source and adds an explicitly fictional bore-inspection review note. The STEP and model bytes are unchanged.

`release-impact-a.json` and `release-impact-b.json` retain exact PDF/STEP hashes. The regular asset check verifies those files. B's page-2 regions are transformed from source page-1 bounds using the crop and destination rectangles in `make-demo-revision.py`, including its proportional fit and centered placement. They are not copied from A's different enlarged layout.

The prepared release pairing and initial project conversation are fictional reviewed demonstration records. They are not evidence of a manufacturer-issued revision, a tolerance, or an engineering decision. The visitor still must manually inspect and confirm every affected commercial reference before B enters the next quotation.

Rebuild the prepared release JSON from the unchanged public source bytes:

```sh
node content/drawings/sk08/source-tools/make-impact-releases.mjs
node scripts/check-drawings.mjs
```

The original A inquiry, question events and quotation remain immutable. The example has two drawing-dependent requests and an independent online-handoff request, so an impact check can demonstrate both affected and unaffected work. Prices remain unprovided. The demo never reads or resets the ordinary project namespace.
