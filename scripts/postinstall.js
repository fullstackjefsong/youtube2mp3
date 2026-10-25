#!/usr/bin/env node
'use strict';

const { downloadYtDlp, ensureFfmpeg } = require('../lib/binaries');

const log = (m) => console.log(`[youtube2mp3] ${m}`);

(async () => {
  let ok = true;
  try {
    await downloadYtDlp({ log });
  } catch (err) {
    ok = false;
    console.warn(`[youtube2mp3] Warning: could not download yt-dlp (${err.message}).`);
  }
  try {
    await ensureFfmpeg({ log });
  } catch (err) {
    ok = false;
    console.warn(`[youtube2mp3] Warning: could not download ffmpeg (${err.message}).`);
  }
  if (!ok) {
    if (process.argv.includes('--strict')) {
      console.error('[youtube2mp3] Setup failed: required dependencies are missing.');
      process.exitCode = 1;
    } else {
      console.warn('[youtube2mp3] Missing components will be downloaded automatically the first time you run youtube2mp3.');
    }
  }
})();
