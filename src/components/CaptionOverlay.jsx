import { useEffect, useState, useMemo } from 'react'

const BEASTY_COLORS = ['#FF2D87', '#FFE600', '#00F5FF', '#BF5FFF', '#FF6B35']
const POD_P_COLORS = [
  '#FF69B4', '#FF00FF', '#00FFFF', '#7DF9FF', '#32CD32', 
  '#FFA500', '#FFFF00', '#800080', '#EE82EE', '#FF7F50', '#FFD700'
]
const ACCENT_COLORS = ['#FF69B4', '#00FFFF', '#FFFF00'] 

export default function CaptionOverlay({ videoRef, videoMetadata, selectedRatio, captions, captionStyle }) {
  const [currentTime, setCurrentTime] = useState(0)

  // ─── Chunking rules ──────────────────────────────────────────────────────
  const chunks = useMemo(() => {
    let maxWords = 3
    if (captionStyle === 'beasty')    maxWords = 1
    else if (captionStyle === 'pod-p')   maxWords = 2
    else if (captionStyle === 'karaoke') maxWords = 6

    const SILENCE_BREAK = 0.8  

    const grouped = []
    let currentChunk = []
    let sentenceIndex = 0

    const processWords = (chunkArray, startIndex, sIdx) => {
      const youshaeiAccent = ACCENT_COLORS[sIdx % ACCENT_COLORS.length]
      return chunkArray.map((w, idx) => {
        const globalIdx = startIndex + idx
        let color = 'white'
        let caseStyle = w.text
        if (captionStyle === 'beasty') {
          color = BEASTY_COLORS[globalIdx % BEASTY_COLORS.length]
          caseStyle = w.text.toUpperCase()
        } else if (captionStyle === 'pod-p') {
          color = POD_P_COLORS[globalIdx % POD_P_COLORS.length]
          caseStyle = w.text.toUpperCase()
        } else if (captionStyle === 'youshaei') {
          const isUpper = globalIdx % 2 === 0
          caseStyle = isUpper ? w.text.toUpperCase() : (w.text.charAt(0).toUpperCase() + w.text.slice(1).toLowerCase())
          color = isUpper ? 'white' : youshaeiAccent
        } else if (captionStyle === 'mrbeast' || captionStyle === 'karaoke') {
          caseStyle = w.text.toUpperCase()
        }
        return { ...w, displayColor: color, displayCase: caseStyle, globalIdx }
      })
    }

    const flushChunk = (i) => {
      if (currentChunk.length === 0) return
      grouped.push({
        words: processWords(currentChunk, i - currentChunk.length, sentenceIndex),
        start: currentChunk[0].start,
        end:   currentChunk[currentChunk.length - 1].end
      })
      currentChunk = []
      sentenceIndex++
    }

    for (let i = 0; i < captions.length; i++) {
      const word = captions[i]
      const gap  = currentChunk.length > 0 ? word.start - currentChunk[currentChunk.length - 1].end : 0
      if (currentChunk.length > 0 && (gap > SILENCE_BREAK || currentChunk.length >= maxWords)) flushChunk(i)
      currentChunk.push(word)
    }
    flushChunk(captions.length) 
    return grouped
  }, [captions, captionStyle])

  useEffect(() => {
    let animationFrameId
    const video = videoRef.current
    if (!video) return

    const checkTime = () => {
      setCurrentTime(video.currentTime)
      if (!video.paused && !video.ended) animationFrameId = requestAnimationFrame(checkTime)
    }

    const handlePlay = () => checkTime()
    const handlePause = () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); setCurrentTime(video.currentTime) }
    const handleSeek = () => setCurrentTime(video.currentTime)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeek)

    if (!video.paused && !video.ended) checkTime()

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeek)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [videoRef])

  const activeChunk = chunks.find(chunk => currentTime >= chunk.start && currentTime <= chunk.end)
  if (!activeChunk) return null

  // ─── Dynamic Scaling Logic ────────────────────────────────────────────────
  // Target font size: ~5-7% of video height
  // Position: lower center (around 70-80% from top)
  const vHeight = videoMetadata.height || 1080
  const vWidth = videoMetadata.width || 1920
  
  let dynamicFontSize = '32px'
  let dynamicTop = '75%'

  if (selectedRatio === '9:16') {
    dynamicFontSize = `${Math.floor(vHeight / 20)}px` 
    dynamicTop = '78%' // Higher margin for reels
  } else if (selectedRatio === '16:9') {
    dynamicFontSize = `${Math.floor(vHeight / 15)}px`
    dynamicTop = '82%'
  } else {
    dynamicFontSize = `${Math.floor(vHeight / 18)}px`
    dynamicTop = '80%'
  }

  // Cap mobile preview font size if metadata hasn't loaded properly
  if (vHeight < 500) dynamicFontSize = '24px'

  const containerStyle = {
    top: dynamicTop,
    fontSize: dynamicFontSize,
    position: 'absolute',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    textAlign: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none'
  }

  return (
    <div key={activeChunk.start} className={`caption-overlay style-${captionStyle}`} style={containerStyle}>
      {activeChunk.words.map((word, index) => {
        const isActive = currentTime >= word.start && currentTime <= word.end
        const isPast = currentTime > word.end
        
        let inlineStyle = { color: word.displayColor }
        let classNames = ["caption-word"]
        if (isActive) classNames.push("active")
        else classNames.push("inactive")

        if (captionStyle === 'mrbeast') {
          if (isActive) {
            inlineStyle.color = '#FFE500'
            inlineStyle.transform = 'scale(1.1)'
          } else {
            inlineStyle.color = 'white'
          }
        } else if (captionStyle === 'karaoke') {
          if (isActive) inlineStyle.color = '#00FF87'
          else if (isPast) inlineStyle.color = 'white'
          else inlineStyle.color = '#555555'
        }

        return (
          <span key={index} className={classNames.join(' ')} style={inlineStyle}>
            {word.displayCase}
          </span>
        )
      })}
    </div>
  )
}
