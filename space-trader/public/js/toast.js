// Short-lived notices in the corner (announced to screen readers via the live region).

const MAX = 3;

export function toast(text, tone = 'info', ms = 4200) {
  const host = document.getElementById('toasts');
  if (!host || !text) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = text;
  host.appendChild(el);
  while (host.children.length > MAX) host.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

export function notify(notice) {
  if (notice && notice.text) toast(notice.text, notice.tone);
}
