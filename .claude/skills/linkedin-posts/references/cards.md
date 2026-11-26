# Cards

## Writing a cards module

A cards module exports a function that receives the kit and returns one entry per card. The key becomes the file name.

```js
// linkedin/cards/week-2026-12-14.js
module.exports = kit => ({
  '01-ifc-with-holds': kit.card({
    kicker: 'Notes from 18 years of design reviews',
    title: `Issued for construction, ${kit.mark('or issued for waiting?')}`,
    body: kit.grid([
      { n: '85 %', l: 'engineering progress reported', s: 'Illustrative' },
      { n: '52 %', l: 'drawings site can actually build from', s: 'Illustrative', hl: true, tag: 'The number that matters' },
    ]) + kit.box('Count this instead', 'Drawings with zero holds, against the drawings site needs in the next eight weeks.'),
  }),
});
```

Render with `node .claude/skills/linkedin-posts/scripts/render_cards.js <module> <out-dir> [only-name]`. Keep the module in the repository (`linkedin/cards/`) so a card can be corrected later; the scratchpad is wiped between sessions and several early card scripts were lost that way.

## Building blocks in `card_kit.js`

| Helper | Use |
|---|---|
| `kit.card({ kicker, title, body, tag, big })` | The whole card. `big: true` for a title of two or three words. `tag` is the hashtag in the footer. |
| `kit.mark('words')` | Yellow highlight under the key words of the title. One highlight per title. |
| `kit.grid(tiles)` | Two columns of statistic tiles. Pass `true` as the second argument for three small tiles in a row. |
| tile `{ n, l, s, hl, tag }` | `n` the number, `l` what it measures in plain words, `s` source and year, `hl` yellow tile, `tag` a small label above the number. |
| `kit.box(heading, text)` | The dark box that states the point. `<b>` inside the text turns yellow. |
| `kit.list(heading, items)` | A numbered list in a light panel. Three items read well; five is the limit. |
| `kit.cols(a, b)` | Two panels side by side: `{ h, items, hl }`. For "reported vs built", "the agent does vs the planner does". |
| `kit.bars(caption, rows, source)` | Shrinking bars: `{ n, label, pct, hot }`. For "out of N, how many…". |
| `kit.shot(file, style)` | A screenshot in a rounded frame, for the 4D model. |
| `kit.foot(tag)`, `kit.page(body)`, `kit.CSS` | For a card that needs custom HTML or an inline SVG chart inside `body`. |

Custom charts go in as inline SVG inside `body` (a Gantt comparison and a float chart were done this way). Use the kit colours: ink `#14202E`, muted `#4A5563`, blue `#1F6FBF`, navy `#14315F`, light blue `#7DBDEB`, yellow `#F6D84C`, orange `#EC6F0A`.

## Lessons from cards the user sent back

- **Light theme, always.** It is a standing preference for every file made for the user.
- **Fill the card.** Early cards left the bottom third empty; the kit centres the middle block and the renderer reports the gap above the footer. Aim for 60 to 180 px.
- **One number per tile, and say what it counts.** A bare percentage with a technical label was not understood. Add the plain example to the tile.
- **Highlight what the user wants noticed.** When design failure and scope change were named as the point, those tiles became yellow with a "Where the delay starts" tag and the box said what planning should do.
- **Source and year on every figure**, in the small line of the tile.
- **Footer:** "Project Controls Manager · 18 years in construction". It is set once in `card_kit.js`.
- **Words as well as colours** for any status or category. The user is colour-blind for red and green.
- **Check the picture.** Read the rendered PNG once before sending: wrapped numbers, labels sitting on chart lines and cut-off text have all slipped through when only the script output was read.
- **A published card cannot be swapped.** A wrong footer on three live posts had to stay. Get the card right before the scheduled time.

## 4D model screenshots and video

The demo is `demo-4d-progress-model.html` (fictional Orion plant). It exposes `window.orion` for scripts: `mode('spool'|'built')`, `focus('340'|'mc1'|'all'…)`, `tp(index)`, `view({tx,ty,tz,r,az,el})`, `tab('ov'|'4d'|'sp'|'ht'|'cm'|'rp')`, `card(geom, index)`, `setWeek(n)`, `reset()`, plus the data arrays `TPS`, `SPOOLS`, `LINES`, `INST`.

Headless Chromium needs `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, and the page's three.js request must be routed to a local copy of r128. `scripts/make_4d_video.js` shows all of it, including captions, camera moves and partial re-renders. A full 53-second render takes about 15 minutes; run it in the background and check a contact sheet before encoding.
