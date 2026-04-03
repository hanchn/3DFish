import * as THREE from 'three'
import { playSound } from './audio.js'

export function createWaterGun(camera, scene, waterGunRef) {
  const waterGun = new THREE.Group()
  
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
  
  if (waterGunRef) waterGunRef.value = waterGun
}

export function spawnBubble(pos, scene, bubbleArray) {
  const bubbleGeo = new THREE.SphereGeometry(0.05 + Math.random()*0.1, 8, 8)
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.9,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1
  })
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat)
  bubble.position.copy(pos)
  // add a little randomness to X/Z
  bubble.position.x += (Math.random() - 0.5) * 0.2
  bubble.position.z += (Math.random() - 0.5) * 0.2
  
  scene.add(bubble)
  bubbleArray.push(bubble)
}

export function shootWaterBullet(
  gameState,
  waterGun,
  camera,
  scene,
  waterBullets,
  mouse,
  raycaster,
  waterSurfacePlane
) {
  if (gameState !== 'playing') return
  playSound('splash')
  
  // Create bullet
  const bulletGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const bulletMat = new THREE.MeshPhysicalMaterial({
    color: 0x00ffff,
    transmission: 0.8,
    transparent: true,
    opacity: 0.8,
    roughness: 0.1
  })
  const bullet = new THREE.Mesh(bulletGeo, bulletMat)
  
  // Start bullet at gun tip
  const gunTip = new THREE.Vector3(0, 0, -0.6)
  gunTip.applyMatrix4(waterGun.matrixWorld)
  bullet.position.copy(gunTip)
  
  // Determine direction based on mouse position
  raycaster.setFromCamera(mouse, camera)
  
  let targetPoint = new THREE.Vector3()
  const intersects = raycaster.intersectObject(waterSurfacePlane)
  
  if (intersects.length > 0) {
    targetPoint = intersects[0].point
    // Aim a bit lower into the water
    targetPoint.y -= 5
  } else {
    // Fallback: shoot straight ahead
    raycaster.ray.at(20, targetPoint)
  }
  
  const direction = new THREE.Vector3().subVectors(targetPoint, gunTip).normalize()
  
  // Add some bullet logic
  bullet.userData.velocity = direction.multiplyScalar(0.8) // Fast bullet
  bullet.userData.life = 0
  
  scene.add(bullet)
  waterBullets.push(bullet)
}

export function dropFoodAtCenter(
  gameState,
  camera,
  scene,
  foodArray
) {
  if (gameState !== 'playing') return
  playSound('splash')
  
  // Get camera's forward direction
  const viewDirection = new THREE.Vector3()
  camera.getWorldDirection(viewDirection)
  viewDirection.normalize()
  
  // Drop food 5 units in front of the camera, slightly higher
  const targetPos = camera.position.clone()
  targetPos.add(viewDirection.multiplyScalar(5)) 
  targetPos.y += 2
  
  // Limit max height so it doesn't spawn above water too far
  if (targetPos.y > 8) targetPos.y = 8
  
  for(let i = 0; i < 5; i++) {
    const foodGeo = new THREE.SphereGeometry(0.15, 8, 8)
    const foodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 })
    const food = new THREE.Mesh(foodGeo, foodMat)
    
    // Spread slightly
    food.position.copy(targetPos)
    food.position.x += (Math.random() - 0.5) * 1.5
    food.position.y += (Math.random() - 0.5) * 0.5
    food.position.z += (Math.random() - 0.5) * 1.5
    
    scene.add(food)
    foodArray.push(food)
  }
}
