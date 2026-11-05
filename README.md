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
    - [`design/effect-declare-dependencies`](#adhere-rule-design-effect-declare-dependencies)
    - [`design/no-speculative-edge-cases`](#adhere-rule-design-no-speculative-edge-cases)
- [Lint settings](#adhere-lint-settings)
- [Custom lint plugins](#adhere-custom-lint-plugins)

<a id="adhere-rules"></a>

### Rules

<a id="adhere-topic-ci"></a>

#### ci

<a id="adhere-rule-ci-use-self-hosted-runners"></a>

<details>
<summary><h2><code>ci/use-self-hosted-runners</code></h2></summary>

A workflow job must run on a self-hosted runner label (linux, macos, arc, arc-dind, kvm, or arc-kvm), never on a GitHub-hosted runner such as ubuntu-latest.

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

<a id="adhere-rule-design-effect-declare-dependencies"></a>

<details>
<summary><h2><code>design/effect-declare-dependencies</code></h2></summary>

Effect code must take each dependency from the context, yielding its service or <code>Config</code> inside an effect or layer, and must never read it from a global such as <code>globalThis</code> or <code>process</code>, capture it from module scope, or close over it in a function that returns a service class.

A dependency is anything the code needs from outside itself. That includes the runtime (`globalThis.Bun`, `process.env`, `process.platform`, `process.stderr`), the clock, the file system, configuration, and other services. Code in an `Effect.gen` gets a dependency by yielding its service, or by reading configuration through `Config`. Then the type names the dependency, a layer supplies it, and a test can swap it. Reading a global inside Effect code hides the dependency, and so does capturing a module-scope value built from one.

Effect code means an `Effect.gen`, a layer, or a function that returns an Effect. It also covers the callbacks it runs and the helpers it calls. So a module-scope helper such as `const columns = () => process.stderr.columns`, when an `Effect.gen` calls it, breaks the rule. A script that runs an Effect program is held to the same standard: a `process.env` read at module scope that the program captures breaks the rule.

Reading `process.env` through `Config` follows the rule, and reading it directly breaks it. A module-scope constant that is not a dependency, such as a literal, a schema, or a service tag, follows the rule.

The rule is about how Effect code gets a dependency, not about how a dependency gets built. Code that no effect reads is outside the rule, even when it reads a global: a plain async function, a promise-based provider's `ask`, or a module-scope value that only plain calls use. Code that wraps a global to pass it in as an argument also follows the rule, for example a `fetch` handed over as `jev({ fetch: wire })` that calls `globalThis.fetch`, because the call that receives it names it.

A function that takes arguments and returns a `Layer`, such as `SourceWalkerLive(filter, roots)`, follows the rule. Its service tag stays fixed, and its layer still yields every dependency. A function that returns a service class breaks the rule, for example `const make = (args) => class Service extends ...`. Each call creates a new tag, and the service's dependencies stay in the closure, where the context cannot see them.

<a id="adhere-heading-design-effect-declare-dependencies-must"></a>

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

<a id="adhere-heading-design-effect-declare-dependencies-never"></a>

##### Never

```ts
const load = yield* Effect.cached(
  attempt(async () => {
    const bun = (globalThis as { Bun?: { isStandaloneExecutable?: boolean } }).Bun;
    let manifest = process.env.ADHERE_TYPESCRIPT_PACKAGE;
    const expected = `@typescript/typescript-${process.platform}-${process.arch}`;
    if (!manifest && bun?.isStandaloneExecutable) throw new Error("This raw executable has no installed compiler.");
  }),
);
```

Source: [`design/effect-declare-dependencies`](./.adhere/rules/design/effect-declare-dependencies/RULE.md).

</details>

<a id="adhere-rule-design-no-speculative-edge-cases"></a>

<details>
<summary><h2><code>design/no-speculative-edge-cases</code></h2></summary>

Code should handle only the cases its real inputs produce, and should not handle edge cases those inputs do not produce, such as unused corners of a format or a recheck of what the program's own code already guarantees.

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
