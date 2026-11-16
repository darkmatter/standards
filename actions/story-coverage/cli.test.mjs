import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const entry = fileURLToPath(new URL("./check.mjs", import.meta.url));
test("CLI fails missing coverage, passes direct stories, and fails a story-only deletion", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "story-coverage-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  const run = (base) =>
    spawnSync(process.execPath, [entry], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        COVERAGE_BASE: base,
        COVERAGE_REPOSITORY: dir,
        COVERAGE_CONFIG: ".storybook-coverage.json",
        COVERAGE_HEAD: "HEAD",
        GITHUB_STEP_SUMMARY: "",
      },
    });
  git("init", "-q");
  writeFileSync(
    join(dir, ".storybook-coverage.json"),
    JSON.stringify({ components: ["src/**/*.tsx"], stories: ["src/**/*.stories.tsx"] }),
  );
  const initial = commit();
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/Button.tsx"), "export const Button = () => <button/>;");
  commit();
  const missing = run(initial);
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stderr, /file=src\/Button.tsx,line=1/);
  writeFileSync(
    join(dir, "src/Button.stories.tsx"),
    "import { Button } from './Button'; export default { component: Button }; export const Default = {};",
  );
  const covered = commit();
  const success = run(initial);
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /1 component exports checked, 1 story files, 0 missing/);
  git("rm", "-q", "src/Button.stories.tsx");
  commit();
  assert.equal(run(covered).status, 1);
});

test("CLI rejects missing history and malformed configuration", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "story-coverage-invalid-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [entry], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, COVERAGE_BASE: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /COVERAGE_BASE must be a full commit SHA/);
});
