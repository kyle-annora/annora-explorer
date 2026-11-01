import { STUDIO_PRODUCT_ID, STUDIO_PARTS } from "./seed.js";
import {
  readWalkthroughSession,
  withWalkthroughSession,
} from "../walkthrough/session.js";

export const copy = (value) => JSON.parse(JSON.stringify(value));
export const sections = [
  { id: "product", title: "Product information", short: "Product" },
  { id: "parts", title: "Parts & documents", short: "Parts & docs" },
  { id: "presentation", title: "Presentation", short: "Presentation" },
  { id: "inquiry", title: "Inquiry setup", short: "Inquiry" },
];
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not saved yet";
export const customerTabs = ["inquiry", "quotation", "conversation"];
export const customerModes = [
  "detail",
  "edit",
  "quote-review",
  "reply",
  "reply-review",
  "ack",
  "ack-review",
];
export const readRoute = (hash = location.hash) => {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [page, section] = (path || "products").split("/");
  const params = new URLSearchParams(query);
  const route = {
    page: [
      "products",
      "edit",
      "preview",
      "release",
      "projects",
      "project",
    ].includes(page)
      ? page
      : "products",
    section: sections.some((s) => s.id === section) ? section : "product",
    id: params.get("id") || "",
  };
  if (route.page === "project") {
    route.tab = customerTabs.includes(params.get("tab"))
      ? params.get("tab")
      : "inquiry";
    route.mode = customerModes.includes(params.get("mode"))
      ? params.get("mode")
      : "detail";
    route.quote = params.get("quote") || "";
    route.draft = params.get("draft") || "";
  }
  return route;
};
export const routeHash = (route) => {
  const query = new URLSearchParams();
  if (route.id) query.set("id", route.id);
  if (route.page === "project") {
    if (customerTabs.includes(route.tab)) query.set("tab", route.tab);
    if (customerModes.includes(route.mode) && route.mode !== "detail")
      query.set("mode", route.mode);
    if (route.quote) query.set("quote", route.quote);
    if (route.mode !== "detail" && route.draft) query.set("draft", route.draft);
  }
  return `#${route.page}${route.page === "edit" ? `/${route.section || "product"}` : ""}${query.size ? `?${query}` : ""}`;
};
export const roomURL = ({ preview, release, page = "overview" } = {}) => {
  const url = new URL("../product-room/", location.href);
  url.searchParams.set("model", STUDIO_PRODUCT_ID);
  if (preview) url.searchParams.set("studioPreview", preview);
  if (release) url.searchParams.set("release", release);
  url.hash = page;
  const session = readWalkthroughSession();
  return (session ? withWalkthroughSession(url, session) : url).href;
};
export const partOptions = () => [
  ["", "Whole product"],
  ...STUDIO_PARTS.map((part) => [part.id, part.title]),
];
