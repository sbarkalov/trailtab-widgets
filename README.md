# TrailTab widgets

Community widgets for [TrailTab](https://github.com/sbarkalov/trailtab), a new-tab extension for Chrome. A widget here is drawn in the new tab's hero, at random, for people who have switched on **Community widgets**.

Everything in this repository is public and is read by the extension from a CDN. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a widget.

## How a widget gets from here to a new tab

1. **A pull request** adds `widgets/<id>/widget.js` and `widgets/<id>/widget.json`, plus the regenerated `library.json`.
2. **The check** (`npm run check`, also run in CI on every pull request) refuses a malformed declaration, a file over 8 KB, markup where a script belongs, a stale `library.json`, changed code under an unchanged version, and any address the code names that `contacts` does not declare — or the reverse.
3. **A maintainer reads the whole file** and merges it or does not. Nothing is listed unread: that is the moderation, and it is why the size limit exists.
4. **The extension is pinned to a commit** of this repository. A merged widget reaches users when a release moves that pin, not when it merges. The pin is what makes a listing traceable to one reviewed state of this repository.
5. **The extension verifies every payload** against the SHA-256 in `library.json` before caching it, then runs it in a sandbox with no extension APIs and a fixed allowlist of destinations.

## Layout

```
library.json           generated: what the extension reads
allowlist.json         the destinations the extension currently permits, copied from its manifest
widgets/<id>/widget.js the widget: one script, 8 KB at most
widgets/<id>/widget.json its declaration
scripts/               the check and the listing generator; no dependencies
```

## Commands

Node 22 or later. No `npm install` is needed — there are no dependencies.

```bash
npm run build    # check every widget and regenerate library.json
npm run check    # check without writing; what CI runs
npm test         # the check's own tests
node scripts/library.mjs allowlist <path/to/trailtab/public/manifest.json>
```
