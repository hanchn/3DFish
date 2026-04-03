import * as THREE from 'three'
import gsap from 'gsap'
import { generateFishTexture } from './models.js'

export function spawnMushroom(
  scene,
  camera,
  mushroomArray,
  gameState,
  isInitial = false,
  forcePoisonous = null
) {
  const group = new THREE.Group()
  const scale = 0.5 + Math.random() * 1.5
  
  let isPoisonous = false
  if (forcePoisonous !== null) {
    isPoisonous = forcePoisonous
  } else {
    isPoisonous = Math.random() < 0.5
  }
  
  group.userData.isPoisonous = isPoisonous
  
  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.6, 16)
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 })
  const stem = new THREE.Mesh(stemGeo, stemMat)
  stem.position.y = 0.3
  stem.castShadow = true
  
  // Cap
  const capGeo = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI*2, 0, Math.PI/2)
  let capColor, texType
  
  if (isPoisonous) {
    capColor = 0xff0000 // Red
    texType = 'mushroom' // Has white spots
  } else {
    const safeColors = [0x8a2be2, 0x1e90ff, 0x32cd32, 0xffa500, 0x9932cc] 
    capColor = safeColors[Math.floor(Math.random() * safeColors.length)]
    texType = 'safe_mushroom' // No distinct spots
  }
  
  const tex = generateFishTexture(capColor, texType)
  const capMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
  const cap = new THREE.Mesh(capGeo, capMat)
  cap.position.y = 0.6
  cap.scale.set(1, 0.8, 1)
  cap.castShadow = true
  
  // Eyes on stem
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
  eyeR.position.set(0.1, 0.4, 0.25)
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.1, 0.4, 0.25)
  
  group.add(stem, cap, eyeR, eyeL)
  
  // Random position (bounds based on game state)
  const isPlaying = gameState === 'playing'
  // Make mushrooms spawn over a very wide area (45 units)
  const boundsX = isPlaying ? 45 : 8
  const boundsZ = isPlaying ? 45 : 4
  
  if (isInitial) {
    // Initial position inside the small tank
    group.position.set(
      (Math.random() - 0.5) * 16,
      0.1, // on the floor
      (Math.random() - 0.5) * 8
    )
    // Target position for when game starts (spread wide to 90 units total span)
    group.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 90,
      0.1,
      (Math.random() - 0.5) * 90
    )
  } else {
    // Spawn directly in front of the player (camera)
    const viewDirection = new THREE.Vector3()
    camera.getWorldDirection(viewDirection)
    viewDirection.y = 0 // Keep it on the same horizontal plane
    viewDirection.normalize()
    
    // Spawn 10 units in front of the camera, dropping to the floor
    const targetPos = camera.position.clone()
    targetPos.add(viewDirection.multiplyScalar(10))
    targetPos.y = 0.1 // Set to floor level
    
    group.position.copy(targetPos)
  }
  
  group.rotation.y = Math.random() * Math.PI * 2
  
  // Scale animation (grow from ground)
  group.scale.set(0.01, 0.01, 0.01)
  scene.add(group)
  mushroomArray.push(group)
  
  gsap.to(group.scale, {
    x: scale,
    y: scale,
    z: scale,
    duration: 2,
    ease: 'elastic.out(1, 0.5)'
  })
  
  group.userData.targetScale = scale
}

export function spawnInitialMushrooms(
  scene,
  camera,
  mushroomArray,
  gameState,
  fishCount
) {
  const targetCount = Math.max(1, Math.floor(fishCount / 10))
  for (let i = 0; i < targetCount; i++) {
    // Initial spawn mixes them up
    spawnMushroom(scene, camera, mushroomArray, gameState, true, Math.random() < 0.5)
  }
}
