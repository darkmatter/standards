# standards

Shared [adhere](https://github.com/darkmatter/adhere) rules for darkmatter's
repositories. Each rule is a Markdown file in `.adhere/`, and a repo that
copies it in has Jev judge its files against it when it runs `adhere lint`.

## Use these rules

List the rules, then copy them into a repo, all of them or one topic or rule:

```sh
adhere list darkmatter/standards
adhere install darkmatter/standards
adhere install darkmatter/standards/style
adhere install darkmatter/standards/style/prefer-small-files
```

The copies land in `.adhere/darkmatter/standards/` and are that repo's own from then
on, to edit or to start other rules from. To take a later version of a rule,
install it again with `--force`, which overwrites local edits.

## Add a rule

Add a Markdown file under `.adhere/<topic>/`; its path is its id. See
[Rules as Markdown files](https://github.com/darkmatter/adhere#rules-as-markdown-files)
and the [rule writing tips](https://github.com/darkmatter/adhere#rule-writing-tips).
`adhere validate` checks each rule's wording and asks Jev whether any two
contradict. CI runs it on every push to main and every pull request.

## Setup

`alchemy.run.ts` creates this repository on GitHub, or adopts it when it
exists, and sets the `TYPESAFE_API_KEY` secret CI's `adhere validate` needs.
Install, which init already did, deploy once, then push:

```sh
npm install
TYPESAFE_API_KEY=... npx alchemy deploy
git init && git add -A && git commit -m "Add shared adhere rules"
git remote add origin git@github.com:darkmatter/standards.git && git push -u origin main
```

Deploying again updates the secret, as after rotating the key.

<!-- adhere:rules:start -->
<a id="adhere-contents"></a>

### Contents

- [Rules](#adhere-rules)
  - [`ci`](#adhere-topic-ci)
    - [`ci/use-self-hosted-runners`](#adhere-rule-ci-use-self-hosted-runners)
  - [`design`](#adhere-topic-design)
    - [`design/effect-declared-dependencies`](#adhere-rule-design-effect-declared-dependencies)
    - [`design/no-speculative-edge-cases`](#adhere-rule-design-no-speculative-edge-cases)
- [Lint settings](#adhere-lint-settings)
- [Custom lint plugins](#adhere-custom-lint-plugins)

<a id="adhere-rules"></a>

### Rules

<a id="adhere-topic-ci"></a>

#### ci

<a id="adhere-rule-ci-use-self-hosted-runners"></a>

<details>
<summary><strong>A workflow job must run on a self-hosted runner label (linux, macos, arc, arc-dind, kvm, or arc-kvm), never on a GitHub-hosted runner such as ubuntu-latest.</strong> <code>ci/use-self-hosted-runners</code></summary>

The organization runs its own runners, labeled `linux`, `macos`, `arc`,
`arc-dind`, `kvm`, and `arc-kvm`. A job's `runs-on` names one of them, alone or
with `self-hosted`, as in `runs-on: [self-hosted, macos]`. GitHub-hosted labels
include `ubuntu-*`, `windows-*`, and `macos-*` with a version or `-latest`. The
bare `macos` label is self-hosted, but `macos-latest` or `macos-14` is
GitHub-hosted. The rule covers workflow YAML anywhere: in `.github/workflows/`,
in strings that generate a workflow, and in docs that show one. A `runs-on`
that comes from a matrix or expression breaks the rule if any value it can take
is a GitHub-hosted label.

<a id="adhere-heading-ci-use-self-hosted-runners-must"></a>

##### Must

```yaml
jobs:
  release:
    runs-on: arc
    steps:
      - uses: actions/checkout@v7
```

<a id="adhere-heading-ci-use-self-hosted-runners-never"></a>

##### Never

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
```

Source: [`ci/use-self-hosted-runners`](./.adhere/rules/ci/use-self-hosted-runners/RULE.md).

</details>

**[↑ Back to contents](#adhere-contents)**

<a id="adhere-topic-design"></a>

#### design

<a id="adhere-rule-design-effect-declared-dependencies"></a>

<details>
<summary><strong>Effect code must obtain each dependency from its context, as a yielded service, <code>Config</code>, or platform service, and must never read it from <code>process</code>, <code>globalThis</code>, or module scope, take a service or <code>Context</code> as a parameter, or create a service class inside a function.</strong> <code>design/effect-declared-dependencies</code></summary>

A dependency that comes from the context appears in the Effect's requirements type. A layer can then replace it in tests or at the entry point. A dependency read from `process` or module scope, or passed in by hand, is hidden from that type, and nothing can substitute it.

Effect code here is a generator passed to `Effect.gen` or `Effect.fn`, a layer, or a function that returns an Effect. It also includes any module-scope value or helper that such code in the same file reads.

This rule covers these cases:

- Reading `process.env` instead of `Config`. Reading `process.cwd()`, `process.platform`, `process.stderr.columns`, or `globalThis` instead of using a platform service such as `Path` or `Terminal`. Each of these breaks the rule inside a service, layer, or workflow, including as a fallback such as `options.root ?? process.cwd()`. It also breaks the rule in a module-scope value or helper that Effect code in the file reads, such as `const columns = () => process.stderr.columns ?? 80`.
- A function that takes a service implementation (`SourceWalker["Service"]`, `FileSystem.FileSystem`) or a `Context.Context<...>` as a parameter and provides or calls it. It should yield the service instead and keep it in its requirements.
- A function that defines and returns a service class, such as `const make = (args) => class Service extends Context.Service<...>()(...)`. A service is declared once, at module scope.

These do not break the rule:

- A function that takes plain values, such as a path, and returns a layer for a service declared at module scope, such as `(base?: string) => Layer.effect(AuditCache)(...)`.
- Constants, schemas, and pure functions imported or declared at module scope. These are not dependencies.
- A plain function that returns a value or a Promise rather than an Effect, when no Effect code in its file calls it, such as `post(name, url, headers, body, signal, fetch = globalThis.fetch)`. A file that imports only `Schema` from `effect` may hold no Effect code at all.
- The program's entry point, where the layers are assembled. A file that passes its main Effect to `BunRuntime.runMain` is one, whether it is the CLI or a script. It may read the process anywhere in that file. That includes module scope, such as `` const platform = `${process.platform}-${process.arch}` ``, and a layer built there, such as one checking `process.stderr.isTTY`. Its functions still must not take a service or a `Context` as a parameter.

<a id="adhere-heading-design-effect-declared-dependencies-must"></a>

##### Must

```ts
export const JevLive = Layer.effect(Jev)(
  Effect.gen(function* () {
    const config = yield* AdhereConfig;
    const credentials = yield* Credentials;
    const fetch = yield* FetchHttpClient.Fetch;
    const limiter = yield* RateLimiter.RateLimiter;

    const provider: Provider = config.provider ?? jev({ model: config.model, fetch });
  }),
);
```

<a id="adhere-heading-design-effect-declared-dependencies-never"></a>

##### Never

```ts
Effect.gen(function* () {
  const walker = yield* SourceWalker;
  const files = yield* walker.files;
  const root = options.root ?? process.cwd();
});
```

Source: [`design/effect-declared-dependencies`](./.adhere/rules/design/effect-declared-dependencies/RULE.md).

</details>

<a id="adhere-rule-design-no-speculative-edge-cases"></a>

<details>
<summary><strong>Code should handle only the cases its real inputs produce, and should not handle edge cases those inputs do not produce, such as unused corners of a format or a recheck of what the program's own code already guarantees.</strong> <code>design/no-speculative-edge-cases</code></summary>

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

<a id="adhere-heading-design-no-speculative-edge-cases-should"></a>

##### Should

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

<a id="adhere-heading-design-no-speculative-edge-cases-should-not"></a>

##### Should not

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

Source: [`design/no-speculative-edge-cases`](./.adhere/rules/design/no-speculative-edge-cases/RULE.md).

</details>

**[↑ Back to contents](#adhere-contents)**

<a id="adhere-lint-settings"></a>

### Lint settings

- None.

<a id="adhere-custom-lint-plugins"></a>

### Custom lint plugins

- None.

**[↑ Back to contents](#adhere-contents)**
<!-- adhere:rules:end -->
