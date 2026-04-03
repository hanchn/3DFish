<template>
  <div class="pig-game">
    <div id="pig-container"></div>
    <div class="score-board">
      喂猪数量: {{ feedCount }}
    </div>
    
    <div class="fruit-menu">
      <div 
        v-for="fruit in fruits" 
        :key="fruit.id"
        class="fruit-btn"
        :class="{ active: selectedFruit === fruit.id }"
        @click.stop="selectedFruit = fruit.id"
      >
        <span class="fruit-icon">{{ fruit.icon }}</span>
        <span class="fruit-name">{{ fruit.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import gsap from 'gsap'
import { createFishModel } from '../utils/models'

const feedCount = ref(0)
const selectedFruit = ref('apple')

const fruits = [
  { id: 'apple', name: '苹果', icon: '🍎' },
  { id: 'watermelon', name: '西瓜', icon: '🍉' },
  { id: 'peach', name: '桃子', icon: '🍑' },
  { id: 'banana', name: '香蕉', icon: '🍌' },
  { id: 'grape', name: '葡萄', icon: '🍇' }
]

let scene, camera, renderer, animationId
let ground
let truck // 卡车对象
const pigs = []
const apples = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const groundSize = 60

// Truck state
let truckState = 'idle' // 'idle', 'driving_in', 'loading', 'driving_away', 'driving_back'
let targetedPigForTruck = null

// Audio
let audioCtx

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) {
      audioCtx = new AudioContext()
    }
  }
}

function playCrunchSound() {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  
  // Simple "crunch" sound (eating sound)
  osc.type = 'square'
  osc.frequency.setValueAtTime(300, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1)

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)

  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.1)
}

function playOinkSound() {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  
  // Pig "oink/grunt" (咕咕) sound
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(60, audioCtx.currentTime) // Low pitch grunt
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2)

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2)

  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.2)
}

onMounted(() => {
  initScene()
  spawnPigs(1) // 默认一只猪
  animate()
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('click', onClick)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('mousemove', onMouseMove) // For hover effects
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('click', onClick)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousemove', onMouseMove)
  
  if (renderer) {
    renderer.dispose()
    document.getElementById('pig-container').innerHTML = ''
  }
})

function onKeyDown(event) {
  // 按下空格键生成一只新猪
  if (event.code === 'Space') {
    event.preventDefault() // 防止页面滚动
    spawnPigs(1)
  }
}

function initScene() {
  const container = document.getElementById('pig-container')
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // sky blue

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 35, 40)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  // Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(10, 30, 20)
  dirLight.castShadow = true
  dirLight.shadow.camera.left = -40
  dirLight.shadow.camera.right = 40
  dirLight.shadow.camera.top = 40
  dirLight.shadow.camera.bottom = -40
  scene.add(dirLight)

  // Ground
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x90EE90 }) // Light green grass
  ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  
  // Road for the truck
  const roadGeo = new THREE.PlaneGeometry(15, groundSize)
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x555555 })
  const road = new THREE.Mesh(roadGeo, roadMat)
  road.rotation.x = -Math.PI / 2
  road.position.set(20, 0.05, 0) // slightly above ground
  road.receiveShadow = true
  scene.add(road)
  
  createTruck()
}

function createTruck() {
  truck = new THREE.Group()
  
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.5 }) // Blue truck
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 }) // Wooden bed
  
  // Truck Cab (Front)
  const cabGeo = new THREE.BoxGeometry(4, 4, 3)
  const cab = new THREE.Mesh(cabGeo, bodyMat)
  cab.position.set(0, 2.5, 3)
  cab.castShadow = true
  
  // Truck Bed (Back)
  const bedGeo = new THREE.BoxGeometry(4.5, 0.5, 6)
  const bed = new THREE.Mesh(bedGeo, woodMat)
  bed.position.set(0, 1.5, -1.5)
  bed.castShadow = true
  
  // Truck Fences (Sides of bed)
  const fenceGeoZ = new THREE.BoxGeometry(0.2, 1.5, 6)
  const fenceLeft = new THREE.Mesh(fenceGeoZ, woodMat)
  fenceLeft.position.set(-2.15, 2.5, -1.5)
  const fenceRight = new THREE.Mesh(fenceGeoZ, woodMat)
  fenceRight.position.set(2.15, 2.5, -1.5)
  
  const fenceGeoX = new THREE.BoxGeometry(4.5, 1.5, 0.2)
  const fenceBack = new THREE.Mesh(fenceGeoX, woodMat)
  fenceBack.position.set(0, 2.5, -4.4)
  
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16)
  wheelGeo.rotateZ(Math.PI / 2)
  
  const w1 = new THREE.Mesh(wheelGeo, darkMat)
  w1.position.set(-2.2, 0.8, 3)
  const w2 = new THREE.Mesh(wheelGeo, darkMat)
  w2.position.set(2.2, 0.8, 3)
  const w3 = new THREE.Mesh(wheelGeo, darkMat)
  w3.position.set(-2.2, 0.8, -3)
  const w4 = new THREE.Mesh(wheelGeo, darkMat)
  w4.position.set(2.2, 0.8, -3)
  
  truck.add(cab, bed, fenceLeft, fenceRight, fenceBack, w1, w2, w3, w4)
  
  // Initial position on road
  truck.position.set(20, 0, 0)
  
  // Add a hitbox area on the truck bed to detect pig drops
  const hitboxGeo = new THREE.BoxGeometry(4, 2, 5)
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false })
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat)
  hitbox.position.set(0, 3, -1.5)
  hitbox.userData.isTruckBed = true
  truck.add(hitbox)
  
  scene.add(truck)
}

function spawnPigs(count, position = null) {
  for (let i = 0; i < count; i++) {
    const pig = createFishModel('pig', 0xffffff)
    pig.scale.set(2.5, 2.5, 2.5) // Scale up
    
    if (position) {
      // 从指定位置（比如母猪位置）稍微偏移一点出生
      pig.position.set(
        position.x + (Math.random() - 0.5) * 4,
        2,
        position.z + (Math.random() - 0.5) * 4
      )
    } else {
      pig.position.set(
        (Math.random() - 0.5) * (groundSize - 20),
        2, // Base Y
        (Math.random() - 0.5) * (groundSize - 20)
      )
    }
    
    pig.userData.target = getRandomTarget()
    pig.userData.speed = 0.05 + Math.random() * 0.02
    pig.userData.state = 'idle' // 'idle' or 'eating'
    pig.userData.applesEaten = 0 // 记录吃了多少个苹果
    
    scene.add(pig)
    pigs.push(pig)
  }
}

function getRandomTarget() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * (groundSize - 10),
    2,
    (Math.random() - 0.5) * (groundSize - 10)
  )
}

function createApple(position, type) {
  const group = new THREE.Group()
  group.scale.set(2, 2, 2)
  
  if (type === 'apple') {
    const appleGeo = new THREE.SphereGeometry(0.5, 16, 16)
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 })
    const apple = new THREE.Mesh(appleGeo, appleMat)
    apple.castShadow = true
    
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    const stem = new THREE.Mesh(stemGeo, stemMat)
    stem.position.y = 0.5
    
    const leafGeo = new THREE.ConeGeometry(0.1, 0.3)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })
    const leaf = new THREE.Mesh(leafGeo, leafMat)
    leaf.position.set(0.1, 0.5, 0)
    leaf.rotation.z = Math.PI / 4
    
    group.add(apple, stem, leaf)
  } else if (type === 'watermelon') {
    const melonGeo = new THREE.SphereGeometry(0.8, 16, 16)
    melonGeo.scale(1, 1.2, 1)
    
    // Create striped texture for watermelon
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    context.fillStyle = '#228b22'
    context.fillRect(0, 0, 256, 256)
    context.fillStyle = '#32cd32'
    for(let i=0; i<10; i++) {
      context.beginPath()
      context.moveTo(i*25.6, 0)
      context.lineTo(i*25.6 + 5, 0)
      context.lineTo(i*25.6 + 15, 256)
      context.lineTo(i*25.6 + 10, 256)
      context.fill()
    }
    const tex = new THREE.CanvasTexture(canvas)
    
    const melonMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })
    const melon = new THREE.Mesh(melonGeo, melonMat)
    melon.rotation.z = Math.PI / 2 // lie on side
    melon.castShadow = true
    group.add(melon)
  } else if (type === 'peach') {
    const peachGeo = new THREE.SphereGeometry(0.5, 16, 16)
    peachGeo.scale(1, 0.9, 1)
    const peachMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.4 }) // pinkish
    const peach = new THREE.Mesh(peachGeo, peachMat)
    peach.castShadow = true
    
    const leafGeo = new THREE.ConeGeometry(0.1, 0.4)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })
    const leaf = new THREE.Mesh(leafGeo, leafMat)
    leaf.position.set(0, 0.5, 0)
    leaf.rotation.x = Math.PI / 3
    
    group.add(peach, leaf)
  } else if (type === 'banana') {
    // Curved cylinder for banana
    const bananaGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8, 4, false)
    
    // Bend the geometry
    const positions = bananaGeo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      const bend = Math.cos(y * Math.PI / 1.2) * 0.2 // slight curve
      positions.setX(i, positions.getX(i) + bend)
    }
    bananaGeo.computeVertexNormals()
    
    const bananaMat = new THREE.MeshStandardMaterial({ color: 0xffe135, roughness: 0.4 })
    const banana = new THREE.Mesh(bananaGeo, bananaMat)
    banana.rotation.z = Math.PI / 2
    banana.castShadow = true
    group.add(banana)
  } else if (type === 'grape') {
    const grapeMat = new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.2 }) // Purple
    
    // Create a bunch of small spheres
    for (let i = 0; i < 15; i++) {
      const grapeGeo = new THREE.SphereGeometry(0.15, 8, 8)
      const grape = new THREE.Mesh(grapeGeo, grapeMat)
      
      // Random position in a cluster shape
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const r = Math.random() * 0.4
      
      grape.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        -r * Math.cos(phi) + 0.2, // bias downwards
        r * Math.sin(phi) * Math.sin(theta)
      )
      grape.castShadow = true
      group.add(grape)
    }
    
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3)
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    const stem = new THREE.Mesh(stemGeo, stemMat)
    stem.position.y = 0.5
    group.add(stem)
  }
  
  // Setup position
  group.position.copy(position)
  group.position.y = 15 // Drop from high up
  
  scene.add(group)
  apples.push(group) // Still keeping the array named 'apples' for simplicity
  
  // Drop animation
  gsap.to(group.position, {
    y: 1, // Rest on ground
    duration: 0.8,
    ease: "bounce.out"
  })
}

function onClick(event) {
  initAudio()
  
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  
  // 1. 先检测是否点到了猪
  const pigIntersects = raycaster.intersectObjects(pigs, true)
  if (pigIntersects.length > 0 && truckState === 'idle' && pigs.length >= 2) {
    let object = pigIntersects[0].object
    while (object.parent && object.userData.type !== 'pig') {
      if (object.parent.type === 'Scene') break
      object = object.parent
    }
    
    if (object && object.userData.type === 'pig') {
      // 召唤卡车来装这只猪
      callTruckForPig(object)
      return // 点了猪就不扔苹果了
    }
  }
  
  // 2. 如果没点到猪，且点到了草地，则扔苹果
  const groundIntersects = raycaster.intersectObject(ground)
  
  if (groundIntersects.length > 0) {
    createApple(groundIntersects[0].point, selectedFruit.value)
  }
}

function callTruckForPig(pig) {
  truckState = 'driving_in'
  targetedPigForTruck = pig
  pig.userData.state = 'waiting_for_truck' // 猪停止活动等待上车
  
  // 卡车从远处开过来停在猪附近的马路上
  truck.position.set(20, 0, -100) // Start from far away
  
  // 找一个和猪Z轴平行的马路位置停车
  const stopZ = pig.position.z
  
  gsap.to(truck.position, {
    z: stopZ,
    duration: 2,
    ease: "power2.out",
    onComplete: () => {
      truckState = 'loading'
      loadPigIntoTruck(pig)
    }
  })
}

function loadPigIntoTruck(pig) {
  // 把猪“吸”进车厢
  gsap.to(pig.position, {
    x: truck.position.x,
    y: truck.position.y + 3, // 高于车斗一点
    z: truck.position.z - 1.5,
    duration: 1,
    ease: "power1.inOut",
    onComplete: () => {
      // 正式装入车厢
      truck.add(pig)
      pig.position.set(0, 2.5, -1.5)
      pig.rotation.set(0, Math.PI, 0)
      
      const idx = pigs.indexOf(pig)
      if (idx > -1) pigs.splice(idx, 1)
      
      // 开走
      truckState = 'driving_away'
      playOinkSound()
      
      gsap.to(truck.position, {
        z: 100, // 开向远方
        duration: 3,
        ease: "power2.in",
        onComplete: () => {
          truck.remove(pig)
          
          // 卡车从远方反向开回来（空车）
          truck.position.z = -100
          truckState = 'driving_back'
          
          gsap.to(truck.position, {
            z: 0,
            duration: 3,
            ease: "power2.out",
            onComplete: () => {
              truckState = 'idle'
              targetedPigForTruck = null
            }
          })
        }
      })
    }
  })
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  // Rotate truck wheels if driving
  if (truckState === 'driving_away') {
    truck.children.forEach(c => {
      if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y === 0.8) {
        c.rotation.x += 0.2
      }
    })
  } else if (truckState === 'driving_back') {
    truck.children.forEach(c => {
      if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y === 0.8) {
        c.rotation.x -= 0.2 // rotate backwards? No, truck drives forward
        c.rotation.x += 0.2 
      }
    })
  }
  
  pigs.forEach(pig => {
    if (pig.userData.state === 'eating' || pig.userData.state === 'dragged' || pig.userData.state === 'in_truck') return // Skip moving if busy
    
    // Find closest apple
    let closestApple = null
    let minDistance = Infinity
    
    apples.forEach(apple => {
      if (apple.userData.isTargetedBy && apple.userData.isTargetedBy !== pig) return // Apple claimed by another pig
      
      const dist = pig.position.distanceTo(apple.position)
      if (dist < minDistance) {
        minDistance = dist
        closestApple = apple
      }
    })
    
    if (closestApple) {
      // Move towards apple
      closestApple.userData.isTargetedBy = pig
      pig.userData.target = closestApple.position.clone()
      pig.userData.target.y = 2 // Keep pig on ground level
      
      // If close enough, eat it
      if (minDistance < 3) {
        pig.userData.state = 'eating'
        
        // Remove apple
        scene.remove(closestApple)
        const idx = apples.indexOf(closestApple)
        if (idx > -1) apples.splice(idx, 1)
        
        // 播放连续的吧唧嘴声音
        let eatCount = 0
        const eatInterval = setInterval(() => {
          playCrunchSound()
          eatCount++
          if (eatCount >= 3) clearInterval(eatInterval)
        }, 150)
        
        // Eating animation
        gsap.to(pig.scale, {
          x: 3, y: 2, z: 3, // squish down
          duration: 0.15,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            pig.userData.state = 'idle'
            feedCount.value++
            pig.userData.applesEaten++ // 增加吃苹果计数
            
            playOinkSound() // Happy oink after eating
            
            // 吃够3个生一只小猪
            if (pig.userData.applesEaten >= 3) {
              pig.userData.applesEaten = 0 // 重置计数
              spawnPigs(1, pig.position) // 在当前猪的位置生一只新猪
              
              // 也可以给新生的动作加个特别的声音或者稍微蹦一下
              gsap.to(pig.position, { y: 4, duration: 0.3, yoyo: true, repeat: 1 })
            }
            
            // Random new target
            pig.userData.target = getRandomTarget()
          }
        })
        return
      }
    } else {
      // Random wandering if no apples
      if (pig.position.distanceTo(pig.userData.target) < 2) {
        pig.userData.target = getRandomTarget()
      }
    }
    
    // Movement logic
    const dir = new THREE.Vector3().subVectors(pig.userData.target, pig.position)
    dir.y = 0
    if (dir.length() > 0.1) {
      dir.normalize()
      
      // Speed burst if chasing apple
      const currentSpeed = closestApple ? pig.userData.speed * 2 : pig.userData.speed
      pig.position.addScaledVector(dir, currentSpeed)
      
      // Rotation
      const targetRotation = Math.atan2(dir.x, dir.z)
      let diff = targetRotation - pig.rotation.y
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      pig.rotation.y += diff * 0.1
      
      // Bobbing
      pig.position.y = 2 + Math.abs(Math.sin(Date.now() * 0.01 * currentSpeed * 100)) * 0.4
    }
  })
  
  renderer.render(scene, camera)
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(pigs, true)
  if (intersects.length > 0 && truckState === 'idle' && pigs.length >= 2) {
    document.body.style.cursor = 'pointer' // 提示可以点击猪
  } else {
    document.body.style.cursor = 'default'
  }
}
</script>

<style scoped>
.pig-game {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #87ceeb;
}

#pig-container {
  width: 100%;
  height: 100%;
}

.score-board {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px 25px;
  border-radius: 20px;
  font-size: 28px;
  font-weight: bold;
  color: #333;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 100;
  border: 3px solid #ff69b4; /* Hot pink border for pig game */
}

.fruit-menu {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
  background: rgba(255, 255, 255, 0.8);
  padding: 15px 25px;
  border-radius: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  z-index: 100;
}

.fruit-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  background: white;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border: 3px solid transparent;
  box-sizing: border-box;
}

.fruit-btn:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.fruit-btn.active {
  border-color: #ff1493;
  background: #ffe4e1;
  transform: scale(1.15) translateY(-5px);
  box-shadow: 0 8px 20px rgba(255, 20, 147, 0.4);
}

.fruit-icon {
  font-size: 28px;
  margin-bottom: 5px;
}

.fruit-name {
  font-size: 12px;
  font-weight: bold;
  color: #555;
}
</style>
