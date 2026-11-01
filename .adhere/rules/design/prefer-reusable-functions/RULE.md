---
description: A helper that does a general job, one that other modules need too, should be exported from one module and imported where it is needed, and should not be defined privately in the file that first needed it.
---

A general job is one that is not this file's own work. Examples are making a
path relative to a root, running git, reading whether an Oxlint rule setting is
on, and matching the pattern of a rule id. A private copy of a helper like this
is how the same two lines end up in three files. A constant for a general job,
such as that rule id pattern, follows the same rule. Tying a general helper to
this file's own error type does not make the job this file's own. For example,
a `git` runner that fails with this file's error is still a git runner.

Only the file is shown, so judge each helper by the job it does, not by whether
a copy is visible. A private helper is fine when its job belongs to this file
alone: it takes the file's own types and serves the file's one flow. An example
is running a generated test file with this file's test runtime and timeout. An
exported helper that other modules import follows the rule, even when it is one
line built on a shared function.

`dependents` lists the files that import this one. An exported helper in a file
with dependents is already shared.

## Should

```ts
export const failed = (name: string, response: Response, text: string): RequestFailed => {
  const ray = response.headers.get("cf-ray");
  const detail = text.trim().replace(/\s+/g, " ").slice(0, 300);
  return new RequestFailed(
    `${name} answered HTTP ${response.status}${ray === null ? "" : `, Ray ID ${ray}`}${detail === "" ? "" : `: ${detail}`}`,
    response.status,
  );
};
```

## Should not

```ts
const displayPath = (file: string, root: string): string =>
  file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
```
