<template>
  <div class="rabbit-container">
    <div ref="container" class="canvas-container"></div>
    <div id="ui-layer">
      <div class="score-board">
        拔出的萝卜：{{ score }}
      </div>
      <div class="controls-hint">
        🐰 兔子拔萝卜<br>
        [W/A/S/D] 或 [方向键] 控制兔子移动<br>
        [空格键] 拔出面前的萝卜
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import gsap from 'gsap'

const container = ref(null)
const score = ref(0)

let scene, camera, renderer, animationFrameId
let rabbitGroup, carrotsArray = []

// Input state
const keys = { w: false, a: false, s: false, d: false, space: false }
const rabbitSpeed = 0.15

onMounted(() => {
  initScene()
  createRabbit()
  createCarrotField()
  
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  cancelAnimationFrame(animationFrameId)
  
  if (renderer && container.value) {
    container.value.removeChild(renderer.domElement)
    renderer.dispose()
  }
})

function initScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB) // Sky blue
  
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  // Top-down isometric view
  camera.position.set(0, 15, 15)
  camera.lookAt(0, 0, 0)
  
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(10, 20, 10)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 2048
  dirLight.shadow.mapSize.height = 2048
  dirLight.shadow.camera.left = -20
  dirLight.shadow.camera.right = 20
  dirLight.shadow.camera.top = 20
  dirLight.shadow.camera.bottom = -20
  scene.add(dirLight)
  
  // Ground (Grass)
  const groundGeo = new THREE.PlaneGeometry(50, 50)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x7cfc00, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

function createRabbit() {
  rabbitGroup = new THREE.Group()
  
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.8 })
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  
  // Body
  const bodyGeo = new THREE.SphereGeometry(0.8, 16, 16)
  bodyGeo.scale(1, 0.8, 1.2)
  const body = new THREE.Mesh(bodyGeo, whiteMat)
  body.position.y = 0.8
  body.castShadow = true
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.6, 16, 16)
  const head = new THREE.Mesh(headGeo, whiteMat)
  head.position.set(0, 1.4, 0.8)
  head.castShadow = true
  
  // Ears
  const earGeo = new THREE.BoxGeometry(0.2, 0.8, 0.1)
  const earL = new THREE.Mesh(earGeo, whiteMat)
  earL.position.set(-0.3, 2.0, 0.8)
  earL.rotation.z = Math.PI / 16
  const earR = new THREE.Mesh(earGeo, whiteMat)
  earR.position.set(0.3, 2.0, 0.8)
  earR.rotation.z = -Math.PI / 16
  
  const innerEarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.11)
  const innerEarL = new THREE.Mesh(innerEarGeo, pinkMat)
  innerEarL.position.set(-0.3, 1.95, 0.8)
  innerEarL.rotation.z = Math.PI / 16
  const innerEarR = new THREE.Mesh(innerEarGeo, pinkMat)
  innerEarR.position.set(0.3, 1.95, 0.8)
  innerEarR.rotation.z = -Math.PI / 16
  
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8)
  const eyeL = new THREE.Mesh(eyeGeo, blackMat)
  eyeL.position.set(-0.25, 1.5, 1.3)
  const eyeR = new THREE.Mesh(eyeGeo, blackMat)
  eyeR.position.set(0.25, 1.5, 1.3)
  
  // Nose
  const snoutGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const snout = new THREE.Mesh(snoutGeo, pinkMat)
  snout.position.set(0, 1.3, 1.35)
  
  // Tail
  const tailGeo = new THREE.SphereGeometry(0.2, 8, 8)
  const tail = new THREE.Mesh(tailGeo, whiteMat)
  tail.position.set(0, 0.9, -1.2)
  
  rabbitGroup.add(body, head, earL, earR, innerEarL, innerEarR, eyeL, eyeR, snout, tail)
  scene.add(rabbitGroup)
  
  // Store a reference to the body for hopping animation
  rabbitGroup.userData.body = body
  rabbitGroup.userData.head = head
  rabbitGroup.userData.isHopping = false
  rabbitGroup.userData.isPulling = false
}

function createCarrotField() {
  const carrotGeo = new THREE.ConeGeometry(0.3, 1.2, 8)
  carrotGeo.rotateX(Math.PI) // Point down
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff8c00, roughness: 0.6 }) // Orange
  
  const leafGeo = new THREE.ConeGeometry(0.2, 0.8, 4)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x32cd32 }) // Green
  
  // Plant 40 carrots randomly
  for (let i = 0; i < 40; i++) {
    const carrotGroup = new THREE.Group()
    
    const root = new THREE.Mesh(carrotGeo, carrotMat)
    // Bury it in the ground, only top shows
    root.position.y = -0.3
    
    const leaf1 = new THREE.Mesh(leafGeo, leafMat)
    leaf1.position.set(0, 0.5, 0)
    leaf1.rotation.x = Math.PI / 8
    
    const leaf2 = new THREE.Mesh(leafGeo, leafMat)
    leaf2.position.set(0, 0.5, 0)
    leaf2.rotation.x = -Math.PI / 8
    
    carrotGroup.add(root, leaf1, leaf2)
    
    const x = (Math.random() - 0.5) * 40
    const z = (Math.random() - 0.5) * 40
    
    // Don't spawn exactly on the rabbit
    if (Math.abs(x) < 2 && Math.abs(z) < 2) continue
    
    carrotGroup.position.set(x, 0, z)
    
    // Random slight tilt to look natural
    carrotGroup.rotation.x = (Math.random() - 0.5) * 0.2
    carrotGroup.rotation.z = (Math.random() - 0.5) * 0.2
    
    scene.add(carrotGroup)
    carrotsArray.push(carrotGroup)
  }
}

function onKeyDown(e) {
  const key = e.key.toLowerCase()
  if (keys.hasOwnProperty(key)) keys[key] = true
  if (e.key === 'ArrowUp') keys.w = true
  if (e.key === 'ArrowDown') keys.s = true
  if (e.key === 'ArrowLeft') keys.a = true
  if (e.key === 'ArrowRight') keys.d = true
  if (e.code === 'Space') keys.space = true
}

function onKeyUp(e) {
  const key = e.key.toLowerCase()
  if (keys.hasOwnProperty(key)) keys[key] = false
  if (e.key === 'ArrowUp') keys.w = false
  if (e.key === 'ArrowDown') keys.s = false
  if (e.key === 'ArrowLeft') keys.a = false
  if (e.key === 'ArrowRight') keys.d = false
  if (e.code === 'Space') keys.space = false
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  
  if (rabbitGroup && !rabbitGroup.userData.isPulling) {
    let moveX = 0
    let moveZ = 0
    
    if (keys.w) moveZ -= 1
    if (keys.s) moveZ += 1
    if (keys.a) moveX -= 1
    if (keys.d) moveX += 1
    
    const isMoving = moveX !== 0 || moveZ !== 0
    
    if (isMoving) {
      // Normalize vector
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
      moveX = (moveX / length) * rabbitSpeed
      moveZ = (moveZ / length) * rabbitSpeed
      
      rabbitGroup.position.x += moveX
      rabbitGroup.position.z += moveZ
      
      // Rotate rabbit to face movement direction
      const angle = Math.atan2(moveX, moveZ)
      rabbitGroup.rotation.y = angle
      
      // Hopping animation
      if (!rabbitGroup.userData.isHopping) {
        rabbitGroup.userData.isHopping = true
        gsap.to(rabbitGroup.position, {
          y: 0.5,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: 'power1.out',
          onComplete: () => {
            rabbitGroup.userData.isHopping = false
          }
        })
      }
    }
    
    // Pulling action
    if (keys.space && !rabbitGroup.userData.isPulling) {
      pullCarrot()
    }
    
    // Camera follow
    camera.position.x = rabbitGroup.position.x
    camera.position.z = rabbitGroup.position.z + 15
    camera.lookAt(rabbitGroup.position)
  }
  
  renderer.render(scene, camera)
}

function pullCarrot() {
  rabbitGroup.userData.isPulling = true
  
  // Find closest carrot
  let closestCarrot = null
  let minDistance = 2.0 // Pull range
  let closestIndex = -1
  
  for (let i = 0; i < carrotsArray.length; i++) {
    const carrot = carrotsArray[i]
    if (!carrot) continue
    
    const dist = rabbitGroup.position.distanceTo(carrot.position)
    if (dist < minDistance) {
      minDistance = dist
      closestCarrot = carrot
      closestIndex = i
    }
  }
  
  // Pull animation (dip down then jump up)
  gsap.to(rabbitGroup.position, {
    y: -0.2,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      if (closestCarrot) {
        // We found a carrot!
        // Remove it from ground
        carrotsArray[closestIndex] = null
        
        // Pop the carrot out
        gsap.to(closestCarrot.position, {
          y: 3,
          duration: 0.3,
          ease: 'back.out(1.7)'
        })
        gsap.to(closestCarrot.rotation, {
          x: Math.PI * 2,
          y: Math.PI * 2,
          duration: 0.5
        })
        
        // Carrot disappears
        gsap.to(closestCarrot.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.2,
          delay: 0.4,
          onComplete: () => {
            scene.remove(closestCarrot)
            score.value++
            
            // Check win condition
            if (score.value >= 40) {
              alert("你拔光了所有的萝卜！兔子吃饱了！")
            }
          }
        })
      }
      
      // Rabbit jumps back up
      gsap.to(rabbitGroup.position, {
        y: 0,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: () => {
          rabbitGroup.userData.isPulling = false
        }
      })
    }
  })
}
</script>

<style scoped>
.rabbit-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #87CEEB;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

#ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.score-board {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px 25px;
  border-radius: 15px;
  font-size: 24px;
  font-weight: bold;
  color: #ff8c00;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border: 2px solid #ff8c00;
}

.controls-hint {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 15px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  backdrop-filter: blur(5px);
}
</style>
