---
description: A function must be a plain synchronous function when it only calculates, formats, or encodes an in-memory value without a recoverable typed error, and must return an Effect when it performs I/O, accesses a service or dependency, handles recoverable errors, or controls execution, never wrapping an infallible calculation in Effect or running I/O or a dependency directly in a plain or async function.
reads: ["symbols", "references"]
exclude: {"paths": ["packages/core/tooling/oxlint/**"]}
excludeIf: ["a thin boundary adapter, UI event helper, or framework entrypoint whose caller contract requires void, a synchronous value, or a Promise and that delegates to or executes an Effect or satisfies a third-party SDK's Promise-shaped interface", "a browser DOM, Canvas, WebGL, or Web Crypto helper that reads or renders client UI state or mints synchronous client-side IDs for components and event handlers", "a pure synchronous computation that calls Effect.runSync on an in-memory, resource-free Effect primitive such as hashing or encoding with no external I/O or runtime dependencies"]
---

Use plain synchronous functions—including `Schema.encodeSync`, `Schema.decodeUnknownOption`, and `Option`—for pure data transformations, formatting, and lenient parsing whose invalid inputs map to `Option` or `null` or whose failure is a defect (such as `Effect.orDie` or `Effect.ignore` around in-memory `Schema` encoding). When a function wraps an in-memory projection or `Schema` encoding in `Effect.Effect<A>` and converts encoding failure with `Effect.orDie`, it breaks the rule: encode synchronously instead.

Return an `Effect.Effect` when a function performs I/O (filesystem, network, storage, processes, clocks, randomness), accesses a service or port (yielded from context rather than passed as an argument to a plain or `async` helper), fails with a typed domain error the caller can handle (`Effect.Effect<A, E>`), or uses concurrency, retries, timeouts, or resource scopes. Calling filesystem, process, or storage APIs directly in a plain or `async` function—or passing a service port into an `async` helper instead of yielding it in `Effect`—breaks the rule.

A pure validation function that rejects untrusted input with a typed domain error (for example `Effect.Effect<string, ValidationError>`) legitimately returns an `Effect` so callers compose the failure in the error channel. Thin host entrypoints, React UI callbacks or client API bridges (`Effect.runPromise`, `Effect.runFork`, `Effect.runSync`), browser DOM/Canvas rendering helpers, synchronous client-side ID helpers (`SecureRandom.uuidV4Unsafe`), pure in-memory helpers that unwrap a resource-free Effect primitive with `Effect.runSync` (such as SHA-256 digesting), and boundary adapters whose framework or third-party SDK contract requires `void`, a synchronous return value, or a `Promise` are out of scope when they only bridge that contract.

## Must

```ts
const JsonCell = Schema.fromJsonString(Schema.Unknown);
const encodeJson = Schema.encodeSync(JsonCell);

export function encodeMetadata(
  metadata: InboundEventMetadata | null | undefined,
): string | null {
  if (metadata === undefined || metadata === null) return null;
  const encoded = encodeJson(metadata);
  return encoded === "{}" ? null : encoded;
}

export const readThreadIfMaterialized = (threadId: string) =>
  Effect.gen(function* () {
    const reads = yield* SubmissionReads;
    return yield* reads.readThread(threadId).pipe(
      Effect.catchTag("ThreadNotMaterialized", () => Effect.succeed(null)),
    );
  });
```

## Never

```ts
export function encodeMetadata(
  metadata: InboundEventMetadata | null | undefined,
): Effect.Effect<string | null> {
  if (metadata === undefined || metadata === null) return Effect.succeed(null);
  return Effect.map(encodeJson(metadata), (encoded) =>
    encoded === "{}" ? null : encoded,
  );
}

async function readThreadIfMaterialized(
  threadId: string,
  reads: SubmissionReads,
) {
  try {
    return await reads.readThread(threadId);
  } catch (error) {
    if (Schema.is(ThreadNotMaterialized)(error)) return null;
    throw error;
  }
}
```
