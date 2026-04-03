import * as THREE from 'three'
import gsap from 'gsap'

export function createEnvironment(
  scene,
  fruitArray,
  seaweedArray,
  waterSurfacePlaneRef,
  tableRef,
  tankGroupRef,
  waterRef
) {
  // Table
  const tableGeometry = new THREE.BoxGeometry(30, 1, 20)
  const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
  const table = new THREE.Mesh(tableGeometry, tableMaterial)
  table.position.y = -0.5
  table.receiveShadow = true
  scene.add(table)
  if (tableRef) tableRef.value = table
  
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
  const tankGroup = new THREE.Group()
  
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
  if (tankGroupRef) tankGroupRef.value = tankGroup
  
  // Water
  const waterGeometry = new THREE.BoxGeometry(tankWidth - 0.4, tankHeight - 1, tankDepth - 0.4)
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x00aaff,
    transmission: 0.8,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2
  })
  const water = new THREE.Mesh(waterGeometry, waterMaterial)
  water.position.y = (tankHeight - 1) / 2 + 0.2
  scene.add(water)
  if (waterRef) waterRef.value = water
  
  // Invisible plane for raycasting food drops
  const planeGeo = new THREE.PlaneGeometry(100, 100)
  const planeMat = new THREE.MeshBasicMaterial({ visible: false })
  const waterSurfacePlane = new THREE.Mesh(planeGeo, planeMat)
  waterSurfacePlane.rotation.x = -Math.PI / 2
  waterSurfacePlane.position.y = 8 // Drop food from height 8
  scene.add(waterSurfacePlane)
  if (waterSurfacePlaneRef) waterSurfacePlaneRef.value = waterSurfacePlane
  
  // Ground Fruits (replacing Rocks)
  const fruitColors = [0xff0000, 0xffa500, 0xffff00, 0x00ff00, 0x0000ff, 0x800080, 0xff1493]
  for(let i=0; i<30; i++) {
    const rSize = 0.3 + Math.random() * 0.3
    const fruitGeo = new THREE.SphereGeometry(rSize, 16, 16)
    const fruitMat = new THREE.MeshStandardMaterial({ 
      color: fruitColors[Math.floor(Math.random() * fruitColors.length)], 
      roughness: 0.6 
    })
    const fruit = new THREE.Mesh(fruitGeo, fruitMat)
    
    // Initial position inside the tank
    const initX = (Math.random() - 0.5) * (tankWidth - 4)
    const initZ = (Math.random() - 0.5) * (tankDepth - 4)
    fruit.position.set(initX, rSize, initZ)
    
    fruit.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    fruit.castShadow = true
    fruit.receiveShadow = true
    
    // Store target expanded position for game start
    fruit.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      rSize,
      (Math.random() - 0.5) * 80
    )
    
    fruit.userData.isGroundFruit = true
    scene.add(fruit)
    fruitArray.push(fruit)
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

  // Add Fruit Trees as static environment objects
  createFruitTrees(scene, seaweedArray, tankWidth, tankDepth)
}

function createFruitTrees(scene, seaweedArray, tankWidth, tankDepth) {
  const treeTypes = ['lemon', 'watermelon', 'apple']
  
  for (let i = 0; i < 6; i++) { // 2 of each type
    const type = treeTypes[i % 3]
    const group = new THREE.Group()
    
    let trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    let canopyMat, fruitGeo, fruitMat, fruitCount, fruitRadius, yOffset
    
    if (type === 'lemon') {
      canopyMat = new THREE.MeshStandardMaterial({ color: 0x228b22 })
      fruitGeo = new THREE.SphereGeometry(0.2, 8, 8)
      fruitGeo.scale(0.8, 1.2, 0.8)
      fruitMat = new THREE.MeshStandardMaterial({ color: '#fff700', roughness: 0.6 })
      fruitCount = 8
      fruitRadius = 1.5
      yOffset = 1.5
    } else if (type === 'watermelon') {
      trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 })
      canopyMat = new THREE.MeshStandardMaterial({ color: 0x006400 })
      fruitGeo = new THREE.SphereGeometry(0.4, 16, 16)
      fruitGeo.scale(1, 1.2, 1)
      // Simple green material since we don't have the procedural texture generator here
      fruitMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7 }) 
      fruitCount = 5
      fruitRadius = 2.0
      yOffset = 2.0
    } else if (type === 'apple') {
      canopyMat = new THREE.MeshStandardMaterial({ color: 0x32cd32 })
      fruitGeo = new THREE.SphereGeometry(0.25, 16, 16)
      fruitMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.4 })
      fruitCount = 10
      fruitRadius = 1.8
      yOffset = 1.8
    }
    
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, yOffset * 1.5, 8)
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = yOffset * 0.75
    
    // Canopy
    const canopyGeo = type === 'apple' ? new THREE.DodecahedronGeometry(fruitRadius, 1) : new THREE.SphereGeometry(fruitRadius, 16, 16)
    const canopy = new THREE.Mesh(canopyGeo, canopyMat)
    canopy.position.y = yOffset * 1.5
    
    group.add(trunk, canopy)
    
    // Fruits
    for (let j = 0; j < fruitCount; j++) {
      const fruit = new THREE.Mesh(fruitGeo, fruitMat)
      const phi = type === 'watermelon' ? Math.random() * Math.PI * 0.8 : Math.random() * Math.PI
      const theta = Math.random() * Math.PI * 2
      fruit.position.set(
        fruitRadius * Math.sin(phi) * Math.cos(theta),
        yOffset * 1.5 + fruitRadius * Math.cos(phi),
        fruitRadius * Math.sin(phi) * Math.sin(theta)
      )
      fruit.rotation.set(Math.random(), Math.random(), Math.random())
      group.add(fruit)
    }
    
    // Position
    const initX = (Math.random() - 0.5) * (tankWidth - 4)
    const initZ = (Math.random() - 0.5) * (tankDepth - 4)
    group.position.set(initX, 0, initZ)
    
    group.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 60,
      0,
      (Math.random() - 0.5) * 60
    )
    
    group.children.forEach(c => c.castShadow = true)
    
    // Store original vertices of canopy to make it sway like seaweed
    group.userData.originalVertices = []
    group.userData.isTriangle = false
    const posAttr = canopyGeo.attributes.position
    for (let j = 0; j < posAttr.count; j++) {
      group.userData.originalVertices.push({
        x: posAttr.getX(j),
        y: posAttr.getY(j),
        z: posAttr.getZ(j)
      })
    }
    group.userData.swayOffset = Math.random() * Math.PI * 2
    
    // Replace the canopy geometry with a new one that we can animate
    const animCanopyGeo = canopyGeo.clone()
    canopy.geometry = animCanopyGeo
    // Pass reference to the specific geometry we want to animate
    group.geometry = animCanopyGeo 
    
    // Add custom flag to identify fruit trees as edible food
    group.userData.isFruitTree = true
    group.userData.isPoisonous = false // Fruit trees are safe to eat
    
    scene.add(group)
    seaweedArray.push(group)
    
    // Add to mushroom array so fish can eat them
    if (typeof window !== 'undefined' && window.mushroomArrayRef) {
      window.mushroomArrayRef.push(group)
    }
  }
}
