import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPortableHtml,
  findHtmlPortabilityViolations,
} from '../dist/html-portability.js';

test('portable HTML allows inline code, data URLs, and relative project assets', () => {
  const html = `<!doctype html><html><head><style>
    body { background-image: url('../assets/paper.png') }
  </style></head><body><a href="https://example.com/source">source</a><img src="data:image/svg+xml,%3Csvg/%3E"><script>document.body.dataset.ready='1'</script></body></html>`;
  assert.deepEqual(findHtmlPortabilityViolations(html), []);
  assert.doesNotThrow(() => assertPortableHtml(html));
});

test('portable HTML rejects CDN and machine-absolute references', () => {
  const html = `<!doctype html><html><head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="//fonts.example.com/font.css">
    <style>.hero{background:url('file:///D:/author/hero.png')}</style>
  </head><body><video src="E:\\media\\clip.mp4"></video></body></html>`;
  const violations = findHtmlPortabilityViolations(html);
  assert.equal(violations.length, 4);
  assert.throws(() => assertPortableHtml(html), /HTML is not portable/);
});
