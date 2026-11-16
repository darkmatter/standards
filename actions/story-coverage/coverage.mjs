import { matchesGlob } from "node:path";
import { sourceGraph } from "./source.mjs";

const ignored =
  /(?:^|\/)(?:node_modules|vendor|dist|build|__tests__|tests?|e2e)\/|\.(?:test|spec|stories|generated|gen|d)\.[cm]?[jt]sx?$/;
const matches = (file, patterns) => patterns.some((pattern) => matchesGlob(file, pattern));

export function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Story coverage config must be an object");
  if (Object.keys(config).some((key) => !["components", "stories", "exceptions"].includes(key)))
    throw new Error("Unknown story coverage config key");
  for (const key of ["components", "stories"]) {
    if (
      !Array.isArray(config[key]) ||
      !config[key].length ||
      config[key].some((item) => typeof item !== "string" || !item)
    )
      throw new Error(`${key} must be a nonempty array of repository-relative globs`);
  }
  for (const item of config.exceptions ?? []) {
    if (
      !item ||
      typeof item.file !== "string" ||
      typeof item.export !== "string" ||
      typeof item.reason !== "string" ||
      !item.reason.trim()
    )
      throw new Error("Each exception needs file, export, and a nonempty reason");
  }
  return config;
}

/** Recompute from both snapshots on every run, including story-only edits. */
export function checkCoverage(base, head, renames, input) {
  const config = validateConfig(input);
  const eligible = (file) =>
    /\.[jt]sx?$/.test(file) && !ignored.test(file) && matches(file, config.components);
  const roots = (files) =>
    [...files.keys()].filter(
      (file) =>
        eligible(file) || (/\.stories\.[jt]sx?$/.test(file) && matches(file, config.stories)),
    );
  const before = sourceGraph(base, roots(base));
  const after = sourceGraph(head, roots(head));
  const storyFiles = [...head.keys()].filter(
    (file) => /\.stories\.[jt]sx?$/.test(file) && matches(file, config.stories),
  );
  const rendered = new Set(
    storyFiles.flatMap((file) =>
      after.stories(file).flatMap((story) => [...after.renderedBy(story)]),
    ),
  );
  const baseCovered = new Set(
    [...base.keys()]
      .filter((file) => /\.stories\.[jt]sx?$/.test(file) && matches(file, config.stories))
      .flatMap((file) => before.stories(file).flatMap((story) => [...before.renderedBy(story)])),
  );
  const missing = [];
  let checked = 0;
  for (const file of head.keys()) {
    if (!eligible(file)) continue;
    const oldFile = renames.get(file) ?? file;
    const oldComponents = before.components(oldFile);
    for (const component of after.components(file)) {
      const previous = oldComponents.find((item) => item.name === component.name);
      // Protect established coverage when only its stories change, without backfilling legacy gaps.
      if (previous && !baseCovered.has(previous.symbol)) continue;
      checked++;
      if (rendered.has(component.symbol)) continue;
      if (
        (config.exceptions ?? []).some(
          (item) => item.file === file && item.export === component.name,
        )
      )
        continue;
      missing.push({ file, export: component.name, line: component.line });
    }
  }
  return { checked, storyFiles: storyFiles.length, missing };
}
