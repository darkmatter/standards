---
description: Effect code must take each dependency from the context, yielding its service or `Config` inside an effect or layer, and must never read it from a global such as `globalThis` or `process`, capture it from module scope, or close over it in a function that returns a service class.
---

A dependency is anything the code needs from outside itself. That includes the runtime (`globalThis.Bun`, `process.env`, `process.platform`, `process.stderr`), the clock, the file system, configuration, and other services. Code in an `Effect.gen` gets a dependency by yielding its service, or by reading configuration through `Config`. Then the type names the dependency, a layer supplies it, and a test can swap it. Reading a global inside Effect code hides the dependency, and so does capturing a module-scope value built from one.

Effect code means an `Effect.gen`, a layer, or a function that returns an Effect. It also covers the callbacks it runs and the helpers it calls. So a module-scope helper such as `const columns = () => process.stderr.columns`, when an `Effect.gen` calls it, breaks the rule. A script that runs an Effect program is held to the same standard: a `process.env` read at module scope that the program captures breaks the rule.

Reading `process.env` through `Config` follows the rule, and reading it directly breaks it. A module-scope constant that is not a dependency, such as a literal, a schema, or a service tag, follows the rule.

The rule is about how Effect code gets a dependency, not about how a dependency gets built. Code that no effect reads is outside the rule, even when it reads a global: a plain async function, a promise-based provider's `ask`, or a module-scope value that only plain calls use. Code that wraps a global to pass it in as an argument also follows the rule, for example a `fetch` handed over as `jev({ fetch: wire })` that calls `globalThis.fetch`, because the call that receives it names it.

A function that takes arguments and returns a `Layer`, such as `SourceWalkerLive(filter, roots)`, follows the rule. Its service tag stays fixed, and its layer still yields every dependency. A function that returns a service class breaks the rule, for example `const make = (args) => class Service extends ...`. Each call creates a new tag, and the service's dependencies stay in the closure, where the context cannot see them.

## Must

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

## Never

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
