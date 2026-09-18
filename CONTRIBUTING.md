# Proposing a widget

A widget is a small program that strangers' browsers will run without having read it. Everything below follows from taking that seriously.

## What a widget is here

**One JavaScript file** — not an HTML page. The extension hands your file, as text, to a sandboxed shell page that already contains `TrailTabWidget` (the protocol) and nothing else, and the shell runs it as a script. Your code builds its own DOM inside `document.body` and adds its own `<style>` to `document.head`. A file that begins with markup is refused, because in the shell it is a syntax error that shows as an empty frame.

The shell is dark-on-transparent: `body` has a transparent background, `color: #e8ecf5` and `font-family: system-ui`. Draw for that.

## What your code can and cannot do

- **No extension APIs and no user data.** The frame is sandboxed without `allow-same-origin`; `chrome` is undefined and `parent.document` throws. A widget that needs bookmarks, tabs, history or settings cannot be a community widget, and asking will not change that.
- **Only allowlisted destinations.** `fetch` and images reach only the hosts in [`allowlist.json`](allowlist.json), which mirrors the extension's sandbox CSP. A new destination needs an extension release, so propose one only if the destination itself is worth it.
- **No remote code.** `<script src>` to anywhere fails. Everything you run is in your one file.
- **No opening pages.** A link inside the frame opens nothing. Call `TrailTabWidget.source(url)` with the page for what is on screen, and the panel offers it — only at a host you declared.
- **Say it failed** with `TrailTabWidget.fail(message)` when you cannot render around a problem.

### Size

The frame is **640 × 320**, or **360 × 180** on a narrow window — both 2:1, same layout scaled. Size in viewport units (`vh`, `vw`) or read `innerWidth`/`innerHeight` on `resize`. The hero clips and does not scroll: what does not fit is gone.

### Lifecycle — read this, it differs from the built-in widgets

- **`TrailTabWidget.onInit` does not fire for a library widget.** The shell answers `init` before your file is delivered. Start drawing at the top level of your script.
- `onExpand(fn)` / `onCollapse(fn)` fire when the user activates your widget and when it loses the keyboard.
- **If you take the keyboard, release it on Escape** with `TrailTabWidget.releaseFocus()`.

## `widget.json`

```json
{
  "id": "moon-phase",
  "title": "The moon tonight",
  "version": "1.0.0",
  "interactive": false,
  "contacts": null
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | What the widget shows, in plain English words: `moon-phase`, `word-of-the-day`, `tide-times`. Lowercase, hyphenated, the same as the directory. **Permanent** — see below. |
| `title` | yes | The name shown with the frame. |
| `version` | yes | `MAJOR.MINOR.PATCH`. **Bump it whenever `widget.js` changes** — a cached widget is kept until its version moves, so new code under an old version reaches nobody who already has it. The check enforces this in both directions. |
| `interactive` | yes | `true` if it wants the keyboard once activated. It does not affect whether it is drawn. |
| `contacts` | yes | **Every** host the widget can put the user in front of — fetched, drawn as an image, or linked to through `source()`. `null` if it reaches nothing. It is what the user is shown before consenting. |
| `rotatable` | no | `false` keeps it out of the random draw — for a widget the draw would spoil: session state, metered cost, slowness. Never because it is interactive. |

### Choosing the id

The `title` is what users read, and it can change freely. The `id` is what everyone else reads — maintainers, issues, diagnostic logs, the directory in a diff — and it can **never** change: the extension's cache and rotation know a widget by its id, so a renamed widget is a new widget and the old one silently drops out. Pick it once, and pick one that tells a stranger what they will see.

- Name the content, not the kind of thing: `moon-phase`, not `astronomy`; `tide-times`, not `ocean-widget`.
- No numbers, versions or dates (`clock-2`, `weather-v2`, `quote-2026`) — `version` is where change goes, and the id outlives it.
- No words that describe every widget: `widget`, `my`, `new`, `test`, `demo`, `untitled`.
- No author or brand prefix: the id is the widget's name, not a namespace.

The check refuses the shapes that plainly cannot be read (the numbers, hashes and generic words above, anything under 3 or over 40 characters). Whether the id actually says what the widget shows is decided in review, and a pull request may be asked to rename before it merges — the last moment a rename is free.

Write `contacts` honestly and completely. The check compares it with every absolute `http(s)://` address in your file, both ways: an address you use but did not declare fails, and so does one you declared but never use. An address assembled by concatenation is invisible to the check and will be refused in review for exactly that reason.

## Opening the pull request

```bash
npm run build     # checks everything and regenerates library.json
npm test
```

Commit `widgets/<id>/`, and `library.json` as generated. Do not edit `library.json` or `allowlist.json` by hand.

## What review refuses

The check refuses what can be decided mechanically. A maintainer reads the whole file and also refuses:

- anything that needs the user's data
- taking the keyboard and not releasing it on Escape
- `contacts` that do not match what the code does
- a destination not on the allowlist, unless it is worth an extension release
- content that does not fit 360 × 180 or needs to scroll
- code that is hard to read, slow enough to notice, or costs the user money or quota without `rotatable: false`
- obfuscated or minified code — the reviewer has to read it, and so does anyone auditing it later

## After it merges

It is not live yet. The extension reads this repository at a pinned commit, and your widget reaches people with the release that moves the pin past your merge. Even then it is drawn only for people who switched on Community widgets, and the cache rotates, so it takes turns with everything else in the library.
