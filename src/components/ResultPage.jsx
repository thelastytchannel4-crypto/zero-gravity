import { useRef, useMemo } from 'react'
import CaptionOverlay from './CaptionOverlay'

// ─── Build phrase-level chunks from word array ────────────────────────────────
function buildSRTChunks(captions) {
  const SILENCE_BREAK = 0.8
  const MAX_WORDS = 8 
  const chunks = []
  let cur = []

  const flush = () => {
    if (cur.length === 0) return
    chunks.push({
      start: cur[0].start,
      end:   cur[cur.length - 1].end,
      text:  cur.map(w => w.text).join(' ')
    })
    cur = []
  }

  for (const word of captions) {
    const gap = cur.length > 0 ? word.start - cur[cur.length - 1].end : 0
    if (cur.length > 0 && (gap > SILENCE_BREAK || cur.length >= MAX_WORDS)) flush()
    cur.push(word)
  }
  flush()
  return chunks
}

export default function ResultPage({ videoURL, videoMetadata, selectedRatio, captions, language, selectedStyle, onReset }) {
  const videoRef = useRef(null)

  const fmt = (seconds, sep) => {
    const ms   = Math.round(seconds * 1000)
    const h    = Math.floor(ms / 3600000).toString().padStart(2, '0')
    const m    = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')
    const s    = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
    const msec = (ms % 1000).toString().padStart(3, '0')
    return `${h}:${m}:${s}${sep}${msec}`
  }

  const srtChunks = useMemo(() => buildSRTChunks(captions), [captions])

  const downloadSRT = () => {
    const lines = srtChunks.map((chunk, i) =>
      `${i + 1}\n${fmt(chunk.start, ',')} --> ${fmt(chunk.end, ',')}\n${chunk.text}`
    )
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'captions.srt'; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadVTT = () => {
    const lines = srtChunks.map(chunk =>
      `${fmt(chunk.start, '.')} --> ${fmt(chunk.end, '.')}\n${chunk.text}`
    )
    const blob = new Blob(['WEBVTT\n\n' + lines.join('\n\n') + '\n'], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'captions.vtt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="glass-card" style={{ maxWidth: '800px' }}>
      <h2>Captions Generated</h2>
      <div className="video-wrapper">
        <video
          ref={videoRef}
          src={videoURL}
          controls
          className="video-player"
          playsInline
        />
        <CaptionOverlay 
          videoRef={videoRef} 
          videoMetadata={videoMetadata}
          selectedRatio={selectedRatio}
          captions={captions} 
          captionStyle={selectedStyle} 
        />
      </div>

      <div className="download-buttons">
        <button className="neon-button" onClick={downloadSRT}>Download SRT</button>
        <button className="neon-button" onClick={downloadVTT}>Download VTT</button>
        <button className="neon-button" onClick={onReset}
          style={{ borderColor: '#FF1744', color: '#FF1744', boxShadow: '0 0 10px #FF1744, inset 0 0 10px #FF1744' }}>
          Upload Another
        </button>
      </div>
    </div>
  )
}
