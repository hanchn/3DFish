export const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

export function playSound(type) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  
  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  
  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  
  const now = audioCtx.currentTime
  
  if (type === 'splash') {
    // Water drop / plop sound
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    
    osc.start(now)
    osc.stop(now + 0.3)
  } else if (type === 'hit') {
    // Hit sound (short, high pitch blip)
    osc.type = 'square'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    
    osc.start(now)
    osc.stop(now + 0.15)
  } else if (type === 'pop') {
    // Mushroom hit / bubble pop sound
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    
    osc.start(now)
    osc.stop(now + 0.15)
  } else if (type === 'moo') {
    // Cow 'moo' sound simulation
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.linearRampToValueAtTime(120, now + 0.5)
    osc.frequency.exponentialRampToValueAtTime(80, now + 1.0)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.2)
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.8)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.2)
    
    osc.start(now)
    osc.stop(now + 1.2)
  } else if (type === 'hit_jellyfish') {
    // Electric zap sound
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.linearRampToValueAtTime(100, now + 0.1)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    
    osc.start(now)
    osc.stop(now + 0.1)
  } else if (type === 'hit_shark') {
    // Deep heavy thud
    osc.type = 'sine'
    osc.frequency.setValueAtTime(100, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.05)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
    
    osc.start(now)
    osc.stop(now + 0.4)
  } else if (type === 'hit_turtle') {
    // Hard shell knock (wood block sound)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(400, now)
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.6, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    
    osc.start(now)
    osc.stop(now + 0.1)
  } else if (type === 'hit_small') {
    // High pitch plink for normal small fishes
    osc.type = 'square'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1)
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    
    osc.start(now)
    osc.stop(now + 0.1)
  }
}
