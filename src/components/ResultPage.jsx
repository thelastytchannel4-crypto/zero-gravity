import { useRef } from 'react'
import CaptionOverlay from './CaptionOverlay'

export default function ResultPage({ videoURL, captions, language, selectedStyle, onReset }) {
  const videoRef = useRef(null)

  const formatTime = (seconds, separator) => {
    const d = new Date(seconds * 1000)
    let hours = d.getUTCHours().toString().padStart(2, '0')
    let mins = d.getUTCMinutes().toString().padStart(2, '0')
    let secs = d.getUTCSeconds().toString().padStart(2, '0')
    let ms = d.getUTCMilliseconds().toString().padStart(3, '0')
    return `${hours}:${mins}:${secs}${separator}${ms}`
  }

  const downloadSRT = () => {
    let srtContent = ''
    captions.forEach((word, index) => {
      srtContent += `${index + 1}\n`
      srtContent += `${formatTime(word.start, ',')} --> ${formatTime(word.end, ',')}\n`
      srtContent += `${word.text}\n\n`
    })
    
    const blob = new Blob([srtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'captions.srt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadVTT = () => {
    let vttContent = 'WEBVTT\n\n'
    captions.forEach((word) => {
      vttContent += `${formatTime(word.start, '.')} --> ${formatTime(word.end, '.')}\n`
      vttContent += `${word.text}\n\n`
    })

    const blob = new Blob([vttContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'captions.vtt'
    a.click()
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
        <CaptionOverlay videoRef={videoRef} captions={captions} captionStyle={selectedStyle} />
      </div>

      <div className="download-buttons">
        <button className="neon-button" onClick={downloadSRT}>
          Download SRT
        </button>
        <button className="neon-button" onClick={downloadVTT}>
          Download VTT
        </button>
        <button className="neon-button" onClick={onReset} style={{ borderColor: '#FF1744', color: '#FF1744', boxShadow: '0 0 10px #FF1744, inset 0 0 10px #FF1744' }}>
          Upload Another
        </button>
      </div>
    </div>
  )
}
