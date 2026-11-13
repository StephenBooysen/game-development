// Number and text formatting shared by all screens.

const nf = new Intl.NumberFormat('en-US');

/** 12,345 */
export const fmt = (n) => (n === null || n === undefined ? '—' : nf.format(n));

/** +1,200 or −340 (true minus sign). */
export const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

/** 1,200 cr */
export const cr = (n) => `${fmt(n)} cr`;

/** Percentage for a bar width, clamped 0–100. */
export const pctOf = (value, max) => (max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0);

/** Picks a CSS class for a server tone. */
export const toneClass = (tone) => `tone-${tone || 'neutral'}`;

export const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
