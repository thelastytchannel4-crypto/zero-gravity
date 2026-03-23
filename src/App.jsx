import { useState, useEffect } from 'react'
import SetupPage from './components/SetupPage'
import HomePage from './components/HomePage'
import ProcessingPage from './components/ProcessingPage'
import ResultPage from './components/ResultPage'
import SpaceBackground from './components/SpaceBackground'
import ErrorBoundary from './components/ErrorBoundary'

// ─── WAV encoder (inline, no external util dependency) ───────────────────────
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i))
}
function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
}
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  floatTo16BitPCM(view, 44, samples)
  return new Blob([buffer], { type: 'audio/wav' })
}

// ─── Devanagari → Roman transliteration ──────────────────────────────────────
function transliterateToRoman(text) {
  const map = {
    'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
    'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng',
    'च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
    'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
    'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
    'प':'p','फ':'f','ब':'b','भ':'bh','म':'m',
    'य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
    'क्ष':'ksh','त्र':'tr','ज्ञ':'gy',
    'ा':'a','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au',
    'ं':'n','ः':'h','्':''
  }
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += map[text[i]] !== undefined ? map[text[i]] : text[i]
  }
  return result
}

export default function App() {
  const [page, setPage] = useState('setup')
  const [apiKey, setApiKey] = useState('')

  const [videoFile, setVideoFile] = useState(null)
  const [videoURL, setVideoURL] = useState(null)
  const [videoMetadata, setVideoMetadata] = useState({ width: 0, height: 0, ratio: 'auto' })
  const [captions, setCaptions] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [selectedStyle, setSelectedStyle] = useState('mrbeast')
  const [selectedRatio, setSelectedRatio] = useState('9:16')

  const [processingError, setProcessingError] = useState(null)
  const [processingStep, setProcessingStep] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)

  // ─── Init from localStorage ───────────────────────────────────────────────
  useEffect(() => {
    const storedKey = localStorage.getItem('GROQ_API_KEY')
    if (storedKey) { setApiKey(storedKey); setPage('home') }
    const storedStyle = localStorage.getItem('CAPTION_STYLE')
    if (storedStyle) setSelectedStyle(storedStyle === 'classic' ? 'mrbeast' : storedStyle)
  }, [])

  const handleSetStyle = (s) => { setSelectedStyle(s); localStorage.setItem('CAPTION_STYLE', s) }
  const handleSaveKey  = (key) => { localStorage.setItem('GROQ_API_KEY', key); setApiKey(key); setPage('home') }
  const handleOpenSettings = () => setPage('setup')

  // ─── Core transcription flow ──────────────────────────────────────────────
  const performGroqTranscription = async (file, language) => {
    setIsTranscribing(true)
    setProcessingError(null)
    setProcessingStep('')

    const globalTimer = setTimeout(() => {
      setProcessingError('Process timed out after 90 seconds. Please retry.')
      setIsTranscribing(false)
    }, 90000)

    try {
      setProcessingStep('Extracting audio from video...')
      if (file.size > 50 * 1024 * 1024) throw new Error('Please use a video under 2 minutes')

      const audioContext = new AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const float32Array = audioBuffer.getChannelData(0)

      setProcessingStep('Converting audio format...')
      const wavBlob = encodeWAV(float32Array, 16000)

      setProcessingStep('Sending to Groq AI...')
      const formData = new FormData()
      formData.append('file', wavBlob, 'audio.wav')
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('response_format', 'verbose_json')
      formData.append('timestamp_granularities[]', 'word')
      formData.append('temperature', '0.0')

      if (language === 'en') formData.append('language', 'en')
      if (language === 'hi') formData.append('language', 'hi')
      // hinglish + auto → NO language parameter (forces auto-detect)

      const HINGLISH_PROMPT = 
        "Casual Indian Hinglish only. Transcribe exactly as spoken in Roman script: " +
        "keep Hindi words unchanged (like bhai, yaar, arre, mast, scene hai, bol raha, kya, ho gaya), " +
        "English words as is, full code-mixing preserved, slang intact, no translation to pure English, " +
        "no normalization, no grammar fixes."

      const hiPrompt = "यह हिंदी ऑडियो है। बिल्कुल जैसा बोला गया वैसा देवनागरी में लिखो। अनुवाद मत करो।"
      const enPrompt = "English audio. Transcribe word-for-word exactly as spoken. No translation."

      formData.append('prompt', language === 'hinglish' ? HINGLISH_PROMPT : (language === 'hi' ? hiPrompt : enPrompt))

      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        body: formData
      })

      if (!whisperResponse.ok) {
        const errText = await whisperResponse.text()
        let msg = errText
        try { const js = JSON.parse(errText); if (js.error?.message) msg = js.error.message } catch (_) {}
        throw new Error('Whisper Error: ' + msg)
      }

      setProcessingStep('Synthesizing captions...')
      const result = await whisperResponse.json()

      if (!result.words || result.words.length === 0) throw new Error('No speech detected in this audio.')

      const HALLUCINATIONS = new Set(['you', '...', '[music]', '[inaudible]', '[applause]', '[laughter]', ''])
      const rawWords = result.words.filter((w) => {
        const duration = w.end - w.start
        const cleanText = w.word.trim().toLowerCase().replace(/[.,!?;:'"()-]/g, '')
        if (duration < 0.05 || w.start === w.end || cleanText.length === 0 || HALLUCINATIONS.has(cleanText)) return false
        return true
      })

      if (rawWords.length === 0) throw new Error('No speech detected in this audio.')

      let finalTranscribedWords = rawWords.map((w) => ({
        text: w.word.trim(),
        start: w.start,
        end: w.end
      }))

      // ── Step 8: LLM Correction for Hinglish (Anti-Translation Layer) ───────
      if (language === 'hinglish') {
        setProcessingStep('Correcting translation errors...')
        const fullText = finalTranscribedWords.map(w => w.text).join(' ')
        
        try {
          const llmResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: "You are a Hinglish expert. Rewrite the given transcription back to original spoken Hinglish in Roman script. Keep all code-mixing and slang (bhai, yaar, arre, mast, etc.). Direct transcription only. Output ONLY the fixed text."
                },
                {
                  role: 'user',
                  content: `This is a Whisper transcription that might have translated Hindi to English. Rewrite it back to EXACT original spoken Hinglish in Roman script only. Preserve the natural flow.\n\nTranscription: ${fullText}`
                }
              ],
              temperature: 0.1
            })
          })

          if (llmResponse.ok) {
            const llmJson = await llmResponse.json()
            const correctedText = llmJson.choices[0]?.message?.content?.trim()
            if (correctedText) {
              const correctedWords = correctedText.split(/\s+/).filter(w => w.length > 0)
              
              // Map corrected words back to original timestamps
              // We use index-based mapping; if word count changed slightly, we distribute
              finalTranscribedWords = finalTranscribedWords.map((original, idx) => {
                const newWord = correctedWords[idx] || (idx === finalTranscribedWords.length - 1 ? correctedWords.slice(idx).join(' ') : '')
                return {
                  ...original,
                  text: newWord || original.text
                }
              }).filter(w => w.text.length > 0)
            }
          }
        } catch (llmErr) {
          console.warn('LLM correction failed, using raw transcription:', llmErr)
        }
      }

      // Final Transliteration if needed (though LLM is told Roman script)
      const sanitizedWords = finalTranscribedWords.map(w => ({
        ...w,
        text: language === 'hinglish' ? transliterateToRoman(w.text) : w.text
      }))

      setProcessingStep('Done!')
      setCaptions(sanitizedWords)
      setPage('result')

    } catch (err) {
      console.error('Transcription error:', err)
      setProcessingError(err.message || 'An unknown error occurred.')
    } finally {
      clearTimeout(globalTimer)
      setIsTranscribing(false)
    }
  }

  const handleTranscribe = (file, language, ratio) => {
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoURL(url)
    setSelectedLanguage(language)
    setSelectedRatio(ratio)
    setPage('processing')

    const video = document.createElement('video')
    video.src = url
    video.onloadedmetadata = () => {
      setVideoMetadata({ 
        width: video.videoWidth, 
        height: video.videoHeight, 
        ratio: video.videoWidth / video.videoHeight 
      })
      performGroqTranscription(file, language)
    }
  }

  const handleRetry = () => {
    if (videoFile) { setProcessingError(null); performGroqTranscription(videoFile, selectedLanguage) }
    else setPage('home')
  }

  const handleReset = () => {
    if (videoURL) URL.revokeObjectURL(videoURL)
    setVideoFile(null); setVideoURL(null); setCaptions([]); setPage('home')
  }

  return (
    <ErrorBoundary>
      <SpaceBackground />
      <div className="app-container">
        {page === 'setup' && <SetupPage onSave={handleSaveKey} />}
        {page === 'home' && (
          <HomePage
            onTranscribe={handleTranscribe}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            onOpenSettings={handleOpenSettings}
            selectedStyle={selectedStyle}
            setSelectedStyle={handleSetStyle}
            selectedRatio={selectedRatio}
            setSelectedRatio={setSelectedRatio}
          />
        )}
        {page === 'processing' && (
          <ProcessingPage error={processingError} step={processingStep} onRetry={handleRetry} isTranscribing={isTranscribing} />
        )}
        {page === 'result' && (
          <ResultPage
            videoURL={videoURL}
            videoMetadata={videoMetadata}
            selectedRatio={selectedRatio}
            captions={captions}
            selectedStyle={selectedStyle}
            language={selectedLanguage}
            onReset={handleReset}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
