#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProject, containedFile } from "./lib/project-config.mjs";
import {
  normalizeDrawingPackage,
  releaseDiagnostic,
} from "../src/drawings/package.js";
const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const { models } = await loadProject(root),
    directory = resolve(root, "content/drawings");
  let directories = [];
  try {
    directories = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let count = 0;
  for (const item of directories.filter((item) => item.isDirectory())) {
    const folder = resolve(directory, item.name),
      names = await readdir(folder);
    if (!names.includes("package.json")) continue;
    for (const name of names.filter(
      (name) => name === "package.json" || /^release-.*\.json$/.test(name),
    )) {
      const file = resolve(folder, name),
        input = JSON.parse(await readFile(file, "utf8"));
      const pkg = normalizeDrawingPackage(input.packageSnapshot || input),
        model = models.find((model) => model.manifest.id === pkg.modelId);
      if (model) {
        const diagnostic = releaseDiagnostic(pkg, {
          modelRevision: model.revision,
          partIds: model.metadata.parts.map((part) => part.id),
        });
        if (!diagnostic.valid)
          throw new Error(
            `${name}: ${diagnostic.issues
              .filter((issue) => issue.severity === "error")
              .map((issue) => issue.message)
              .join("; ")}`,
          );
      }
      for (const asset of pkg.assets) {
        const assetFile = await containedFile(
          root,
          dirname(file),
          asset.file,
          asset.id,
        );
        const sha = createHash("sha256")
          .update(await readFile(assetFile))
          .digest("hex");
        if (sha !== asset.sha256)
          throw new Error(`${pkg.id}: source hash mismatch for ${asset.id}`);
      }
      count++;
    }
    const base = JSON.parse(
      await readFile(resolve(folder, "package.json"), "utf8"),
    );
    console.log(
      `${item.name}: exact source bytes verified${models.some((model) => model.manifest.id === base.modelId) ? "; configured model associations verified" : "; model not configured (document-only)"}`,
    );
  }
  console.log(`${count} drawing package/release snapshot(s) verified.`);
} catch (error) {
  console.error(`Drawing check failed: ${error.message}`);
  process.exitCode = 1;
}
