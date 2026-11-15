# Story coverage

A shared pull request check for exported UI components. It uses the TypeScript
parser and module resolver over the Git merge-base and head snapshots. It never
imports repository configuration, executes source, installs repository packages,
or needs a TypeSafe key. It has no result cache.

## Adopt

Add `.storybook-coverage.json` at the consumer repository root. Story globs must
match the files included by that repository's Storybook configuration:

```json
{
  "components": ["src/**/*.{ts,tsx,js,jsx}"],
  "stories": ["src/**/*.stories.{ts,tsx,js,jsx}"],
  "exceptions": [
    {
      "file": "src/AppProvider.tsx",
      "export": "AppProvider",
      "reason": "Nonvisual application provider; exercised by the app integration suite."
    }
  ]
}
```

Add a job with a stable name to CI. Replace `REVIEWED_COMMIT_SHA` with the reviewed
standards commit; updates to the check should arrive as explicit pin updates.

```yaml
story-coverage:
  name: Story coverage
  runs-on: arc
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v6
      with:
        fetch-depth: 0
    - uses: darkmatter/standards/actions/story-coverage@REVIEWED_COMMIT_SHA
      with:
        base: ${{ github.event.pull_request.base.sha }}
```

Run on `pull_request`, without path filters: deleting a story must run the check
too. A workflow handling pushes as well must guard this job to PR events. The
checkout must contain the base/head history. For manual runs, supply full commit
SHAs as `base` and `head`. A private standards repo must permit consumer access to
its actions in GitHub settings.

Pilot the check on representative PRs before adding **Story coverage** to required
checks or an organization ruleset. This repository does not silently change org
branch protection. Explicit consumer component roots determine which apps enroll;
a non-React app outside those roots has no requirements. An enrolled UI component
with no story files fails with an actionable annotation.

## Policy

- New named/default component exports need coverage, including additions inside
  existing source files. Components are uppercase exports (or default exports)
  whose function, class, or wrapper contains JSX or a `createElement` call.
- Existing uncovered exports are grandfathered. Previously covered exports remain
  protected: deleting their last covering story fails even on a story-only PR.
- Git-detected file renames preserve the old export identities. Renaming an export
  itself is treated as introducing an export.
- Named CSF object/function stories with literal default metadata, and CSF Next
  `preview.meta({...})` / `meta.story({...})` exports, count. The
  metadata's `component`, its `render`, or a story's overriding `render` must
  reference the component. A story render overrides `meta.component` evidence.
- Composition stories count through statically resolved JSX component references,
  including relative imports, tsconfig paths, re-exports, and workspace package
  exports. Visiting a symbol twice cannot loop. Type-only and empty exports do not
  count. `includeStories`/`excludeStories` must be literal string arrays.
- Tests, stories, declarations, generated files, vendor/build outputs, and private
  helpers are not independent candidates. Use exact file/export exceptions with
  reviewable reasons for framework entrypoints or nonvisual providers.
- Missing or malformed policy, source syntax errors, and unresolved tsconfig
  inheritance are errors. Workspace-exported and relative tsconfig inheritance
  work without installing dependencies. External-package tsconfig inheritance
  needs a repository-local config before adoption.

This is **static coverage evidence**, not a browser test. The configured globs
must match Storybook discovery; run a Storybook build and render tests alongside
it to prove stories load. Static JSX traversal does not prove reachability through
runtime branches. Dynamic component factories, CSF2 `Template.bind`, custom story
factories, MDX stories, Vite-only aliases, and components returning only a variable
or `null` are outside the initial supported subset. Use a direct CSF story or an
explicit exception where appropriate. It does not require a story per visual state
or judge fixture quality; Adhere can add that semantic guidance separately.

Keep preview deployment, visual diffs, and trusted baseline acceptance in the
repository's existing Storybook pipeline. This action only reads source and emits
coverage annotations; it does not publish sites or accept snapshots.

## Test or run locally

```sh
npm ci --ignore-scripts --prefix actions/story-coverage
node --test actions/story-coverage/*.test.mjs
COVERAGE_BASE=<full-base-sha> COVERAGE_HEAD=HEAD \
  COVERAGE_REPOSITORY=/path/to/consumer \
  node actions/story-coverage/check.mjs
```

Node 24 is required. Dependency installation uses the committed lockfile and skips
lifecycle scripts. Git integration tests create isolated temporary repositories
and remove those exact directories afterwards.
