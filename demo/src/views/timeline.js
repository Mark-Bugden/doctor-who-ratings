// The timeline: one dot per episode at its air date, sized by votes, and each story's rating as a
// short bar across its episodes. Each Doctor's run is a band, labelled at the top, and the years
// off air between 1989 and 2005 are left empty.
//
// Colours come from CSS classes (see demo.css), so a theme change needs no redraw: every mark is
// muted until a Doctor is lit, then the lit Doctor's marks take the accent and the rest the curve
// colour.

import { s } from '../dom.js';
import { linear, log, logTicks, ticks, yearTicks } from '../scale.js';

const MARGIN = { top: 26, right: 14, bottom: 26, left: 40 };
const DAY = 864e5;
const PADDING = 120 * DAY; // before the first episode and after the last
const BAR_MIN = 7; // px: a story's bar is at least this wide, so a single episode's still shows
const DIGIT = 6.5; // px: the width of a digit in a band label, to keep labels from overlapping

export function createTimeline(container, data) {
  const root = s('svg', { class: 'dw-timeline', 'aria-hidden': 'true' });
  container.append(root);

  let points = []; // { part, x, y, r, el }, in broadcast order
  let bars = new Map(); // story -> line
  let labels = new Map(); // doctor -> { el, x0, x1 }, the label and its extent
  let rings = null;

  function render({ width, height, metric }) {
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const { parts } = data;
    const x = linear([parts[0].time - PADDING, parts.at(-1).time + PADDING], [MARGIN.left, width - MARGIN.right]);
    const bottom = height - MARGIN.bottom;
    const top = MARGIN.top + 6;
    let y;
    let yTicks;
    let yLabel;
    if (metric === 'votes') {
      const domain = [data.votes[0] / 1.25, data.votes[1] * 1.25];
      y = log(domain, [bottom, top]);
      yTicks = logTicks(...domain);
      yLabel = (value) => (value >= 1000 ? `${value / 1000}k` : String(value));
    } else {
      const domain = [Math.floor(data.ratings[0]), Math.ceil(data.ratings[1])];
      y = linear(domain, [bottom, top]);
      yTicks = ticks(...domain, Math.max(2, Math.round((bottom - top) / 48)));
      yLabel = String;
    }
    const value = (item) => (metric === 'votes' ? item.votes : item.rating);

    // Dots are sized by votes when they show ratings, and all the same when they show votes.
    const maxRadius = Math.min(6, Math.max(3, width / 170));
    const radius = metric === 'votes'
      ? () => Math.min(2.4, maxRadius)
      : (part) => Math.max(1.6, maxRadius * Math.sqrt((part.votes ?? 0) / data.votes[1]));

    // Bands: one per Doctor, alternately tinted, labelled with the Doctor's number. Most runs are too
    // narrow for a name, so none gets one; the Doctor select and the status line give the names.
    const bands = s('g', { class: 'dw-bands' });
    labels = new Map();
    data.doctors.forEach((doctor, i) => {
      const x0 = x(doctor.parts[0].time - 7 * DAY);
      const x1 = x(doctor.parts.at(-1).time + 7 * DAY);
      bands.append(s('rect', { class: i % 2 ? 'dw-band' : 'dw-band dw-band-alt', x: x0, y: MARGIN.top, width: x1 - x0, height: bottom - MARGIN.top }));
      const middle = (x0 + x1) / 2;
      const half = (String(doctor.id).length * DIGIT) / 2 + 2;
      const label = s('text', { class: 'dw-band-label', x: middle, y: MARGIN.top - 8, 'text-anchor': 'middle' }, String(doctor.id));
      labels.set(doctor, { el: label, x0: middle - half, x1: middle + half });
      bands.append(label);
    });

    // The years off air.
    const lastClassic = data.eras.classic.parts.at(-1).time;
    const firstRevived = data.eras.revived.parts[0].time;
    const gap = s('text', { class: 'dw-gap', x: (x(lastClassic) + x(firstRevived)) / 2, y: (top + bottom) / 2, 'text-anchor': 'middle' }, 'Off air');

    // Axes: horizontal gridlines with their values on the left, years along the bottom.
    const axes = s('g', { class: 'dw-axis' });
    for (const tick of yTicks) {
      axes.append(
        s('line', { class: 'dw-gridline', x1: MARGIN.left, x2: width - MARGIN.right, y1: y(tick), y2: y(tick) }),
        s('text', { x: MARGIN.left - 6, y: y(tick), dy: '0.32em', 'text-anchor': 'end' }, yLabel(tick)),
      );
    }
    const firstYear = new Date(parts[0].time).getUTCFullYear();
    const lastYear = new Date(parts.at(-1).time).getUTCFullYear();
    for (const year of yearTicks(firstYear, lastYear, x(Date.UTC(lastYear, 0, 1)) - x(Date.UTC(firstYear, 0, 1)))) {
      axes.append(s('text', { x: x(Date.UTC(year, 0, 1)), y: height - 8, 'text-anchor': 'middle' }, String(year)));
    }
    axes.append(s('text', { class: 'dw-axis-title', x: 4, y: MARGIN.top - 8 }, metric === 'votes' ? 'Votes' : 'Rating'));

    // Story bars, then dots on top.
    const barLayer = s('g', { class: 'dw-bars' });
    bars = new Map();
    for (const story of data.stories) {
      if (value(story) == null) continue;
      const x0 = x(story.parts[0].time);
      const x1 = x(story.parts.at(-1).time);
      const widen = Math.max(0, BAR_MIN - (x1 - x0)) / 2;
      const line = s('line', { class: 'dw-bar', x1: x0 - widen, x2: x1 + widen, y1: y(value(story)), y2: y(value(story)) });
      bars.set(story, line);
      barLayer.append(line);
    }
    const dotLayer = s('g', { class: 'dw-dots' });
    points = [];
    for (const part of parts) {
      if (value(part) == null) continue;
      const point = { part, x: x(part.time), y: y(value(part)), r: radius(part) };
      point.el = s('circle', { class: 'dw-dot', cx: point.x, cy: point.y, r: point.r });
      points.push(point);
      dotLayer.append(point.el);
    }
    rings = s('g', { class: 'dw-rings' });

    root.replaceChildren(bands, axes, gap, barLayer, dotLayer, rings);
  }

  /** Lights a Doctor's marks, and rings the found and hovered episodes. */
  function highlight({ lit, found, hovered }) {
    root.classList.toggle('has-lit', Boolean(lit));
    for (const point of points) point.el.classList.toggle('is-lit', point.part.story.doctor === lit);
    for (const [story, line] of bars) line.classList.toggle('is-lit', story.doctor === lit);
    // A label that would overlap the one before it is hidden, unless it's lit; one that would overlap
    // the lit label is hidden too.
    const litLabel = labels.get(lit);
    let right = -Infinity;
    for (const [doctor, label] of labels) {
      const overlaps = (other) => other && other !== label && label.x0 < other.x1 && other.x0 < label.x1;
      const shown = doctor === lit || (label.x0 >= right && !overlaps(litLabel));
      label.el.classList.toggle('is-lit', doctor === lit);
      label.el.classList.toggle('is-hidden', !shown);
      if (shown) right = label.x1;
    }

    const ringed = new Map();
    for (const part of found?.part ? [found.part] : found?.story.parts ?? []) ringed.set(part, 'dw-ring');
    if (hovered) ringed.set(hovered, 'dw-ring dw-ring-hover');
    rings.replaceChildren(...[...ringed].map(([part, className]) => {
      const point = points.find((p) => p.part === part);
      return point ? s('circle', { class: className, cx: point.x, cy: point.y, r: point.r + 3 }) : null;
    }).filter(Boolean));
  }

  /** The episode nearest (x, y), within `reach` px of its edge, or null. */
  function partAt(x, y, reach) {
    let best = null;
    let bestDistance = Infinity;
    for (const point of points) {
      const distance = Math.hypot(point.x - x, point.y - y) - point.r;
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    return best && bestDistance <= reach ? best.part : null;
  }

  /** Where to point the tooltip for an episode or story: the top of its mark. */
  function anchor({ part, story }) {
    const target = part ?? story.parts[0];
    const point = points.find((p) => p.part === target);
    return point ? { x: point.x, y: point.y - point.r } : null;
  }

  return {
    render,
    highlight,
    partAt,
    anchor,
    reveal() {},
    destroy() { root.remove(); },
  };
}
