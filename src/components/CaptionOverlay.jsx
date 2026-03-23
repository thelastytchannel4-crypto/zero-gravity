import { useEffect, useState, useMemo } from 'react'

const BEASTY_COLORS = ['#FF2D87', '#FFE600', '#00F5FF', '#BF5FFF', '#FF6B35']
const POD_P_COLORS = [
  '#FF69B4', '#FF00FF', '#00FFFF', '#7DF9FF', '#32CD32', 
  '#FFA500', '#FFFF00', '#800080', '#EE82EE', '#FF7F50', '#FFD700'
]
const ACCENT_COLORS = ['#FF69B4', '#00FFFF', '#FFFF00'] // Pink, Cyan, Yellow

export default function CaptionOverlay({ videoRef, captions, captionStyle }) {
  const [currentTime, setCurrentTime] = useState(0)

  // Chunking logic based on active style + 0.3s gap rule
  const chunks = useMemo(() => {
    let maxWords = 3; 
    if (captionStyle === 'beasty') maxWords = 1;
    else if (captionStyle === 'pod-p') maxWords = 2;
    else if (captionStyle === 'karaoke') maxWords = 6; 

    const grouped = []
    let currentChunk = []
    let sentenceIndex = 0; 
    
    // Helper to process words into correctly colored/styled rendering objects
    const processWords = (chunkArray, startIndex, sIdx) => {
       const youshaeiAccent = ACCENT_COLORS[sIdx % ACCENT_COLORS.length]
       return chunkArray.map((w, idx) => {
         const globalIdx = startIndex + idx;
         let color = 'white';
         let caseStyle = w.text;
         if (captionStyle === 'beasty') {
           color = BEASTY_COLORS[globalIdx % BEASTY_COLORS.length]
           caseStyle = w.text.toUpperCase()
         } else if (captionStyle === 'pod-p') {
           color = POD_P_COLORS[globalIdx % POD_P_COLORS.length]
           caseStyle = w.text.toUpperCase()
         } else if (captionStyle === 'youshaei') {
           const isUpper = globalIdx % 2 === 0;
           caseStyle = isUpper ? w.text.toUpperCase() : (w.text.charAt(0).toUpperCase() + w.text.slice(1).toLowerCase());
           color = isUpper ? 'white' : youshaeiAccent;
         } else if (captionStyle === 'mrbeast' || captionStyle === 'karaoke') {
           caseStyle = w.text.toUpperCase()
         }
         return { ...w, displayColor: color, displayCase: caseStyle, globalIdx }
       })
    }

    for (let i = 0; i < captions.length; i++) {
      const word = captions[i]
      const gap = currentChunk.length > 0 ? (word.start - currentChunk[currentChunk.length - 1].end) : 0
      
      // Cut chunk if word limit reached or gap > 0.3s
      if (currentChunk.length > 0 && (currentChunk.length >= maxWords || gap > 0.3)) {
         grouped.push({
           words: processWords(currentChunk, i - currentChunk.length, sentenceIndex),
           start: currentChunk[0].start,
           end: currentChunk[currentChunk.length - 1].end
         })
         currentChunk = []
         sentenceIndex++
      }
      currentChunk.push(word)
    }

    // Push final straggler chunk
    if (currentChunk.length > 0) {
       grouped.push({
         words: processWords(currentChunk, captions.length - currentChunk.length, sentenceIndex),
         start: currentChunk[0].start,
         end: currentChunk[currentChunk.length - 1].end
       })
    }
    return grouped
  }, [captions, captionStyle])

  useEffect(() => {
    let animationFrameId
    const video = videoRef.current
    if (!video) return

    const checkTime = () => {
      setCurrentTime(video.currentTime)
      if (!video.paused && !video.ended) {
        animationFrameId = requestAnimationFrame(checkTime)
      }
    }

    const handlePlay = () => checkTime()
    const handlePause = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      setCurrentTime(video.currentTime)
    }
    const handleSeek = () => setCurrentTime(video.currentTime)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeek)

    if (!video.paused && !video.ended) {
      checkTime()
    }

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeek)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [videoRef])

  const activeChunk = chunks.find(chunk => currentTime >= chunk.start && currentTime <= chunk.end)

  if (!activeChunk) return null

  // Silence gap check
  const isAnyWordActive = activeChunk.words.some(w => currentTime >= w.start && currentTime <= w.end)
  if (!isAnyWordActive) return null

  return (
    <div key={activeChunk.start} className={`caption-overlay style-${captionStyle}`}>
      {activeChunk.words.map((word, index) => {
        const isActive = currentTime >= word.start && currentTime <= word.end
        const isPast = currentTime > word.end
        
        let inlineStyle = { color: word.displayColor }
        let classNames = ["caption-word"]
        
        if (isActive) classNames.push("active")
        else classNames.push("inactive")

        if (captionStyle === 'karaoke') {
          if (isActive) inlineStyle.color = '#00FF87';
          else if (isPast) inlineStyle.color = 'white';
          else inlineStyle.color = '#555555'; // Dark gray unspoken
          inlineStyle.fontFamily = "'Montserrat', sans-serif";
          inlineStyle.fontWeight = 800;
        } 
        else if (captionStyle === 'beasty') {
           inlineStyle.fontFamily = "'Anton', sans-serif";
           inlineStyle.WebkitTextStroke = '4px black';
        } 
        else if (captionStyle === 'deep-diver') {
           inlineStyle.fontFamily = "'Exo 2', sans-serif";
           inlineStyle.fontWeight = 700;
        } 
        else if (captionStyle === 'pod-p') {
           inlineStyle.fontFamily = "sans-serif"; 
           inlineStyle.fontWeight = 900;
           if (isActive) {
               inlineStyle.textShadow = `0 0 15px ${word.displayColor}, 0 0 30px ${word.displayColor}`;
           }
        } 
        else if (captionStyle === 'youshaei') {
           inlineStyle.fontFamily = "'Orbitron', sans-serif";
           inlineStyle.fontWeight = 700;
        } 
        else if (captionStyle === 'mrbeast') {
           // MrBeast handling is largely CSS, but we inject inline text transform to be safe
           // and handle active coloring dynamically in CSS or here
           if (isActive) inlineStyle.color = '#FFE500';
           else inlineStyle.color = 'white';
        }

        return (
          <span 
            key={index} 
            className={classNames.join(' ')}
            style={inlineStyle}
          >
            {word.displayCase}
          </span>
        )
      })}
    </div>
  )
}
