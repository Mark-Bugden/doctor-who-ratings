// The heatmap: one era at a time, a row per season and a cell per episode, coloured by rating or by
// votes. Ratings take the scale from 5 to 9, where all but about 2% of episodes fall, and the few
// outside take its ends, so the scale's colours go on the ratings most episodes have. Cells keep a
// minimum size, and the grid scrolls within the stage when it doesn't fit, with the season and
// episode numbers kept in view. A lit Doctor's cells stay as they are and the others dim, because
// the scale has no colour to spare for a highlight.

import { h } from '../dom.js';
import { count } from '../format.js';

const LABEL = 58; // px: the season column
const HEADER = 22; // px: the episode row
const LEGEND = 30; // px
const MIN_CELL = 14;
const MAX_WIDTH = 56;
const MAX_HEIGHT = 36;
const RATINGS = [5, 9]; // the ratings the colour scale spans
const LEGEND_STOPS = 9;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Where a value sits on the colour scale, 0 at its low end and 1 at its high end: ratings on one
 * scale for both eras, votes per era on a log scale. A rating outside the scale falls beyond 0 or 1,
 * and the scale clamps it.
 */
export function position(part, metric, ratings, votes) {
  if (metric === 'votes') {
    const [low, high] = votes.map(Math.log10);
    return part.votes == null ? null : (Math.log10(part.votes) - low) / (high - low);
  }
  return part.rating == null ? null : (part.rating - ratings[0]) / (ratings[1] - ratings[0]);
}

export function createHeatmap(container, data) {
  const legend = h('div', { class: 'dw-legend', 'aria-hidden': 'true' });
  const grid = h('div', { class: 'dw-grid', 'aria-hidden': 'true' });
  const scroller = h('div', { class: 'dw-scroller' }, grid);
  const root = h('div', { class: 'dw-heatmap' }, legend, scroller);
  container.append(root);

  let cells = new Map(); // part -> cell

  function render({ width, height, metric, era: eraId, scale }) {
    const era = data.eras[eraId];
    const columns = era.episodes;
    const rows = era.seasons.length;
    const cellWidth = clamp((width - LABEL - 6) / columns, MIN_CELL, MAX_WIDTH);
    const cellHeight = clamp((height - LEGEND - HEADER - 6) / rows, MIN_CELL, MAX_HEIGHT);
    grid.style.gridTemplateColumns = `${LABEL}px repeat(${columns}, ${cellWidth}px)`;
    grid.style.gridTemplateRows = `${HEADER}px repeat(${rows}, ${cellHeight}px)`;

    const votes = era.votes;
    const every = cellWidth >= 22 ? 1 : 5;
    const heads = [h('div', { class: 'dw-corner' }, era.season)];
    for (let episode = 1; episode <= columns; episode++) {
      const label = episode === 1 || episode % every === 0 ? String(episode) : '';
      heads.push(h('div', { class: 'dw-colhead', style: `grid-column: ${episode + 1}` }, label));
    }

    cells = new Map();
    const body = [];
    era.seasons.forEach(({ season, parts }, row) => {
      body.push(h('div', { class: 'dw-rowhead', style: `grid-row: ${row + 2}` }, String(season)));
      for (const part of parts) {
        const t = position(part, metric, RATINGS, votes);
        const cell = h('div', {
          class: 'dw-cell',
          'data-part': part.index,
          style: `grid-row: ${row + 2}; grid-column: ${part.episode + 1}; background: ${t == null ? 'transparent' : scale(t)}`,
        });
        cells.set(part, cell);
        body.push(cell);
      }
    });
    grid.replaceChildren(...heads, ...body);

    const [low, high] = metric === 'votes' ? votes.map(count) : [`≤${RATINGS[0]}`, `≥${RATINGS[1]}`];
    const stops = Array.from({ length: LEGEND_STOPS }, (_, i) => scale(i / (LEGEND_STOPS - 1))).join(', ');
    legend.replaceChildren(
      h('span', {}, metric === 'votes' ? `Votes, ${era.label.toLowerCase()} era` : 'Rating'),
      h('span', { class: 'dw-legend-end' }, low),
      h('span', { class: 'dw-legend-bar', style: `background: linear-gradient(to right, ${stops})` }),
      h('span', { class: 'dw-legend-end' }, high),
    );
  }

  /** Dims the Doctors who aren't lit, and outlines the found and hovered episodes. */
  function highlight({ lit, found, hovered }) {
    root.classList.toggle('has-lit', Boolean(lit));
    const foundParts = new Set(found?.part ? [found.part] : found?.story.parts ?? []);
    for (const [part, cell] of cells) {
      cell.classList.toggle('is-lit', part.story.doctor === lit);
      cell.classList.toggle('is-found', foundParts.has(part));
      cell.classList.toggle('is-hovered', part === hovered);
    }
  }

  function partFrom(target) {
    const cell = target instanceof Element ? target.closest('.dw-cell') : null;
    return cell ? data.parts[Number(cell.dataset.part)] : null;
  }

  /** Where to point the tooltip: the top middle of the cell, relative to the container. */
  function anchor({ part, story }) {
    const cell = cells.get(part ?? story.parts[0]);
    if (!cell) return null;
    const box = cell.getBoundingClientRect();
    const frame = container.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    if (box.right < view.left + LABEL || box.left > view.right || box.bottom < view.top + HEADER || box.top > view.bottom) return null;
    return { x: box.left + box.width / 2 - frame.left, y: box.top - frame.top };
  }

  /** Scrolls the grid so the episode (or the story's first) is in view, past the sticky headers. */
  function reveal({ part, story }) {
    const cell = cells.get(part ?? story.parts[0]);
    if (!cell) return;
    const left = cell.offsetLeft - LABEL;
    const right = cell.offsetLeft + cell.offsetWidth - scroller.clientWidth;
    const top = cell.offsetTop - HEADER;
    const bottom = cell.offsetTop + cell.offsetHeight - scroller.clientHeight;
    scroller.scrollLeft = clamp(scroller.scrollLeft, right, left);
    scroller.scrollTop = clamp(scroller.scrollTop, bottom, top);
  }

  return {
    render,
    highlight,
    partFrom,
    anchor,
    reveal,
    scroller,
    destroy() { root.remove(); },
  };
}
