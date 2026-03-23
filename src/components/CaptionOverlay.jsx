import { useEffect, useState, useMemo } from 'react'

const BEASTY_COLORS = ['#FF2D87', '#FFE600', '#00F5FF', '#BF5FFF', '#FF6B35']
const POD_P_COLORS = [
  '#FF69B4', '#FF00FF', '#00FFFF', '#7DF9FF', '#32CD32', 
  '#FFA500', '#FFFF00', '#800080', '#EE82EE', '#FF7F50', '#FFD700'
]
const ACCENT_COLORS = ['#FF69B4', '#00FFFF', '#FFFF00'] // Pink, Cyan, Yellow

export default function CaptionOverlay({ videoRef, captions, captionStyle }) {
  const [currentTime, setCurrentTime] = useState(0)

  // Chunking logic based on active style
  const chunks = useMemo(() => {
    let chunkSize = 3; // default
    if (captionStyle === 'beasty') chunkSize = 1;
    else if (captionStyle === 'pod-p') chunkSize = 2;
    else if (captionStyle === 'karaoke') chunkSize = 6; // enough for two lines

    const grouped = []
    let sentenceIndex = 0; // For tracking alternating colors per slice in Youshaei
    
    for (let i = 0; i < captions.length; i += chunkSize) {
      const slice = captions.slice(i, i + chunkSize)
      const youshaeiAccent = ACCENT_COLORS[sentenceIndex % ACCENT_COLORS.length]
      sentenceIndex++;

      grouped.push({
        words: slice.map((w, idx) => {
          const globalIdx = i + idx;
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
            caseStyle = isUpper 
              ? w.text.toUpperCase() 
              : (w.text.charAt(0).toUpperCase() + w.text.slice(1).toLowerCase());
            color = isUpper ? 'white' : youshaeiAccent;
          } else if (captionStyle === 'classic' || captionStyle === 'karaoke') {
             caseStyle = w.text.toUpperCase()
          }

          return { ...w, displayColor: color, displayCase: caseStyle, globalIdx }
        }),
        start: slice[0].start,
        end: slice[slice.length - 1].end
      })
    }
    return grouped
  }, [captions, captionStyle])

  useEffect(() => {
    let animationFrameId
    const checkTime = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime)
      }
      animationFrameId = requestAnimationFrame(checkTime)
    }
    animationFrameId = requestAnimationFrame(checkTime)
    return () => cancelAnimationFrame(animationFrameId)
  }, [videoRef])

  const activeChunk = chunks.find(chunk => currentTime >= chunk.start && currentTime <= chunk.end)

  if (!activeChunk) return null

  // Silence gap check
  const isAnyWordActive = activeChunk.words.some(w => currentTime >= w.start && currentTime <= w.end)
  if (!isAnyWordActive) return null

  return (
    <div className={`caption-overlay style-${captionStyle}`}>
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
        else {
           // classic
           inlineStyle.fontFamily = "'Anton', sans-serif";
           if (isActive) inlineStyle.color = '#FFE600';
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
