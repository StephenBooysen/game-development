// Static checks on the page: no browser needed. They catch the easy mistake of renaming or
// removing an element in index.html that app.js still looks up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');
const html = await read('index.html');
const script = await read('app.js');

// Every opening tag with its attributes, e.g. { tag: 'button', id: 'undo', role: 'tab', hidden: '' }.
const elements = [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)].map(([, tag, text]) => {
  const attributes = { tag };
  for (const [, name, value = ''] of text.matchAll(/([a-z-]+)(?:="([^"]*)")?/g)) attributes[name] = value;
  return attributes;
});
const ids = elements.filter((element) => 'id' in element).map((element) => element.id);
const byId = (id) => elements.find((element) => element.id === id);

test('every id in the page is used only once', () => {
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
});

test('every element app.js looks up by id exists in the page', () => {
  const wanted = new Set([...script.matchAll(/\$\('([\w-]+)'\)/g)].map((match) => match[1]));
  assert.ok(wanted.size > 30, 'the pattern should find the lookups');
  assert.deepEqual([...wanted].filter((id) => !ids.includes(id)), []);
});

test('every label points at a form control', () => {
  for (const label of elements.filter((element) => element.tag === 'label')) {
    assert.equal(byId(label.for)?.tag, 'select', `label for="${label.for}"`);
  }
});

test('each tab controls its own panel, and only the selected tab’s panel is shown', () => {
  const tabs = elements.filter((element) => element.role === 'tab');
  assert.deepEqual(tabs.map((tab) => tab.id), ['tab-moves', 'tab-opening', 'tab-legends', 'tab-setup']);
  assert.equal(tabs.filter((tab) => tab['aria-selected'] === 'true').length, 1);
  for (const tab of tabs) {
    const panel = byId(tab['aria-controls']);
    assert.equal(panel?.role, 'tabpanel', tab.id);
    assert.equal(panel['aria-labelledby'], tab.id);
    const selected = tab['aria-selected'] === 'true';
    assert.equal('hidden' in panel, !selected, `${panel.id} hidden`);
    assert.equal(tab.tabindex === '-1', !selected, `${tab.id} tabindex`);
  }
});
