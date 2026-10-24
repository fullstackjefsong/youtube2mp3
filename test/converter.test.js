'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseYouTubeUrl, resolvePreset, PRESETS } = require('../lib/converter');

test('accepts common YouTube URL shapes', () => {
  const cases = [
    'https://youtu.be/T0LzBzTL16o?si=ZaTuc4_MGz1vPv6G',
    'https://www.youtube.com/watch?v=T0LzBzTL16o&list=PL123',
    'youtube.com/watch?v=T0LzBzTL16o',
    'https://m.youtube.com/watch?v=T0LzBzTL16o',
    'https://music.youtube.com/watch?v=T0LzBzTL16o',
    'https://www.youtube.com/shorts/T0LzBzTL16o',
    'https://www.youtube.com/live/T0LzBzTL16o',
    'https://www.youtube.com/embed/T0LzBzTL16o',
    '  https://youtu.be/T0LzBzTL16o  ',
  ];
  for (const c of cases) {
    assert.deepStrictEqual(parseYouTubeUrl(c), {
      id: 'T0LzBzTL16o',
      url: 'https://www.youtube.com/watch?v=T0LzBzTL16o',
    }, c);
  }
});

test('rejects invalid URLs', () => {
  for (const c of ['', 'not a url', 'https://vimeo.com/123', 'https://youtu.be/abc', 'https://www.youtube.com/', 'ftp://youtu.be/T0LzBzTL16o', 'https://evilyoutube.com/watch?v=T0LzBzTL16o']) {
    assert.throws(() => parseYouTubeUrl(c), Error, c);
  }
});

test('maps confirmation answers to presets', () => {
  assert.strictEqual(resolvePreset(''), PRESETS.default);
  assert.strictEqual(resolvePreset('FLAC'), PRESETS.flac);
  assert.strictEqual(resolvePreset(' flac '), PRESETS.flac);
  assert.strictEqual(resolvePreset('MID'), PRESETS.mid);
  assert.strictEqual(resolvePreset('lofi'), PRESETS.lofi);
  assert.strictEqual(resolvePreset('wav'), null);
  assert.strictEqual(PRESETS.default.quality, '320K');
  assert.strictEqual(PRESETS.mid.quality, '192K');
});
