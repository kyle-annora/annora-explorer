import test from "node:test";
import assert from "node:assert/strict";
import { readRoute, routeHash } from "../src/studio/navigation.js";

test("customer project links preserve version, tab, and edit or review location", () => {
  for (const mode of [
    "detail",
    "edit",
    "quote-review",
    "reply",
    "reply-review",
    "ack",
    "ack-review",
  ]) {
    const route = {
      page: "project",
      id: "PRJ-DEMO-ABC",
      tab: "quotation",
      quote: "Q DEMO / v1",
      mode,
    };
    const roundtrip = readRoute(routeHash(route));
    for (const key of Object.keys(route))
      assert.equal(roundtrip[key], route[key]);
  }
});

test("older customer project links remain valid, unsupported view values are normalized", () => {
  assert.deepEqual(readRoute("#project?id=PRJ-1"), {
    page: "project",
    section: "product",
    id: "PRJ-1",
    tab: "inquiry",
    mode: "detail",
    quote: "",
    draft: "",
  });
  const invalid = readRoute("#project?id=PRJ-1&tab=admin&mode=issue");
  assert.equal(invalid.tab, "inquiry");
  assert.equal(invalid.mode, "detail");
});

test("product editing and release URLs keep their existing shape", () => {
  assert.equal(routeHash({ page: "edit", section: "parts" }), "#edit/parts");
  assert.equal(routeHash({ page: "release", id: "r-2" }), "#release?id=r-2");
  assert.equal(readRoute("#preview?id=preview-1").id, "preview-1");
});

test("editing links bind the saved draft identity while issued views omit it", () => {
  const edit = {
    page: "project",
    id: "P1",
    mode: "quote-review",
    tab: "quotation",
    draft: "QD-1",
  };
  assert.equal(readRoute(routeHash(edit)).draft, "QD-1");
  assert.equal(readRoute(routeHash({ ...edit, mode: "detail" })).draft, "");
});
