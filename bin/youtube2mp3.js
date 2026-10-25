#!/usr/bin/env node
'use strict';

const readline = require('readline');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');
const { PRESETS, parseYouTubeUrl, resolvePreset, fetchVideoInfo, convert } = require('../lib/converter');
const { downloadYtDlp } = require('../lib/binaries');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1');
const dim = c('2');
const red = c('31');
const green = c('32');
const cyan = c('36');
const yellow = c('33');

const APP_ART = [
  "                    _         _          ____                 _____",
  "  _   _  ___  _   _| |_ _   _| |__   ___|___ \\ _ __ ___  _ __|___ /",
  " | | | |/ _ \\| | | | __| | | | '_ \\ / _ \\ __) | '_ ` _ \\| '_ \\ |_ \\",
  " | |_| | (_) | |_| | |_| |_| | |_) |  __// __/| | | | | | |_) |__) |",
  "  \\__, |\\___/ \\__,_|\\__|\\__,_|_.__/ \\___|_____|_| |_| |_| .__/____/",
  "  |___/                                                 |_|",
];
const USER_ART = [
  "   __      _ _    _           _    _      __",
  "  / _|_  _| | |__| |_ __ _ __| |__(_)___ / _|___ ___ _ _  __ _",
  " |  _| || | | (_-<  _/ _` / _| / /| / -_)  _(_-</ _ \\ ' \\/ _` |",
  " |_|  \\_,_|_|_/__/\\__\\__,_\\__|_\\_\\/ \\___|_| /__/\\___/_||_\\__, |",
  "                                |__/                     |___/",
];

function banner() {
  const width = Math.max(...APP_ART.map((l) => l.length), ...USER_ART.map((l) => l.length)) + 2;
  const rule = `+${'='.repeat(width)}+`;
  const row = (s, color = (x) => x) => `${dim('|')}${color(s.padEnd(width))}${dim('|')}`;
  const left = ' YouTube -> MP3 / FLAC converter';
  const right = `v${pkg.version} `;
  const tagline = left + right.padStart(width - left.length);
  return [
    dim(rule),
    ...APP_ART.map((l) => row(l, (x) => bold(red(x)))),
    row(''),
    row('   by', dim),
    ...USER_ART.map((l) => row(l, cyan)),
    row(''),
    row(tagline, yellow),
    dim(rule),
  ].join('\n');
}

const HELP = `
${bold('youtube2mp3')} v${pkg.version} - convert YouTube videos to MP3 / FLAC

Usage:
  youtube2mp3            Interactive mode (prompts for URL and quality)
  youtube2mp3 <url>      Skip the URL prompt
  youtube2mp3 --update   Update the bundled yt-dlp engine to the latest release
  youtube2mp3 --version  Show version
  youtube2mp3 --help     Show this help

Quality options (typed at the confirmation prompt):
  ${bold('<Enter>')}   ${PRESETS.default.label}  ${dim('(default)')}
  ${bold('FLAC')}      ${PRESETS.flac.label}
  ${bold('mid')}       ${PRESETS.mid.label}
  ${bold('lofi')}      ${PRESETS.lofi.label}

Files are saved to the current directory, named after the video title.
`;

// Line queue so prompts work for both interactive terminals and piped input.
function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lines = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    if (!waiters.length) return lines.push(line);
    if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
    waiters.shift()(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) waiters.shift()(null);
  });
  rl.on('SIGINT', () => {
    process.stdout.write('\n');
    console.log(dim('Cancelled.'));
    process.exit(130);
  });
  return {
    ask(question) {
      process.stdout.write(question);
      if (lines.length) {
        const l = lines.shift();
        if (!process.stdin.isTTY) process.stdout.write(`${l}\n`);
        return Promise.resolve(l);
      }
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close: () => rl.close(),
  };
}

function formatDuration(sec) {
  if (!sec && sec !== 0) return 'unknown';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

async function promptForVideo(prompter, initialUrl) {
  let candidate = initialUrl;
  for (;;) {
    if (candidate == null) {
      candidate = await prompter.ask(`${cyan('?')} ${bold('YouTube URL:')} `);
      if (candidate == null) return null;
    }
    try {
      const { url } = parseYouTubeUrl(candidate);
      process.stdout.write(dim('  Checking video... '));
      const info = await fetchVideoInfo(url);
      process.stdout.write(`${green('OK')}\n`);
      return info;
    } catch (err) {
      if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
      else process.stdout.write('\n');
      console.log(`  ${red('x')} ${err.message}`);
    }
    candidate = null;
  }
}

async function promptForPreset(prompter) {
  for (;;) {
    const answer = await prompter.ask(
      `${cyan('?')} ${bold('Press Enter to convert')} ${dim(`[${PRESETS.default.label}]`)}, or type ${bold('FLAC')} / ${bold('mid')} / ${bold('lofi')} ${dim('(n to cancel)')}: `
    );
    if (answer == null) return null;
    if (/^(n|no|q|quit|cancel)$/i.test(answer.trim())) return null;
    const preset = resolvePreset(answer);
    if (preset) return preset;
    console.log(`  ${red('x')} Unknown option "${answer.trim()}". Choose Enter, FLAC, mid, or lofi.`);
  }
}

function renderProgress({ percent, speed, eta }) {
  const pct = parseFloat(percent) || 0;
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  const bar = '#'.repeat(filled) + '-'.repeat(width - filled);
  const text = `  Downloading [${bar}] ${percent.padStart(6)}  ${speed || ''}  ETA ${eta || ''}`;
  if (process.stdout.isTTY) process.stdout.write(`\r\x1b[K${text}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(pkg.version);
    return 0;
  }
  if (args.includes('--update')) {
    await downloadYtDlp();
    const { ytDlpPath } = require('../lib/binaries');
    spawnSync(ytDlpPath(), ['--version'], { stdio: 'inherit' });
    return 0;
  }
  const unknown = args.filter((a) => a.startsWith('-'));
  if (unknown.length) {
    console.error(`Unknown option: ${unknown[0]}\n${HELP}`);
    return 2;
  }

  console.log(`\n${banner()}\n`);
  const prompter = createPrompter();
  try {
    const info = await promptForVideo(prompter, args[0]);
    if (!info) {
      console.log(dim('Cancelled.'));
      return 1;
    }
    console.log(`  ${bold('Title:')}    ${info.title}`);
    if (info.uploader || info.channel) console.log(`  ${bold('Channel:')}  ${info.uploader || info.channel}`);
    console.log(`  ${bold('Duration:')} ${formatDuration(info.duration)}\n`);

    const preset = await promptForPreset(prompter);
    if (!preset) {
      console.log(dim('Cancelled.'));
      return 1;
    }
    prompter.close();

    console.log(`\n  Converting to ${bold(preset.label)} ...`);
    const file = await convert(info, preset, { outDir: process.cwd(), onProgress: renderProgress });
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
    console.log(`  ${green('Done!')} Saved: ${bold(file)}\n`);
    return 0;
  } finally {
    prompter.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K');
    console.error(`\n  ${red('Error:')} ${err.message}\n`);
    process.exit(1);
  });
