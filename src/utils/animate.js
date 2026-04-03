import * as THREE from 'three'
import gsap from 'gsap'
import { playSound } from './audio.js'
import { spawnBabyFishes } from './fishes.js'
import { spawnBubble } from './interactions.js'

export function animateGame(
  delta,
  now,
  time,
  gameState,
  camera,
  scene,
  controls,
  waterGun,
  moveState,
  fishArray,
  fishCountRef,
  foodArray,
  mushroomArray,
  seaweedArray,
  bubbleArray,
  waterBullets
) {
  // Update controls
  controls.update()
  
  // Camera Movement (WASD + Shift)
  if (gameState === 'playing') {
    const moveSpeed = 10 * delta
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    
    // Ignore pitch for WASD movement to stay horizontal
    forward.y = 0
    forward.normalize()
    right.y = 0
    right.normalize()
    
    if (moveState.forward) camera.position.add(forward.clone().multiplyScalar(moveSpeed))
    if (moveState.backward) camera.position.sub(forward.clone().multiplyScalar(moveSpeed))
    if (moveState.right) camera.position.add(right.clone().multiplyScalar(moveSpeed))
    if (moveState.left) camera.position.sub(right.clone().multiplyScalar(moveSpeed))
    
    if (moveState.up) camera.position.y += moveSpeed
    if (moveState.down) camera.position.y -= moveSpeed
    
    // Simple Boundaries
    if (camera.position.y < 1) camera.position.y = 1
    if (camera.position.y > 10) camera.position.y = 10
    if (camera.position.x > 40) camera.position.x = 40
    if (camera.position.x < -40) camera.position.x = -40
    if (camera.position.z > 40) camera.position.z = 40
    if (camera.position.z < -40) camera.position.z = -40
    
    // Update orbit controls target to move with camera
    const lookAtDist = 5
    const viewDir = new THREE.Vector3()
    camera.getWorldDirection(viewDir)
    controls.target.copy(camera.position).add(viewDir.multiplyScalar(lookAtDist))
    
    // Gun bobbing animation
    if (waterGun) {
      const bobbing = Math.sin(now / 200) * 0.05
      waterGun.position.y = -0.8 + bobbing
    }
  }
  
  // Update Fishes
  fishArray.forEach(fish => {
    if (!fish || !fish.userData) return
    
    // Size affects speed
    const sizePenalty = 1 / fish.scale.x
    const currentMaxSpeed = fish.userData.speed * sizePenalty
    
    // Swim animation (tail wag)
    const wagSpeed = fish.userData.isStartled ? 25 : 15 * sizePenalty
    if (!fish.userData.isStunned) {
      fish.userData.swimCycle += delta * wagSpeed
      if (fish.userData.tail) {
        fish.userData.tail.rotation.y = Math.sin(fish.userData.swimCycle) * 0.3
      }
    }
    
    let targetVec = null
    let targetSpeed = currentMaxSpeed
    
    // Hunger logic: fish becomes hungry after 20 seconds
    const hungerTime = now - fish.userData.lastEatenTime
    const canEat = hungerTime > 20000 // Fixed 20 seconds cooldown
    
    // Faint if starving (hungry for 30s after the 20s cooldown, total 50s)
    if (!fish.userData.isStunned && hungerTime > 50000) {
      fish.userData.isStunned = true
      fish.userData.isStartled = false
      fish.userData.isStarvedFaint = true // Mark as fainted from hunger
      fish.userData.hitCount = 0
      fish.userData.velocity.set(0, -0.05, 0)
      
      gsap.to(fish.rotation, {
        z: Math.PI,
        duration: 0.5,
        ease: 'power2.out'
      })
      // The recovery logic will be triggered when the fish hits the bottom
    }
    
    if (canEat && !fish.userData.isStartled && !fish.userData.isStunned) {
      let targetItem = null
      let targetType = ''
      let itemIndex = -1
      let minDist = 35 // Increase feeding detection range so fish can spot food from further away
      
      // Find the absolute closest food item (player food or mushroom)
      if (foodArray.length > 0) {
        foodArray.forEach((f, idx) => {
          if (!f) return
          const dist = fish.position.distanceTo(f.position)
          if (dist < minDist) {
            minDist = dist
            targetItem = f
            targetType = 'playerFood'
            itemIndex = idx
          }
        })
      }
      
      mushroomArray.forEach((m, idx) => {
        if (!m) return
        const dist = fish.position.distanceTo(m.position)
        if (dist < minDist) {
          minDist = dist
          targetItem = m
          targetType = 'mushroom'
          itemIndex = idx
        }
      })
      
      if (targetItem) {
        targetVec = targetItem.position.clone().sub(fish.position)
        // Adjust targeting slightly above the mushroom base so fish doesn't dive into the floor
        if (targetType === 'mushroom') targetVec.y += 0.2 
        targetVec.normalize()
        
        targetSpeed = currentMaxSpeed * (targetType === 'playerFood' ? 2.5 : 1.2)
        
        // Eat it
        if (minDist < 1.5) {
          fish.userData.lastEatenTime = now
          playSound('pop')
          
          let isPoisonous = false
          if (targetType === 'playerFood') {
            scene.remove(targetItem)
            foodArray[itemIndex] = null // will filter below
          } else if (targetType === 'mushroom') {
            isPoisonous = targetItem.userData.isPoisonous
            gsap.to(targetItem.scale, {
              x: 0, y: 0, z: 0,
              duration: 0.2,
              onComplete: () => scene.remove(targetItem)
            })
            mushroomArray[itemIndex] = null
          }
          
          if (isPoisonous) {
            fish.userData.isStunned = true
            fish.userData.isStartled = false
            fish.userData.isPoisonedDead = true // Mark as dead from poison
            fish.userData.hitCount = 0
            fish.userData.velocity.set(0, -0.05, 0)
            
            gsap.to(fish.rotation, {
              z: Math.PI,
              duration: 0.5,
              ease: 'power2.out'
            })
            // The 2s disappearance logic is now handled when the fish hits the bottom
          } else {
            // Both player food and normal mushrooms count towards breeding
            fish.userData.itemsEaten = (fish.userData.itemsEaten || 0) + 1
            if (fish.userData.itemsEaten >= 2) {
              gsap.to(fish.scale, {
                x: fish.scale.x * 1.05, y: fish.scale.y * 1.05, z: fish.scale.z * 1.05,
                duration: 0.3, ease: "back.out(1.7)"
              })
              
              spawnBabyFishes(fish, 2, scene, fishArray, { value: fishCountRef.value })
              fish.userData.itemsEaten = 0
              
              // Increment breed count
              fish.userData.breedCount = (fish.userData.breedCount || 0) + 1
              
              // Die after 3 breeding cycles
              if (fish.userData.breedCount >= 3) {
                fish.userData.isStunned = true
                fish.userData.isStartled = false
                fish.userData.isOldAgeDead = true // Mark as dead from old age
                fish.userData.hitCount = 0
                fish.userData.velocity.set(0, -0.05, 0)
                
                gsap.to(fish.rotation, {
                  z: Math.PI,
                  duration: 0.5,
                  ease: 'power2.out'
                })
              }
            } else {
              gsap.to(fish.scale, {
                x: fish.scale.x * 1.10, y: fish.scale.y * 1.10, z: fish.scale.z * 1.10,
                duration: 0.3, ease: "back.out(1.7)"
              })
            }
          }
        }
      }
    }
    
    if (targetVec && !fish.userData.isStunned) {
      fish.userData.velocity.lerp(targetVec.multiplyScalar(targetSpeed), 0.08)
    } else if (!fish.userData.isStunned) {
      const isPlaying = gameState === 'playing'
      const timeSinceHit = now - fish.userData.lastHitTime
      let isFleeingPlayer = false
      
      if (isPlaying && timeSinceHit < 60000 && !fish.userData.isStartled) {
        const distToCamera = fish.position.distanceTo(camera.position)
        if (distToCamera < 20) {
           isFleeingPlayer = true
           const dirAway = fish.position.clone().sub(camera.position).normalize()
           dirAway.x += (Math.random() - 0.5) * 0.5
           dirAway.y += (Math.random() - 0.5) * 0.5
           dirAway.z += (Math.random() - 0.5) * 0.5
           
           targetSpeed = currentMaxSpeed * 1.5
           fish.userData.velocity.lerp(dirAway.normalize().multiplyScalar(targetSpeed), 0.05)
        }
      }
      
      let boundsX = isPlaying ? 45 : 8
      const boundsY = isPlaying ? 15 : 8
      let boundsZ = isPlaying ? 45 : 4
      let centerX = 0
      let centerZ = 0
      
      if (isPlaying && !isFleeingPlayer) {
        // Dynamic density: 5 fish per 20m radius
        // The fewer the fish, the smaller the radius, keeping them close to the player
        const dynamicRadius = Math.max(20, Math.sqrt(fishArray.length / 5) * 20.0)
        boundsX = dynamicRadius
        boundsZ = dynamicRadius
        
        // Center the swarm slightly in front of the camera so they follow the player
        const viewDir = new THREE.Vector3()
        camera.getWorldDirection(viewDir)
        centerX = camera.position.x + viewDir.x * 4
        centerZ = camera.position.z + viewDir.z * 4
      }

      const p = fish.position
      const v = fish.userData.velocity
      
      if (!isFleeingPlayer) {
        if (!fish.userData.targetDirection) {
          fish.userData.targetDirection = new THREE.Vector3(Math.random()-0.5, (Math.random()-0.5)*0.2, Math.random()-0.5).normalize()
        }
        if (Math.random() < 0.01 && !fish.userData.isStartled) {
          fish.userData.targetDirection.set(Math.random()-0.5, (Math.random()-0.5)*0.2, Math.random()-0.5).normalize()
        }
        
        if (p.x > centerX + boundsX) { fish.userData.targetDirection.x = -Math.abs(fish.userData.targetDirection.x) - 0.1; v.x -= 0.01 }
        if (p.x < centerX - boundsX) { fish.userData.targetDirection.x = Math.abs(fish.userData.targetDirection.x) + 0.1; v.x += 0.01 }
        if (p.y > boundsY) { fish.userData.targetDirection.y = -Math.abs(fish.userData.targetDirection.y) - 0.1; v.y -= 0.01 }
        if (p.y < 1) { 
          fish.userData.targetDirection.y = Math.abs(fish.userData.targetDirection.y) + 0.1; 
          v.y += 0.01; 
          if (p.y < 0.5) p.y = 0.5; // Prevent clipping through the floor and accumulating infinite upward velocity
        }
        if (p.z > centerZ + boundsZ) { fish.userData.targetDirection.z = -Math.abs(fish.userData.targetDirection.z) - 0.1; v.z -= 0.01 }
        if (p.z < centerZ - boundsZ) { fish.userData.targetDirection.z = Math.abs(fish.userData.targetDirection.z) + 0.1; v.z += 0.01 }
        fish.userData.targetDirection.normalize()
        
        v.lerp(fish.userData.targetDirection.clone().multiplyScalar(targetSpeed), 0.02)
      } else {
        const globalBounds = 45;
        if (p.x > globalBounds) v.x -= 0.005
        if (p.x < -globalBounds) v.x += 0.005
        if (p.y > boundsY) v.y -= 0.005
        if (p.y < 1) v.y += 0.005
        if (p.z > globalBounds) v.z -= 0.005
        if (p.z < -globalBounds) v.z += 0.005
        v.normalize().multiplyScalar(targetSpeed)
      }
    }
    
    fish.position.add(fish.userData.velocity)
    
    if (fish.userData.isStunned && fish.position.y <= 1.0) {
      fish.position.y = 1.0
      fish.userData.velocity.set(0, 0, 0)
      
      if ((fish.userData.isPoisonedDead || fish.userData.isOldAgeDead) && !fish.userData.disappearing) {
        fish.userData.disappearing = true
        setTimeout(() => {
          if (!fish || !fish.parent) return
          gsap.to(fish.scale, {
            x: 0, y: 0, z: 0,
            duration: 1,
            onComplete: () => {
              scene.remove(fish)
              fish.userData.dead = true // mark to filter
            }
          })
        }, 2000)
      } else if (fish.userData.isStarvedFaint && !fish.userData.recovering) {
        fish.userData.recovering = true
        
        // Recover after 5 seconds of lying on the bottom
        setTimeout(() => {
          if (fish && fish.userData) {
            gsap.to(fish.rotation, {
              z: 0,
              duration: 0.5,
              ease: 'power2.inOut',
              onComplete: () => {
                fish.userData.isStunned = false
                fish.userData.isStartled = true
                fish.userData.isStarvedFaint = false
                fish.userData.recovering = false
                fish.userData.lastEatenTime = Date.now() // Reset hunger timer so it doesn't immediately faint again
                
                // Dash away upon waking up
                const escapeDir = new THREE.Vector3(
                  (Math.random() - 0.5),
                  (Math.random() - 0.5) * 0.2,
                  (Math.random() - 0.5)
                ).normalize()
                fish.userData.velocity.copy(escapeDir.multiplyScalar(0.2))
                
                setTimeout(() => {
                  if (fish && fish.userData) fish.userData.isStartled = false
                }, 3000)
              }
            })
          }
        }, 5000)
      }
    }
    
    if (!fish.userData.isStunned && fish.userData.velocity.lengthSq() > 0.0001) {
      const lookTarget = fish.position.clone().add(fish.userData.velocity)
      fish.lookAt(lookTarget)
    }
  })
  
  // Clean up food array (nulls from eating)
  for (let i = foodArray.length - 1; i >= 0; i--) {
    if (!foodArray[i]) foodArray.splice(i, 1)
  }
  
  // Animate Food
  foodArray.forEach((food, idx) => {
    if (!food) return
    if (food.position.y > 0.1) {
      food.position.y -= delta * 1.5 // sink
      if (food.position.y <= 0.1) {
        food.position.y = 0.1 // Stay on the floor
      }
    }
  })
  
  mushroomArray.forEach(m => {
    if (!m) return
    if (Math.random() < 0.01) {
      const pos = m.position.clone()
      pos.y += 0.6 * m.scale.y
      spawnBubble(pos, scene, bubbleArray)
    }
  })
  
  bubbleArray.forEach((b, index) => {
    if (!b) return
    b.position.y += delta * 2
    b.position.x += Math.sin(time * 3 + b.userData.offset) * 0.01
    if (b.position.y > 8) {
      scene.remove(b)
      bubbleArray[index] = null
    }
  })
  
  waterBullets.forEach((bullet, index) => {
    if (!bullet) return
    bullet.position.add(bullet.userData.velocity)
    bullet.userData.life += delta
    
    fishArray.forEach(fish => {
      if (fish.userData.dead) return
      const hitRadius = 1.0 * fish.scale.x
      if (!fish.userData.isStunned && bullet.position.distanceTo(fish.position) < hitRadius) {
        fish.userData.hitCount++
        bullet.userData.life = 100
        
        const origColor = fish.children[0].children[0].material.color.clone()
        fish.children[0].children[0].material.color.setHex(0xffffff)
        setTimeout(() => {
          if(fish && fish.children[0] && fish.children[0].children[0]) {
             fish.children[0].children[0].material.color.copy(origColor)
          }
        }, 100)

        if (fish.userData.hitCount >= 1) {
            fish.userData.isStunned = true
            fish.userData.isStartled = false
            fish.userData.hitCount = 0
            fish.userData.lastHitTime = Date.now()
            
            if (fish.userData.type === 'cow') playSound('moo')
            else if (fish.userData.type === 'shark') playSound('hit_shark')
            else if (fish.userData.type === 'turtle') playSound('hit_turtle')
            else if (fish.userData.type === 'jellyfish') playSound('hit_jellyfish')
            else if (fish.userData.type === 'long' || fish.userData.type === 'flat') playSound('hit_small')
            else playSound('hit')
            
            fish.userData.velocity.set(0, -0.04, 0)
            gsap.to(fish.rotation, { z: Math.PI, duration: 0.5, ease: 'power2.out' })
            
            setTimeout(() => {
              if (fish && fish.userData) gsap.to(fish.rotation, { z: 0, duration: 0.5, ease: 'power2.inOut' })
            }, 10000)
            
            setTimeout(() => {
              if (fish && fish.userData) {
                fish.userData.isStunned = false
                fish.userData.isStartled = true
                const escapeDir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5) * 0.2, (Math.random() - 0.5)).normalize()
                fish.userData.velocity.copy(escapeDir.multiplyScalar(0.2))
                setTimeout(() => { if (fish && fish.userData) fish.userData.isStartled = false }, 3000)
              }
            }, 13000)
          } else {
            fish.userData.isStartled = true
            if (fish.userData.type === 'cow') playSound('moo')
            else if (fish.userData.type === 'shark') playSound('hit_shark')
            else if (fish.userData.type === 'turtle') playSound('hit_turtle')
            else if (fish.userData.type === 'jellyfish') playSound('hit_jellyfish')
            else if (fish.userData.type === 'long' || fish.userData.type === 'flat') playSound('hit_small')
            else playSound('hit')
          
          const pushDir = bullet.userData.velocity.clone().normalize()
          fish.userData.velocity.copy(pushDir.multiplyScalar(0.15))
          setTimeout(() => {
            if (fish && fish.userData && !fish.userData.isStunned) fish.userData.isStartled = false
          }, 2000)
        }
      }
    })
    
    mushroomArray.forEach((m, mIndex) => {
      if (!m) return
      const hitRadius = 0.6 * m.scale.x
      if (bullet.position.distanceTo(m.position) < hitRadius) {
        playSound('pop')
        bullet.userData.life = 100
        gsap.to(m.scale, {
          x: 0, y: 0, z: 0, duration: 0.2,
          onComplete: () => scene.remove(m)
        })
        mushroomArray[mIndex] = null
      }
    })
    
    if (bullet.userData.life > 3.0) {
      scene.remove(bullet)
      waterBullets[index] = null
    }
  })
  
  // Clean arrays
  for (let i = fishArray.length - 1; i >= 0; i--) {
    if (fishArray[i].userData.dead) fishArray.splice(i, 1)
  }
  for (let i = foodArray.length - 1; i >= 0; i--) {
    if (!foodArray[i]) foodArray.splice(i, 1)
  }
  for (let i = waterBullets.length - 1; i >= 0; i--) {
    if (!waterBullets[i]) waterBullets.splice(i, 1)
  }
  for (let i = mushroomArray.length - 1; i >= 0; i--) {
    if (!mushroomArray[i]) mushroomArray.splice(i, 1)
  }
  for (let i = bubbleArray.length - 1; i >= 0; i--) {
    if (!bubbleArray[i]) bubbleArray.splice(i, 1)
  }
  
  seaweedArray.forEach(seaweed => {
    if (!seaweed) return
    const positions = seaweed.geometry.attributes.position
    const origVerts = seaweed.userData.originalVertices
    const swayFactor = seaweed.userData.isTriangle ? 0.2 : 0.5
    
    for (let i = 0; i < positions.count; i++) {
      const orig = origVerts[i]
      if (orig.y > 0.1) {
        const heightFactor = orig.y / 5.0 
        const swayX = Math.sin(time * 1.5 + seaweed.userData.swayOffset + orig.y * 0.5) * swayFactor * heightFactor
        const swayZ = Math.cos(time * 1.2 + seaweed.userData.swayOffset + orig.y * 0.5) * swayFactor * heightFactor * 0.5
        positions.setX(i, orig.x + swayX)
        positions.setZ(i, orig.z + swayZ)
      }
    }
    positions.needsUpdate = true
  })
}