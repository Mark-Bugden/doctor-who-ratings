// The leaderboard: one row per Doctor, writer or director, best first, with a dot at their score and
// a vertical line at the average over all stories, which shrinkage pulls every score towards. Faint
// lines beside the rank numbers join each row to its place in the default ranking, so what moved
// shows. When the assumptions change, the rows slide to their new places over the kit's slow
// duration, which is zero under prefers-reduced-motion.
//
// main.js ranks the subjects; this draws them. The score axis spans the scores with no shrinkage,
// which shrinkage only pulls inwards, so moving the slider moves the dots and not the axis. Colours
// come from CSS classes, as on the timeline.

import { h, s } from '../dom.js';
import * as describe from '../format.js';
import { MIN_STORIES } from '../rankings.js';
import { linear, tickStep } from '../scale.js';

const HEAD = 20; // px: the row of column titles and score ticks, which stays in view
const ROW_MIN = 13; // px: enough for 11px text, and short enough to fit 38 directors on a desktop stage
const ROW_MAX = 40;
const PAD = 8;
// Column widths in px: rank numbers, the lines from the default ranking, the stories column (its
// title may overhang the names), the scores, the gaps between, and the narrowest the plot gets
// before the board scrolls sideways. Phones get tighter columns, so the plot and scores fit.
const COLUMNS = {
  wide: { rank: 20, moves: 24, stories: 40, score: 40, gap: 10, space: 6, plot: 140 },
  narrow: { rank: 16, moves: 14, stories: 22, score: 32, gap: 4, space: 3, plot: 84 },
};
const NARROW = 560; // px: stages narrower than this get the narrow columns and 11px text
const INSET = 8; // px: keeps a dot at either end of the axis clear of the plot's edge
const RADIUS = 4.5;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) ** 3;

/** A CSS duration token, such as "360ms" or "0.36s", in milliseconds. */
function duration(el, name) {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.endsWith('ms') ? number : number * 1000;
}

/** A key icon for the caption: the average line, or a line from the default ranking. */
function icon(kind) {
  const line = kind === 'average'
    ? s('line', { x1: 7, x2: 7, y1: 0, y2: 12 })
    : s('line', { x1: 1, x2: 13, y1: 2, y2: 10 });
  return s('svg', { class: `dw-key-icon dw-key-${kind}`, width: 14, height: 12, viewBox: '0 0 14 12' }, line);
}

export function createLeaderboard(container, data) {
  const caption = h('div', { class: 'dw-board-caption' });
  const head = h('div', { class: 'dw-board-head' });
  const svg = s('svg', { class: 'dw-board-rows' });
  const scroller = h('div', { class: 'dw-scroller' }, head, svg);
  const root = h('div', { class: 'dw-board', 'aria-hidden': 'true' }, caption, scroller);
  container.append(root);

  const rated = new Map(data.rated.map((story) => [story.id, story]));
  let subject = null;
  let rows = new Map(); // id -> { id, g, move, dot, x, y, ... }
  let rowHeight = ROW_MIN;
  let layout = null; // the subject and stage size the rows were placed for
  let movesLayer = null;
  let rowsLayer = null;
  let frame = 0;

  function render({ width, height, board }) {
    const { ranking, initial, spread, overall, settings } = board;
    const eraAdjusted = settings.eraAdjusted;
    // Rows slide from where they are only while the subject and the stage size stay the same.
    const key = `${board.subject} ${width}×${height}`;
    const before = key === layout ? rows : new Map();
    layout = key;
    subject = board.subject;

    caption.replaceChildren(
      h('span', { class: 'dw-board-note' }, describe.boardNote(subject, MIN_STORIES[subject])),
      h('span', { class: 'dw-key' }, icon('average'), 'Average of all stories'),
      h('span', { class: 'dw-key' }, icon('moves'), 'Default order'),
    );

    // Row height: fill the stage, within limits; past them the board scrolls.
    svg.setAttribute('width', 0);
    svg.setAttribute('height', 0);
    head.style.width = '0';
    rowHeight = clamp((scroller.clientHeight - HEAD) / ranking.length, ROW_MIN, ROW_MAX);
    const narrow = width < NARROW;
    const column = narrow ? COLUMNS.narrow : COLUMNS.wide;
    const font = rowHeight >= 22 && !narrow ? 12 : 11;
    const plotHeight = ranking.length * rowHeight;
    svg.setAttribute('height', plotHeight);
    svg.style.fontSize = `${font}px`;
    const slot = (index) => (index + 0.5) * rowHeight;

    // The rows' text first, so the names can be measured.
    const defaults = new Map(initial.map((row, index) => [row.id, index]));
    const built = ranking.map((row, index) => {
      const name = s('text', { class: 'dw-name', dy: '0.32em' }, data.subjectName(subject, row.id));
      const count = s('text', { class: 'dw-count', dy: '0.32em', 'text-anchor': 'end' }, String(row.stories));
      const value = s('text', { class: 'dw-score', dy: '0.32em', 'text-anchor': 'end' }, describe.score(row.score, eraAdjusted));
      const hit = s('rect', { class: 'dw-row-hit', y: -rowHeight / 2, height: rowHeight });
      const ring = s('circle', { class: 'dw-row-ring', r: RADIUS + 3 });
      const dot = s('circle', { class: 'dw-mark', r: RADIUS });
      const g = s('g', { class: 'dw-row' }, hit, name, count, ring, dot, value);
      const move = s('line', { class: 'dw-move' });
      return { id: row.id, row, index, from: defaults.get(row.id), g, name, count, value, hit, ring, dot, move };
    });
    const slots = s('g', { class: 'dw-slots' });
    const grid = s('g', { class: 'dw-board-grid' });
    movesLayer = s('g', { class: 'dw-moves' }, ...built.map((r) => r.move));
    rowsLayer = s('g', { class: 'dw-board-row-layer' }, ...built.map((r) => r.g));
    svg.replaceChildren(slots, grid, movesLayer, rowsLayer);
    const nameWidth = Math.ceil(Math.max(...built.map((r) => r.name.getComputedTextLength())));

    // Columns, left to right: rank, moves, name, stories, the plot, score.
    const rankX = PAD + column.rank;
    const movesX = [rankX + column.space, rankX + column.space + column.moves];
    const nameX = movesX[1] + column.space;
    const storiesX = nameX + nameWidth + column.gap + column.stories;
    const plotLeft = storiesX + column.gap * 1.5;
    const contentWidth = Math.max(scroller.clientWidth, plotLeft + column.plot + column.gap + column.score + PAD);
    const scoreX = contentWidth - PAD;
    const plotRight = scoreX - column.score - column.gap;
    svg.setAttribute('width', contentWidth);
    svg.setAttribute('viewBox', `0 0 ${contentWidth} ${plotHeight}`);
    head.style.width = `${contentWidth}px`;

    // The axis: round steps around every score with no shrinkage, and the overall average, with as
    // many of them labelled as the plot's width allows.
    const scores = [...spread.map((r) => r.score), ...ranking.map((r) => r.score), overall];
    const low = Math.min(...scores);
    const high = Math.max(...scores);
    const fine = tickStep(low, high, 6);
    const domain = [Math.floor(low / fine) * fine, Math.ceil(high / fine) * fine];
    const x = linear(domain, [plotLeft + INSET, plotRight - INSET]);
    const step = Math.max(fine, tickStep(...domain, clamp(Math.round((plotRight - plotLeft) / 70), 2, 6)));
    const ticks = [];
    for (let tick = Math.ceil(domain[0] / step) * step; tick <= domain[1] + step * 1e-9; tick += step) ticks.push(Number(tick.toPrecision(12)));

    ranking.forEach((_, index) => {
      slots.append(
        s('rect', { class: index % 2 ? 'dw-slot dw-slot-alt' : 'dw-slot', x: 0, y: index * rowHeight, width: contentWidth, height: rowHeight }),
        s('text', { class: 'dw-rank', x: rankX, y: slot(index), dy: '0.32em', 'text-anchor': 'end' }, String(index + 1)),
      );
    });
    for (const tick of ticks) grid.append(s('line', { class: 'dw-gridline', x1: x(tick), x2: x(tick), y1: 0, y2: plotHeight }));
    grid.append(s('line', { class: 'dw-board-average', x1: x(overall), x2: x(overall), y1: 0, y2: plotHeight }));

    head.replaceChildren(
      h('span', { class: 'dw-head-end', style: `right: ${contentWidth - storiesX}px` }, 'Stories'),
      ...ticks.map((tick) => h('span', { class: 'dw-head-tick', style: `left: ${x(tick)}px` }, describe.scoreTick(tick, eraAdjusted))),
      h('span', { class: 'dw-head-end', style: `right: ${contentWidth - scoreX}px` }, eraAdjusted ? 'vs era' : 'Score'),
    );

    for (const r of built) {
      r.name.setAttribute('x', nameX);
      r.count.setAttribute('x', storiesX);
      r.value.setAttribute('x', scoreX);
      r.hit.setAttribute('width', contentWidth);
      r.move.setAttribute('x1', movesX[0]);
      r.move.setAttribute('x2', movesX[1]);
      r.move.setAttribute('y1', slot(r.from));
      r.target = { y: slot(r.index), x: x(r.row.score) };
      const was = before.get(r.id);
      r.start = was ? { y: was.y, x: was.x } : r.target;
    }
    rows = new Map(built.map((r) => [r.id, r]));
    slide(built, before.size ? duration(root, '--duration-slow') : 0);
  }

  function place(r, y, x) {
    r.y = y;
    r.x = x;
    r.g.setAttribute('transform', `translate(0 ${y})`);
    r.ring.setAttribute('cx', x);
    r.dot.setAttribute('cx', x);
    r.move.setAttribute('y2', y);
  }

  /** Moves each row from its start to its target, over `ms` milliseconds, or at once. */
  function slide(built, ms) {
    cancelAnimationFrame(frame);
    const begun = performance.now();
    const step = (now) => {
      const t = ms > 0 ? clamp((now - begun) / ms, 0, 1) : 1;
      const k = ease(t);
      for (const r of built) place(r, lerp(r.start.y, r.target.y, k), lerp(r.start.x, r.target.x, k));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    step(begun);
  }

  /** The ids of the subjects credited on a story, for the current subject. */
  function credited(story) {
    return new Set(rated.get(story.id)?.[subject] ?? []);
  }

  /** Lights the selected Doctor's row, and rings the rows of the found story's Doctor, writers or directors. */
  function highlight({ lit, found }) {
    const litId = subject === 'doctor' ? lit?.id : undefined;
    const ringed = found ? credited(found.story) : new Set();
    root.classList.toggle('has-lit', rows.has(litId));
    for (const r of rows.values()) {
      r.g.classList.toggle('is-lit', r.id === litId);
      r.move.classList.toggle('is-lit', r.id === litId);
      r.g.classList.toggle('is-found', ringed.has(r.id));
    }
    // The lit row and its line go on top.
    const litRow = rows.get(litId);
    if (litRow) {
      movesLayer.append(litRow.move);
      rowsLayer.append(litRow.g);
    }
  }

  /** Scrolls the first row credited on the found story into view, below the column titles. */
  function reveal({ story }) {
    const ids = credited(story);
    const r = [...rows.values()].find((row) => ids.has(row.id));
    if (!r) return;
    const top = r.target.y - rowHeight / 2;
    const bottom = HEAD + r.target.y + rowHeight / 2 - scroller.clientHeight;
    scroller.scrollTop = clamp(scroller.scrollTop, bottom, top);
  }

  return {
    render,
    highlight,
    reveal,
    partFrom: () => null,
    anchor: () => null,
    scroller,
    destroy() {
      cancelAnimationFrame(frame);
      root.remove();
    },
  };
}
