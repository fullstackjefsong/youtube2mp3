# youtube2mp3

Interactive command-line tool that converts a YouTube video into an **MP3** (320 / 192 / 96 kbps) or **FLAC** file, named after the video title and saved to the folder you run it from.

Everything it needs — the [yt-dlp](https://github.com/yt-dlp/yt-dlp) download engine and [FFmpeg](https://ffmpeg.org) (with the MP3/LAME and FLAC codecs) — is installed automatically by the setup script. No Python, no manual FFmpeg install, no PATH editing.

## Install

### Windows

```cmd
git clone https://github.com/fullstackjefsong/youtube2mp3.git
cd youtube2mp3
setup.cmd
```

(Or just double-click `setup.cmd` in Explorer.)

**Downloaded the ZIP instead?** Extract it first (right-click ? *Extract All*), then double-click `setup.cmd` in the extracted folder. If Windows shows a security prompt for a downloaded file, choose *Run* / *More info ? Run anyway*.

### macOS / Linux

```bash
git clone https://github.com/fullstackjefsong/youtube2mp3.git
cd youtube2mp3
./setup.sh
```

### Alternative: one-liner without cloning (Node.js 20+ already installed)

```bash
npm install -g github:fullstackjefsong/youtube2mp3 --allow-scripts=youtube2mp3
```

If your npm version skips install scripts, yt-dlp and FFmpeg are downloaded automatically the first time you run `youtube2mp3`.

The setup script:

1. Installs Node.js LTS if Node.js 20+ is missing (via `winget` on Windows, Homebrew or nvm on macOS/Linux).
2. Downloads the standalone yt-dlp binary (SHA-256 verified) and a static FFmpeg + FFprobe build for your OS/CPU (Windows x64/ARM64/x86, macOS Intel/Apple Silicon, Linux x64/ARM64) into `vendor/`.
3. Copies the app to a permanent per-user location ? `%LOCALAPPDATA%\youtube2mp3` on Windows, `~/.local/share/youtube2mp3` on macOS/Linux ? and registers the global `youtube2mp3` command from there.
4. Adds npm's global bin folder to your PATH if needed.

An internet connection is needed during setup (Node.js, yt-dlp and FFmpeg are downloaded for your exact OS/CPU). After setup finishes, **the cloned or extracted folder can be deleted** ? the command keeps working.

Open a **new** terminal afterwards (cmd, PowerShell, Windows Terminal, Git Bash, bash, zsh…) and `youtube2mp3` is available everywhere.

> Git cannot run scripts automatically on `git clone` (a security restriction), so running the setup script once after cloning or extracting is the only manual step.

## Usage

```text
> youtube2mp3

 __________________________________________________________________________ 
| ________________________________________________________________________ |
| | SIDE A ------------------------------------------------------ v1.2.0 | |
| |                     _         _          ____                 _____  | |
| |   _   _  ___  _   _| |_ _   _| |__   ___|___ \ _ __ ___  _ __|___ /  | |
| |  | | | |/ _ \| | | | __| | | | '_ \ / _ \ __) | '_ ` _ \| '_ \ |_ \  | |
| |  | |_| | (_) | |_| | |_| |_| | |_) |  __// __/| | | | | | |_) |__) | | |
| |   \__, |\___/ \__,_|\__|\__,_|_.__/ \___|_____|_| |_| |_| .__/____/  | |
| |   |___/                                                 |_|          | |
| |                                                                      | |
| |                               -- by --                               | |
| |    __      _ _    _           _    _      __                         | |
| |   / _|_  _| | |__| |_ __ _ __| |__(_)___ / _|___ ___ _ _  __ _       | |
| |  |  _| || | | (_-<  _/ _` / _| / /| / -_)  _(_-</ _ \ ' \/ _` |      | |
| |  |_|  \_,_|_|_/__/\__\__,_\__|_\_\/ \___|_| /__/\___/_||_\__, |      | |
| |                                 |__/                     |___/       | |
| |______________________________________________________________________| |
|                                                                          |
|            ,------.                                  ,------.            |
|           / ,----. \    .----------------------.    / ,----. \           |
|          | | (()) | |===|  ==================  |===| | (()) | |          |
|           \ `----' /    '----------------------'    \ `----' /           |
|            `------'                                  `------'            |
|                                                                          |
|            YouTube -> MP3 / FLAC  *  320k  *  HI-FI  *  C-90             |
|          ______________________________________________________          |
|         /  O     [ ]                                [ ]     O  \         |
|_______/__________________________________________________________\_______|

? YouTube URL: https://youtu.be/T0LzBzTL16o?si=ZaTuc4_MGz1vPv6G
  Checking video... OK
  Title:    Sierra Ferrell - Whispering Waltz - 5/21/2021 - Paste Studio NVL - Nashville TN
  Channel:  Paste Magazine
  Duration: 3:03

? Press Enter to convert [MP3 320 kbps (CBR)], or type FLAC / mid / lofi (n to cancel):

  Converting to MP3 320 kbps (CBR) ...
  Done! Saved: C:\Music\Sierra Ferrell - Whispering Waltz - 5⧸21⧸2021 - Paste Studio NVL - Nashville TN.mp3
```

1. Enter a YouTube URL (`youtu.be/…`, `youtube.com/watch?v=…`, Shorts, Music, live and embed links are accepted; tracking parameters like `?si=` are ignored).
2. The URL is validated and the video is checked for accessibility (private, removed, age-restricted, or still-live videos are reported and you are asked for another URL).
3. At the confirmation prompt choose the output quality:

| Input        | Output                              |
|--------------|-------------------------------------|
| *Enter*      | MP3 320 kbps CBR (default)          |
| `FLAC`       | FLAC lossless                       |
| `mid`        | MP3 192 kbps CBR                    |
| `lofi`       | MP3 96 kbps CBR                     |
| `n`          | Cancel                              |

The file is written to the current directory and named after the video title, with title/artist metadata and the thumbnail as cover art. Characters that are not allowed in file names (such as `/`, `:` or `?`) are replaced with look-alike Unicode characters.

### Other commands

```text
youtube2mp3 <url>      Skip the URL prompt
youtube2mp3 --update   Update the bundled yt-dlp engine (run this if YouTube downloads start failing)
youtube2mp3 --version  Show version
youtube2mp3 --help     Show help
```

## Updating / uninstalling

Update the yt-dlp engine only (fixes most "site changed" errors):

```bash
youtube2mp3 --update
```

Update the tool itself: `git pull` (or download a fresh ZIP and extract it), then run `setup.cmd` / `./setup.sh` again. Setup overwrites the installed copy and keeps already downloaded binaries.

Uninstall:

```bash
npm uninstall -g youtube2mp3
```

then delete the install folder: `%LOCALAPPDATA%\youtube2mp3` (Windows) or `~/.local/share/youtube2mp3` (macOS/Linux).

## Notes

- YouTube serves lossy audio (Opus/AAC); FLAC preserves that source exactly without further loss, but cannot add quality that was not there.
- Only download content you have the right to download, in accordance with YouTube's Terms of Service and your local copyright law.

## License

MIT
