import * as THREE from 'three'

// Function to generate a procedural texture with patterns
export function generateFishTexture(baseColorHex, type) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')

  const baseColor = new THREE.Color(baseColorHex)
  const hsl = {}
  baseColor.getHSL(hsl)
  
  // Fill base color
  context.fillStyle = '#' + baseColor.getHexString()
  context.fillRect(0, 0, 256, 256)

  // Determine pattern type based on fish type or random
  const patternType = Math.random() > 0.5 ? 'spots' : 'stripes'
  
  // Contrast color for pattern
  const patternColor = new THREE.Color()
  patternColor.setHSL(hsl.h, hsl.s, hsl.l > 0.5 ? hsl.l - 0.3 : hsl.l + 0.3)
  context.fillStyle = '#' + patternColor.getHexString()

  if (type === 'shark') {
    // Sharks just get a darker top, lighter bottom gradient-like or simple smooth look
    context.fillStyle = 'rgba(0,0,0,0.1)'
    for(let i=0; i<10; i++) {
      context.beginPath()
      context.arc(Math.random()*256, Math.random()*256, Math.random()*20, 0, Math.PI*2)
      context.fill()
    }
  } else if (type === 'cow') {
    // Cow pattern (black spots on white/color background)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 256, 256)
    context.fillStyle = '#111111'
    for(let i=0; i<12; i++) {
      context.beginPath()
      // Draw irregular blob
      context.arc(Math.random()*256, Math.random()*256, Math.random()*25 + 15, 0, Math.PI*2)
      context.fill()
    }
  } else if (type === 'mushroom') {
    // White spots for mushrooms
    context.fillStyle = '#ffffff'
    for(let i=0; i<20; i++) {
      context.beginPath()
      context.arc(Math.random()*256, Math.random()*256, Math.random()*15 + 10, 0, Math.PI*2)
      context.fill()
    }
  } else if (type === 'safe_mushroom') {
    // Solid color, maybe some very faint variations but no spots
    context.fillStyle = 'rgba(255,255,255,0.1)'
    for(let i=0; i<5; i++) {
      context.beginPath()
      context.arc(Math.random()*256, Math.random()*256, Math.random()*30 + 10, 0, Math.PI*2)
      context.fill()
    }
  } else if (type === 'turtle') {
    // Turtle shell pattern (hexagons)
    context.strokeStyle = '#' + patternColor.getHexString()
    context.lineWidth = 4
    for(let i=0; i<6; i++) {
      for(let j=0; j<6; j++) {
        context.strokeRect(i*50, j*50, 40, 40)
      }
    }
  } else if (patternType === 'spots') {
    for(let i=0; i<30; i++) {
      context.beginPath()
      context.arc(Math.random()*256, Math.random()*256, Math.random()*15 + 5, 0, Math.PI*2)
      context.fill()
    }
  } else { // stripes
    for(let i=0; i<10; i++) {
      context.fillRect(i*30, 0, 15, 256)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function createFishModel(type, color) {
  // Default base speed calculation based on type - slower
  let baseSpeed = 0.008
  if (type === 'wide') baseSpeed = 0.005
  if (type === 'flat') baseSpeed = 0.01
  if (type === 'long') baseSpeed = 0.015
  if (type === 'turtle') baseSpeed = 0.003
  if (type === 'jellyfish') baseSpeed = 0.002
  if (type === 'shark') baseSpeed = 0.02
  if (type === 'cow') baseSpeed = 0.004

  const group = new THREE.Group()
  group.userData.baseSpeed = baseSpeed
  group.userData.type = type
  
  // Use procedural texture instead of solid color
  const tex = generateFishTexture(color, type)
  const mainMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 }) // Light gray/white belly
  
  let bodyGroup = new THREE.Group()
  let tailGeo
  
  if (type === 'wide') {
    // Top half
    const topGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.3)
    topGeo.scale(0.8, 1, 1.2)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    // Bottom half (belly)
    const bottomGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, Math.PI / 2 + 0.3, Math.PI / 2 - 0.3)
    bottomGeo.scale(0.8, 0.4, 1.2)
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(topMesh, bottomMesh)
    
    tailGeo = new THREE.ConeGeometry(0.5, 1, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'flat') {
    // Cylinder is along Z after rotation.
    const topGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16, 1, false, -0.3, Math.PI + 0.6)
    topGeo.rotateX(Math.PI / 2)
    topGeo.rotateZ(Math.PI / 2)
    topGeo.scale(0.2, 1, 1)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    // Bottom half
    const bottomGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16, 1, false, Math.PI + 0.3, Math.PI - 0.6)
    bottomGeo.rotateX(Math.PI / 2)
    bottomGeo.rotateZ(Math.PI / 2)
    bottomGeo.scale(0.2, 0.4, 1)
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(topMesh, bottomMesh)
    
    tailGeo = new THREE.ConeGeometry(0.6, 0.8, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'long') {
    const topGeo = new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.3)
    topGeo.scale(0.6, 1.2, 4)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    const bottomGeo = new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, Math.PI / 2 + 0.3, Math.PI / 2 - 0.3)
    bottomGeo.scale(0.6, 0.5, 4)
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(topMesh, bottomMesh)
    
    tailGeo = new THREE.ConeGeometry(0.4, 0.8, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'turtle') {
    // Turtle Shell
    const shellGeo = new THREE.SphereGeometry(1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    shellGeo.scale(1, 0.5, 1.2)
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 })
    const shell = new THREE.Mesh(shellGeo, shellMat)
    
    // Belly
    const bottomGeo = new THREE.SphereGeometry(1, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    bottomGeo.scale(1, 0.2, 1.2)
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(shell, bottomMesh)
    
    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 16, 16)
    const head = new THREE.Mesh(headGeo, mainMat)
    head.position.set(0, 0, 1.2)
    bodyGroup.add(head)
    
    // Flippers
    tailGeo = new THREE.BoxGeometry(1.8, 0.1, 0.4)
    const flippers = new THREE.Mesh(tailGeo, mainMat)
    flippers.position.set(0, 0, 0.5)
    bodyGroup.add(flippers)
    
    // Small tail
    tailGeo = new THREE.ConeGeometry(0.2, 0.4, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'cow') {
    // Body (Boxy)
    const bodyGeo = new THREE.BoxGeometry(1, 0.8, 1.8)
    const bodyMesh = new THREE.Mesh(bodyGeo, mainMat)
    
    // Head
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.8)
    const head = new THREE.Mesh(headGeo, mainMat)
    head.position.set(0, 0.3, 1.2)
    
    // Udder
    const udderGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6)
    const udderMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 })
    const udder = new THREE.Mesh(udderGeo, udderMat)
    udder.position.set(0, -0.45, -0.2)
    
    // Horns
    const hornGeo = new THREE.ConeGeometry(0.1, 0.3, 4)
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee })
    const hornL = new THREE.Mesh(hornGeo, hornMat)
    hornL.position.set(-0.25, 0.7, 1.2)
    const hornR = new THREE.Mesh(hornGeo, hornMat)
    hornR.position.set(0.25, 0.7, 1.2)
    
    bodyGroup.add(bodyMesh, head, udder, hornL, hornR)
    
    // Tail
    tailGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6)
    tailGeo.rotateX(Math.PI / 2)
  } else if (type === 'shark') {
    // Shark Body
    const topGeo = new THREE.ConeGeometry(1, 4, 16, 1, false, 0, Math.PI)
    topGeo.rotateX(-Math.PI / 2)
    topGeo.rotateZ(Math.PI / 2)
    topGeo.scale(0.8, 1.2, 1)
    const topMesh = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4 }))
    
    const bottomGeo = new THREE.ConeGeometry(1, 4, 16, 1, false, Math.PI, Math.PI)
    bottomGeo.rotateX(-Math.PI / 2)
    bottomGeo.rotateZ(Math.PI / 2)
    bottomGeo.scale(0.8, 0.6, 1)
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    // Dorsal Fin
    const finGeo = new THREE.ConeGeometry(0.4, 1, 3)
    const fin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0x555555 }))
    fin.position.set(0, 1, 0)
    
    bodyGroup.add(topMesh, bottomMesh, fin)
    
    tailGeo = new THREE.ConeGeometry(0.8, 1.5, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'jellyfish') {
    // Dome
    const domeGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const jellyMat = new THREE.MeshPhysicalMaterial({
      color: color,
      transmission: 0.8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1
    })
    const dome = new THREE.Mesh(domeGeo, jellyMat)
    
    // Tentacles
    tailGeo = new THREE.CylinderGeometry(0.4, 0.1, 1.5, 8)
    const tentacles = new THREE.Mesh(tailGeo, jellyMat)
    tentacles.position.y = -0.7
    
    bodyGroup.add(dome)
  }
  
  // Enable shadows for body parts
  bodyGroup.children.forEach(child => {
    child.castShadow = true
  })
  
  group.add(bodyGroup)
  
  // Create Tail if it exists
  let tail
  if (tailGeo) {
    tail = new THREE.Mesh(tailGeo, mainMat)
    
    if (type === 'shark') {
      tail.position.z = -2.0
    } else if (type === 'turtle') {
      tail.position.z = -1.2
    } else if (type === 'cow') {
      tail.position.z = -0.9
    } else if (type === 'jellyfish') {
      tail.material = new THREE.MeshPhysicalMaterial({
        color: color,
        transmission: 0.8,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1
      })
      tail.position.y = -0.7
    } else {
      tail.position.z = type === 'long' ? -1.5 : -0.8
    }
    
    tail.castShadow = true
    
    // Store tail for animation
    group.userData.tail = tail
    group.add(tail)
  }
  
  // Eyes
  if (type !== 'jellyfish') {
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    
    if (type === 'shark') {
      eyeR.position.set(0.4, 0.2, 1.5)
      eyeL.position.set(-0.4, 0.2, 1.5)
    } else if (type === 'turtle') {
      eyeR.position.set(0.2, 0.1, 1.4)
      eyeL.position.set(-0.2, 0.1, 1.4)
    } else if (type === 'cow') {
      eyeR.position.set(0.3, 0.5, 1.6)
      eyeL.position.set(-0.3, 0.5, 1.6)
    } else {
      eyeR.position.set(type === 'flat' ? 0.2 : 0.4, 0.1, 0.5)
      eyeL.position.set(type === 'flat' ? -0.2 : -0.4, 0.1, 0.5)
    }
    
    group.add(eyeR, eyeL)
  }
  
  return group
}
