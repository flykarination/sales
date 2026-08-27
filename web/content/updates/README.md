# Travel updates

Every file in this folder is one post on **Karination › Travel updates**
(`/updates`). To publish a new one, add a Markdown file here on GitHub and
commit it — the site rebuilds and deploys itself. Nothing else to touch: no
index to update, no code to change.

## Adding a post

Click **Add file › Create new file** in this folder and name it:

```
YYYY-MM-DD-a-short-slug.md
```

The date in the filename is only for keeping the folder tidy — the `date:`
field below is what the site actually reads. The slug becomes the post's
web address, so `2026-09-02-typhoon-advisory.md` is published at
`/updates/typhoon-advisory`.

Then paste this and fill it in:

```markdown
---
title: Typhoon Yagi — waivers for northern Vietnam
date: 2026-09-02
category: disruption
summary: One-line version, shown in the list and used as the page preview.
airports: HAN, HPH, VDO
until: 2026-09-06
---

Write the post here in Markdown.

## Headings work

- So do lists
- **Bold**, *italic* and [links](https://example.com)

> And quotes, for anything worth setting apart.
```

## The fields

| Field | Required | What it does |
| --- | --- | --- |
| `title` | yes | The headline. |
| `date` | yes | Publication date, `YYYY-MM-DD`. Sorted newest first. |
| `category` | yes | One of `disruption`, `advisory`, `network`, `product`, `policy`. Sets the colour and the filter it appears under. |
| `summary` | recommended | One line, shown in the list. Falls back to the first paragraph. |
| `airports` | no | Comma-separated IATA codes. Shown as tags. |
| `until` | no | `YYYY-MM-DD`. After this date the post is marked **Expired** and drops below the current ones. |

`category` decides the colour, so pick honestly:

- **disruption** — something is not operating as scheduled right now.
- **advisory** — travellers should know before they fly, but nothing is broken.
- **network** — a route, hub or schedule change.
- **product** — cabins, RainbowOne, anything on board.
- **policy** — baggage, documents, conditions of carriage.

## Removing a post

Delete the file. There is no archive — if a post should stay readable but is
no longer current, give it an `until:` date in the past instead.
