import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkCoverage } from "./coverage.mjs";
import { git, snapshot, renamedFiles } from "./git.mjs";

const escape = (text) =>
  String(text)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(",", "%2C")
    .replaceAll(":", "%3A");
try {
  const repo = resolve(process.env.COVERAGE_REPOSITORY || ".");
  const baseInput = process.env.COVERAGE_BASE;
  const headInput = process.env.COVERAGE_HEAD || "HEAD";
  if (!baseInput || !/^[a-f0-9]{40}$/.test(baseInput))
    throw new Error("COVERAGE_BASE must be a full commit SHA; fetch the PR base history first");
  const head = git(repo, ["rev-parse", "--verify", `${headInput}^{commit}`]).trim();
  const base = git(repo, ["merge-base", baseInput, head]).trim();
  const baseFiles = snapshot(repo, base);
  const headFiles = snapshot(repo, head);
  const configPath = process.env.COVERAGE_CONFIG || ".storybook-coverage.json";
  const text = headFiles.get(configPath);
  if (!text)
    throw new Error(
      `Missing ${configPath}. Configure component and story globs before enabling the check.`,
    );
  const result = checkCoverage(
    baseFiles,
    headFiles,
    renamedFiles(repo, base, head),
    JSON.parse(text),
  );
  for (const item of result.missing) {
    console.error(
      `::error file=${escape(item.file)},line=${item.line},title=Missing Storybook coverage::${escape(`${item.export} needs a story that renders it. Add a named CSF story using meta.component or render, or document an exact file/export exception with a reason in ${configPath}.`)}`,
    );
  }
  const summary = `Story coverage: ${result.checked} component exports checked, ${result.storyFiles} story files, ${result.missing.length} missing.\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.exitCode = result.missing.length ? 1 : 0;
} catch (error) {
  console.error(`::error title=Story coverage could not run::${escape(error.message)}`);
  process.exitCode = 1;
}
