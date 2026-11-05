---
description: Effect code must obtain each dependency from its context, as a yielded service, `Config`, or platform service, and must never read it from `process`, `globalThis`, or module scope, take a service or `Context` as a parameter, or create a service class inside a function.
include: {"content": ["from [\"'](?:effect|@effect/)"]}
excludeIf: ["a read of `process` in a file that runs itself as a program, passing its main Effect to `BunRuntime.runMain`"]
---

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
Effect.gen(function* () {
  const walker = yield* SourceWalker;
  const files = yield* walker.files;
  const root = options.root ?? process.cwd();
});
```
