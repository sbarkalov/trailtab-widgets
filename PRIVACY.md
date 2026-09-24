# TrailTab privacy policy

Effective 24 September 2026. Applies to the TrailTab extension for Chrome.

**In short:** TrailTab has no server and no account, and collects nothing. What it reads stays in your browser. It makes network requests only when you switch on a feature that needs them, and those requests go straight from your browser to the service named below, not through us.

## What TrailTab reads, and why

| What | Why | Where it goes |
|---|---|---|
| **The address of the tab you are on** (the `tabs` permission) | To mark the toolbar icon with ★ when the page is bookmarked, or with its reading-list state. The address is checked against your bookmarks and reading list and then discarded. | Nowhere. It is not stored. |
| **Your bookmarks** (`bookmarks`) | To show them on the new tab page (including the panel that brings back an old bookmark), and to suggest a folder when you save a page. The suggestion is calculated in your browser from your own folders; it uses no AI model and no network. | Nowhere. |
| **Your reading list** (`readingList`) | To show it on the new tab page and to add pages to it. | Nowhere. |
| **Your most visited sites** (`topSites`) | To offer them as favourites on the new tab page. | Nowhere. |
| **Tab groups** (`tabGroups`) | Only if you switch on *Unload a group's tabs when it collapses*: to notice a group being collapsed. | Nowhere. |
| **The text of the page you are on** (`activeTab`, `scripting`) | Only when you press *Summarize this page*: the text is handed to the summarization model built into Chrome, which runs on your device. | Nowhere. The model is local. |
| **Site icons** (`favicon`) | To show a site's icon next to its link, from Chrome's own icon cache. | Nowhere. |

The warning Chrome shows at installation — *"Read your browsing history"* — is how Chrome describes the `tabs` permission, because access to tab addresses *could* be used to build a history. TrailTab uses it for the toolbar mark above, and keeps no record of the pages you visit.

## What TrailTab stores on your device

All of this is kept in Chrome's extension storage on your computer. None of it is sent anywhere by TrailTab.

- **Your settings** and **your favourite links.** These are kept in Chrome's *sync* storage, so if you use Chrome Sync, Chrome carries them to your other devices through your Google account, as it does for any extension's settings. TrailTab itself does not send them anywhere.
- **A record of recent saves** (the last 200): the address of each page you saved from the toolbar button, the folder suggested and the folder chosen. It exists so you can see, in Settings → Diagnostics, how often the suggestion was right.
- **A record of recent summaries** (the last 200): how long each took and how it ended. It holds nothing about the page itself.
- **A record of recent group unloads** (the last 20), only if you switched that feature on: the addresses and titles of the tabs that were unloaded, so they can be found again if the browser closes unexpectedly.
- **Widgets from the library**, once downloaded, so they are not fetched again every time.
- **Which bookmark folders you had open**, and similar display state.

Removing the extension removes all of it.

## Network requests

TrailTab makes none unless you ask for something that needs one.

**Community widgets** (off by default). When you switch on *Community widgets*, the new tab page may show widgets that fetch content from public services. The address of each service is shown next to the widget, and listed in Settings. The requests are made directly from your browser, so each service sees your IP address, as it would if you visited it:

- **wttr.in** — the weather widget. Given no place, wttr.in estimates your location from your IP address; TrailTab does not send one.
- **picsum.photos** — a random photograph.
- **Wikimedia** (api.wikimedia.org, thumb.wikimedia.org, upload.wikimedia.org, commons.wikimedia.org) and **Wiktionary** (en.wiktionary.org) — the picture and word of the day.
- **The Cleveland Museum of Art** and **The Metropolitan Museum of Art** — works of art.
- **NASA** (images-api.nasa.gov, images-assets.nasa.gov) — space images.

The same switch lets TrailTab fetch new widgets from this repository: a small file from **raw.githubusercontent.com** says which version to use, and the widgets themselves come from **cdn.jsdelivr.net**. Nothing about you is sent with these requests beyond what any browser request carries. Every widget is checked against a published fingerprint before it runs, and runs in a sandbox with no access to your bookmarks, reading list, tabs, or anything else of yours.

**The on-device model.** The page summary uses Chrome's built-in model. Chrome downloads it — about 4 GB — only when you press *Download model* in Settings. The download is Chrome's, from Google, and governed by Google's terms; TrailTab never starts it on its own.

**Things you open yourself.** Searching from the new tab uses your browser's default search engine. *AI search* and *Ask AI* (the latter off by default) take you to the AI service you chose in Settings — Perplexity, ChatGPT, Claude or Google — with your query in the link; for *Ask AI*, the query contains the address of the reading-list item you asked about. That is you visiting that service; its own privacy policy applies from there.

## What TrailTab does not do

- It has no server, no account, no analytics, no advertising, and no crash reporting.
- It does not sell, share or transfer any data, because it has none to transfer.
- It does not use your data for anything other than the features described here.

## Changes

If TrailTab ever starts sending anything — for example, if widget ratings are added — this policy will say so before the release that does it, and the feature will ask you first. Changes are visible in this file's history.

## Contact

Questions: open an issue at [github.com/sbarkalov/trailtab-widgets/issues](https://github.com/sbarkalov/trailtab-widgets/issues).
