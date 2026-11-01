import { STUDIO_PRODUCT_ID, STUDIO_PARTS } from "./seed.js";

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
export const readRoute = () => {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const [page, section] = (path || "products").split("/");
  return {
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
    id: new URLSearchParams(query).get("id") || "",
  };
};
export const routeHash = (route) =>
  `#${route.page}${route.page === "edit" ? `/${route.section || "product"}` : ""}${route.id ? `?id=${encodeURIComponent(route.id)}` : ""}`;
export const roomURL = ({ preview, release, page = "overview" } = {}) => {
  const url = new URL("../product-room/", location.href);
  url.searchParams.set("model", STUDIO_PRODUCT_ID);
  if (preview) url.searchParams.set("studioPreview", preview);
  if (release) url.searchParams.set("release", release);
  url.hash = page;
  return url.href;
};
export const partOptions = () => [
  ["", "Whole product"],
  ...STUDIO_PARTS.map((part) => [part.id, part.title]),
];
