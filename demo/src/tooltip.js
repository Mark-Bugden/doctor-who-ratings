// The tooltip: a few lines about an episode or a story, beside the mark it describes, or briefly
// just a name. It's hidden from screen readers, because the status line says the same about
// whatever is found.

import { h } from './dom.js';

const GAP = 10;
const EDGE = 6;

export function createTooltip(container) {
  const el = h('div', { class: 'dw-tip', 'aria-hidden': 'true', hidden: true });
  container.append(el);

  return {
    /** Shows `lines` (the first in bold) beside the point { x, y }, kept inside the container. A brief tip is smaller. */
    show(lines, { x, y }, { brief = false } = {}) {
      el.replaceChildren(h('strong', {}, lines[0]), ...lines.slice(1).map((line) => h('span', {}, line)));
      el.classList.toggle('dw-tip-brief', brief);
      el.hidden = false;
      const { width, height } = container.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const left = Math.min(Math.max(EDGE, x - box.width / 2), width - box.width - EDGE);
      const above = y - box.height - GAP;
      const top = above >= EDGE ? above : Math.min(y + GAP, height - box.height - EDGE);
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    },
    hide() {
      el.hidden = true;
    },
  };
}
