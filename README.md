# TrailTab widgets

Community widgets for [TrailTab](https://github.com/sbarkalov/trailtab), a new-tab extension for Chrome. A widget here is drawn in the new tab's hero, at random, for people who have switched on **Community widgets**.

Everything in this repository is public and is read by the extension from a CDN. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a widget.

## How a widget gets from here to a new tab

1. **A pull request** adds `widgets/<id>/widget.js` and `widgets/<id>/widget.json`, plus the regenerated `library.json`.
2. **The check** (`npm run check`, also run in CI on every pull request) refuses a malformed declaration, a file over 8 KB, markup where a script belongs, a stale `library.json`, changed code under an unchanged version, and any address the code names that `contacts` does not declare — or the reverse.
3. **A maintainer reads the whole file** and merges it or does not. Nothing is listed unread: that is the moderation, and it is why the size limit exists.
4. **`pin.json` names the state the extension reads**, and the extension follows it. A merged widget reaches users when the pin moves — `npm run publish`, then commit — not when it merges, and not when the extension is released. Merging lists a widget; moving the pin publishes it. The pin is what makes what users are served traceable to one reviewed state of this repository, and a rollback is the pin naming the previous commit.
5. **The extension verifies every payload** against the SHA-256 in `library.json` before caching it, then runs it in a sandbox with no extension APIs and a fixed allowlist of destinations.

## Layout

```
pin.json               the state the extension reads; moving it is publishing
library.json           generated: the widgets in a state
allowlist.json         the destinations the extension currently permits, copied from its manifest
widgets/<id>/widget.js the widget: one script, 8 KB at most
widgets/<id>/widget.json its declaration
scripts/               the check and the listing generator; no dependencies
```

## Commands

Node 22 or later. No `npm install` is needed — there are no dependencies.

```bash
npm run build    # check every widget and regenerate library.json
npm run check    # check without writing, including the pin; what CI runs
npm run publish  # move pin.json to the current commit, then commit it
npm test         # the check's own tests
node scripts/library.mjs allowlist <path/to/trailtab/public/manifest.json>
```

## License

[MIT](LICENSE). By opening a pull request you agree that your widget is published under it. The license covers the code only: images, text and data a widget shows remain under the terms of wherever they come from.
