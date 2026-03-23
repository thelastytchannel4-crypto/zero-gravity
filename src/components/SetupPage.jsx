import { useState } from 'react'

export default function SetupPage({ onSave }) {
  const [apiKey, setApiKey] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (apiKey.trim()) {
      onSave(apiKey.trim())
    }
  }

  return (
    <div className="glass-card">
      <h2 style={{ color: '#00F5FF', textShadow: '0 0 10px #00F5FF' }}>GET YOUR FREE GROQ API KEY</h2>
      
      <div style={{ textAlign: 'left', margin: '2rem 0', lineHeight: '1.8' }}>
        <p><strong>Step 1</strong> — Go to <a href="https://groq.com" target="_blank" rel="noreferrer" style={{ color: '#FF2D87', textDecoration: 'none' }}>groq.com</a></p>
        <p><strong>Step 2</strong> — Click Sign Up — use Google account — completely free</p>
        <p><strong>Step 3</strong> — Click API Keys in dashboard</p>
        <p><strong>Step 4</strong> — Click Create API Key</p>
        <p><strong>Step 5</strong> — Copy and paste it below</p>
        <p style={{ color: '#00F5FF', marginTop: '1rem', fontStyle: 'italic' }}>This is completely free — no credit card — no limits</p>
      </div>

      <form onSubmit={handleSubmit}>
        <input 
          type="password" 
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxx"
          style={{ 
            width: '100%', 
            padding: '15px', 
            borderRadius: '10px', 
            border: '2px solid #00F5FF', 
            background: 'transparent',
            color: 'white',
            fontSize: '1.2rem',
            textAlign: 'center',
            boxShadow: '0 0 15px rgba(0, 245, 255, 0.5), inset 0 0 10px rgba(0, 245, 255, 0.3)',
            marginBottom: '2rem',
            outline: 'none'
          }}
          required
        />
        <button type="submit" className="neon-button" style={{ width: '100%' }}>
          Save
        </button>
      </form>
    </div>
  )
}
