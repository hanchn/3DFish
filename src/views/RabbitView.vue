<template>
  <div class="rabbit-container">
    <div ref="container" class="canvas-container"></div>
    <div id="ui-layer">
      <div class="score-board">
        拔出的萝卜：{{ score }}
      </div>
      <div class="controls-hint">
        🐰 兔子拔萝卜<br>
        [鼠标左键点击] 地面让兔子跳过去<br>
        [鼠标左键点击] 萝卜，兔子会自动跳过去并拔出萝卜
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
let groundPlane

// Mouse interaction state
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let targetPosition = null

onMounted(() => {
  initScene()
  createRabbit()
  createCarrotField()
  
  window.addEventListener('click', onMouseClick)
  
  animate()
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onMouseClick)
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
  
  groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  groundPlane.rotation.x = -Math.PI / 2
  scene.add(groundPlane)
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

function onMouseClick(event) {
  if (rabbitGroup.userData.isPulling) return

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // First check if we clicked a carrot
  let clickedCarrot = null
  let carrotIndex = -1
  
  const activeCarrots = carrotsArray.filter(c => c !== null)
  const intersects = raycaster.intersectObjects(activeCarrots, true)
  
  if (intersects.length > 0) {
    // Find the root group of the clicked carrot
    let obj = intersects[0].object
    while (obj.parent && obj.parent !== scene) {
      obj = obj.parent
    }
    clickedCarrot = obj
    carrotIndex = carrotsArray.indexOf(clickedCarrot)
  }

  if (clickedCarrot) {
    targetPosition = clickedCarrot.position.clone()
    rabbitGroup.userData.targetCarrot = clickedCarrot
    rabbitGroup.userData.targetCarrotIndex = carrotIndex
  } else {
    // If no carrot clicked, check ground
    const groundIntersects = raycaster.intersectObject(groundPlane)
    if (groundIntersects.length > 0) {
      targetPosition = groundIntersects[0].point.clone()
      rabbitGroup.userData.targetCarrot = null
    }
  }

  if (targetPosition) {
    // Make rabbit face the target
    rabbitGroup.lookAt(targetPosition.x, rabbitGroup.position.y, targetPosition.z)
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  
  if (rabbitGroup && targetPosition && !rabbitGroup.userData.isPulling) {
    const currentPos = rabbitGroup.position.clone()
    currentPos.y = 0
    const targetPos2D = targetPosition.clone()
    targetPos2D.y = 0
    
    const distance = currentPos.distanceTo(targetPos2D)
    
    if (distance > 0.5) {
      // Move towards target
      const dir = targetPos2D.sub(currentPos).normalize()
      rabbitGroup.position.add(dir.multiplyScalar(0.2))
      
      // Hopping animation
      if (!rabbitGroup.userData.isHopping) {
        rabbitGroup.userData.isHopping = true
        gsap.to(rabbitGroup.position, {
          y: 0.8,
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          ease: 'power1.out',
          onComplete: () => {
            rabbitGroup.userData.isHopping = false
          }
        })
      }
    } else {
      // Reached destination
      rabbitGroup.position.x = targetPosition.x
      rabbitGroup.position.z = targetPosition.z
      targetPosition = null
      
      // If destination was a carrot, start pulling!
      if (rabbitGroup.userData.targetCarrot) {
        pullCarrot(rabbitGroup.userData.targetCarrot, rabbitGroup.userData.targetCarrotIndex)
        rabbitGroup.userData.targetCarrot = null
      }
    }
  }
  
  if (rabbitGroup) {
    // Camera follow
    camera.position.x += (rabbitGroup.position.x - camera.position.x) * 0.1
    camera.position.z += (rabbitGroup.position.z + 15 - camera.position.z) * 0.1
    camera.lookAt(rabbitGroup.position.x, 0, rabbitGroup.position.z)
  }
  
  renderer.render(scene, camera)
}

function pullCarrot(carrot, index) {
  rabbitGroup.userData.isPulling = true
  
  // Pull animation (dip down then jump up)
  gsap.to(rabbitGroup.position, {
    y: -0.2,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      if (carrot) {
        carrotsArray[index] = null
        
        // Pop the carrot out
        gsap.to(carrot.position, {
          y: 3,
          duration: 0.3,
          ease: 'back.out(1.7)'
        })
        gsap.to(carrot.rotation, {
          x: Math.PI * 2,
          y: Math.PI * 2,
          duration: 0.5
        })
        
        // Carrot disappears
        gsap.to(carrot.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.2,
          delay: 0.4,
          onComplete: () => {
            scene.remove(carrot)
            score.value++
            
            if (score.value >= 40) {
              setTimeout(() => alert("你拔光了所有的萝卜！兔子吃饱了！"), 500)
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
