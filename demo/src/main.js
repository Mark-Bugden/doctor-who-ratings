// The demo's entry point. Vite bundles it with the kit and the CSS into demo.js and demo.css.
//
// It loads the episodes, then mounts the frame with the controls. The views (views/) draw the
// stage; this module keeps the state they share: the Doctor selected, the story or episode found
// by search or by a click, and the episode under the pointer. A Doctor is lit when selected, or on
// the timeline while one of their episodes is under the pointer. For the leaderboard, it also ranks
// the subjects under the assumptions chosen (rankings.js).

import manifest from 'virtual:manifest';
import { loadJSON, mount, select, slider, toggle } from '@mark-bugden/demo-kit';
import '@mark-bugden/demo-kit/tokens.scoped.css';
import '@mark-bugden/demo-kit/frame.css';
import './demo.css';
import { interpolate } from './colour.js';
import { search } from './controls.js';
import { prepare } from './data.js';
import { h } from './dom.js';
import * as describe from './format.js';
import { DEFAULTS, overall, rank } from './rankings.js';
import { find, searchIndex, suggestions } from './search.js';
import { createTooltip } from './tooltip.js';
import { createHeatmap } from './views/heatmap.js';
import { createLeaderboard } from './views/leaderboard.js';
import { createTimeline } from './views/timeline.js';

const VIEWS = { timeline: createTimeline, heatmap: createHeatmap, leaderboard: createLeaderboard };
const LABELS = {
  timeline: 'Timeline of IMDb ratings for every regular Doctor Who episode, one dot per episode, with each Doctor\'s run banded.',
  heatmap: 'Heatmap of IMDb ratings, one row per season and one cell per episode.',
  leaderboard: 'Leaderboard of Doctors, writers or directors, ranked by their stories\' IMDb ratings.',
};
// How close the pointer must come to a dot, in px: closer with a mouse than with a finger.
const REACH = { mouse: 10, touch: 22, pen: 14 };

async function start(el) {
  const data = prepare(await loadJSON('data/episodes.json'));
  const index = searchIndex(data.stories);

  const view = select({
    label: 'View',
    options: [{ label: 'Timeline', value: 'timeline' }, { label: 'Heatmap', value: 'heatmap' }, { label: 'Leaderboard', value: 'leaderboard' }],
  });
  const doctor = select({
    label: 'Doctor',
    options: [
      { label: 'All Doctors', value: null },
      ...data.doctors.map((d) => ({ label: `${d.label.replace(' Doctor', '')}: ${d.name}`, value: d })),
    ],
  });
  const finder = search({ label: 'Find a story or episode', placeholder: 'e.g. Blink', suggestions: suggestions(index) });
  const era = select({
    label: 'Era',
    options: Object.values(data.eras).map((e) => ({ label: `${e.label} (${e.seasons[0].years.slice(0, 4)}–${e.seasons.at(-1).years.slice(-4)})`, value: e.id })),
  });
  const metric = select({ label: 'Show', options: [{ label: 'Rating', value: 'rating' }, { label: 'Votes', value: 'votes' }] });
  // The leaderboard's subject and the assumptions behind its ranking.
  const subject = select({
    label: 'Rank',
    options: [{ label: 'Doctors', value: 'doctor' }, { label: 'Writers', value: 'writer' }, { label: 'Directors', value: 'director' }],
  });
  const average = select({
    label: 'Average',
    options: [{ label: 'Vote-weighted mean', value: 'weighted' }, { label: 'Mean', value: 'mean' }, { label: 'Median', value: 'median' }],
    value: DEFAULTS.average,
  });
  const shrinkage = slider({ label: 'Shrinkage', min: 0, max: 20, step: 1, value: DEFAULTS.k, format: describe.shrinkage });
  const adjust = toggle({ label: 'Adjust for era', value: DEFAULTS.eraAdjusted });
  const BOARD = [subject, average, shrinkage, adjust];

  const state = { found: null, missed: null, hovered: null, reveal: false };
  let current = null; // { name, view }
  let host = null;
  let tip = null;
  let scale = null;
  let scaleTheme = null;
  let board = null; // the leaderboard's rankings, while it's the view

  const app = mount({
    el,
    manifest,
    controls: { view, doctor, finder, era, metric, subject, average, shrinkage, adjust },
    render({ stage, width, height, values, theme, token }) {
      // A stage with no size, such as one hidden for a moment, has nothing to draw. The frame
      // redraws when it has a size again.
      if (width < 1 || height < 1) return;
      if (!host) {
        host = h('div', { class: 'dw-view' });
        stage.append(host);
        tip = createTooltip(stage);
        listen(stage);
      }
      if (current?.name !== values.view) {
        current?.view.destroy();
        current = { name: values.view, view: VIEWS[values.view](host, data) };
        current.view.scroller?.addEventListener('scroll', showTip, { passive: true });
        stage.setAttribute('aria-label', LABELS[values.view]);
        state.hovered = null;
        state.reveal = true;
        followEra(state.found?.story.doctor ?? doctor.value);
      }
      era.disabled = values.view !== 'heatmap';
      metric.disabled = values.view === 'leaderboard';
      for (const control of BOARD) control.disabled = values.view !== 'leaderboard';
      if (theme !== scaleTheme) {
        scale = interpolate(token('--dw-heat-low'), token('--dw-heat-high'));
        scaleTheme = theme;
      }
      board = values.view === 'leaderboard' ? standings(values) : null;
      current.view.render({ width, height, metric: values.metric, era: era.value, scale, board });
      if (board) stage.setAttribute('aria-label', describe.boardLabel(board.ranking, board.name, board.subject, board.settings.eraAdjusted));
      if (state.reveal && state.found) current.view.reveal(state.found);
      state.reveal = false;
      refresh();
    },
  });
  app.stage.setAttribute('role', 'img');
  el.querySelector('.dk-status')?.setAttribute('aria-live', 'polite');

  /** The leaderboard's rankings: under the chosen assumptions, the default ones, and with no shrinkage (for the axis). */
  function standings(values) {
    const settings = { average: values.average, k: values.shrinkage, eraAdjusted: values.adjust };
    return {
      subject: values.subject,
      settings,
      ranking: rank(data.rated, values.subject, settings),
      initial: rank(data.rated, values.subject),
      spread: rank(data.rated, values.subject, { ...settings, k: 0 }),
      overall: overall(data.rated, settings),
      name: (id) => data.subjectName(values.subject, id),
    };
  }

  function lit() {
    return (current.name === 'timeline' && state.hovered?.story.doctor) || doctor.value;
  }

  function refresh() {
    current.view.highlight({ lit: lit(), found: state.found, hovered: state.hovered });
    showTip();
    app.status(statusText());
  }

  function showTip() {
    const target = state.hovered ? { part: state.hovered } : state.found;
    const at = target && current.view.anchor(target);
    if (!at) {
      tip.hide();
      return;
    }
    tip.show(target.part ? describe.partLines(target.part) : describe.storyLines(target.story), at);
  }

  function statusText() {
    if (state.missed) return `No story or episode matches “${state.missed}”.`;
    if (board) return describe.topThree(board.ranking, board.name, board.subject, board.settings.eraAdjusted);
    if (state.found) return describe.foundStatus(state.found);
    if (doctor.value) return describe.doctorStatus(doctor.value);
    if (current.name === 'heatmap') {
      const e = data.eras[era.value];
      const seasons = e.id === 'classic' ? 'seasons' : 'series';
      return `The ${e.label.toLowerCase()} era: ${describe.count(e.parts.length)} episodes in ${e.seasons.length} ${seasons}, one cell per episode. Point at a cell for details, or pick a Doctor.`;
    }
    return `${describe.count(data.parts.length)} episodes from ${data.parts[0].airDate.slice(0, 4)} to ${data.parts.at(-1).airDate.slice(0, 4)}, one dot per episode. Point at one for details, pick a Doctor, or search for a story.`;
  }

  /** On the heatmap, switches to the era of the Doctor given, so their episodes are on screen. */
  function followEra(of) {
    if (of && current?.name === 'heatmap') era.value = of.parts[0].era;
  }

  /** Finds a story or episode, or clears the find with null, and shows it in the current view. */
  function setFound(found) {
    state.found = found;
    state.reveal = Boolean(found);
    followEra(found?.story.doctor);
    app.redraw();
  }

  doctor.onChange((d) => followEra(d));

  finder.onChange((query) => {
    const found = find(index, query);
    state.missed = query.trim() && !found ? query.trim() : null;
    setFound(found);
  });

  function partUnder(stage, event, reach) {
    if (current.name !== 'timeline') return current.view.partFrom(event.target);
    const box = stage.getBoundingClientRect();
    return current.view.partAt(event.clientX - box.left, event.clientY - box.top, reach);
  }

  function setHovered(part) {
    if (part === state.hovered) return;
    state.hovered = part;
    refresh();
  }

  function listen(stage) {
    stage.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') setHovered(partUnder(stage, event, REACH.mouse));
    });
    stage.addEventListener('pointerleave', () => setHovered(null));
    stage.addEventListener('click', (event) => {
      const part = partUnder(stage, event, REACH[event.pointerType] ?? REACH.pen);
      finder.value = '';
      state.missed = null;
      setFound(part ? { story: part.story, part } : null);
    });
  }
}

const el = document.querySelector(`[data-demo="${manifest.slug}"]`);
start(el).catch((error) => {
  // The still image stays in place, so the page still shows the timeline.
  console.error('doctor-who-ratings: could not start the demo', error);
});
