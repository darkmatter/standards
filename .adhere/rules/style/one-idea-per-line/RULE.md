---
description: A condition that combines several distinct checks should be named by a predicate function or constant that states the idea, and should not be written inline where its result is used.
---

People read code top to bottom more easily than left to right. A condition
that chains several different checks with `&&` or `||` makes the reader hold
every check in mind at once to work out what it means. A name such as
`isBuiltin(name)` or `isNotFound(e)` says the idea in one word. Move the
checks into a predicate function or a named `const`, and use the name in the
condition.

What counts as distinct checks: tests of different properties or methods, or
different kinds of test, combined in one expression. For example, a type-guard
chain like `e && typeof e === "object" && "code" in e && e.code === "ENOENT"`,
or `startsWith` calls mixed with an `includes` lookup. Splitting such a
condition across several lines does not fix it. It still needs a name.

An inline use is anywhere the result is consumed directly: an `if`, an
early-return guard, a ternary, or an anonymous callback passed to `find`,
`filter`, `some`, or `every` whose body chains several distinct checks. Name
the callback too, as in `.find(isFileDescription)`.

These cases already follow the rule:

- The compound expression is the whole body of a named predicate or the
  initializer of a named `const`. There the expression defines the name and
  is not an inline use.
- The same check is repeated across sibling values, such as
  `!accessKeyId || !secretAccessKey || !sessionToken || !expiration`. That
  reads as one idea: one of the values is missing.
- The condition is a single call, comparison, or negation, such as
  `if (!(await pathExists(src)))`.

## Should

```ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};
```

## Should not

```ts
if (name.startsWith("node:") || name.startsWith("bun:") || builtinModules.includes(name)) {
  return "builtin";
}
```
