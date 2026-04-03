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
            按回车键投喂鱼食<br>
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
let floor
let waterGun
let waterBullets = []

// Sound Effects Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

function playSound(type) {
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
  }
}

// Colors and types
const fishTypes = ['wide', 'flat', 'long', 'turtle', 'jellyfish', 'shark']
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
  createEnvironment()
  createFishes(40) // create 40 fishes initially
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
    case 'Space':
      shootWaterBullet()
      break
    case 'Enter':
      dropFoodAtCenter()
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
  createWaterGun()
}

function createWaterGun() {
  waterGun = new THREE.Group()
  
  // Main barrel
  const barrelGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.2, 16)
  barrelGeo.rotateX(Math.PI / 2)
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.3, roughness: 0.5 })
  const barrel = new THREE.Mesh(barrelGeo, barrelMat)
  
  // Water tank
  const tankGeo = new THREE.SphereGeometry(0.3, 16, 16)
  tankGeo.scale(1, 1, 1.5)
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: 0x00aaff,
    transmission: 0.9,
    transparent: true,
    opacity: 0.8,
    roughness: 0.1
  })
  const gunTank = new THREE.Mesh(tankGeo, tankMat)
  gunTank.position.z = 0.5
  gunTank.position.y = -0.2
  
  // Handle
  const handleGeo = new THREE.BoxGeometry(0.15, 0.6, 0.2)
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
  const handle = new THREE.Mesh(handleGeo, handleMat)
  handle.position.z = 0.8
  handle.position.y = -0.4
  handle.rotation.x = Math.PI / 8
  
  waterGun.add(barrel, gunTank, handle)
  
  // Initially position it bottom center
  waterGun.position.set(0, -0.8, -1.5)
  
  camera.add(waterGun)
  scene.add(camera)
}

function createEnvironment() {
  // Table
  const tableGeometry = new THREE.BoxGeometry(30, 1, 20)
  const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
  table = new THREE.Mesh(tableGeometry, tableMaterial)
  table.position.y = -0.5
  table.receiveShadow = true
  scene.add(table)
  
  // Tank (Glass)
  const tankWidth = 20
  const tankHeight = 10
  const tankDepth = 12
  
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xaaaaaa,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.9,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  })
  
  // Create 4 walls and bottom
  tankGroup = new THREE.Group()
  
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(tankWidth, 0.2, tankDepth), glassMaterial)
  bottom.position.y = 0.1
  tankGroup.add(bottom)
  
  const back = new THREE.Mesh(new THREE.BoxGeometry(tankWidth, tankHeight, 0.2), glassMaterial)
  back.position.set(0, tankHeight/2, -tankDepth/2)
  tankGroup.add(back)
  
  const front = new THREE.Mesh(new THREE.BoxGeometry(tankWidth, tankHeight, 0.2), glassMaterial)
  front.position.set(0, tankHeight/2, tankDepth/2)
  tankGroup.add(front)
  
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, tankHeight, tankDepth), glassMaterial)
  left.position.set(-tankWidth/2, tankHeight/2, 0)
  tankGroup.add(left)
  
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, tankHeight, tankDepth), glassMaterial)
  right.position.set(tankWidth/2, tankHeight/2, 0)
  tankGroup.add(right)
  
  scene.add(tankGroup)
  
  // Water
  const waterGeometry = new THREE.BoxGeometry(tankWidth - 0.4, tankHeight - 1, tankDepth - 0.4)
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00aaff,
    transmission: 0.8,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2
  })
  water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.position.y = (tankHeight - 1) / 2 + 0.2
  scene.add(water)
  
  // Invisible plane for raycasting food drops
  const planeGeo = new THREE.PlaneGeometry(100, 100)
  const planeMat = new THREE.MeshBasicMaterial({ visible: false })
  waterSurfacePlane = new THREE.Mesh(planeGeo, planeMat)
  waterSurfacePlane.rotation.x = -Math.PI / 2
  waterSurfacePlane.position.y = 8 // Drop food from height 8
  scene.add(waterSurfacePlane)
  
  // Rocks
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
  for(let i=0; i<30; i++) {
    const rSize = 0.5 + Math.random() * 1.5
    const rockGeo = new THREE.DodecahedronGeometry(rSize, 1)
    const rock = new THREE.Mesh(rockGeo, rockMaterial)
    
    // Initial position inside the tank
    const initX = (Math.random() - 0.5) * (tankWidth - 2)
    const initZ = (Math.random() - 0.5) * (tankDepth - 2)
    rock.position.set(initX, rSize/2 + 0.2, initZ)
    
    // Store target expanded position for game start
    rock.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      rSize/2 + 0.2,
      (Math.random() - 0.5) * 60
    )
    
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0)
    rock.castShadow = true
    scene.add(rock)
    rockArray.push(rock)
  }

  // Seaweeds
  const seaweedMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x228b22, // Forest Green
    roughness: 0.6,
    side: THREE.DoubleSide
  })
  
  // Triangle Seaweed Material
  const triSeaweedMaterial = new THREE.MeshStandardMaterial({
    color: 0x32cd32, // Lime Green
    roughness: 0.5,
    side: THREE.DoubleSide
  })
  
  for(let i=0; i<40; i++) {
    const isTriangle = Math.random() > 0.5
    let seaweedGeo
    let seaweed
    
    if (isTriangle) {
      // Q-style Triangle Seaweed
      const height = 1.5 + Math.random() * 2
      seaweedGeo = new THREE.ConeGeometry(0.4 + Math.random() * 0.2, height, 3)
      seaweedGeo.translate(0, height / 2, 0)
      seaweed = new THREE.Mesh(seaweedGeo, triSeaweedMaterial)
    } else {
      // Normal stringy Seaweed
      const segments = 6
      const height = 2 + Math.random() * 5
      const radius = 0.15 + Math.random() * 0.1
      seaweedGeo = new THREE.CylinderGeometry(0.01, radius, height, 5, segments)
      seaweedGeo.translate(0, height / 2, 0)
      seaweed = new THREE.Mesh(seaweedGeo, seaweedMaterial)
    }
    
    // Initial position inside the tank
    const initX = (Math.random() - 0.5) * (tankWidth - 4)
    const initZ = (Math.random() - 0.5) * (tankDepth - 4)
    seaweed.position.set(initX, 0.2, initZ)
    
    // Store target expanded position for game start
    seaweed.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      0.2,
      (Math.random() - 0.5) * 60
    )
    
    // Store original vertices for animation
    seaweed.userData.originalVertices = []
    seaweed.userData.isTriangle = isTriangle
    const positionAttribute = seaweedGeo.attributes.position
    for (let j = 0; j < positionAttribute.count; j++) {
      seaweed.userData.originalVertices.push({
        x: positionAttribute.getX(j),
        y: positionAttribute.getY(j),
        z: positionAttribute.getZ(j)
      })
    }
    
    seaweed.userData.swayOffset = Math.random() * Math.PI * 2
    seaweed.castShadow = true
    scene.add(seaweed)
    seaweedArray.push(seaweed)
  }
}

function createFishModel(type, color) {
  // Default base speed calculation based on type - slower
  let baseSpeed = 0.008
  if (type === 'wide') baseSpeed = 0.005
  if (type === 'flat') baseSpeed = 0.01
  if (type === 'long') baseSpeed = 0.015
  if (type === 'turtle') baseSpeed = 0.003
  if (type === 'jellyfish') baseSpeed = 0.002
  if (type === 'shark') baseSpeed = 0.02

  const group = new THREE.Group()
  group.userData.baseSpeed = baseSpeed
  group.userData.type = type
  
  const mainMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 })
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 }) // Light gray/white belly
  
  let bodyGroup = new THREE.Group()
  let tailGeo
  
  if (type === 'wide') {
    // Top half
    const topGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.3) // Extend top further down
    topGeo.scale(0.8, 1, 1.2)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    // Bottom half (belly) - Make it smaller
    const bottomGeo = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, Math.PI / 2 + 0.3, Math.PI / 2 - 0.3)
    bottomGeo.scale(0.8, 0.4, 1.2) // Y scale reduced
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(topMesh, bottomMesh)
    
    tailGeo = new THREE.ConeGeometry(0.5, 1, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'flat') {
    // Cylinder is along Z after rotation. Let's make it out of two half cylinders
    const topGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16, 1, false, -0.3, Math.PI + 0.6) // Extend top around
    topGeo.rotateX(Math.PI / 2)
    topGeo.rotateZ(Math.PI / 2) // Orient correctly
    topGeo.scale(0.2, 1, 1)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    // Bottom half - Make it smaller
    const bottomGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 16, 1, false, Math.PI + 0.3, Math.PI - 0.6)
    bottomGeo.rotateX(Math.PI / 2)
    bottomGeo.rotateZ(Math.PI / 2)
    bottomGeo.scale(0.2, 0.4, 1) // Y scale reduced further
    const bottomMesh = new THREE.Mesh(bottomGeo, bellyMat)
    
    bodyGroup.add(topMesh, bottomMesh)
    
    tailGeo = new THREE.ConeGeometry(0.6, 0.8, 3)
    tailGeo.rotateX(-Math.PI / 2)
  } else if (type === 'long') {
    // Capsule is harder to split, let's use a sphere and cylinder approach or just scale a half sphere
    const topGeo = new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.3) // Extend top further down
    topGeo.scale(0.6, 1.2, 4)
    const topMesh = new THREE.Mesh(topGeo, mainMat)
    
    // Bottom half - Make it smaller
    const bottomGeo = new THREE.SphereGeometry(0.5, 16, 16, 0, Math.PI * 2, Math.PI / 2 + 0.3, Math.PI / 2 - 0.3)
    bottomGeo.scale(0.6, 0.5, 4) // Y scale reduced further
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
    
    // Flippers (simulate tail for animation)
    tailGeo = new THREE.BoxGeometry(1.8, 0.1, 0.4)
    const flippers = new THREE.Mesh(tailGeo, mainMat)
    flippers.position.set(0, 0, 0.5)
    bodyGroup.add(flippers)
    
    // Actually use a small tail for the tail animation logic
    tailGeo = new THREE.ConeGeometry(0.2, 0.4, 3)
    tailGeo.rotateX(-Math.PI / 2)
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
      // Jellyfish moves vertically mostly, we'll assign tentacles as 'tail'
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
      // Tail should be at the back (-Z)
      tail.position.z = type === 'long' ? -1.5 : -0.8
    }
    
    tail.castShadow = true
    
    // Store tail for animation
    group.userData.tail = tail
    group.add(tail)
  }
  
  // Eyes (front is +Z)
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
    } else {
      eyeR.position.set(type === 'flat' ? 0.2 : 0.4, 0.1, 0.5)
      eyeL.position.set(type === 'flat' ? -0.2 : -0.4, 0.1, 0.5)
    }
    
    group.add(eyeR, eyeL)
  }
  
  return group
}

  function createFishes(count) {
  for (let i = 0; i < count; i++) {
    const type = fishTypes[Math.floor(Math.random() * fishTypes.length)]
    const color = colors[Math.floor(Math.random() * colors.length)]
    const fish = createFishModel(type, color)
    
    // Initial random position inside the tank
    fish.position.set(
      (Math.random() - 0.5) * 16,
      1 + Math.random() * 6,
      (Math.random() - 0.5) * 8
    )
    
    // Initial random velocity
    fish.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.02
    )
    // Speed takes type and a little random variance into account
    fish.userData.speed = fish.userData.baseSpeed + (Math.random() * 0.005)
    fish.userData.swimCycle = Math.random() * Math.PI * 2
    fish.userData.lastEatenTime = 0 // Timestamp for cooldown
    fish.userData.hitCount = 0 // Track how many times hit
    fish.userData.isStartled = false // State for when hit by bullet
    fish.userData.isStunned = false // State for being flipped over
    
    scene.add(fish)
    fishArray.push(fish)
  }
  fishCount.value = fishArray.length
}

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

function shootWaterBullet() {
  if (gameState.value !== 'playing') return
  // Gun recoil animation
  gsap.killTweensOf(waterGun.position)
  gsap.to(waterGun.position, {
    z: -1.3,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
    ease: 'power2.out'
  })
  
  // Create bullet
  const bulletGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const bulletMat = new THREE.MeshPhysicalMaterial({
    color: 0xccffff,
    transmission: 0.9,
    transparent: true,
    opacity: 0.8,
    roughness: 0.0
  })
  const bullet = new THREE.Mesh(bulletGeo, bulletMat)
  
  // Start from the tip of the gun
  // We need to calculate world position of the gun's tip
  const gunTipLocal = new THREE.Vector3(0, 0, -0.6)
  const gunTipWorld = gunTipLocal.applyMatrix4(waterGun.matrixWorld)
  bullet.position.copy(gunTipWorld)
  
  // Direction is based on raycast from camera to mouse position
  raycaster.setFromCamera(mouse, camera)
  const direction = raycaster.ray.direction.clone()
  
  bullet.userData.velocity = direction.multiplyScalar(0.8) // Speed of bullet
  bullet.userData.life = 0 // Time lived
  
  scene.add(bullet)
  waterBullets.push(bullet)
}

function dropFoodAtCenter() {
  if (gameState.value !== 'playing') return
  
  playSound('splash')
  
  // Use the camera's exact viewing direction, not just the horizontal forward
  const viewDirection = new THREE.Vector3()
  camera.getWorldDirection(viewDirection)
  viewDirection.normalize()
  
  const targetPos = camera.position.clone()
  // Place the food 5 units directly in front of the camera, slightly higher so it falls through the center
  targetPos.add(viewDirection.multiplyScalar(5)) 
  targetPos.y += 2 // Give it a little height to drop down through the view
  
  // Make sure it doesn't spawn above the water surface
  if (targetPos.y > 8) targetPos.y = 8
  
  dropFood(targetPos)
}

function dropFood(position) {
  const foodGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const foodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const food = new THREE.Mesh(foodGeo, foodMat)
  food.position.copy(position)
  scene.add(food)
  foodArray.push(food)
}

function catchFish(fish) {
  // Simple catch animation
  gsap.to(fish.position, {
    y: 12,
    duration: 0.5,
    ease: 'power2.in'
  })
  gsap.to(fish.scale, {
    x: 0, y: 0, z: 0,
    duration: 0.5,
    ease: 'power2.in',
    onComplete: () => {
      scene.remove(fish)
      fishArray = fishArray.filter(f => f !== fish)
      fishCount.value = fishArray.length
    }
  })
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
      
      // Swim animation (tail wag)
      // Tail wags faster if moving faster
      const wagSpeed = fish.userData.isStartled ? 25 : 15 * sizePenalty
      fish.userData.swimCycle += delta * wagSpeed
      if (fish.userData.tail) {
        fish.userData.tail.rotation.y = Math.sin(fish.userData.swimCycle) * 0.3
      }
      
      // Determine target (food or random wandering)
      let targetVec = null
      let targetSpeed = currentMaxSpeed
      
      // Check cooldown (60 seconds = 60000 ms)
      const canEat = (now - fish.userData.lastEatenTime) > 60000
      
      if (canEat && !fish.userData.isStartled && !fish.userData.isStunned && foodArray.length > 0) {
        // Find closest food
        let closestFood = null
        let minDist = Infinity
        foodArray.forEach(food => {
          const dist = fish.position.distanceTo(food.position)
          if (dist < minDist) {
            minDist = dist
            closestFood = food
          }
        })
        
        // Increased detection range to 25 so many fish come
        if (closestFood && minDist < 25) {
          targetVec = closestFood.position.clone().sub(fish.position).normalize()
          targetSpeed = currentMaxSpeed * 2.5 // Swim much faster when pursuing food
          
          // Eat food if close enough
          if (minDist < 1.0) {
            scene.remove(closestFood)
            foodArray = foodArray.filter(f => f !== closestFood)
            
            fish.userData.lastEatenTime = now // Set cooldown
            
            // Grow bigger
            gsap.to(fish.scale, {
              x: fish.scale.x * 1.15,
              y: fish.scale.y * 1.15,
              z: fish.scale.z * 1.15,
              duration: 0.3,
              ease: "back.out(1.7)"
            })
          }
        }
      }
      
      if (targetVec && !fish.userData.isStunned) {
        // Steer towards food with increased speed
        fish.userData.velocity.lerp(targetVec.multiplyScalar(targetSpeed), 0.08)
      } else if (!fish.userData.isStunned) {
        // Random wandering
        // Check boundaries - use expanded boundaries if playing, else tank boundaries
        const isPlaying = gameState.value === 'playing'
        const boundsX = isPlaying ? 25 : 8
        const boundsY = isPlaying ? 15 : 8
        const boundsZ = isPlaying ? 25 : 4
        const p = fish.position
        const v = fish.userData.velocity
        
        if (p.x > boundsX) v.x -= 0.005
        if (p.x < -boundsX) v.x += 0.005
        if (p.y > boundsY) v.y -= 0.005
        if (p.y < 1) v.y += 0.005 // don't go below bottom
        if (p.z > boundsZ) v.z -= 0.005
        if (p.z < -boundsZ) v.z += 0.005
        
        // Randomize slightly
        if (Math.random() < 0.05 && !fish.userData.isStartled) {
          v.x += (Math.random() - 0.5) * 0.01
          v.y += (Math.random() - 0.5) * 0.01
          v.z += (Math.random() - 0.5) * 0.01
        }
        v.normalize().multiplyScalar(targetSpeed)
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
            
            playSound('hit')
            
            // Stop swimming and sink down slowly
            fish.userData.velocity.set(0, -0.01, 0)
            
            // Flip animation (rotate Z by PI) immediately
            gsap.to(fish.rotation, {
              z: Math.PI,
              duration: 0.5,
              ease: 'power2.out'
            })
            
            // Unflip at 3 seconds
            setTimeout(() => {
              if (fish && fish.userData) {
                // Unflip animation
                gsap.to(fish.rotation, {
                  z: 0,
                  duration: 0.3,
                  ease: 'power2.inOut'
                })
              }
            }, 3000)
            
            // Start floating up at 4 seconds
            setTimeout(() => {
               if (fish && fish.userData && fish.userData.isStunned) {
                  fish.userData.velocity.set(0, 0.02, 0) // Float up
               }
            }, 4000)
            
            // Escape at 5 seconds
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
            }, 5000)
            
          } else {
            // Just startling hit (1st hit)
            fish.userData.isStartled = true
            playSound('hit')
          
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
    
    // Remove if lived too long
    if (bullet.userData.life > 3.0) {
      scene.remove(bullet)
      waterBullets[index] = null
    }
  })
  // Clean up removed bullets
  waterBullets = waterBullets.filter(b => b !== null)
  
  // Animate Seaweeds (Sway effect)
  const time = clock.getElapsedTime()
  seaweedArray.forEach(seaweed => {
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

<style scoped>
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.start-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  pointer-events: none; /* let clicks pass if needed, but we have a button */
}

.start-screen h1 {
  font-size: 4rem;
  margin-bottom: 2rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.start-btn {
  pointer-events: auto;
  padding: 15px 40px;
  font-size: 1.5rem;
  background-color: #00aaff;
  color: white;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  transition: transform 0.2s, background-color 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
  background-color: #0088cc;
}

.game-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 24px;
  font-weight: 300;
  user-select: none;
}

.status {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-align: center;
}

.instructions {
  bottom: 80px; /* Positioned above fish count */
}

.fish-count {
  margin-bottom: 10px;
  font-weight: bold;
  font-size: 1.2rem;
}

.instructions {
  font-size: 1rem;
  line-height: 1.5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
