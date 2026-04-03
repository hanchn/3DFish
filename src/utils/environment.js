import * as THREE from 'three'
import gsap from 'gsap'

export function createEnvironment(
  scene,
  rockArray,
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
  
  // Rocks
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
  for(let i=0; i<30; i++) {
    const rSize = 0.5 + Math.random() * 1.5
    const rockGeo = new THREE.DodecahedronGeometry(rSize, 1)
    const rock = new THREE.Mesh(rockGeo, rockMaterial)
    
    // Initial position inside the tank
    const initX = (Math.random() - 0.5) * (tankWidth - 4)
    const initZ = (Math.random() - 0.5) * (tankDepth - 4)
    rock.position.set(initX, rSize / 2, initZ)
    
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    rock.castShadow = true
    rock.receiveShadow = true
    
    // Store target expanded position for game start
    rock.userData.targetPosition = new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      rSize / 2,
      (Math.random() - 0.5) * 80
    )
    
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
