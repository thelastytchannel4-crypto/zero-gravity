import { useState, useEffect } from 'react'
import SetupPage from './components/SetupPage'
import HomePage from './components/HomePage'
import ProcessingPage from './components/ProcessingPage'
import ResultPage from './components/ResultPage'
import SpaceBackground from './components/SpaceBackground'
import ErrorBoundary from './components/ErrorBoundary'
import { floatToWavBlob } from './utils/wav'

// Simple Devanagari to Roman transliteration
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
  const [isTranscribing, setIsTranscribing] = useState(false)

  // Initialize from LocalStorage
  useEffect(() => {
    const storedKey = localStorage.getItem('GROQ_API_KEY')
    if (storedKey) {
      setApiKey(storedKey)
      setPage('home')
    }
    const storedStyle = localStorage.getItem('CAPTION_STYLE')
    if (storedStyle) {
       setSelectedStyle(storedStyle === 'classic' ? 'mrbeast' : storedStyle)
    }
  }, [])

  const handleSetStyle = (s) => {
    setSelectedStyle(s)
    localStorage.setItem('CAPTION_STYLE', s)
  }

  const handleSaveKey = (key) => {
    localStorage.setItem('GROQ_API_KEY', key)
    setApiKey(key)
    setPage('home')
  }

  const handleOpenSettings = () => {
    setPage('setup')
  }

  const performGroqTranscription = async (file, language) => {
    setIsTranscribing(true)
    setProcessingError(null)

    // Check size limit ~50MB limit to prevent memory crash or API 25MB limit 
    // We'll throw early if it exceeds 50MB
    if (file.size > 50 * 1024 * 1024) {
      setProcessingError("Please use a video under 2 minutes")
      setIsTranscribing(false)
      return
    }

    try {
      // Decode audio in browser
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const float32Array = audioBuffer.getChannelData(0)

      // Convert to WAV
      const wavBlob = floatToWavBlob(float32Array, 16000)

      // Prep FormData
      const formData = new FormData()
      formData.append('file', wavBlob, 'audio.wav')
      formData.append('model', 'whisper-large-v3-turbo')
      formData.append('response_format', 'verbose_json')
      formData.append('timestamp_granularities[]', 'word')
      formData.append('task', 'transcribe') // Ensures phonetic transcription, not English translation

      if (language === 'en') {
        formData.append('language', 'en')
      } else if (language === 'hi' || language === 'hinglish') {
        formData.append('language', 'hi')
      }

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        body: formData
      })

      if (response.status === 401) {
        throw new Error("Invalid API key — please check your Groq dashboard")
      }
      if (response.status === 413) {
        throw new Error("Please use a video under 2 minutes")
      }
      if (!response.ok) {
        const errText = await response.text()
        console.error("Groq Error Response:", errText)
        let parsedErr = errText
        try {
          const js = JSON.parse(errText)
          if (js.error && js.error.message) parsedErr = js.error.message
        } catch(e) {}
        throw new Error(`API Error: ${parsedErr}`)
      }

      const result = await response.json()

      if (!result.words || result.words.length === 0) {
        throw new Error("No speech detected in this audio.")
      }

      // Map Groq words to our state
      let transcribedWords = result.words.map((w) => {
        let text = w.word.trim()
        if (language === 'hinglish') {
           text = transliterateToRoman(text)
        }
        return {
          text: text,
          start: w.start,
          end: w.end
        }
      })

      setCaptions(transcribedWords)
      setPage('result')

    } catch (err) {
      console.error(err)
      setProcessingError(err.message || 'Network error occurred.')
    } finally {
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
    if (videoFile) {
      performGroqTranscription(videoFile, selectedLanguage)
    } else {
      setPage('home')
    }
  }

  const handleReset = () => {
    if (videoURL) URL.revokeObjectURL(videoURL)
    setVideoFile(null)
    setVideoURL(null)
    setCaptions([])
    setPage('home')
  }

  return (
    <ErrorBoundary>
      <SpaceBackground />
      <div className="app-container">
        {page === 'setup' && (
          <SetupPage onSave={handleSaveKey} />
        )}
        {page === 'home' && (
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
            onRetry={handleRetry} 
            isTranscribing={isTranscribing} 
          />
        )}
        {page === 'result' && (
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
