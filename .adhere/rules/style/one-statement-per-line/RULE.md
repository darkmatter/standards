---
description: Every statement must start on its own line, with the body of an `if` or loop on the lines after its condition, and that condition must be one check or a call to a named predicate; never put a body on its condition's line, even after a single check, or join checks with `&&` or `||` inside a condition.
---

A condition made of joined checks makes the reader work out what the checks
mean together. A named predicate states it. `if (isAuthorized(user))` says
what `if (user.isAdmin || content.visibility === "public" || content.shares.includes(user.id))`
only implies. Two checks are enough to break the rule, in an `if`, an
`else if`, or a `while` or `for` condition. That holds with or without
braces, and with or without parentheses or a negation around them, as in
`if ((name === "Pick" || name === "Omit") && isBuiltIn(name, environment))`,
`if (name === "Record" && isBuiltIn(name, environment))`, or
`} else if (entry.name === "bun.lock" && dir !== base) {`. Checks joined
inside an inline callback in the condition count too, as in
`if (roots.some((root) => root.length === 0 || root.endsWith("/**"))) {`.
A comparison, a call, and a property test each count as a check.

A body on its condition's line puts two statements on one line. This holds
for a guard clause with a single check, and for one whose check already
calls a named predicate: `if (!root) throw new Error("Missing #root");`,
`if (values.length === 0) return null`, and
`if (!containsForbiddenSymbolName(node.name)) return;` all break the rule.
A `return`, `continue`, `break`, or `throw` at the end of the line also
hides a jump in control flow. Give the body braces and a line of its own.
Other statements on one line, such as `a(); b();`, break the rule too.

These are not violations:

- The returned expression of a named predicate function, which is where
  joined checks belong, as in `return command.includes("/") || command.includes("\\");`.
- A single check, including a negated check or a call with arguments, with
  its body on the following lines, as in `if (!(error instanceof Error)) {`.
- A conditional expression that picks a value, as in
  `const resolvedPath = path.isAbsolute(ocxBin) ? ocxBin : path.resolve(baseDirectory, ocxBin);`.
- `??` and `?.`, which pick a value rather than join checks.
- A callback outside any condition, as in
  `.filter((line) => line.length > 0 && !line.startsWith("#"))`: its
  returned expression is not an `if` or loop condition.

## Must

```ts
export function isPathLikeCommand(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

if (isPathLikeCommand(ocxBin)) {
  const resolvedPath = path.isAbsolute(ocxBin) ? ocxBin : path.resolve(baseDirectory, ocxBin);
  return Result.ok(resolvedPath);
}

const resolvedFromPath = resolveExecutable(ocxBin);
if (!resolvedFromPath) {
  return Result.err(`Configured OCX binary "${ocxBin}" is not available in PATH.`);
}
```

## Never

```ts
const rootSrc = path.join(ROOT, "src");
if (await exists(rootSrc)) roots.push(rootSrc);

for (const entry of await readdir(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "scripts") {
    continue;
  }
  const src = path.join(ROOT, entry.name, "src");
  const pj = path.join(ROOT, entry.name, "package.json");
  if ((await exists(src)) && (await exists(pj))) roots.push(src);
}
```
