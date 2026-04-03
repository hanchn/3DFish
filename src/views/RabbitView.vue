<template>
  <div class="rabbit-container">
    <div ref="container" class="canvas-container"></div>
    <div id="ui-layer">
      <div class="score-board">
        吃掉的果蔬：{{ score }}<br>
        兔子体重：{{ weight.toFixed(1) }}kg
      </div>
      <div class="controls-hint">
        🐰 兔子拔萝卜<br>
        [鼠标左键点击] 地面让兔子跳过去<br>
        [鼠标左键点击] 萝卜，拔出它！<br>
        <span style="color: #ffd700">特别大的萝卜需要点击多次才能拔出！</span><br>
        拔出后再次点击萝卜可以吃掉得分！
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
const weight = ref(5.0) // initial weight is 5.0kg

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
  const cropTypes = ['carrot', 'cabbage', 'strawberry', 'apple', 'pear', 'banana', 'grape', 'peach']
  
  // Base materials
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff8c00, roughness: 0.6 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x32cd32 })
  const cabbageMat = new THREE.MeshStandardMaterial({ color: 0x90ee90, roughness: 0.8 })
  const strawberryMat = new THREE.MeshStandardMaterial({ color: 0xff0033, roughness: 0.4 })
  const appleMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 })
  const pearMat = new THREE.MeshStandardMaterial({ color: 0xd1e231, roughness: 0.4 })
  const bananaMat = new THREE.MeshStandardMaterial({ color: 0xffe135, roughness: 0.5 })
  const grapeMat = new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.2 })
  const peachMat = new THREE.MeshStandardMaterial({ color: 0xffdab9, roughness: 0.5 })

  // Plant 40 crops randomly
  for (let i = 0; i < 40; i++) {
    const cropGroup = new THREE.Group()
    const type = cropTypes[Math.floor(Math.random() * cropTypes.length)]
    
    if (type === 'carrot') {
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 8), carrotMat)
      root.rotation.x = Math.PI
      root.position.y = -0.3
      const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), leafMat)
      leaf1.position.set(0, 0.5, 0)
      leaf1.rotation.x = Math.PI / 8
      const leaf2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), leafMat)
      leaf2.position.set(0, 0.5, 0)
      leaf2.rotation.x = -Math.PI / 8
      cropGroup.add(root, leaf1, leaf2)
    } else if (type === 'cabbage') {
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), cabbageMat)
      body.position.y = 0.2
      body.scale.set(1, 0.8, 1)
      cropGroup.add(body)
    } else if (type === 'strawberry') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 16), strawberryMat)
      body.rotation.x = Math.PI
      body.position.y = 0.2
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0, 0.1, 8), leafMat)
      cap.position.y = 0.6
      cropGroup.add(body, cap)
    } else if (type === 'apple') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), appleMat)
      body.position.y = 0.3
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2), new THREE.MeshStandardMaterial({color: 0x8b4513}))
      stem.position.y = 0.75
      cropGroup.add(body, stem)
    } else if (type === 'pear') {
      const bodyGeo = new THREE.SphereGeometry(0.4, 16, 16)
      bodyGeo.translate(0, -0.1, 0)
      const topGeo = new THREE.SphereGeometry(0.25, 16, 16)
      topGeo.translate(0, 0.3, 0)
      const body = new THREE.Mesh(bodyGeo, pearMat)
      const top = new THREE.Mesh(topGeo, pearMat)
      body.position.y = 0.3
      top.position.y = 0.3
      cropGroup.add(body, top)
    } else if (type === 'banana') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), bananaMat)
      body.rotation.z = Math.PI / 4
      body.position.y = 0.4
      // Curve it slightly by using a bent tube or just leave it straight for simplicity
      cropGroup.add(body)
    } else if (type === 'grape') {
      const grapeGroup = new THREE.Group()
      for(let j=0; j<10; j++) {
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), grapeMat)
        berry.position.set((Math.random()-0.5)*0.3, Math.random()*0.5, (Math.random()-0.5)*0.3)
        grapeGroup.add(berry)
      }
      grapeGroup.position.y = 0.2
      cropGroup.add(grapeGroup)
    } else if (type === 'peach') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), peachMat)
      body.position.y = 0.3
      // A little cleft
      body.scale.set(1, 0.95, 1.05)
      cropGroup.add(body)
    }
    
    // Position
    const x = (Math.random() - 0.5) * 40
    const z = (Math.random() - 0.5) * 40
    
    if (Math.abs(x) < 2 && Math.abs(z) < 2) continue
    
    cropGroup.position.set(x, 0, z)
    
    // Random scale for huge crops
    const scale = 0.5 + Math.random() * 3.0
    cropGroup.scale.set(scale, scale, scale)
    
    // Determine pulls required based on size
    cropGroup.userData.requiredPulls = Math.max(1, Math.floor(scale * 1.8))
    cropGroup.userData.currentPulls = 0
    cropGroup.userData.isUprooted = false
    cropGroup.userData.cropType = type
    
    // Random slight tilt
    cropGroup.rotation.x = (Math.random() - 0.5) * 0.2
    cropGroup.rotation.z = (Math.random() - 0.5) * 0.2
    
    scene.add(cropGroup)
    carrotsArray.push(cropGroup)
  }
}

function onMouseClick(event) {
  if (rabbitGroup.userData.isPulling || rabbitGroup.userData.isFalling) return

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
  
  if (rabbitGroup && !rabbitGroup.userData.isFalling) {
    // Check if rabbit is off the edge (ground is 50x50, so bounds are -25 to 25)
    if (Math.abs(rabbitGroup.position.x) > 25 || Math.abs(rabbitGroup.position.z) > 25) {
      fallOffEdge()
    } else if (targetPosition && !rabbitGroup.userData.isPulling) {
      const currentPos = rabbitGroup.position.clone()
      currentPos.y = 0
      const targetPos2D = targetPosition.clone()
      targetPos2D.y = 0
      
      const distance = currentPos.distanceTo(targetPos2D)
      
      if (distance > 0.5) {
        // Move towards target
        const dir = targetPos2D.sub(currentPos).normalize()
        
        // Speed depends on weight! Fat rabbit runs slower
        const currentSpeed = Math.max(0.05, 0.2 - (weight.value - 5.0) * 0.01)
        rabbitGroup.position.add(dir.multiplyScalar(currentSpeed))
        
        // Running burns calories
        burnCalories(0.002)
        
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
          const target = rabbitGroup.userData.targetCarrot
          const index = rabbitGroup.userData.targetCarrotIndex
          rabbitGroup.userData.targetCarrot = null
          
          // If rabbit is fat enough (>10kg), it can eat anything without pulling it out!
          if (target.userData.isUprooted || weight.value > 10.0) {
            eatCarrot(target, index)
          } else {
            pullCarrot(target, index)
          }
        }
      }
    }
  }
  
  if (rabbitGroup && !rabbitGroup.userData.isFalling) {
    // Camera follow
    camera.position.x += (rabbitGroup.position.x - camera.position.x) * 0.1
    camera.position.z += (rabbitGroup.position.z + 15 - camera.position.z) * 0.1
    camera.lookAt(rabbitGroup.position.x, 0, rabbitGroup.position.z)
  }
  
  renderer.render(scene, camera)
}

function fallOffEdge() {
  rabbitGroup.userData.isFalling = true
  targetPosition = null
  
  // Stop any hopping
  gsap.killTweensOf(rabbitGroup.position)
  
  // Fall down animation
  gsap.to(rabbitGroup.position, {
    y: -20,
    duration: 1.5,
    ease: 'power2.in',
    onComplete: () => {
      // Reset game
      alert("哎呀！兔子掉下去了！游戏重新开始。")
      resetGame()
    }
  })
  
  // Spin while falling
  gsap.to(rabbitGroup.rotation, {
    x: Math.PI * 4,
    y: Math.PI * 4,
    z: Math.PI * 4,
    duration: 1.5,
    ease: 'power1.in'
  })
}

function resetGame() {
  // Clear old carrots
  carrotsArray.forEach(c => {
    if (c) scene.remove(c)
  })
  carrotsArray = []
  
  // Reset score
  score.value = 0
  
  // Reset rabbit
  rabbitGroup.position.set(0, 0, 0)
  rabbitGroup.rotation.set(0, 0, 0)
  rabbitGroup.userData.isFalling = false
  rabbitGroup.userData.isPulling = false
  rabbitGroup.userData.isHopping = false
  rabbitGroup.userData.targetCarrot = null
  targetPosition = null
  
  // Respawn field
  createCarrotField()
  
  // Reset camera
  camera.position.set(0, 15, 15)
  camera.lookAt(0, 0, 0)
}

function updateRabbitScale() {
  // Make the weight gain much more visible (exaggerated scaling)
  // At 10kg (double weight), the rabbit will be twice as wide
  const scaleFactor = Math.max(1.0, 1.0 + (weight.value - 5.0) * 0.2)
  gsap.to(rabbitGroup.scale, {
    x: scaleFactor,
    y: 1.0 + (scaleFactor - 1.0) * 0.2, // slightly taller but mostly fatter
    z: scaleFactor,
    duration: 0.3,
    ease: "power2.out"
  })
}

function burnCalories(amount) {
  if (weight.value > 5.0) {
    weight.value = Math.max(5.0, weight.value - amount)
    updateRabbitScale()
  }
}

function pullCarrot(carrot, index) {
  rabbitGroup.userData.isPulling = true
  carrot.userData.currentPulls++
  
  // Pulling is hard work! Burn some calories
  burnCalories(0.1)
  
  const isUprootedNow = carrot.userData.currentPulls >= carrot.userData.requiredPulls
  
  // Fatter rabbit pulls and eats faster!
  // Base weight is 5.0kg. At 15kg (10kg gain), action speed is 3x faster (duration / 3)
  const speedMultiplier = Math.max(1.0, 1.0 + (weight.value - 5.0) * 0.2)
  const animDuration = 0.2 / speedMultiplier
  
  // Pull animation (dip down then jump up)
  gsap.to(rabbitGroup.position, {
    y: -0.2,
    duration: animDuration,
    ease: 'power2.in',
    onComplete: () => {
      if (carrot) {
        if (isUprootedNow) {
          carrot.userData.isUprooted = true
          
          // Pop the carrot out and lay it on the ground
          gsap.to(carrot.position, {
            y: 0.4 * carrot.scale.y, // Lay on ground depending on scale
            x: carrot.position.x + (Math.random() - 0.5) * 1.5,
            z: carrot.position.z + (Math.random() - 0.5) * 1.5,
            duration: 0.3 / speedMultiplier,
            ease: 'back.out(1.7)'
          })
          gsap.to(carrot.rotation, {
            x: Math.PI / 2 + (Math.random() - 0.5) * 0.5, // lay flat
            z: Math.random() * Math.PI * 2,
            duration: 0.3 / speedMultiplier
          })
        } else {
          // Struggle animation (carrot wiggles)
          gsap.to(carrot.rotation, {
            x: carrot.rotation.x + 0.15,
            z: carrot.rotation.z + 0.15,
            yoyo: true,
            repeat: 3,
            duration: 0.05 / speedMultiplier
          })
        }
      }
      
      // Rabbit jumps back up
      gsap.to(rabbitGroup.position, {
        y: 0,
        duration: animDuration,
        ease: 'power2.out',
        onComplete: () => {
          rabbitGroup.userData.isPulling = false
        }
      })
    }
  })
}

function eatCarrot(carrot, index) {
  rabbitGroup.userData.isPulling = true
  
  // Fatter rabbit pulls and eats faster!
  const speedMultiplier = Math.max(1.0, 1.0 + (weight.value - 5.0) * 0.2)
  const animDuration = 0.15 / speedMultiplier
  
  // Eat animation (nibble)
  gsap.to(rabbitGroup.position, {
    y: -0.2,
    duration: animDuration,
    yoyo: true,
    repeat: 3,
    ease: 'power1.inOut',
    onComplete: () => {
      if (carrot) {
        carrotsArray[index] = null
        
        // Calculate weight gain based on the size of the crop (more exaggerated)
        const sizeGain = carrot.scale.x * 0.8 // E.g., size 3.0 gives 2.4kg gain!
        weight.value += sizeGain
        updateRabbitScale()
        
        // Carrot disappears
        gsap.to(carrot.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.2 / speedMultiplier,
          onComplete: () => {
            scene.remove(carrot)
            score.value++
            
            // Check win condition
            if (score.value >= 40) {
              setTimeout(() => alert("你吃光了所有的果蔬！兔子吃饱了！"), 500)
            }
          }
        })
      }
      
      rabbitGroup.position.y = 0
      rabbitGroup.userData.isPulling = false
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
