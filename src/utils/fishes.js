import * as THREE from 'three'
import { createFishModel } from './models.js'

export const fishTypes = ['wide', 'flat', 'long', 'turtle', 'jellyfish', 'shark', 'cow', 'whale', 'pig', 'bird']
export const colors = [0xff9900, 0xff3333, 0x3399ff, 0xffcc00, 0xcc33ff, 0x33cc33]

export function createFishes(count, scene, fishArray, fishCountRef) {
  for (let i = 0; i < count; i++) {
    // If count matches exactly the number of types (7), create one of each
    // Otherwise fall back to random types
    const type = count === fishTypes.length ? fishTypes[i] : fishTypes[Math.floor(Math.random() * fishTypes.length)]
    const color = colors[Math.floor(Math.random() * colors.length)]
    
    const fish = createFishModel(type, color)
    
    const scale = 0.5 + Math.random() * 1.5
    fish.scale.set(scale, scale, scale)
    
    // Initial random position inside the tank (spread them out more)
    fish.position.set(
      (Math.random() - 0.5) * 19,
      1 + Math.random() * 7,
      (Math.random() - 0.5) * 11
    )
    
    // Random rotation
    fish.rotation.y = Math.random() * Math.PI * 2
    
    // Add velocity and other data
    fish.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.005,
      (Math.random() - 0.5) * 0.02
    )
    fish.userData.speed = fish.userData.baseSpeed + (Math.random() * 0.005)
    fish.userData.swimCycle = Math.random() * Math.PI * 2
    
    // Randomize initial lastEatenTime so they don't all get hungry at once
    // A fish will get hungry after 'hungerInterval' ms has passed since 'lastEatenTime'
    fish.userData.lastEatenTime = Date.now() - Math.random() * 20000 // Offset 0-20s initially
    fish.userData.hungerInterval = 25000 + Math.random() * 10000 // 25s - 35s, average 30s
    
    fish.userData.lastHitTime = 0 // Timestamp for fear cooldown
    fish.userData.hitCount = 0 // Track how many times hit
    fish.userData.isStartled = false // State for when hit by bullet
    fish.userData.isStunned = false // State for being flipped over
    fish.userData.normalMushroomEatenCount = 0
    fish.userData.color = color
    
    scene.add(fish)
    fishArray.push(fish)
  }
  if (fishCountRef) fishCountRef.value = fishArray.length
}

export function spawnBabyFishes(parentFish, count, scene, fishArray, fishCountRef) {
  for (let i = 0; i < count; i++) {
    const type = parentFish.userData.type
    const color = parentFish.userData.color || colors[Math.floor(Math.random() * colors.length)]
    const babyFish = createFishModel(type, color)
    
    // Scale down
    const initialScale = parentFish.scale.x * 0.4
    babyFish.scale.set(initialScale, initialScale, initialScale)
    
    // Position slightly offset from parent
    babyFish.position.copy(parentFish.position)
    babyFish.position.x += (Math.random() - 0.5) * 2
    babyFish.position.y += (Math.random() - 0.5) * 2
    babyFish.position.z += (Math.random() - 0.5) * 2
    
    // Velocity similar to parent but slightly randomized
    babyFish.userData.velocity = parentFish.userData.velocity.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.01
    ))
    
    babyFish.userData.speed = babyFish.userData.baseSpeed + (Math.random() * 0.005)
    babyFish.userData.swimCycle = Math.random() * Math.PI * 2
    
    babyFish.userData.lastEatenTime = Date.now() // freshly born, not hungry yet
    babyFish.userData.hungerInterval = 25000 + Math.random() * 10000 // 25s - 35s
    
    babyFish.userData.lastHitTime = 0
    babyFish.userData.hitCount = 0
    babyFish.userData.isStartled = false
    babyFish.userData.isStunned = false
    babyFish.userData.normalMushroomEatenCount = 0
    babyFish.userData.color = color
    
    scene.add(babyFish)
    fishArray.push(babyFish)
  }
  if (fishCountRef) fishCountRef.value = fishArray.length
}
