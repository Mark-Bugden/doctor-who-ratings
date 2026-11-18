// The title search, a control the kit doesn't have. Like the kit's controls it returns
// { el, value, disabled, onChange }, so mount() can place it in the rail.

import { h } from './dom.js';

let lastId = 0;

/** A search box with suggestions. onChange fires when a search is made: Enter, a suggestion, or clearing the box. */
export function search({ label, placeholder = '', suggestions = [] }) {
  const id = `dw-search-${++lastId}`;
  const input = h('input', {
    id, type: 'search', list: `${id}-list`, placeholder, autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
  });
  const options = h('datalist', { id: `${id}-list` }, ...suggestions.map((value) => h('option', { value })));
  const el = h('div', { class: 'dk-control dw-search' }, h('label', { for: id, class: 'dk-control-label' }, label), input, options);

  const listeners = new Set();
  const notify = () => {
    for (const listener of listeners) listener(input.value);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      notify();
    }
  });
  // Picking a suggestion replaces the text in one go, with no inputType or with insertReplacementText.
  input.addEventListener('input', (event) => {
    if (!event.inputType || event.inputType === 'insertReplacementText' || input.value === '') notify();
  });

  return {
    el,
    get value() { return input.value; },
    set value(next) { input.value = next ?? ''; },
    get disabled() { return input.disabled; },
    set disabled(state) {
      input.disabled = Boolean(state);
      el.toggleAttribute('data-disabled', input.disabled);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
