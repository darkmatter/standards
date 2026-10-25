---
description: A workflow job must run on a self-hosted runner label (linux, macos, arc, arc-dind, kvm, or arc-kvm), never on a GitHub-hosted runner such as ubuntu-latest.
---

The organization runs its own runners, labeled `linux`, `macos`, `arc`,
`arc-dind`, `kvm`, and `arc-kvm`. A job's `runs-on` names one of them, alone or
with `self-hosted`, as in `runs-on: [self-hosted, macos]`. GitHub-hosted labels
include `ubuntu-*`, `windows-*`, and `macos-*` with a version or `-latest`. The
bare `macos` label is self-hosted, but `macos-latest` or `macos-14` is
GitHub-hosted. The rule covers workflow YAML anywhere: in `.github/workflows/`,
in strings that generate a workflow, and in docs that show one. A `runs-on`
that comes from a matrix or expression breaks the rule if any value it can take
is a GitHub-hosted label.

## Must

```yaml
jobs:
  release:
    runs-on: arc
    steps:
      - uses: actions/checkout@v7
```

## Never

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
```
