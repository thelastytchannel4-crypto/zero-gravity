# Zero Gravity Captions

A completely static frontend React Vite app that generates Opus Clip style captions entirely in the browser using Transformers.js Whisper in a Web Worker.

## Tech Stack
- React 18
- Vite
- Transformers.js (`@xenova/transformers`)
- Whisper-tiny
- Plain CSS

## Highlights
- 100% Client-side. No backend, no python.
- Opus clip styled animated words.
- Generates SRT and VTT.
- Zero error Vercel deployment setup with strict package versions.

## Setup
1. `npm install` (NOTE: `legacy-peer-deps` is required, pre-configured in `.npmrc`).
2. `npm run dev` to preview.
3. `npm run build` to build.
