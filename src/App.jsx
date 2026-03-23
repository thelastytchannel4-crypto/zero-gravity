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
  const [captions, setCaptions] = useState([])
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [selectedStyle, setSelectedStyle] = useState('mrbeast')

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

    // 90-second global safety timeout
    const globalTimer = setTimeout(() => {
      setProcessingError('Process timed out after 90 seconds. Please retry.')
      setIsTranscribing(false)
    }, 90000)

    try {
      // ── Step 1 ────────────────────────────────────────────────────────────
      console.log('Step 1 - Video file received:', file.name, file.size)
      setProcessingStep('Extracting audio from video...')

      if (file.size > 50 * 1024 * 1024) throw new Error('Please use a video under 2 minutes')

      // ── Step 2 ────────────────────────────────────────────────────────────
      console.log('Step 2 - Starting audio extraction')
      const audioContext = new AudioContext({ sampleRate: 16000 })

      // 30-second timeout on audio decode
      let arrayBuffer
      try {
        const decodeP = file.arrayBuffer()
        const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Audio extraction timed out after 30 seconds')), 30000))
        arrayBuffer = await Promise.race([decodeP, timeoutP])
      } catch (e) {
        throw new Error('Audio extraction failed: ' + e.message)
      }

      // ── Step 3 ────────────────────────────────────────────────────────────
      let audioBuffer
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      } catch (e) {
        throw new Error('Could not decode audio from video. Try a different file format.')
      }
      const float32Array = audioBuffer.getChannelData(0)
      console.log('Step 3 - Audio extracted successfully', float32Array.length)

      // ── Step 4 ────────────────────────────────────────────────────────────
      console.log('Step 4 - Converting to WAV blob')
      setProcessingStep('Converting audio format...')
      const wavBlob = encodeWAV(float32Array, 16000)
      console.log('Step 5 - WAV blob created', wavBlob.size)

      // ── Step 5: Build FormData (NO task param — not supported by Groq) ───
      console.log('Step 6 - Sending to Groq API')
      setProcessingStep('Sending to Groq AI...')

      const formData = new FormData()
      formData.append('file', wavBlob, 'audio.wav')
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('response_format', 'verbose_json')
      formData.append('timestamp_granularities[]', 'word')
      // ── Language param strategy ────────────────────────────────────────────
      // English  → force 'en'  (prevents hallucination in other scripts)
      // Hindi    → force 'hi'  (want Devanagari output, then transliterate)
      // Hinglish → NO language param — intentional auto-detect.
      //            Sending 'hi' coerces Devanagari output.
      //            Sending 'en' coerces English translation.
      //            Neither is correct. Auto-detect + rich prompt = best result.
      // Auto     → no language param
      if (language === 'en') formData.append('language', 'en')
      if (language === 'hi') formData.append('language', 'hi')
      // hinglish + auto → no language param (intentional)

      // ── Few-shot Whisper conditioning prompts (≤224 tokens) ───────────────
      // Whisper treats the prompt as a "previous transcript" — it biases the
      // model toward the vocabulary, script & style demonstrated in examples.
      // For Hinglish: seed with real Roman-script Hinglish so the model stays
      // in that register instead of defaulting to English translation.
      const PROMPTS = {
        hinglish:
          'Arre bhai, yeh scene toh fire hai yaar! ' +
          'Kya chal raha hai bro, sab theek toh hai na? ' +
          'Aaj ka din bohot mast tha, seriously next level experience tha. ' +
          'Dekh yaar, isko samajhna padega properly. ' +
          'Main bol raha tha ki yeh wala option better hai. ' +
          'Transcribe EXACTLY as spoken in Roman script Hinglish. ' +
          'Do NOT translate to English. Do NOT use Devanagari. Preserve all slang.',
        hi:
          'यह हिंदी ऑडियो है। बिल्कुल जैसा बोला गया वैसा देवनागरी में लिखो। ' +
          'अनुवाद मत करो। व्याकरण मत सुधारो।',
        en:
          'English audio. Transcribe word-for-word exactly as spoken. ' +
          'No translation, no grammar fixes, no text during silence or music.',
        auto:
          'Transcribe exactly as spoken in the original language. ' +
          'No translation. Skip silence and music.',
      }
      formData.append('prompt', PROMPTS[language] || PROMPTS.auto)

      // ── Step 6: Fetch with 60-second timeout ──────────────────────────────
      let response
      try {
        const fetchP = fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method : 'POST',
          headers: { 'Authorization': 'Bearer ' + apiKey },
          body   : formData
        })
        const toP = new Promise((_, rej) => setTimeout(() => rej(new Error('API request timed out after 60 seconds')), 60000))
        response = await Promise.race([fetchP, toP])
      } catch (e) {
        throw new Error('Network request failed: ' + e.message)
      }

      console.log('Step 7 - Groq response received, status:', response.status)

      if (response.status === 401) throw new Error('Invalid API key — please check your Groq dashboard')
      if (response.status === 413) throw new Error('Please use a video under 2 minutes')
      if (!response.ok) {
        const errText = await response.text()
        console.error('Groq Error Response:', errText)
        let msg = errText
        try { const js = JSON.parse(errText); if (js.error?.message) msg = js.error.message } catch (_) {}
        throw new Error('API Error: ' + msg)
      }

      setProcessingStep('Generating captions...')
      const result = await response.json()
      console.log('Step 7 - Full Groq result:', result)
      console.log('Step 8 - Words array:', result.words)

      if (!result.words || result.words.length === 0) throw new Error('No speech detected in this audio.')

      // ── Step 7: Post-process & map words ──────────────────────────────────
      // Filter out noise artifacts before building caption list:
      //   • Duration < 50ms  → likely a model glitch / background click
      //   • start === end    → zero-length timestamp, meaningless
      //   • text is blank / pure punctuation → nothing to display
      //   • text is common hallucination filler (Whisper sometimes emits these)
      const HALLUCINATIONS = new Set([
        'you', '...', '[music]', '[inaudible]', '[applause]',
        '[laughter]', '(music)', '(inaudible)', ''
      ])

      const rawWords = result.words.filter((w) => {
        const duration = w.end - w.start
        const clean    = w.word.trim().replace(/[.,!?;:'"()-]/g, '')
        if (duration < 0.05)                     return false  // <50ms — noise
        if (w.start === w.end)                   return false  // zero-length
        if (clean.length === 0)                  return false  // punctuation only
        if (HALLUCINATIONS.has(clean.toLowerCase())) return false
        return true
      })

      if (rawWords.length === 0) throw new Error('No speech detected in this audio.')

      const transcribedWords = rawWords.map((w) => {
        let text = w.word.trim()
        if (language === 'hinglish') text = transliterateToRoman(text)
        return { text, start: w.start, end: w.end }
      })

      setProcessingStep('Done!')
      setCaptions(transcribedWords)
      setPage('result')

    } catch (err) {
      console.error('Transcription error:', err)
      setProcessingError(err.message || 'An unknown error occurred.')
    } finally {
      clearTimeout(globalTimer)
      setIsTranscribing(false)
    }
  }

  const handleTranscribe = (file, language) => {
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoURL(url)
    setSelectedLanguage(language)
    setPage('processing')
    performGroqTranscription(file, language)
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
        {page === 'setup'      && <SetupPage onSave={handleSaveKey} />}
        {page === 'home'       && (
          <HomePage
            onTranscribe={handleTranscribe}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            onOpenSettings={handleOpenSettings}
            selectedStyle={selectedStyle}
            setSelectedStyle={handleSetStyle}
          />
        )}
        {page === 'processing' && (
          <ProcessingPage
            error={processingError}
            step={processingStep}
            onRetry={handleRetry}
            isTranscribing={isTranscribing}
          />
        )}
        {page === 'result'     && (
          <ResultPage
            videoURL={videoURL}
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
