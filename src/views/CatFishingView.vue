<template>
  <div class="fishing-game">
    <div id="fishing-container"></div>
    
    <div class="ui-overlay">
      <div class="score-board">
        🐟 钓到的鱼: {{ score }} <br>
        😺 猫咪体重: {{ catWeight }} / {{ MAX_WEIGHT }}
      </div>
      
      <div class="power-bar-container" v-show="isCharging">
        <div class="power-bar" :style="{ width: powerPercentage + '%' }"></div>
      </div>
      
      <div class="status-text">
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import gsap from 'gsap'
import { createFishModel } from '../utils/models'

const score = ref(0)
const catWeight = ref(0) // 猫咪吃的鱼数量/体重
const MAX_WEIGHT = 5 // 吃多少条鱼船会翻
const isCharging = ref(false)
const powerPercentage = ref(0)
const statusMessage = ref('长按鼠标左键蓄力抛竿')

let scene, camera, renderer, animationId
let boat // 改为船
let cat, fishingRod, fishingLine, bobber
let water
let bubblesGroup // 水下气泡粒子
const fishes = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

// Game State
let gameState = 'idle' // idle, charging, casting, waiting, biting, reeling, game_over
let chargeStartTime = 0
const MAX_CHARGE_TIME = 2000 // 2 seconds for max power

// 调整深度和相机视野，使得屏幕高度刚好容纳水面到水底
const FRUSTUM_SIZE = 40 // 相机的垂直视野大小
const MAX_DEPTH = -(FRUSTUM_SIZE - 10) // 留出10的单位给水面以上的船和天空，剩下的30都是水下
const POOL_RADIUS = 100 // 扩大水域
let currentDepth = 0
let hookedFish = null
let biteTimer = null

// Boat Controls
  let isDriving = false
  let driveDirection = new THREE.Vector3()
  const BOAT_SPEED = 0.2
  
  onMounted(() => {
  initScene()
  createEnvironment()
  createCatAndRod()
  spawnFishes()
  
  animate()
  
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)
  
  if (biteTimer) clearTimeout(biteTimer)
  
  if (renderer) {
    renderer.dispose()
    document.getElementById('fishing-container').innerHTML = ''
  }
})

function initScene() {
  const container = document.getElementById('fishing-container')
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // sky blue

  // Use Orthographic Camera for true 2D side-scrolling feel
  const aspect = window.innerWidth / window.innerHeight
  camera = new THREE.OrthographicCamera(
    FRUSTUM_SIZE * aspect / -2, 
    FRUSTUM_SIZE * aspect / 2, 
    FRUSTUM_SIZE / 2, 
    FRUSTUM_SIZE / -2, 
    0.1, 
    1000
  )
  
  // 固定相机在水面中央（y轴），让屏幕上方包含船，下方包含水底
  // 中心点设置在深度的一半左右
  camera.position.set(0, MAX_DEPTH / 2 + 5, 50) 
  camera.lookAt(0, MAX_DEPTH / 2 + 5, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(0, 20, 20) // Move light to front so fish are well lit
  dirLight.castShadow = true
  dirLight.shadow.camera.left = -30
  dirLight.shadow.camera.right = 30
  dirLight.shadow.camera.top = 30
  dirLight.shadow.camera.bottom = -30
  scene.add(dirLight)
}

function createEnvironment() {
  // Water Surface (Thin plane)
  const waterGeo = new THREE.PlaneGeometry(POOL_RADIUS * 2, 2)
  const waterMat = new THREE.MeshBasicMaterial({ 
    color: 0x4dd0e1, // Lighter blue
    transparent: true, 
    opacity: 0.5
  })
  water = new THREE.Mesh(waterGeo, waterMat)
  water.position.set(0, -1, 1) // slightly forward so it covers fish slightly
  water.userData.isWater = true
  scene.add(water)
  
  // Background underwater plane (to give it a "Gold Miner" cross-section look)
  // We use a slight gradient or textured look for depth
  const bgGeo = new THREE.PlaneGeometry(POOL_RADIUS * 2, Math.abs(MAX_DEPTH) + 10)
  
  // Create a gradient texture for water depth
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#4dd0e1') // light surface
  gradient.addColorStop(1, '#001a33') // dark deep sea
  context.fillStyle = gradient
  context.fillRect(0, 0, 2, 256)
  const bgTex = new THREE.CanvasTexture(canvas)
  
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTex })
  const bg = new THREE.Mesh(bgGeo, bgMat)
  bg.position.set(0, MAX_DEPTH / 2, -5) // Push back behind the fish
  scene.add(bg)
  
  // Pool Bottom (Sand)
  const bottomGeo = new THREE.BoxGeometry(POOL_RADIUS * 2, 5, 20)
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0xc2b280 }) // Sand color
  const bottom = new THREE.Mesh(bottomGeo, bottomMat)
  bottom.position.set(0, MAX_DEPTH - 2, -5)
  scene.add(bottom)
  
  // Create underwater bubbles
  bubblesGroup = new THREE.Group()
  const bubbleGeo = new THREE.SphereGeometry(0.2, 8, 8)
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
  
  for(let i=0; i<30; i++) {
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat)
    bubble.position.set(
      (Math.random() - 0.5) * POOL_RADIUS * 1.5,
      MAX_DEPTH + Math.random() * Math.abs(MAX_DEPTH),
      (Math.random() - 0.5) * 4
    )
    bubble.userData = {
      speed: 0.05 + Math.random() * 0.05,
      wobbleSpeed: 0.02 + Math.random() * 0.05,
      wobbleAmount: Math.random() * 0.5,
      startX: bubble.position.x
    }
    const scale = 0.5 + Math.random() * 1.5
    bubble.scale.set(scale, scale, scale)
    bubblesGroup.add(bubble)
  }
  scene.add(bubblesGroup)
}

function createCatAndRod() {
  boat = new THREE.Group()
  
  // Simple Boat
  const boatGeo = new THREE.BoxGeometry(6, 1.5, 10)
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 }) // Wood brown
  const hull = new THREE.Mesh(boatGeo, boatMat)
  hull.position.set(0, 0, 0)
  hull.castShadow = true
  hull.receiveShadow = true
  boat.add(hull)
  
  // Add Cat to Boat
  cat = new THREE.Group()
  
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffa500, roughness: 0.6 }) // Orange cat
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }) // White belly/paws
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333 }) // Eyes/Nose
  
  // Body (Pear shaped sitting)
  const bodyGeo = new THREE.SphereGeometry(1.2, 16, 16)
  bodyGeo.scale(1, 1.3, 1)
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.position.y = 1.2
  body.castShadow = true
  
  // White Belly
  const bellyGeo = new THREE.SphereGeometry(0.8, 16, 16)
  bellyGeo.scale(1, 1.2, 0.5)
  const belly = new THREE.Mesh(bellyGeo, whiteMat)
  belly.position.set(0, 1.1, 0.9)
  
  // Head
  const headGeo = new THREE.SphereGeometry(1.1, 16, 16)
  headGeo.scale(1.2, 1, 1)
  const head = new THREE.Mesh(headGeo, bodyMat)
  head.position.set(0, 2.8, 0.2)
  head.castShadow = true
  
  // Ears
  const earGeo = new THREE.ConeGeometry(0.4, 0.8, 4)
  const earL = new THREE.Mesh(earGeo, bodyMat)
  earL.position.set(-0.7, 3.5, 0.2)
  earL.rotation.z = Math.PI / 6
  const earR = new THREE.Mesh(earGeo, bodyMat)
  earR.position.set(0.7, 3.5, 0.2)
  earR.rotation.z = -Math.PI / 6
  
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const eyeL = new THREE.Mesh(eyeGeo, darkMat)
  eyeL.position.set(-0.4, 2.9, 1.2)
  const eyeR = new THREE.Mesh(eyeGeo, darkMat)
  eyeR.position.set(0.4, 2.9, 1.2)
  
  // Nose
  const noseGeo = new THREE.SphereGeometry(0.08, 8, 8)
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffa07a }) // Pink nose
  const nose = new THREE.Mesh(noseGeo, noseMat)
  nose.position.set(0, 2.6, 1.3)
  
  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.15, 0.1, 2)
  const tail = new THREE.Mesh(tailGeo, bodyMat)
  tail.position.set(0, 0.5, -1.2)
  tail.rotation.x = Math.PI / 4
  
  cat.add(body, belly, head, earL, earR, eyeL, eyeR, nose, tail)
  
  // Sitting looking to the right (X axis)
  cat.rotation.y = Math.PI / 2
  cat.position.set(-1, 0.8, 0) 
  boat.add(cat)
  
  // Fishing Rod
  fishingRod = new THREE.Group()
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.1, 10)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.set(0, 4, 0)
  fishingRod.add(pole)
  
  cat.add(fishingRod)
  // Held in hands, angled forward (right side of screen)
  fishingRod.position.set(0, 1.5, 1) 
  fishingRod.rotation.x = Math.PI / 2.5 // Tilt forward towards water
  
  boat.position.set(0, -0.5, 0) // Floating on water
  scene.add(boat)
  
  // Bobber (Float)
  const bobberGeo = new THREE.SphereGeometry(0.3)
  const bobberMat = new THREE.MeshStandardMaterial({ color: 0xff0000 })
  bobber = new THREE.Mesh(bobberGeo, bobberMat)
  bobber.position.set(0, 0, 0)
  bobber.visible = false
  scene.add(bobber)
  
  // Fishing Line (Dynamic)
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  fishingLine = new THREE.Line(lineGeo, lineMat)
  scene.add(fishingLine)
}

function spawnFishes() {
  // Spawn different types of fish at different depths
  const fishTypes = [
    { type: 'flat', color: 0x00ff00, minDepth: -2, maxDepth: -8, count: 6 }, // Shallow
    { type: 'chicken', color: 0xffffff, minDepth: -2, maxDepth: -5, count: 2 }, // Floating chicken
    { type: 'duck', color: 0xffff00, minDepth: -2, maxDepth: -5, count: 2 }, // Floating duck
    { type: 'milk', color: 0xffffff, minDepth: -5, maxDepth: -10, count: 2 }, // Sinking milk
    { type: 'long', color: 0xffa500, minDepth: -8, maxDepth: -15, count: 4 }, // Mid
    { type: 'pig', color: 0xffffff, minDepth: -10, maxDepth: -20, count: 2 }, // Sinking pig
    { type: 'cow', color: 0xffffff, minDepth: -12, maxDepth: -22, count: 1 }, // Sinking cow
    { type: 'shark', color: 0x555555, minDepth: -15, maxDepth: -25, count: 3 }, // Deep
    { type: 'whale', color: 0x1c395c, minDepth: -25, maxDepth: MAX_DEPTH, count: 2 } // Very Deep
  ]
  
  fishTypes.forEach(config => {
    for(let i=0; i<config.count; i++) {
      const fish = createFishModel(config.type, config.color)
      
      const xPos = (Math.random() - 0.5) * (POOL_RADIUS * 1.5)
      const depth = config.minDepth - Math.random() * (config.maxDepth - config.minDepth)
      const zPos = (Math.random() - 0.5) * 10 // Keep fish relatively close to the 2D plane (Z=0)
      
      fish.position.set(xPos, depth, zPos)
      
      // 深度越深，鱼越大 (depth 是负数，取绝对值计算)
      const depthFactor = Math.abs(depth) / Math.abs(MAX_DEPTH) // 0 (surface) to 1 (bottom)
      let baseScale = 0.6 + depthFactor * 1.5 // Scale from 0.6 to ~2.1
      
      if (config.type === 'whale') {
        fish.scale.set(baseScale * 0.7, baseScale * 0.7, baseScale * 0.7) // 鲸鱼基准太大，稍微调整比例
      } else if (config.type === 'pig' || config.type === 'cow') {
        baseScale = 0.8
        fish.scale.set(baseScale, baseScale, baseScale)
      } else if (config.type === 'milk') {
        baseScale = 1.2
        fish.scale.set(baseScale, baseScale, baseScale)
      } else {
        fish.scale.set(baseScale, baseScale, baseScale)
      }
      
      // Horizontal swimming
      const movingRight = Math.random() > 0.5
      fish.rotation.y = movingRight ? Math.PI / 2 : -Math.PI / 2
      
      // Non-fish items rotate differently or bob
      if (config.type === 'milk') {
        fish.rotation.y = 0
        fish.rotation.z = Math.random() * 0.5
      }
      
      fish.userData = {
        baseSpeed: fish.userData.baseSpeed * 0.5, // Swim much slower
        movingRight: movingRight,
        depth: depth,
        type: config.type,
        isHooked: false,
        isBiting: false
      }
      
      scene.add(fish)
      fishes.push(fish)
    }
  })
}

function onMouseDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  if (gameState === 'idle') {
    raycaster.setFromCamera(mouse, camera)
    
    const intersects = raycaster.intersectObject(water)
    
    // If clicking on water far from boat, we want to drive
    if (intersects.length > 0) {
      const clickPoint = intersects[0].point
      const distToBoat = clickPoint.distanceTo(boat.position)
      
      // If clicking further away, treat as driving command
      if (distToBoat > 10) {
        isDriving = true
        // Calculate direction to target
        driveDirection.subVectors(clickPoint, boat.position)
        driveDirection.y = 0 // Keep on water plane
        driveDirection.normalize()
        
        // Rotate boat to face target
        const targetRotation = Math.atan2(driveDirection.x, driveDirection.z)
        gsap.to(boat.rotation, {
          y: targetRotation,
          duration: 0.5,
          ease: "power1.out"
        })
        
        statusMessage.value = '开船中...'
        return
      }
    }
    
    // Otherwise, start charging fishing rod
    gameState = 'charging'
    isCharging.value = true
    chargeStartTime = Date.now()
    statusMessage.value = '蓄力中...'
  } else if (gameState === 'biting') {
    // Clicked while fish is biting! REEL IT IN!
    reelIn(true)
  } else if (gameState === 'waiting') {
    // Clicked too early or gave up
    reelIn(false)
  }
}

function onMouseUp(event) {
  if (isDriving) {
    isDriving = false
    statusMessage.value = '长按鼠标左键蓄力抛竿，点击远处水面开船'
    return
  }

  if (gameState === 'charging') {
    // Cast the line
    const chargeDuration = Math.min(Date.now() - chargeStartTime, MAX_CHARGE_TIME)
    powerPercentage.value = (chargeDuration / MAX_CHARGE_TIME) * 100
    
    // Calculate depth based on power
    currentDepth = (powerPercentage.value / 100) * MAX_DEPTH
    
    castLine()
  }
}

function castLine() {
  gameState = 'casting'
  isCharging.value = false
  statusMessage.value = '抛竿！'
  
  // Animate the rod bending forward
  gsap.to(fishingRod.rotation, {
    x: Math.PI / 1.5,
    duration: 0.5,
    ease: "power2.out"
  })
  
  // Bobber moves along the X axis (to the right of the boat)
  const distanceOut = 5 + (powerPercentage.value / 100) * 20
  
  const targetPos = boat.position.clone()
  targetPos.x += distanceOut // Cast to the right
  targetPos.z = 0 // Keep on the 2D plane
  
  bobber.visible = true
  
  // Start from rod tip (world space)
  const rodTipLocal = new THREE.Vector3(0, 5, 0)
  const rodTipWorld = rodTipLocal.applyMatrix4(fishingRod.children[0].matrixWorld)
  bobber.position.copy(rodTipWorld)
  
  // Create a curved path for the bobber using bezier
  gsap.to(bobber.position, {
    x: targetPos.x,
    z: targetPos.z,
    duration: 0.8,
    ease: "power1.out"
  })
  
  // Add a nice arc (bezier-like) by animating Y separately with a different easing
  // First go up, then go down to the water surface
  const peakY = Math.max(rodTipWorld.y, targetPos.y) + 5
  
  gsap.timeline()
    .to(bobber.position, {
      y: peakY,
      duration: 0.4,
      ease: "power1.out"
    })
    .to(bobber.position, {
      y: -1.5, // Water surface
      duration: 0.4,
      ease: "power1.in"
    })
    .to(bobber.position, {
      y: currentDepth, // Sink to calculated depth
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        gameState = 'waiting'
        statusMessage.value = `水深 ${(Math.abs(currentDepth)).toFixed(1)} 米，耐心等待...`
        waitForBite()
      }
    })
}

function waitForBite() {
  // Random time between 1 to 3 seconds to get a bite (faster response)
  const waitTime = 1000 + Math.random() * 2000
  
  biteTimer = setTimeout(() => {
    if (gameState !== 'waiting') return
    
    // 寻找浮标所在深度上下 10个单位 范围内的所有鱼（增加探测范围）
    const availableFishes = fishes.filter(f => 
      !f.userData.isHooked && 
      !f.userData.isBiting &&
      Math.abs(f.position.y - currentDepth) < 10 
    )
    
    if (availableFishes.length > 0) {
      // 找到水平距离最近的一条鱼
      availableFishes.sort((a, b) => Math.abs(a.position.x - bobber.position.x) - Math.abs(b.position.x - bobber.position.x))
      const targetFish = availableFishes[0]
      
      targetFish.userData.isBiting = true
      statusMessage.value = '有鱼靠近了...'
      
      // 让鱼转向浮标的方向
      const isBobberToTheRight = bobber.position.x > targetFish.position.x
      targetFish.rotation.y = isBobberToTheRight ? Math.PI / 2 : -Math.PI / 2
      
      // 动画：鱼主动游向浮标咬钩
      gsap.to(targetFish.position, {
        x: bobber.position.x,
        y: bobber.position.y - 0.5,
        z: bobber.position.z,
        duration: 1.5, // 给点时间让玩家看到鱼游过来的过程
        ease: "power1.inOut",
        onComplete: () => {
          if (gameState !== 'waiting') {
            targetFish.userData.isBiting = false
            return
          }
          
          // 正式咬钩！
          hookedFish = targetFish
          hookedFish.userData.isHooked = true
          
          gameState = 'biting'
          statusMessage.value = '！！！鱼上钩了！！！快点击鼠标收线！'
          
          // 浮标剧烈抖动
          gsap.to(bobber.position, {
            y: bobber.position.y - 1,
            duration: 0.1,
            yoyo: true,
            repeat: -1
          })
          
          // 如果玩家 2 秒内没点鼠标，鱼就跑了
          setTimeout(() => {
            if (gameState === 'biting') {
              statusMessage.value = '哎呀，鱼跑了...'
              hookedFish.userData.isHooked = false
              hookedFish.userData.isBiting = false
              hookedFish = null
              reelIn(false)
            }
          }, 2000)
        }
      })
      
    } else {
      // 这个深度完全没有鱼
      statusMessage.value = '这里好像没有鱼，收线重试吧。'
    }
  }, waitTime)
}

function reelIn(success) {
  gameState = 'reeling'
  gsap.killTweensOf(bobber.position) // Stop biting jerk
  
  // Calculate target position for bringing fish in (the boat)
  const boatPos = boat.position.clone()
  boatPos.y += 2 // slightly above boat
  
  if (success && hookedFish) {
    statusMessage.value = '收线中...'
    
    // 鱼和浮标飞回船上方
    gsap.to([bobber.position, hookedFish.position], {
      x: boatPos.x,
      y: boatPos.y,
      z: boatPos.z,
      duration: 1,
      ease: "power2.inOut",
      onComplete: () => {
        score.value++
        
        // 自动吃掉钓上来的鱼
        autoEatFish(hookedFish)
        
        // 生成一条新鱼保持生态平衡
        spawnSingleFish(hookedFish.userData.type)
        
        resetFishing()
      }
    })
  } else {
    // Just bring bobber back
    gsap.to(bobber.position, {
      x: boatPos.x, 
      y: boatPos.y, 
      z: boatPos.z,
      duration: 1,
      onComplete: resetFishing
    })
  }
  
  // Rod goes back up
  gsap.to(fishingRod.rotation, {
    x: Math.PI / 2.5,
    duration: 1
  })
}

function autoEatFish(fish) {
  // 停止鱼的游泳动画逻辑
  fish.userData.isHooked = false
  
  // 将鱼转换到船的坐标系中，方便做飞向嘴巴的动画
  scene.remove(fish)
  const idx = fishes.indexOf(fish)
  if (idx > -1) fishes.splice(idx, 1)
  
  boat.add(fish)
  fish.position.set(0, 2, 0) // 初始在船上方
  
  // 猫咪嘴巴的大致位置 (相对船)
  const catMouthPos = new THREE.Vector3(-1, 3.3, 0) // 猫坐在 (-1, 0.8, 0)，头在大概 y=3.3
  
  statusMessage.value = '喵呜~ 自动吃掉！猫咪变胖了！'
  catWeight.value++ // 猫咪变胖
  
  // 鱼飞进嘴里并缩小消失
  gsap.to(fish.position, {
    x: catMouthPos.x,
    y: catMouthPos.y,
    z: catMouthPos.z,
    duration: 0.5,
    ease: "power1.in"
  })
  
  gsap.to(fish.scale, {
    x: 0, y: 0, z: 0,
    duration: 0.5,
    onComplete: () => {
      boat.remove(fish) // 彻底吃掉
      
      // 猫咪身体变胖动画 (横向缩放)
      const body = cat.children[0]
      const belly = cat.children[1]
      
      // 计算新的体型 (每次吃鱼增宽15%)
      const newScaleX = 1 + (catWeight.value * 0.15)
      const newScaleZ = 1 + (catWeight.value * 0.15)
      
      gsap.to([body.scale, belly.scale], {
        x: newScaleX,
        z: newScaleZ,
        duration: 0.5,
        ease: "back.out(1.7, 0.3)"
      })
      
      // 检查是否超重翻船
      if (catWeight.value >= MAX_WEIGHT) {
        triggerGameOver()
      }
    }
  })
  
  // 猫咪开心跳一下
  if (catWeight.value < MAX_WEIGHT) {
    gsap.to(cat.position, {
      y: cat.position.y + 0.5,
      duration: 0.2,
      yoyo: true,
      repeat: 1
    })
    
    setTimeout(() => { if (gameState === 'idle') statusMessage.value = '长按鼠标左键蓄力抛竿，点击远处水面开船' }, 2000)
  }
}

function triggerGameOver() {
  gameState = 'game_over'
  isDriving = false
  statusMessage.value = '猫咪太胖啦！船翻了！ (刷新页面重新开始)'
  
  // 翻船动画：船向一侧倾覆并下沉
  gsap.to(boat.rotation, {
    x: Math.PI / 1.5, // 翻过去
    z: Math.PI / 4,
    duration: 1.5,
    ease: "power2.in"
  })
  
  gsap.to(boat.position, {
    y: MAX_DEPTH - 2, // 沉入水底
    duration: 4,
    ease: "power2.in",
    delay: 0.5
  })
}

function spawnSingleFish(type) {
  // Logic to spawn a replacement fish (simplified)
  let depth = -5
  let color = 0x00ff00
  if (type === 'long') { depth = -12; color = 0xffa500 }
  if (type === 'shark') { depth = -20; color = 0x555555 }
  if (type === 'whale') { depth = -28; color = 0x1c395c }
  if (type === 'chicken') { depth = -3; color = 0xffffff }
  if (type === 'duck') { depth = -3; color = 0xffff00 }
  if (type === 'milk') { depth = -8; color = 0xffffff }
  if (type === 'pig') { depth = -15; color = 0xffffff }
  if (type === 'cow') { depth = -18; color = 0xffffff }
  
  const fish = createFishModel(type, color)
  
  // Random horizontal position, near 2D plane
  const xPos = (Math.random() - 0.5) * (POOL_RADIUS * 1.5)
  const zPos = (Math.random() - 0.5) * 10
  
  fish.position.set(xPos, depth, zPos)
  
  // 深度越深，鱼越大 (depth 是负数，取绝对值计算)
  const depthFactor = Math.abs(depth) / Math.abs(MAX_DEPTH) // 0 (surface) to 1 (bottom)
  let baseScale = 0.6 + depthFactor * 1.5 // Scale from 0.6 to ~2.1
  
  if (type === 'whale') {
    fish.scale.set(baseScale * 0.7, baseScale * 0.7, baseScale * 0.7) // 鲸鱼基准太大，稍微调整比例
  } else if (type === 'pig' || type === 'cow') {
    baseScale = 0.8
    fish.scale.set(baseScale, baseScale, baseScale)
  } else if (type === 'milk') {
    baseScale = 1.2
    fish.scale.set(baseScale, baseScale, baseScale)
  } else {
    fish.scale.set(baseScale, baseScale, baseScale)
  }
  
  const movingRight = Math.random() > 0.5
  fish.rotation.y = movingRight ? Math.PI / 2 : -Math.PI / 2
  
  if (type === 'milk') {
    fish.rotation.y = 0
    fish.rotation.z = Math.random() * 0.5
  }
  
  fish.userData = {
    baseSpeed: fish.userData.baseSpeed * 0.5,
    movingRight: movingRight,
    depth: depth,
    type: type,
    isHooked: false,
    isBiting: false
  }
  
  scene.add(fish)
  fishes.push(fish)
}

function resetFishing() {
  gameState = 'idle'
  bobber.visible = false
  powerPercentage.value = 0
  hookedFish = null
  if (statusMessage.value !== '抓到一条鱼！') {
    statusMessage.value = '长按鼠标左键蓄力抛竿'
  } else {
    setTimeout(() => {
      if (gameState === 'idle') statusMessage.value = '长按鼠标左键蓄力抛竿'
    }, 2000)
  }
}

function updateFishingLine() {
  if (!fishingRod || !bobber || !fishingLine) return
  
  // Update line geometry to connect rod tip to bobber
  // Calculate rod tip position in world space
  const rodTipLocal = new THREE.Vector3(0, 4, 0) // Assuming cylinder is 8 long, centered
  const rodTipWorld = rodTipLocal.applyMatrix4(fishingRod.children[0].matrixWorld)
  
  const positions = fishingLine.geometry.attributes.position.array
  
  if (gameState === 'idle') {
    // Hide line or draw it limp next to boat
    positions[0] = rodTipWorld.x; positions[1] = rodTipWorld.y; positions[2] = rodTipWorld.z
    positions[3] = rodTipWorld.x; positions[4] = rodTipWorld.y - 1; positions[5] = rodTipWorld.z
  } else {
    // Draw line from rod to bobber
    positions[0] = rodTipWorld.x; positions[1] = rodTipWorld.y; positions[2] = rodTipWorld.z
    positions[3] = bobber.position.x; positions[4] = bobber.position.y; positions[5] = bobber.position.z
  }
  fishingLine.geometry.attributes.position.needsUpdate = true
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  // Boat Driving Logic
  if (isDriving && gameState !== 'game_over') {
    boat.position.addScaledVector(driveDirection, BOAT_SPEED)
    
    // Check boundaries to keep boat in pool
    const distanceFromCenter = Math.sqrt(boat.position.x ** 2 + boat.position.z ** 2)
    if (distanceFromCenter > POOL_RADIUS - 5) {
      // Push back
      boat.position.subScaledVector(driveDirection, BOAT_SPEED)
      isDriving = false
      statusMessage.value = '到达水池边缘了'
    }
  } else if (gameState === 'idle') {
    // 船在水面上轻轻晃动 (Bobbing)
    boat.position.y = -0.5 + Math.sin(Date.now() * 0.002) * 0.1
    boat.rotation.z = Math.sin(Date.now() * 0.001) * 0.02
  }
  
  // Camera follows boat (only horizontally for 2D feel)
  if (boat) {
    const targetX = boat.position.x
    camera.position.lerp(new THREE.Vector3(targetX, MAX_DEPTH / 2 + 5, 50), 0.1)
  }
  
  // Animate underwater bubbles
  if (bubblesGroup) {
    bubblesGroup.children.forEach(bubble => {
      bubble.position.y += bubble.userData.speed
      // 气泡左右摇摆
      bubble.position.x = bubble.userData.startX + Math.sin(Date.now() * bubble.userData.wobbleSpeed) * bubble.userData.wobbleAmount
      
      // 冒出水面后重置到底部
      if (bubble.position.y > -1) {
        bubble.position.y = MAX_DEPTH
        bubble.userData.startX = (Math.random() - 0.5) * POOL_RADIUS * 1.5
      }
    })
  }
  
  // Charge logic
  if (gameState === 'charging') {
    const chargeDuration = Math.min(Date.now() - chargeStartTime, MAX_CHARGE_TIME)
    powerPercentage.value = (chargeDuration / MAX_CHARGE_TIME) * 100
  }
  
  updateFishingLine()
  
  // Animate swimming fishes
  fishes.forEach(fish => {
    if (fish.userData.isHooked || fish.userData.isBiting) return // Stop swimming if hooked or biting
    
    // Horizontal swimming pattern
    if (fish.userData.movingRight) {
      fish.position.x += fish.userData.baseSpeed
      if (fish.position.x > POOL_RADIUS) {
        fish.userData.movingRight = false
        fish.rotation.y = -Math.PI / 2
      }
    } else {
      fish.position.x -= fish.userData.baseSpeed
      if (fish.position.x < -POOL_RADIUS) {
        fish.userData.movingRight = true
        fish.rotation.y = Math.PI / 2
      }
    }
    
    // Tail animation
    if (fish.userData.tail) {
      fish.userData.tail.rotation.y = Math.sin(Date.now() * 0.01 * fish.userData.baseSpeed * 100) * 0.3
    }
  })
  
  renderer.render(scene, camera)
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight
  const frustumSize = 40
  
  camera.left = frustumSize * aspect / -2
  camera.right = frustumSize * aspect / 2
  camera.top = frustumSize / 2
  camera.bottom = frustumSize / -2
  
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
</script>

<style scoped>
.fishing-game {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #87ceeb;
}

#fishing-container {
  width: 100%;
  height: 100%;
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-board {
  margin-top: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px 25px;
  border-radius: 20px;
  font-size: 28px;
  font-weight: bold;
  color: #333;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  border: 3px solid #1e90ff;
  align-self: flex-end;
  margin-right: 20px;
}

.status-text {
  position: absolute;
  bottom: 100px;
  font-size: 32px;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
  background: rgba(0,0,0,0.4);
  padding: 10px 30px;
  border-radius: 30px;
  transition: all 0.3s;
}

.power-bar-container {
  position: absolute;
  bottom: 180px;
  width: 300px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid white;
}

.power-bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #ffd700, #ff0000);
  width: 0%;
  transition: width 0.1s linear;
}
</style>
