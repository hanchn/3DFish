<template>
  <div class="game-container">
    <!-- 3D Canvas -->
    <div ref="canvasContainer" class="canvas-container"></div>

    <!-- UI Overlay -->
    <div v-if="gameState === 'start'" class="start-screen">
      <h1>3D 捕鱼游戏</h1>
      <button @click="startGame" class="start-btn">开始游戏</button>
    </div>

    <!-- Game UI -->
    <div v-if="gameState === 'playing'">
      <div class="game-ui">
        <!-- Crosshair -->
        <div class="crosshair">+</div>
        <div class="status fish-count">
          鱼群数量: {{ fishCount }}
        </div>
        <transition name="fade">
          <div v-if="showInstructions" class="status instructions">
            按 J 键生成普通蘑菇，K 键生成毒蘑菇<br>
            按 L 键投喂鱼食<br>
            按键盘 W A S D 移动<br>
            鼠标瞄准鱼，按空格键发射水弹<br>
            按 Shift 键下降
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'
import { playSound } from './utils/audio.js'
import { createFishModel } from './utils/models.js'
import { createEnvironment } from './utils/environment.js'
import { spawnMushroom, spawnInitialMushrooms } from './utils/mushroom.js'
import { createFishes, spawnBabyFishes } from './utils/fishes.js'
import { createWaterGun, spawnBubble, shootWaterBullet, dropFoodAtCenter } from './utils/interactions.js'
import { animateGame } from './utils/animate.js'

const canvasContainer = ref(null)
const gameState = ref('start') // 'start' or 'playing'
const fishCount = ref(0)
const showInstructions = ref(true)

// Three.js variables
let scene, camera, renderer, controls
let fishArray = []
let foodArray = []
let raycaster, mouse
let waterSurfacePlane
let animationFrameId
let clock
let table, tankGroup, water
let seaweedArray = []
let rockArray = []
let mushroomArray = []
let bubbleArray = []
let floor
let waterGun
let waterBullets = []

// Colors and types
const fishTypes = ['wide', 'flat', 'long', 'turtle', 'jellyfish', 'shark', 'cow']
const colors = [0xff9900, 0xff3333, 0x3399ff, 0xffcc00, 0xcc33ff, 0x33cc33]

// Movement state
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false
}

function startMove(dir) {
  moveState[dir] = true
}

function stopMove() {
  moveState.forward = false
  moveState.backward = false
  moveState.left = false
  moveState.right = false
  moveState.up = false
  moveState.down = false
}

onMounted(() => {
  initThree()
  
  // We wrap variables in objects/refs so the external function can update them
  const waterSurfacePlaneRef = { value: waterSurfacePlane }
  const tableRef = { value: table }
  const tankGroupRef = { value: tankGroup }
  const waterRef = { value: water }
  
  createEnvironment(
    scene,
    rockArray,
    seaweedArray,
    waterSurfacePlaneRef,
    tableRef,
    tankGroupRef,
    waterRef
  )
  
  waterSurfacePlane = waterSurfacePlaneRef.value
  table = tableRef.value
  tankGroup = tankGroupRef.value
  water = waterRef.value
  
  const fishCountRef = { value: fishCount.value }
  createFishes(40, scene, fishArray, fishCountRef) // create 40 fishes initially
  fishCount.value = fishCountRef.value
  
  spawnInitialMushrooms(scene, camera, mushroomArray, gameState.value, fishCount.value) // spawn initial mushrooms based on fish count
  animate()
  
  window.addEventListener('resize', onWindowResize)
  
  // Keyboard controls
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  
  // Add mousemove listener for aiming
  window.addEventListener('mousemove', onMouseMove)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)
  
  cancelAnimationFrame(animationFrameId)
  if (renderer) renderer.dispose()
})

function onKeyDown(event) {
  if (gameState.value !== 'playing') return
  switch(event.code) {
    case 'KeyW':
    case 'ArrowUp':
      moveState.forward = true
      break
    case 'KeyS':
    case 'ArrowDown':
      moveState.backward = true
      break
    case 'KeyA':
    case 'ArrowLeft':
      moveState.left = true
      break
    case 'KeyD':
    case 'ArrowRight':
      moveState.right = true
      break
    case 'KeyJ':
      spawnMushroom(scene, camera, mushroomArray, gameState.value, false, false) // normal mushroom
      break
    case 'KeyK':
      spawnMushroom(scene, camera, mushroomArray, gameState.value, false, true) // poisonous mushroom
      break
    case 'KeyL':
      dropFoodAtCenter(gameState.value, camera, scene, foodArray) // drop fish food
      break
    case 'Space':
      shootWaterBullet(gameState.value, waterGun, camera, scene, waterBullets, mouse, raycaster, waterSurfacePlane)
      break
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.down = true
      break
  }
}

function onKeyUp(event) {
  switch(event.code) {
    case 'KeyW':
    case 'ArrowUp':
      moveState.forward = false
      break
    case 'KeyS':
    case 'ArrowDown':
      moveState.backward = false
      break
    case 'KeyA':
    case 'ArrowLeft':
      moveState.left = false
      break
    case 'KeyD':
    case 'ArrowRight':
      moveState.right = false
      break
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.down = false
      break
  }
}

function initThree() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // sky color
  
  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  // Initial camera position (outside looking at table)
  camera.position.set(0, 15, 30)
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  canvasContainer.value.appendChild(renderer.domElement)
  
  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.enablePan = false // Disable right-click panning
  controls.target.set(0, 2, 0)
  controls.maxPolarAngle = Math.PI / 2 - 0.1 // don't go below floor
  // Initially we restrict angles just a bit
  
  // Create an extended floor for the wider underwater scene
  const floorGeo = new THREE.PlaneGeometry(100, 100)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 })
  floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.1
  floor.visible = false // Hide until game starts
  scene.add(floor)
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 20, 10)
  directionalLight.castShadow = true
  directionalLight.shadow.camera.top = 20
  directionalLight.shadow.camera.bottom = -20
  directionalLight.shadow.camera.left = -20
  directionalLight.shadow.camera.right = 20
  scene.add(directionalLight)
  
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  clock = new THREE.Clock()
  
  // Water Gun Model (Attached to camera)
  const waterGunRef = { value: waterGun }
  createWaterGun(camera, scene, waterGunRef)
  waterGun = waterGunRef.value
}



// The createEnvironment has been imported from utils






function startGame() {
  gameState.value = 'playing'
  showInstructions.value = true
  
  // Hide instructions after 3 seconds
  setTimeout(() => {
    showInstructions.value = false
  }, 3000)
  
  // Underwater transition
  const underwaterColor = new THREE.Color(0x3399ff) // Brighter, clearer blue
  gsap.to(scene.background, {
    r: underwaterColor.r,
    g: underwaterColor.g,
    b: underwaterColor.b,
    duration: 2
  })
  
  scene.fog = new THREE.FogExp2(0x87ceeb, 0)
  gsap.to(scene.fog, {
    density: 0.03, // Reduced fog density so it's less murky
    duration: 2,
    onUpdate: () => {
      scene.fog.color.lerpColors(new THREE.Color(0x87ceeb), underwaterColor, scene.fog.density / 0.03)
    }
  })

  // Fade out exterior objects to create an independent underwater scene
  const materialsToFade = [
    table.material,
    water.material,
    ...tankGroup.children.map(c => c.material)
  ]
  
  materialsToFade.forEach(mat => {
    mat.transparent = true
    gsap.to(mat, {
      opacity: 0,
      duration: 2,
      onComplete: () => {
        table.visible = false
        tankGroup.visible = false
        water.visible = false
      }
    })
  })
  
  // Expand environment objects outwards
  floor.visible = true
  rockArray.forEach(rock => {
    gsap.to(rock.position, {
      x: rock.userData.targetPosition.x,
      z: rock.userData.targetPosition.z,
      duration: 2.5,
      ease: 'power2.inOut'
    })
  })
  
  seaweedArray.forEach(seaweed => {
    gsap.to(seaweed.position, {
      x: seaweed.userData.targetPosition.x,
      z: seaweed.userData.targetPosition.z,
      duration: 2.5,
      ease: 'power2.inOut'
    })
  })
  
  mushroomArray.forEach(mushroom => {
    if (!mushroom) return
    gsap.to(mushroom.position, {
      x: mushroom.userData.targetPosition.x,
      z: mushroom.userData.targetPosition.z,
      duration: 2.5,
      ease: 'power2.inOut'
    })
  })
  
  // Make fish also spread out slightly
  fishArray.forEach(fish => {
    const expandDir = fish.position.clone()
    expandDir.y = 0
    if (expandDir.lengthSq() > 0.1) {
      expandDir.normalize().multiplyScalar(5 + Math.random() * 10)
      gsap.to(fish.position, {
        x: fish.position.x + expandDir.x,
        z: fish.position.z + expandDir.z,
        duration: 3,
        ease: 'power2.out'
      })
    }
  })
  
  // Dynamic mushroom spawner interval has been removed.
  
  // Animate camera zooming into the tank
  gsap.to(camera.position, {
    x: 0,
    y: 4,
    z: 2, // Deep inside the tank
    duration: 2,
    ease: 'power2.inOut',
    onComplete: () => {
      // Remove angle restrictions to allow free horizontal and vertical rotation
      controls.minAzimuthAngle = -Infinity
      controls.maxAzimuthAngle = Infinity
      
      // Still prevent looking under the floor
      controls.minPolarAngle = 0
      controls.maxPolarAngle = Math.PI / 2 - 0.1
    }
  })
  
  gsap.to(controls.target, {
    x: 0,
    y: 4,
    z: -5,
    duration: 2,
    ease: 'power2.inOut'
  })
}

function onWindowResize() {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function onMouseMove(event) {
  if (gameState.value !== 'playing') return
  // Calculate mouse position in normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  // Make gun point slightly towards mouse position to simulate aiming
  if (waterGun) {
    // Base rotation relative to camera
    waterGun.rotation.y = Math.PI / 16 - mouse.x * 0.5
    waterGun.rotation.x = mouse.y * 0.5
  }
}



function animate() {
  animationFrameId = requestAnimationFrame(animate)
  const delta = clock.getDelta()
  
  if (controls) controls.update()
  
  // Handle Camera Movement
  if (gameState.value === 'playing') {
    const moveSpeed = 5.0 * delta
    
    // Get forward direction from camera
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0 // Keep movement strictly horizontal for forward/backward
    forward.normalize()
    
    const right = new THREE.Vector3()
    right.crossVectors(forward, camera.up).normalize()
    
    const up = new THREE.Vector3(0, 1, 0)
    
    if (moveState.forward) {
      camera.position.add(forward.clone().multiplyScalar(moveSpeed))
      controls.target.add(forward.clone().multiplyScalar(moveSpeed))
    }
    if (moveState.backward) {
      camera.position.sub(forward.clone().multiplyScalar(moveSpeed))
      controls.target.sub(forward.clone().multiplyScalar(moveSpeed))
    }
    if (moveState.left) {
      camera.position.sub(right.clone().multiplyScalar(moveSpeed))
      controls.target.sub(right.clone().multiplyScalar(moveSpeed))
    }
    if (moveState.right) {
      camera.position.add(right.clone().multiplyScalar(moveSpeed))
      controls.target.add(right.clone().multiplyScalar(moveSpeed))
    }
    if (moveState.up) {
      camera.position.add(up.clone().multiplyScalar(moveSpeed))
      controls.target.add(up.clone().multiplyScalar(moveSpeed))
    }
    if (moveState.down) {
      // Prevent going under the floor
      if (camera.position.y > 1.0) {
        camera.position.sub(up.clone().multiplyScalar(moveSpeed))
        controls.target.sub(up.clone().multiplyScalar(moveSpeed))
      }
    }
  }
  
  // Animate Fish
    const now = Date.now()
    fishArray.forEach(fish => {
      // Calculate current speed limit based on size (scale.x)
      // Base scale is 1.0. As it grows, speed decreases.
      const sizePenalty = Math.max(0.3, 1.0 / Math.pow(fish.scale.x, 1.5))
      let currentMaxSpeed = fish.userData.speed * sizePenalty
      
      // Determine if startled
      if (fish.userData.isStartled) {
        currentMaxSpeed *= 3.0 // Swim very fast when startled
      }
      
      // Fear of Mouse Logic (only if not stunned)
      if (!fish.userData.isStunned && raycaster) {
        // We do a quick check if mouse ray intersects this fish
        // To save performance, we only do this occasionally or rely on distance to the ray
        const intersects = raycaster.intersectObject(fish, true)
        if (intersects.length > 0 && !fish.userData.isStartled) {
          // Mouse is over the fish! Scare it away.
          fish.userData.isStartled = true
          
          // Get ray direction
          const rayDir = raycaster.ray.direction.clone()
          // Push away from the ray direction, slightly downwards
          rayDir.y -= 0.5
          fish.userData.velocity.copy(rayDir.normalize().multiplyScalar(0.1))
          
          setTimeout(() => {
            if (fish && fish.userData) fish.userData.isStartled = false
          }, 1500)
        }
      }

      // Swim animation (tail wag)
      // Tail wags faster if moving faster
      const wagSpeed = fish.userData.isStartled ? 25 : 15 * sizePenalty
      if (!fish.userData.isStunned) {
        fish.userData.swimCycle += delta * wagSpeed
        if (fish.userData.tail) {
          fish.userData.tail.rotation.y = Math.sin(fish.userData.swimCycle) * 0.3
        }
      }
      
      // Determine target (food or random wandering)
      let targetVec = null
      let targetSpeed = currentMaxSpeed
      
      // Check cooldown (individual hunger interval, avg 30s)
      const hungerTime = now - fish.userData.lastEatenTime
      const canEat = hungerTime > fish.userData.hungerInterval
      
      // Faint if not eaten in 30s beyond hunger interval
      if (!fish.userData.isStunned && hungerTime > fish.userData.hungerInterval + 30000) {
        fish.userData.isStunned = true
        fish.userData.isStartled = false
        fish.userData.hitCount = 0
        fish.userData.velocity.set(0, -0.05, 0)
        
        gsap.to(fish.rotation, {
          z: Math.PI,
          duration: 0.5,
          ease: 'power2.out'
        })
        
        // Wake up after 30 seconds
        setTimeout(() => {
          if (fish && fish.userData) {
            // Unflip animation
            gsap.to(fish.rotation, {
              z: 0,
              duration: 0.5,
              ease: 'power2.inOut'
            })
          }
        }, 30000)
        
        // Wait 3 seconds after waking up to swim away (Total 33s)
        setTimeout(() => {
          if (fish && fish.userData) {
            fish.userData.isStunned = false
            fish.userData.isStartled = true // Wake up scared
            fish.userData.lastEatenTime = Date.now() // Reset hunger slightly so it doesn't faint instantly
            
            // Shoot away
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
        }, 33000)
      }
      
      if (canEat && !fish.userData.isStartled && !fish.userData.isStunned) {
        let targetItem = null
        let targetType = ''
        let itemIndex = -1
        let minDist = Infinity
        
        // Priority 1: Check player food (fish food) (within 35 units)
        if (foodArray.length > 0) {
          foodArray.forEach((f, idx) => {
            const dist = fish.position.distanceTo(f.position)
            if (dist < minDist) {
              minDist = dist
              targetItem = f
              targetType = 'playerFood'
              itemIndex = idx
            }
          })
        }
        
        if (minDist > 35) targetItem = null // Too far for falling food
        
        // Priority 2: If no falling food, check mushrooms
        if (!targetItem) {
          minDist = Infinity
          
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
          
          // Expanded search radius to 30 units so they can find ground food easily
          if (minDist > 30) targetItem = null 
        }
        
        if (targetItem) {
          targetVec = targetItem.position.clone().sub(fish.position)
          // Ground items adjust vector slightly downward
          if (targetType === 'mushroom') {
            targetVec.y -= 0.5 
          }
          targetVec.normalize()
          
          targetSpeed = currentMaxSpeed * (targetType === 'playerFood' ? 2.5 : 1.2)
          
          // Eat item if close enough
          if (minDist < 1.5) {
            fish.userData.lastEatenTime = now // Set cooldown
            playSound('pop')
            
            let isPoisonous = false
            
            if (targetType === 'playerFood') {
              scene.remove(targetItem)
              foodArray = foodArray.filter(f => f !== targetItem)
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
              // Poisoned: Flip belly up, die, disappear after 30s
              fish.userData.isStunned = true
              fish.userData.isStartled = false
              fish.userData.hitCount = 0
              fish.userData.velocity.set(0, -0.05, 0)
              
              gsap.to(fish.rotation, {
                z: Math.PI,
                duration: 0.5,
                ease: 'power2.out'
              })
              
              setTimeout(() => {
                if (!fish || !fish.parent) return
                // Fade out and disappear
                gsap.to(fish.scale, {
                  x: 0, y: 0, z: 0,
                  duration: 1,
                  onComplete: () => {
                    scene.remove(fish)
                    fishArray = fishArray.filter(f => f !== fish)
                    fishCount.value = fishArray.length
                  }
                })
              }, 30000)
            } else {
              // Normal food / safe mushroom / seaweed eaten
              fish.userData.itemsEaten = (fish.userData.itemsEaten || 0) + 1
              
              if (fish.userData.itemsEaten >= 2) {
                // Grow slightly
                gsap.to(fish.scale, {
                  x: fish.scale.x * 1.05,
                  y: fish.scale.y * 1.05,
                  z: fish.scale.z * 1.05,
                  duration: 0.3,
                  ease: "back.out(1.7)"
                })
                spawnBabyFishes(fish, 2)
                fish.userData.itemsEaten = 0
              } else {
                // Grow a little bit
                gsap.to(fish.scale, {
                  x: fish.scale.x * 1.10,
                  y: fish.scale.y * 1.10,
                  z: fish.scale.z * 1.10,
                  duration: 0.3,
                  ease: "back.out(1.7)"
                })
              }
            }
          }
        }
      }
      
      if (targetVec && !fish.userData.isStunned) {
        // Steer towards food with increased speed
        fish.userData.velocity.lerp(targetVec.multiplyScalar(targetSpeed), 0.08)
      } else if (!fish.userData.isStunned) {
        // Random wandering & Avoiding Player
        const isPlaying = gameState.value === 'playing'
        
        // 1-minute fear logic (60000ms)
        const timeSinceHit = now - fish.userData.lastHitTime
        let isFleeingPlayer = false
        if (isPlaying && timeSinceHit < 60000 && !fish.userData.isStartled) {
          // If within 1 minute of being hit, check distance to camera
          const distToCamera = fish.position.distanceTo(camera.position)
          if (distToCamera < 20) { // If player is within 20 units
             isFleeingPlayer = true
             // Swim away from camera!
             const dirAway = fish.position.clone().sub(camera.position).normalize()
             // Add a little randomness so they don't all swim in perfectly straight lines
             dirAway.x += (Math.random() - 0.5) * 0.5
             dirAway.y += (Math.random() - 0.5) * 0.5
             dirAway.z += (Math.random() - 0.5) * 0.5
             
             // Speed up to escape player
             targetSpeed = currentMaxSpeed * 1.5
             fish.userData.velocity.lerp(dirAway.normalize().multiplyScalar(targetSpeed), 0.05)
          }
        }
        
        // Check boundaries - use expanded boundaries if playing, else tank boundaries
        const boundsX = isPlaying ? 35 : 8
        const boundsY = isPlaying ? 15 : 8
        const boundsZ = isPlaying ? 35 : 4
        const p = fish.position
        const v = fish.userData.velocity
        
        if (!isFleeingPlayer) {
          // Initialize target direction if needed
          if (!fish.userData.targetDirection) {
            fish.userData.targetDirection = new THREE.Vector3(Math.random()-0.5, (Math.random()-0.5)*0.2, Math.random()-0.5).normalize()
          }
          
          // Randomize occasionally to create "from all directions" crossing feel
          if (Math.random() < 0.01 && !fish.userData.isStartled) {
            fish.userData.targetDirection.set(
              Math.random() - 0.5,
              (Math.random() - 0.5) * 0.2,
              Math.random() - 0.5
            ).normalize()
          }
          
          // Bounce off boundaries by reflecting target direction
          if (p.x > boundsX) { fish.userData.targetDirection.x = -Math.abs(fish.userData.targetDirection.x) - 0.1; v.x -= 0.01 }
          if (p.x < -boundsX) { fish.userData.targetDirection.x = Math.abs(fish.userData.targetDirection.x) + 0.1; v.x += 0.01 }
          if (p.y > boundsY) { fish.userData.targetDirection.y = -Math.abs(fish.userData.targetDirection.y) - 0.1; v.y -= 0.01 }
          if (p.y < 1) { fish.userData.targetDirection.y = Math.abs(fish.userData.targetDirection.y) + 0.1; v.y += 0.01 }
          if (p.z > boundsZ) { fish.userData.targetDirection.z = -Math.abs(fish.userData.targetDirection.z) - 0.1; v.z -= 0.01 }
          if (p.z < -boundsZ) { fish.userData.targetDirection.z = Math.abs(fish.userData.targetDirection.z) + 0.1; v.z += 0.01 }
          fish.userData.targetDirection.normalize()
          
          // Smoothly steer towards the target direction
          v.lerp(fish.userData.targetDirection.clone().multiplyScalar(targetSpeed), 0.02)
        } else {
          // Still enforce bounds when fleeing
          if (p.x > boundsX) v.x -= 0.005
          if (p.x < -boundsX) v.x += 0.005
          if (p.y > boundsY) v.y -= 0.005
          if (p.y < 1) v.y += 0.005
          if (p.z > boundsZ) v.z -= 0.005
          if (p.z < -boundsZ) v.z += 0.005
          v.normalize().multiplyScalar(targetSpeed)
        }
      }
      
      // Apply velocity
      fish.position.add(fish.userData.velocity)
      
      // Enforce boundaries for stunned fish sinking down
      if (fish.userData.isStunned) {
        if (fish.position.y < 1.0) {
          fish.position.y = 1.0
          fish.userData.velocity.set(0, 0, 0)
        }
      }
      
      // Look in direction of travel
      if (!fish.userData.isStunned && fish.userData.velocity.lengthSq() > 0.0001) {
        const lookTarget = fish.position.clone().add(fish.userData.velocity)
        fish.lookAt(lookTarget)
      }
    })
  
  // Animate Food
  foodArray.forEach(food => {
    food.position.y -= delta * 1.5 // sink
    if (food.position.y < 0.5) {
      scene.remove(food)
      foodArray = foodArray.filter(f => f !== food)
    }
  })
  
  // Animate Mushrooms (emit bubbles)
  const time = clock.getElapsedTime()
  mushroomArray.forEach(m => {
    if (Math.random() < 0.01) { // Occasional bubbles
      const pos = m.position.clone()
      pos.y += 0.6 * m.scale.y // Top of mushroom
      spawnBubble(pos)
    }
  })
  
  // Animate Bubbles
  bubbleArray.forEach((b, index) => {
    b.position.y += delta * 2
    b.position.x += Math.sin(time * 3 + b.userData.offset) * 0.01
    if (b.position.y > 8) {
      scene.remove(b)
      bubbleArray[index] = null
    }
  })
  bubbleArray = bubbleArray.filter(b => b !== null)
  
  // Animate Water Bullets
  waterBullets.forEach((bullet, index) => {
    bullet.position.add(bullet.userData.velocity)
    bullet.userData.life += delta
    
    // Check collisions with fish
    fishArray.forEach(fish => {
      // Basic distance check for collision
      // Increase hit radius based on fish scale
      const hitRadius = 1.0 * fish.scale.x
      if (!fish.userData.isStunned && bullet.position.distanceTo(fish.position) < hitRadius) {
        // Hit!
        fish.userData.hitCount++
        
        // Remove bullet
        bullet.userData.life = 100 // force removal
        
        // Visual flash
        const origColor = fish.children[0].children[0].material.color.clone() // Get top mesh color
        fish.children[0].children[0].material.color.setHex(0xffffff)
        setTimeout(() => {
          if(fish && fish.children[0] && fish.children[0].children[0]) {
             fish.children[0].children[0].material.color.copy(origColor)
          }
        }, 100)

        if (fish.userData.hitCount >= 1) {
            // Stun the fish (flip belly up)
            fish.userData.isStunned = true
            fish.userData.isStartled = false
            fish.userData.hitCount = 0
            fish.userData.lastHitTime = Date.now() // Record hit time for 1 minute fear
            
            if (fish.userData.type === 'cow') {
              playSound('moo')
            } else if (fish.userData.type === 'shark') {
              playSound('hit_shark')
            } else if (fish.userData.type === 'turtle') {
              playSound('hit_turtle')
            } else if (fish.userData.type === 'jellyfish') {
              playSound('hit_jellyfish')
            } else if (fish.userData.type === 'long' || fish.userData.type === 'flat') {
              playSound('hit_small')
            } else {
              playSound('hit')
            }
            
            // Stop swimming and sink down relatively fast to the floor
            fish.userData.velocity.set(0, -0.04, 0)
            
            // Flip animation (rotate Z by PI) immediately
            gsap.to(fish.rotation, {
              z: Math.PI,
              duration: 0.5,
              ease: 'power2.out'
            })
            
            // Unflip at 10 seconds (Lie dead on the floor for 10s)
            setTimeout(() => {
              if (fish && fish.userData) {
                // Unflip animation - fish wakes up but stays still
                gsap.to(fish.rotation, {
                  z: 0,
                  duration: 0.5,
                  ease: 'power2.inOut'
                })
              }
            }, 10000)
            
            // Wait 3 seconds after waking up, then swim away
            setTimeout(() => {
              if (fish && fish.userData) {
                fish.userData.isStunned = false
                fish.userData.isStartled = true // Wake up scared
                
                // Shoot away in a random direction
                const escapeDir = new THREE.Vector3(
                  (Math.random() - 0.5),
                  (Math.random() - 0.5) * 0.2,
                  (Math.random() - 0.5)
                ).normalize()
                fish.userData.velocity.copy(escapeDir.multiplyScalar(0.2))
                
                // Reset startled state after 3 seconds of escaping
                setTimeout(() => {
                  if (fish && fish.userData) fish.userData.isStartled = false
                }, 3000)
              }
            }, 13000) // 10s dead + 3s waking up
            
          } else {
            // Just startling hit (1st hit)
            fish.userData.isStartled = true
            
            if (fish.userData.type === 'cow') {
              playSound('moo')
            } else if (fish.userData.type === 'shark') {
              playSound('hit_shark')
            } else if (fish.userData.type === 'turtle') {
              playSound('hit_turtle')
            } else if (fish.userData.type === 'jellyfish') {
              playSound('hit_jellyfish')
            } else if (fish.userData.type === 'long' || fish.userData.type === 'flat') {
              playSound('hit_small')
            } else {
              playSound('hit')
            }
          
          // Push fish away from bullet direction
          const pushDir = bullet.userData.velocity.clone().normalize()
          fish.userData.velocity.copy(pushDir.multiplyScalar(0.15))
          
          // Reset startled state after 2 seconds
          setTimeout(() => {
            if (fish && fish.userData && !fish.userData.isStunned) {
              fish.userData.isStartled = false
            }
          }, 2000)
        }
      }
    })
    
    // Check collisions with mushrooms
      mushroomArray.forEach((m, mIndex) => {
        if (!m) return
        const hitRadius = 0.6 * m.scale.x
        if (bullet.position.distanceTo(m.position) < hitRadius) {
          // Hit!
          playSound('pop')
          
          // Remove bullet
          bullet.userData.life = 100 // force removal
          
          // Disappear animation
          gsap.to(m.scale, {
            x: 0, y: 0, z: 0,
            duration: 0.2,
            onComplete: () => {
              scene.remove(m)
            }
          })
          
          mushroomArray[mIndex] = null
          
          // Respawn after 20s
          // Removed automatic respawn
        }
      })
    
    // Remove if lived too long
    if (bullet.userData.life > 3.0) {
      scene.remove(bullet)
      waterBullets[index] = null
    }
  })
  // Clean up removed bullets and mushrooms and seaweeds
  waterBullets = waterBullets.filter(b => b !== null)
  mushroomArray = mushroomArray.filter(m => m !== null)
  seaweedArray = seaweedArray.filter(s => s !== null)
  
  // Animate Seaweeds (Sway effect)
  seaweedArray.forEach(seaweed => {
    if (!seaweed) return
    const positions = seaweed.geometry.attributes.position
    const origVerts = seaweed.userData.originalVertices
    const swayFactor = seaweed.userData.isTriangle ? 0.2 : 0.5 // Triangles sway less
    
    for (let i = 0; i < positions.count; i++) {
      const orig = origVerts[i]
      // Only animate vertices above the base
      if (orig.y > 0.1) {
        // Height factor: bottom stays still, top moves most
        const heightFactor = orig.y / 5.0 
        
        const swayX = Math.sin(time * 1.5 + seaweed.userData.swayOffset + orig.y * 0.5) * swayFactor * heightFactor
        const swayZ = Math.cos(time * 1.2 + seaweed.userData.swayOffset + orig.y * 0.5) * swayFactor * heightFactor * 0.5
        
        positions.setX(i, orig.x + swayX)
        positions.setZ(i, orig.z + swayZ)
      }
    }
    positions.needsUpdate = true
  })
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}
</script>
