import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCoverage } from "./coverage.mjs";

const config = {
  components: ["src/**/*.{ts,tsx,js,jsx}"],
  stories: ["src/**/*.stories.{ts,tsx,js,jsx}"],
};
const button = "export const Button = () => <button>OK</button>;";
const story = `import { Button } from './Button'; const meta = { component: Button }; export default meta; export const Default = {};`;
const files = (entries) => new Map(Object.entries(entries));
const check = (head, base = {}, options = config, renames = new Map()) =>
  checkCoverage(files(base), files(head), renames, options);

test("new exported JSX needs a story; private helpers do not", () => {
  assert.deepEqual(
    check({ "src/Button.tsx": button }).missing.map((item) => item.export),
    ["Button"],
  );
  assert.equal(check({ "src/Button.tsx": "const Button = () => <button/>;" }).checked, 0);
});
test("CSF metadata, satisfies, aliased imports and a real named story cover a component", () => {
  const result = check({
    "src/Button.tsx": button,
    "src/Button.stories.tsx": story
      .replace("{ Button }", "{ Button as Subject }")
      .replace("component: Button", "component: Subject")
      .replace("}; export default", "} satisfies Meta<typeof Subject>; export default"),
  });
  assert.deepEqual(result.missing, []);
});
test("an empty, unrelated or type-only story does not cover a component", () => {
  for (const text of [
    "",
    "export default {}; export const Default = {};",
    "export default {}; export type Default = {};",
    story.replace("export const Default = {};", ""),
  ]) {
    assert.equal(
      check({ "src/Button.tsx": button, "src/Button.stories.tsx": text }).missing.length,
      1,
    );
  }
});
test("render overrides metadata; an unrelated render does not prove coverage", () => {
  assert.equal(
    check({
      "src/Button.tsx": button,
      "src/Button.stories.tsx": story.replace("Default = {}", "Default = { render: () => <div/> }"),
    }).missing.length,
    1,
  );
});
test("explicit render and composition through imports cover nested components", () => {
  assert.deepEqual(
    check({
      "src/Button.tsx": button,
      "src/Panel.tsx": `import { Button } from './Button'; export const Panel = () => <Button/>;`,
      "src/Panel.stories.tsx": `import { Panel } from './Panel'; export default { title: 'Panel' }; export const Default = { render: () => <Panel/> };`,
    }).missing,
    [],
  );
});
test("existing gaps are grandfathered, but new exports in existing files are checked", () => {
  const base = { "src/Button.tsx": button };
  assert.equal(check(base, base).checked, 0);
  assert.deepEqual(
    check(
      { "src/Button.tsx": button + "export function Other() { return <div/>; }" },
      base,
    ).missing.map((item) => item.export),
    ["Other"],
  );
});
test("deleting or breaking stories alone loses previously established coverage", () => {
  const base = { "src/Button.tsx": button, "src/Button.stories.tsx": story };
  assert.equal(check({ "src/Button.tsx": button }, base).missing.length, 1);
  assert.equal(
    check({ ...base, "src/Button.stories.tsx": "export default {};" }, base).missing.length,
    1,
  );
  assert.deepEqual(check(base, base).missing, []);
});
test("a Git rename does not introduce a legacy component", () => {
  assert.equal(
    check(
      { "src/Renamed.tsx": button },
      { "src/Button.tsx": button },
      config,
      new Map([["src/Renamed.tsx", "src/Button.tsx"]]),
    ).checked,
    0,
  );
});
test("default exports, memo, forwardRef and createElement are candidates", () => {
  for (const text of [
    "export default function Button() { return <button/>; }",
    "export const Button = memo(() => <button/>);",
    "export const Button = forwardRef((props, ref) => <button ref={ref}/>);",
    'export const Button = () => React.createElement("button");',
  ])
    assert.equal(check({ "src/Button.tsx": text }).missing.length, 1);
});
test("tsconfig paths and workspace package exports resolve without installed dependencies", () => {
  const head = {
    "src/Button.tsx": button,
    "src/Button.stories.tsx": story.replace("'./Button'", "'@/Button'"),
    "tsconfig.json": JSON.stringify({
      compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
    }),
  };
  assert.deepEqual(check(head).missing, []);
  assert.deepEqual(
    check({
      ...head,
      "src/Button.stories.tsx": story.replace("'./Button'", "'@acme/ui/Button'"),
      "package.json": JSON.stringify({ name: "@acme/ui", exports: { "./*": "./src/*.tsx" } }),
    }).missing,
    [],
  );
});
test("exact exceptions require a reason; config typos are errors", () => {
  assert.deepEqual(
    check(
      { "src/Button.tsx": button },
      {},
      {
        ...config,
        exceptions: [
          { file: "src/Button.tsx", export: "Button", reason: "Framework-only entrypoint" },
        ],
      },
    ).missing,
    [],
  );
  assert.throws(
    () => check({}, {}, { ...config, exceptions: [{ file: "*", export: "*", reason: "" }] }),
    /reason/,
  );
  assert.throws(() => check({}, {}, { ...config, typo: true }), /Unknown/);
});
test("non-UI changes do not need Storybook; stories outside configured roots do not count", () => {
  assert.equal(check({ "src/math.ts": "export const add = (a, b) => a + b;" }).checked, 0);
  assert.equal(
    check({ "src/Button.tsx": button, "other/Button.stories.tsx": story }).missing.length,
    1,
  );
});
test("anonymous default arrow components need stories", () => {
  assert.equal(check({ "src/Button.tsx": "export default () => <button/>;" }).missing.length, 1);
});
test("includeStories and excludeStories cannot turn helpers into coverage", () => {
  for (const select of ["includeStories: ['Other']", "excludeStories: ['Default']"]) {
    assert.equal(
      check({
        "src/Button.tsx": button,
        "src/Button.stories.tsx": story.replace(
          "component: Button",
          `component: Button, ${select}`,
        ),
      }).missing.length,
      1,
    );
  }
});
test("syntax errors refuse the check instead of silently skipping coverage", () => {
  assert.throws(
    () => check({ "src/Button.tsx": "export const Button = () => <button" }),
    /Cannot parse/,
  );
});
test("workspace tsconfig exports resolve extends from source, without running package code", () => {
  assert.deepEqual(
    check({
      "src/Button.tsx": button,
      "src/Button.stories.tsx": story,
      "tsconfig.json": '{"extends":"@repo/tooling/tsconfig"}',
      "tooling/package.json": '{"name":"@repo/tooling","exports":{"./tsconfig":"./tsconfig.json"}}',
      "tooling/tsconfig.json": '{"compilerOptions":{"strict":true}}',
    }).missing,
    [],
  );
});
test("CSF Next preview.meta and meta.story cover direct and composed components", () => {
  const next = `import { Button } from './Button'; const meta = preview.meta({ component: Button }); export const Default = meta.story({});`;
  assert.deepEqual(check({ "src/Button.tsx": button, "src/Button.stories.tsx": next }).missing, []);
  assert.equal(
    check({
      "src/Button.tsx": button,
      "src/Button.stories.tsx": next.replace(
        "meta.story({})",
        "meta.story({ render: () => <div/> })",
      ),
    }).missing.length,
    1,
  );
});
test("render functions may be referenced by name", () => {
  assert.deepEqual(
    check({
      "src/Button.tsx": button,
      "src/Button.stories.tsx": `import { Button } from './Button'; const Render = () => <Button/>; export default { title: 'Button' }; export const Default = { render: Render };`,
    }).missing,
    [],
  );
});
