// The demo's entry point. Vite bundles it with the kit and the CSS into demo.js and demo.css.
//
// It loads the episodes, then mounts the frame with the controls, showing only those that apply to
// the current view. The views (views/) draw the stage; this module keeps the state they share: the
// Doctor selected, the story or episode found by search or by a click, and the episode under the
// pointer. A Doctor is lit when selected, or on the timeline while one of their episodes is under
// the pointer. The episode under the pointer gets its name beside it; a found one gets its details.
// For the leaderboard, it also ranks the subjects under the assumptions chosen (rankings.js).

import manifest from 'virtual:manifest';
import { loadJSON, mount, select, slider, toggle } from '@mark-bugden/demo-kit';
import '@mark-bugden/demo-kit/tokens.scoped.css';
import '@mark-bugden/demo-kit/frame.css';
import './demo.css';
import { ramp } from './colour.js';
import { search, segmented } from './controls.js';
import { prepare } from './data.js';
import { h } from './dom.js';
import * as describe from './format.js';
import { DEFAULTS, overall, rank } from './rankings.js';
import { matches, searchIndex, target } from './search.js';
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
// The views' icons, on a 24 × 24 grid: dots over time, a grid of cells, and ranked rows.
const ICONS = {
  timeline: '<path d="M3 20.5h18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '<g fill="currentColor"><circle cx="5" cy="14" r="1.8"/><circle cx="9" cy="9" r="1.8"/><circle cx="12.5" cy="12.5" r="1.8"/><circle cx="16" cy="6" r="1.8"/><circle cx="19.5" cy="10" r="1.8"/></g>',
  heatmap: '<g fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1" opacity=".55"/><rect x="16" y="3" width="5" height="5" rx="1" opacity=".3"/>'
    + '<rect x="3" y="9.5" width="5" height="5" rx="1" opacity=".3"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1" opacity=".55"/>'
    + '<rect x="3" y="16" width="5" height="5" rx="1" opacity=".55"/><rect x="9.5" y="16" width="5" height="5" rx="1" opacity=".3"/><rect x="16" y="16" width="5" height="5" rx="1"/></g>',
  leaderboard: '<path d="M9 6h12M9 12h8.5M9 18h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<g fill="currentColor"><circle cx="4.5" cy="6" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="4.5" cy="18" r="1.6"/></g>',
};
// How close the pointer must come to a dot, in px: closer with a mouse than with a finger.
const REACH = { mouse: 10, touch: 22, pen: 14 };
// Suggestions shown at once as you type in the search box.
const SUGGESTIONS = 8;

async function start(el) {
  const data = prepare(await loadJSON('data/episodes.json'));
  const index = searchIndex(data.stories);

  const view = segmented({
    label: 'View',
    showLabel: false,
    options: [
      { label: 'Timeline', value: 'timeline', icon: ICONS.timeline },
      { label: 'Heatmap', value: 'heatmap', icon: ICONS.heatmap },
      { label: 'Leaderboard', value: 'leaderboard', icon: ICONS.leaderboard },
    ],
  });
  const doctor = select({
    label: 'Doctor',
    options: [
      { label: 'All Doctors', value: null },
      ...data.doctors.map((d) => ({ label: `${d.label.replace(' Doctor', '')}: ${d.name}`, value: d })),
    ],
  });
  const finder = search({
    label: 'Find a story or episode',
    placeholder: 'e.g. Blink',
    suggest: (query) => matches(index, query, SUGGESTIONS).map((entry) => {
      const found = target(entry);
      return { label: entry.label, detail: describe.suggestionDetail(found), value: found };
    }),
    format: describe.foundName,
    empty: 'No story or episode by that name',
  });
  const era = segmented({
    label: 'Era',
    options: Object.values(data.eras).map((e) => ({
      label: e.label,
      value: e.id,
      title: `${e.seasons[0].years.slice(0, 4)}–${e.seasons.at(-1).years.slice(-4)}`,
    })),
  });
  const metric = segmented({ label: 'Show', options: [{ label: 'Rating', value: 'rating' }, { label: 'Votes', value: 'votes' }] });
  // The leaderboard's subject and the assumptions behind its ranking.
  const subject = segmented({
    label: 'Rank',
    options: [{ label: 'Doctors', value: 'doctor' }, { label: 'Writers', value: 'writer' }, { label: 'Directors', value: 'director' }],
  });
  const average = segmented({
    label: 'Average',
    options: [
      { label: 'Weighted', value: 'weighted', title: 'Mean weighted by votes' },
      { label: 'Mean', value: 'mean' },
      { label: 'Median', value: 'median' },
    ],
    value: DEFAULTS.average,
  });
  const shrinkage = slider({ label: 'Shrinkage', min: 0, max: 20, step: 1, value: DEFAULTS.k, format: describe.shrinkage });
  const adjust = toggle({ label: 'Adjust for era', value: DEFAULTS.eraAdjusted });
  // In the rail, the leaderboard's subject comes first, so that hiding the Doctor, for writers or
  // directors, never moves the buttons just pressed.
  const controls = { view, subject, doctor, finder, era, metric, average, shrinkage, adjust };
  // The controls each view uses, besides the view switch. The Doctor applies to the leaderboard only
  // while it ranks the Doctors.
  const USED = {
    timeline: [doctor, finder, metric],
    heatmap: [doctor, finder, era, metric],
    leaderboard: [doctor, finder, subject, average, shrinkage, adjust],
  };

  const state = { found: null, hovered: null, reveal: false };
  let current = null; // { name, view }
  let host = null;
  let tip = null;
  let scale = null;
  let scaleTheme = null;
  let board = null; // the leaderboard's rankings, while it's the view

  const app = mount({
    el,
    manifest,
    controls,
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
      showControls();
      if (theme !== scaleTheme) {
        scale = ramp(token('--dw-heat').split(/\s+/));
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
  // Before the first draw, so the controls the opening view doesn't use never show.
  showControls();

  /** Shows the controls the view uses, and hides the rest. */
  function showControls() {
    const used = new Set([view, ...USED[view.value]]);
    if (view.value === 'leaderboard' && subject.value !== 'doctor') used.delete(doctor);
    for (const control of Object.values(controls)) control.el.hidden = !used.has(control);
  }

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

  /** The name of the episode under the pointer, or the details of the one found. */
  function showTip() {
    const { hovered, found } = state;
    if (hovered && hovered !== found?.part) {
      const at = current.view.anchor({ part: hovered });
      if (at) tip.show([describe.episodeName(hovered)], at, { brief: true });
      else tip.hide();
      return;
    }
    const at = found && current.view.anchor(found);
    if (!at) {
      tip.hide();
      return;
    }
    tip.show(found.part ? describe.partLines(found.part) : describe.storyLines(found.story), at);
  }

  function statusText() {
    if (board) return describe.topThree(board.ranking, board.name, board.subject, board.settings.eraAdjusted);
    if (state.found) return describe.foundStatus(state.found);
    if (doctor.value) return describe.doctorStatus(doctor.value);
    if (current.name === 'heatmap') {
      const e = data.eras[era.value];
      const seasons = e.id === 'classic' ? 'seasons' : 'series';
      return `The ${e.label.toLowerCase()} era: ${describe.count(e.parts.length)} episodes in ${e.seasons.length} ${seasons}, one cell per episode. Click or tap a cell for details, or pick a Doctor.`;
    }
    return `${describe.count(data.parts.length)} episodes from ${data.parts[0].airDate.slice(0, 4)} to ${data.parts.at(-1).airDate.slice(0, 4)}, one dot per episode. Click or tap one for details, pick a Doctor, or search for a story.`;
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

  finder.onChange((found) => setFound(found));

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
      // With a mouse, a click finds the episode named under the pointer, so the two agree where dots overlap.
      const part = (event.pointerType === 'mouse' && state.hovered) || partUnder(stage, event, REACH[event.pointerType] ?? REACH.pen);
      const found = part ? { story: part.story, part } : null;
      finder.value = found;
      setFound(found);
    });
  }
}

const el = document.querySelector(`[data-demo="${manifest.slug}"]`);
start(el).catch((error) => {
  // The still image stays in place, so the page still shows the timeline.
  console.error('doctor-who-ratings: could not start the demo', error);
});
