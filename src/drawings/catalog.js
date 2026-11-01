import { MODEL_CATALOG } from "../generated/catalog.js";
import { normalizeDrawingPackage, releaseDiagnostic } from "./package.js";
import { resolveDrawingAssets } from "../studio/drawing-asset-store.js";

// Discovery is data-driven. A prepared model and package can be added without
// adding a product branch to the Explorer, document reader or seller workspace.
const packages = import.meta.glob("../../content/drawings/*/package.json", {
  eager: true,
  import: "default",
});
const metadata = import.meta.glob("../../content/models/*/metadata.json", {
  eager: true,
  import: "default",
});
const files = import.meta.glob(
  "../../content/drawings/**/*.{pdf,svg,step,stp}",
  { eager: true, query: "?url", import: "default" },
);
export const DRAWING_CATALOG = Object.values(packages).map((input) => {
  const path = Object.keys(packages).find((key) => packages[key] === input);
  const directory = path.slice(0, path.lastIndexOf("/") + 1);
  const configured = MODEL_CATALOG[input.modelId];
  const data =
    metadata[
      `../../content/models/${configured?.packageId || input.modelId}/metadata.json`
    ];
  const assets = Object.fromEntries(
    input.assets.map((asset) => [asset.id, files[directory + asset.file]]),
  );
  const pkg = normalizeDrawingPackage(input, { assetURLs: assets });
  const model = {
    ...configured,
    id: input.modelId,
    parts: data?.parts || [],
    groups: data?.groups || [],
    bounds: data?.bounds,
  };
  const diagnostic = releaseDiagnostic(pkg, {
    partIds: model.parts.map((part) => part.id),
    modelRevision: model.revision,
  });
  return {
    id: input.modelId,
    title: configured?.shortTitle || input.title,
    package: pkg,
    assets,
    model,
    available: Boolean(configured && diagnostic.valid),
    diagnostic,
  };
});
export const drawingEntry = (id) =>
  DRAWING_CATALOG.find((entry) => entry.id === id);

/** A saved release may change association data, never silently replace sources.
 * URLs are resolved against hash-identical bundled files, not trusted storage. */
export function entryForSnapshot(entry, snapshot) {
  if (
    !entry ||
    snapshot.modelId !== entry.model.id ||
    snapshot.modelRevision !== entry.model.revision
  )
    throw new Error(
      "This saved drawing model version is unavailable. Its original record is preserved.",
    );
  const assets = {};
  for (const asset of snapshot.assets) {
    const source = entry.package.assets.find(
      (item) =>
        item.id === asset.id &&
        item.sha256 === asset.sha256 &&
        item.kind === asset.kind,
    );
    if (!source || !entry.assets[source.id])
      throw new Error(
        "This saved drawing file version is unavailable. The current file will not replace it.",
      );
    assets[asset.id] = entry.assets[source.id];
  }
  return {
    ...entry,
    assets,
    package: normalizeDrawingPackage(snapshot, { assetURLs: assets }),
  };
}

const staticReleases = import.meta.glob(
  "../../content/drawings/*/release-*.json",
  { eager: true, import: "default" },
);
export const DRAWING_RELEASES = Object.values(staticReleases);
export function resolveDrawingRelease(id) {
  return DRAWING_RELEASES.find((record) => record.id === id);
}

/** Async host boundary for immutable uploaded files and archived bundled editions.
 * The returned object owns URL leases; dispose it after its readers are disposed. */
export async function resolveDrawingEntry(entry, snapshot) {
  if (!entry || snapshot.modelId !== entry.model.id || snapshot.modelRevision !== entry.model.revision)
    throw new Error("This saved model version is unavailable. Its drawing record is preserved.");
  const lease = await resolveDrawingAssets(snapshot, {
    resolveBundledAsset(asset) {
      const sources = [
        ...Object.entries(packages).map(([path, pkg]) => ({ path, pkg })),
        ...Object.entries(staticReleases).map(([path, record]) => ({ path, pkg: record.packageSnapshot })),
      ];
      for (const { path, pkg } of sources) {
        const known = pkg?.assets?.find(item => item.sha256 === asset.sha256 && item.kind === asset.kind);
        if (known) {
          const url = files[path.slice(0, path.lastIndexOf('/') + 1) + known.file];
          if (url) return url;
        }
      }
      return null;
    },
  });
  try {
    const pkg = normalizeDrawingPackage(lease.package, { assetURLs: lease.assets });
    const diagnostic = releaseDiagnostic(pkg, { partIds: entry.model.parts.map(part => part.id), modelRevision: entry.model.revision });
    return { ...entry, package: pkg, assets: lease.assets, diagnostic, available: diagnostic.valid, dispose: lease.dispose };
  } catch (error) { lease.dispose(); throw error; }
}
