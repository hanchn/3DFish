<template>
  <div class="cow-game">
    <div id="cow-container"></div>
    <div class="score-board">
      🍼 收集的牛奶: {{ milkCount }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import gsap from 'gsap'
import { createFishModel } from '../utils/models'

const milkCount = ref(0)
let scene, camera, renderer, animationId
const cows = []
const milkBottles = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const groundSize = 60 // A bit larger field

onMounted(() => {
  initScene()
  spawnCows()
  animate()
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('click', onClick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('click', onClick)
  
  // Cleanup
  if (renderer) {
    renderer.dispose()
    document.getElementById('cow-container').innerHTML = ''
  }
})

function initScene() {
  const container = document.getElementById('cow-container')
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // sky blue

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  // isometric-like view
  camera.position.set(0, 30, 35)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  // Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(10, 20, 10)
  dirLight.castShadow = true
  dirLight.shadow.camera.left = -40
  dirLight.shadow.camera.right = 40
  dirLight.shadow.camera.top = 40
  dirLight.shadow.camera.bottom = -40
  scene.add(dirLight)

  // Ground
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x55aa55 }) // Grass green
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  
  // Add some trees or fences for decoration?
}

function spawnCows() {
  for (let i = 0; i < 6; i++) { // 减少生成的奶牛数量
    const cow = createFishModel('cow', 0xffffff)
    cow.scale.set(3, 3, 3) // 把牛放大3倍
    
    // Position randomly on ground
    cow.position.set(
      (Math.random() - 0.5) * (groundSize - 10),
      3, // roughly body height (scaled up)
      (Math.random() - 0.5) * (groundSize - 10)
    )
    
    // Custom data for wandering
    cow.userData.target = getRandomTarget()
    cow.userData.isHovered = false
    cow.userData.speed = 0.03 + Math.random() * 0.03
    cow.userData.hasMilked = false // 标记是否已经在这个位置被挤过奶
    cow.userData.lastMilkPos = new THREE.Vector3() // 记录上次挤奶的位置
    
    // Bounding box for raycasting
    const boxGeo = new THREE.BoxGeometry(2.5, 3, 4)
    const boxMat = new THREE.MeshBasicMaterial({ visible: false })
    const hitbox = new THREE.Mesh(boxGeo, boxMat)
    hitbox.userData.isCow = true
    hitbox.userData.cowRef = cow
    cow.add(hitbox)
    
    scene.add(cow)
    cows.push(cow)
  }
}

function getRandomTarget() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * (groundSize - 10),
    3,
    (Math.random() - 0.5) * (groundSize - 10)
  )
}

function createMilkBottle(position) {
  const group = new THREE.Group()
  group.scale.set(1.5, 1.5, 1.5) // 奶瓶也稍微放大一点
  
  // Bottle body (glass)
  const bottleGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 16)
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.9,
    opacity: 1,
    transparent: true,
    roughness: 0.1
  })
  const bottle = new THREE.Mesh(bottleGeo, bottleMat)
  bottle.castShadow = true
  
  // Milk inside
  const milkGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16)
  const milkMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
  const milk = new THREE.Mesh(milkGeo, milkMat)
  milk.position.y = -0.05
  
  // Cap
  const capGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16)
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
  const cap = new THREE.Mesh(capGeo, capMat)
  cap.position.y = 0.6
  
  group.add(bottle, milk, cap)
  
  // Add a hitbox for easy clicking
  const hitboxGeo = new THREE.CylinderGeometry(0.8, 0.8, 2)
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false })
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat)
  hitbox.userData.isMilk = true
  hitbox.userData.milkRef = group
  group.add(hitbox)
  
  // Start position (drop from cow udder roughly)
  // Drop behind/below the cow a bit
  const startY = position.y
  group.position.copy(position)
  group.position.y = startY
  
  scene.add(group)
  milkBottles.push(group)
  
  // Drop animation
  gsap.to(group.position, {
    y: 0.5, // Ground level
    duration: 0.6,
    ease: "bounce.out"
  })
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  
  // Reset all hover states
  let isPointer = false
  cows.forEach(cow => {
    cow.userData.isHovered = false
  })
  
  // Check intersection with cows
  const intersects = raycaster.intersectObjects(scene.children, true)
  for (let i = 0; i < intersects.length; i++) {
    if (intersects[i].object.userData.isCow) {
      const cow = intersects[i].object.userData.cowRef
      cow.userData.isHovered = true
      isPointer = true
      break
    } else if (intersects[i].object.userData.isMilk) {
      isPointer = true
      break
    }
  }
  
  document.body.style.cursor = isPointer ? 'pointer' : 'default'
}

// Audio context for procedural mooing sound
let audioCtx

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) {
      audioCtx = new AudioContext()
    }
  }
}

function playMooSound() {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  // Procedural "Moo" sound synthesis
  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()

  // Cow sound is roughly a low frequency sawtooth or triangle with some pitch bending
  osc.type = 'sawtooth'
  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)

  const now = audioCtx.currentTime
  const duration = 0.8

  // Pitch bend: Start slightly high, drop low, end slightly higher
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(80, now + duration * 0.4)
  osc.frequency.linearRampToValueAtTime(70, now + duration * 0.8)
  osc.frequency.linearRampToValueAtTime(100, now + duration)

  // Volume envelope
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1) // Attack
  gainNode.gain.setValueAtTime(0.3, now + duration - 0.2) // Sustain
  gainNode.gain.linearRampToValueAtTime(0, now + duration) // Release

  osc.start(now)
  osc.stop(now + duration)
}

function onClick(event) {
  initAudio() // Initialize audio context on first user interaction
  
  // 必须重新计算鼠标位置以防未移动直接点击
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(scene.children, true)
  
  // 优先检测奶瓶，这样当奶瓶和牛重叠时优先收集奶瓶
  let clickedMilk = false
  for (let i = 0; i < intersects.length; i++) {
    const obj = intersects[i].object
    if (obj.userData.isMilk) {
      const milk = obj.userData.milkRef
      
      if (!milk.userData.collected) {
        milk.userData.collected = true
        milkCount.value++
        clickedMilk = true
        
        gsap.to(milk.position, {
          y: milk.position.y + 3,
          duration: 0.4,
          ease: "power2.out"
        })
        gsap.to(milk.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.4,
          onComplete: () => {
            scene.remove(milk)
            const index = milkBottles.indexOf(milk)
            if (index > -1) milkBottles.splice(index, 1)
          }
        })
      }
      break
    }
  }

  // 如果没有点到奶瓶，再检测是否点到了牛
  if (!clickedMilk) {
    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object
      
      if (obj.userData.isCow) {
        const cow = obj.userData.cowRef
        
        // 如果这头牛还没被挤过奶，或者已经移动了一段距离（被重置了状态），才能产奶
        if (!cow.userData.hasMilked) {
          cow.userData.hasMilked = true
          cow.userData.lastMilkPos.copy(cow.position)
          
          playMooSound() // 播放哞哞叫
          
          // Spawn milk bottle at cow's position
          createMilkBottle(cow.position)
          
          // Little jump animation for cow
          gsap.to(cow.position, {
            y: 4.5,
            duration: 0.15,
            yoyo: true,
            repeat: 1
          })
        }
        break // 每次只点击一头牛
      }
    }
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  // Update cows
  cows.forEach(cow => {
    if (!cow.userData.isHovered) {
      // 检查奶牛是否离开了上次被挤奶的位置超过一定距离（比如 5个单位）
      if (cow.userData.hasMilked && cow.position.distanceTo(cow.userData.lastMilkPos) > 5) {
        cow.userData.hasMilked = false // 重置状态，可以再次挤奶了
      }
      
      // Move towards target
      const dir = new THREE.Vector3().subVectors(cow.userData.target, cow.position)
      dir.y = 0 // ignore vertical distance
      
      if (dir.length() < 0.5) {
        // Pick new target
        cow.userData.target = getRandomTarget()
      } else {
        dir.normalize()
        cow.position.addScaledVector(dir, cow.userData.speed)
        
        // Rotate towards target (smoothly)
        // cow model forward is +Z
        const targetRotation = Math.atan2(dir.x, dir.z)
        let diff = targetRotation - cow.rotation.y
        // normalize diff to -PI, PI
        while (diff < -Math.PI) diff += Math.PI * 2
        while (diff > Math.PI) diff -= Math.PI * 2
        cow.rotation.y += diff * 0.1
        
        // Bobbing motion
        cow.position.y = 3 + Math.abs(Math.sin(Date.now() * 0.01 * cow.userData.speed * 100)) * 0.5
      }
    } else {
      // If hovered, slightly wiggle or just stop
      // Reset y position
      cow.position.y = 3
    }
  })
  
  // Bobbing milk bottles
  milkBottles.forEach(bottle => {
    bottle.rotation.y += 0.02
  })
  
  renderer.render(scene, camera)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
</script>

<style scoped>
.cow-game {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #87ceeb;
}

#cow-container {
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
  border: 3px solid #3b82f6;
}
</style>
