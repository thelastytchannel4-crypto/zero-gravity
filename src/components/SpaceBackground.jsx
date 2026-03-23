import { useEffect, useState } from 'react'

export default function SpaceBackground() {
  const [isMobile, setIsMobile] = useState(false)
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isMobile])

  return (
    <div className="space-bg">
      {!isMobile && (
        <>
          <div className="stars"></div>
          <div className="floating-orb orb1"></div>
          <div className="floating-orb orb2"></div>
          <div 
            className="cursor-trail"
            style={{ 
              transform: `translate(${mousePos.x - 10}px, ${mousePos.y - 10}px)` 
            }}
          ></div>
        </>
      )}
    </div>
  )
}
