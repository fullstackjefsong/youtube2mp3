'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { ensureYtDlp, ensureFfmpeg, ffmpegDir } = require('./binaries');

const PRESETS = {
  default: { key: 'default', label: 'MP3 320 kbps (CBR)', format: 'mp3', quality: '320K' },
  flac: { key: 'flac', label: 'FLAC (lossless)', format: 'flac', quality: '0' },
  mid: { key: 'mid', label: 'MP3 192 kbps (CBR)', format: 'mp3', quality: '192K' },
  lofi: { key: 'lofi', label: 'MP3 96 kbps (CBR, lo-fi)', format: 'mp3', quality: '96K' },
};

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Validates the syntax of a YouTube URL and returns a canonical watch URL.
 * Throws an Error with a user-friendly message when invalid.
 */
function parseYouTubeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('No URL entered.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That is not a valid URL.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('URL must start with http:// or https://');
  }
  const host = url.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) {
    throw new Error(`"${url.hostname}" is not a YouTube address.`);
  }

  let id = null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (host.endsWith('youtu.be')) {
    id = segments[0];
  } else if (segments[0] === 'watch') {
    id = url.searchParams.get('v');
  } else if (['shorts', 'live', 'embed', 'v', 'e'].includes(segments[0])) {
    id = segments[1];
  }

  if (!id || !VIDEO_ID_RE.test(id)) {
    throw new Error('Could not find a valid YouTube video ID in that URL.');
  }
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

function resolvePreset(answer) {
  const a = String(answer || '').trim().toLowerCase();
  if (a === '') return PRESETS.default;
  if (a === 'flac') return PRESETS.flac;
  if (a === 'mid') return PRESETS.mid;
  if (a === 'lofi' || a === 'lo-fi') return PRESETS.lofi;
  return null;
}

function baseArgs() {
  return [
    '--ffmpeg-location', ffmpegDir(),
    // Recent YouTube extraction needs a JS runtime; reuse the Node binary running this CLI.
    '--js-runtimes', `node:${process.execPath}`,
    '--no-playlist',
    '--no-config',
    '--encoding', 'utf-8',
  ];
}

function run(bin, args, { onStdout, inheritStderr = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', inheritStderr ? 'inherit' : 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
      if (onStdout) onStdout(d);
    });
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => (stderr += d));
    }
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function extractError(stderr) {
  const lines = String(stderr || '')
    .split(/\r?\n/)
    .filter((l) => /^ERROR:/.test(l));
  const last = lines.pop();
  if (!last) return 'Unknown error.';
  return last.replace(/^ERROR:\s*(\[[^\]]+\]\s*[A-Za-z0-9_-]+:\s*)?/, '').trim();
}

/**
 * Confirms the video exists and is downloadable; returns its metadata.
 */
async function fetchVideoInfo(url) {
  const ytDlp = await ensureYtDlp();
  const { code, stdout, stderr } = await run(ytDlp, [...baseArgs(), '--dump-single-json', '--skip-download', url]);
  if (code !== 0) throw new Error(`Video is not accessible: ${extractError(stderr)}`);
  let info;
  try {
    info = JSON.parse(stdout);
  } catch {
    throw new Error('Could not read video information from YouTube.');
  }
  if (info.is_live) throw new Error('This is a live stream that is still in progress and cannot be converted yet.');
  const hasAudio = (info.formats || []).some((f) => f.acodec && f.acodec !== 'none');
  if (!hasAudio) throw new Error('No downloadable audio stream was found for this video.');
  return info;
}

/**
 * Downloads and converts the video's audio into outDir; resolves with the output file path.
 */
async function convert(info, preset, { outDir = process.cwd(), onProgress } = {}) {
  const ytDlp = await ensureYtDlp();
  await ensureFfmpeg();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtube2mp3-'));
  const infoFile = path.join(tmpDir, 'info.json');
  fs.writeFileSync(infoFile, JSON.stringify(info));

  const args = [
    ...baseArgs(),
    '--load-info-json', infoFile,
    '-f', 'bestaudio/best',
    '--extract-audio',
    '--audio-format', preset.format,
    '--audio-quality', preset.quality,
    '--embed-metadata',
    '--embed-thumbnail',
    '--no-mtime',
    '--paths', outDir,
    '--paths', `temp:${tmpDir}`,
    '--output', '%(title)s.%(ext)s',
    '--newline',
    '--progress',
    '--progress-template', 'download:PROGRESS %(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s',
    '--print', 'after_move:FILEPATH %(filepath)s',
    '--no-simulate',
    '--no-warnings',
  ];

  let filePath = null;
  let buffer = '';
  try {
    const { code, stderr } = await run(ytDlp, args, {
      onStdout(chunk) {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).replace(/\r$/, '');
          buffer = buffer.slice(idx + 1);
          if (line.startsWith('PROGRESS ')) {
            const [percent, speed, eta] = line.slice(9).trim().split(/\s+/);
            if (onProgress) onProgress({ percent, speed, eta });
          } else if (line.startsWith('FILEPATH ')) {
            filePath = line.slice(9).trim();
          }
        }
      },
    });
    if (code !== 0) throw new Error(`Conversion failed: ${extractError(stderr)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  if (!filePath) {
    throw new Error('Conversion finished but the output file could not be determined.');
  }
  return filePath;
}

module.exports = { PRESETS, parseYouTubeUrl, resolvePreset, fetchVideoInfo, convert };
