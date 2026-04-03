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
            鼠标瞄准，左键点击或按空格键发射水弹<br>
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
  // Create exactly 10 fishes initially, one for each type
  createFishes(10, scene, fishArray, fishCountRef)
  fishCount.value = fishCountRef.value
  
  spawnInitialMushrooms(scene, camera, mushroomArray, gameState.value, fishCount.value) // spawn initial mushrooms based on fish count
  animate()
  
  window.addEventListener('resize', onWindowResize)
  
  // Keyboard controls
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  
  // Add mouse listeners for aiming and shooting
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onMouseDown)
  
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

function onMouseDown(event) {
  if (gameState.value !== 'playing') return
  
  // Only shoot on left click (button 0)
  if (event.button === 0) {
    shootWaterBullet(gameState.value, waterGun, camera, scene, waterBullets, mouse, raycaster, waterSurfacePlane)
  }
}



function animate() {
  animationFrameId = requestAnimationFrame(animate)
  
  const delta = clock.getDelta()
  const now = Date.now()
  const time = clock.getElapsedTime()
  
  animateGame(
    delta, now, time, gameState.value, camera, scene, controls,
    waterGun, moveState, fishArray, { value: fishCount.value },
    foodArray, mushroomArray, seaweedArray, bubbleArray, waterBullets, rockArray
  )
  
  // Need to manually keep reactive ref in sync
  fishCount.value = fishArray.filter(f => !f.userData.dead).length
  
  // Make mushroomArray accessible to environment generator
  window.mushroomArrayRef = mushroomArray
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}
</script>
