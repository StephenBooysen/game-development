// Tiny safe templating: every interpolated value is HTML-escaped unless it is
// itself the result of `html` (or wrapped in `raw`). Arrays are joined.

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escape(value);
}

/** Tagged template that escapes interpolations. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Marks a trusted string (e.g. static SVG) as safe HTML. */
export function raw(value) {
  return new SafeHtml(String(value));
}

/** Renders `true`/`false` attributes such as disabled. */
export function attr(name, on) {
  return on ? raw(` ${name}`) : raw('');
}
