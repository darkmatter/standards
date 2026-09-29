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
