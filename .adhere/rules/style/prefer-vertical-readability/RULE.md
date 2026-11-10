---
description: Code should present one meaningful step per line and name cohesive decisions or transformations, and should not bury them in dense expressions or inline compound conditions.
---

Favor vertical reading: readers should follow named steps without unpacking several operations inside one expression. Extract a cohesive group when a meaningful name explains its purpose, not merely to shorten a line.

Code breaks this rule when it:
- Embeds a compound decision directly in control flow instead of naming the decision, such as recognizing a keyboard shortcut inside an `if`.
- Combines matching, collection conversion, mapping, and package-name parsing in one expression instead of separating those steps and naming the parsing operation.
- Resolves alternative data shapes through a ternary containing casts, optional access, and fallback selection instead of a named operation with clear branches. Wrapping that expression across lines is not enough.

Do not require a helper for every operator or callback. An already-named, cohesive predicate may remain compact: `isRecord` can combine an object check, a null check, and an array exclusion. A named path-selection predicate can combine its inclusion and exclusion checks vertically without naming every check separately.

A transformation pipeline with each filtering or mapping stage on its own line is also acceptable. Small callbacks may combine closely related checks, such as excluding the current root while checking containment. Neither boolean-operator counts nor line length alone determine a violation.

## Should

```ts
const isSearchShortcut = (event: KeyboardEvent) =>
  event.key === "k" &&
  (event.metaKey || event.ctrlKey);

const onKey = (event: KeyboardEvent) => {
  if (isSearchShortcut(event)) {
    event.preventDefault();
    search.current?.focus();
  }
};
```

## Should not

```ts
const onKey = (event: KeyboardEvent) => {
  if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    search.current?.focus();
  }
};
```
