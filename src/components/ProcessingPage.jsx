import React from 'react'

export default function ProcessingPage({ error, onRetry, isTranscribing }) {
  return (
    <div className="glass-card">
      <h2>Processing Video</h2>
      
      {error && (
         <div style={{ color: '#FF1744', marginTop: '1rem', fontWeight: 'bold', textShadow: '0 0 10px rgba(255,23,68,0.5)' }}>
           {error}
           <div style={{ marginTop: '2rem' }}>
             <button className="neon-button" onClick={onRetry} style={{ borderColor: '#FF1744', color: '#FF1744', boxShadow: '0 0 10px #FF1744, inset 0 0 10px #FF1744' }}>
               Retry
             </button>
           </div>
         </div>
      )}

      {isTranscribing && !error && (
        <>
          <p style={{ color: '#00F5FF' }}>Extracting Audio and Uploading to API...</p>
          <div style={{ marginTop: '2rem' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              border: '4px solid rgba(0, 245, 255, 0.3)', 
              borderTopColor: '#00F5FF', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}
