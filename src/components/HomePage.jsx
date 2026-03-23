import { useState } from 'react'

const STYLES = [
  { id: 'mrbeast', name: 'MrBeast', preview: 'Bangers Font • Yellow Active' },
  { id: 'karaoke', name: 'Karaoke', preview: 'Two Lines • Green Highlight' },
  { id: 'beasty', name: 'Beasty', preview: '1 Word • HUGE • Slam In' },
  { id: 'deep-diver', name: 'Deep Diver', preview: 'Pills • Dark on White' },
  { id: 'pod-p', name: 'Pod P', preview: '2 Words • Neon • Glow' },
  { id: 'youshaei', name: 'Youshaei', preview: 'Mixed Case • Accent' },
]

const RATIOS = [
  { id: '9:16', name: 'Instagram Reels / YouTube Shorts (9:16)' },
  { id: '16:9', name: 'YouTube Standard (16:9)' },
  { id: '4:5', name: 'Instagram Feed (4:5)' },
  { id: '1:1', name: 'Square (1:1)' },
]

export default function HomePage({ 
  onTranscribe, 
  selectedLanguage, 
  setSelectedLanguage, 
  onOpenSettings, 
  selectedStyle, 
  setSelectedStyle,
  selectedRatio,
  setSelectedRatio
}) {
  const [file, setFile] = useState(null)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (file) {
      onTranscribe(file, selectedLanguage, selectedRatio)
    }
  }

  return (
    <div className="glass-card" style={{ position: 'relative', maxWidth: '800px' }}>
      <button 
        onClick={onOpenSettings}
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          background: 'none', 
          border: 'none', 
          fontSize: '1.5rem', 
          cursor: 'pointer',
          opacity: 0.7,
          transition: 'opacity 0.2s',
          padding: '10px'
        }}
        onMouseOver={e => e.currentTarget.style.opacity = 1}
        onMouseOut={e => e.currentTarget.style.opacity = 0.7}
        title="Settings"
      >
        ⚙️
      </button>

      <h1>ZERO GRAVITY</h1>
      <p style={{ marginBottom: '2rem' }}>Groq AI Direct Video Captions in the Cloud.</p>
      
      <div className="style-selector">
        <h3>Choose Your Identity</h3>
        <div className="style-cards">
          {STYLES.map(s => (
            <div 
              key={s.id} 
              className={`style-card ${selectedStyle === s.id ? 'active' : ''}`}
              onClick={() => setSelectedStyle(s.id)}
            >
              <div className="style-name">{s.name}</div>
              <div className="style-preview">{s.preview}</div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Upload Video</label>
          <input 
            type="file" 
            accept="video/*" 
            onChange={handleFileChange} 
            style={{ width: '100%', padding: '10px', minHeight: '44px' }}
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Audio Language</label>
            <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="hi">Hindi (Devanagari)</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.8, fontSize: '0.9rem' }}>Platform / Ratio</label>
            <select value={selectedRatio} onChange={(e) => setSelectedRatio(e.target.value)}>
              {RATIOS.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          className="neon-button" 
          disabled={!file}
          style={!file ? { opacity: 0.5, cursor: 'not-allowed', width: '100%' } : { width: '100%' }}
        >
          Generate High-Speed Captions
        </button>
      </form>
    </div>
  )
}
