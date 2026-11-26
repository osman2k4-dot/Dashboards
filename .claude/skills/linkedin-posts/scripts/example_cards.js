// Two worked examples. Render with:
//   node render_cards.js example_cards.js /tmp/cards-example
module.exports = kit => ({
  // Statistics card: two plain tiles, two highlighted tiles, one dark box with the point.
  'example-stats': kit.card({
    kicker: 'Notes from 18 years in project controls',
    title: `More planners. More specifications. ${kit.mark('Still late.')}`,
    body: kit.grid([
      { n: '79 %', l: 'of Middle East project professionals surveyed said their projects were delayed in the past year', s: 'PwC Middle East survey, 2025 · 100+ surveyed' },
      { n: '66 %', l: 'extra time claimed on projects that ended in dispute. A 24-month project asked for about 16 months more', s: 'HKA CRUX, 2026 · 2,410 projects, 122 countries' },
      { n: '40 %', l: 'of those projects had design failures: errors, late or incomplete design', s: 'HKA CRUX, 2026', hl: true, tag: 'Where the delay starts' },
      { n: '33 %', l: 'had a change in scope, the biggest single cause', s: 'HKA CRUX, 2026', hl: true, tag: 'Where the delay starts' },
    ]) + kit.box('What planning should do', 'Not only report progress. Plan the design and every scope change, with dates and owners.'),
  }),
  // Simple card: a short title, three shrinking bars, one line to remember.
  'example-bars': kit.card({
    kicker: 'From a book every planner should read',
    title: `Think slow.<br>${kit.mark('Act fast.')}`,
    big: true,
    body: kit.bars('Out of 16,000 projects, how many finished…', [
      { n: '&lt;50 %', label: 'on budget', pct: 48 },
      { n: '8.5 %', label: 'on budget and on time', pct: 8.5 },
      { n: '0.5 %', label: 'on budget, on time, with the promised benefits', pct: 0.5, hot: true },
    ], 'Source: Flyvbjerg &amp; Gardner, How Big Things Get Done (2023)')
      + kit.box('', 'We usually plan fast and build slow. <b>The projects that work do the opposite.</b>'),
  }),
});
