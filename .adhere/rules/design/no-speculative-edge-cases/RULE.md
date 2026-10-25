---
description: Code should handle only the cases its real inputs produce, and should not handle edge cases those inputs do not produce, such as unused corners of a format or a recheck of what the program's own code already guarantees.
---

Every branch for a case that does not happen is code someone has to read, test,
and keep working, and it hides which cases matter. Leaving the case out costs
less than carrying it. The rule holds for every line in the file, old or new:
speculative handling already in the code is a finding too.

Speculative handling looks like parsing every form a spec allows when the
inputs use one, such as tilde fences, indented headings, or closing `#` runs in
Markdown whose format the project defines, or `\u{...}` and `\x..` escapes in
an import's module name. It also looks like a fallback for a value that cannot
occur, such as a code point above 0x10FFFF, or validating again what the
program's own launcher or caller already chose.

A case the program does meet is not an edge case, however rare it looks: the
platforms it runs on (Windows names the home directory `USERPROFILE`), the file
system it walks (a directory can be a symbolic link), or a dependency that can
return less than it was given. Handling those is a requirement.

## Should

```ts
export const adhereConfigDirectory = (path: Path.Path) =>
  Config.NonEmptyString("XDG_CONFIG_HOME").pipe(
    Config.orElse(() =>
      Config.NonEmptyString("HOME").pipe(
        Config.orElse(() => Config.NonEmptyString("USERPROFILE")),
        Config.map((home) => path.join(home, ".config")),
      ),
    ),
    Config.map((configHome) => path.join(configHome, "adhere")),
  );
```

## Should not

```ts
const specifierOf = (token: Token): string => {
  const body = token.text.slice(1, -1);
  return body.replace(
    /\\(u\{[\da-fA-F]{1,6}\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|[\s\S])/g,
    (_, escaped: string) => {
      if (/^(?:u\{|u[\da-fA-F]{4}$|x[\da-fA-F]{2}$)/.test(escaped)) {
        const point = Number.parseInt(
          escaped.startsWith("u{") ? escaped.slice(2, -1) : escaped.slice(1),
          16,
        );
        return point <= 0x10ffff ? String.fromCodePoint(point) : `\\${escaped}`;
      }
      return ESCAPES[escaped] ?? escaped;
    },
  );
};
```
