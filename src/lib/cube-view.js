import * as THREE from 'three'
import { MOVE_META } from './colors.js'

const CHAR_TO_HEX = {
  U: '#F5F2E8',
  D: '#F2CE1B',
  F: '#28B56F',
  B: '#2D6BE0',
  R: '#D62B24',
  L: '#FF8A2A',
}

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B']

const NORMALS = {
  R: [1, 0, 0],
  L: [-1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
}

function faceletIndex(face, row, col) {
  return FACE_ORDER.indexOf(face) * 9 + row * 3 + col
}

function faceletPosition(face, row, col) {
  switch (face) {
    case 'U':
      return [col - 1, 1, row - 1]
    case 'D':
      return [col - 1, -1, 1 - row]
    case 'F':
      return [col - 1, 1 - row, 1]
    case 'B':
      return [1 - col, 1 - row, -1]
    case 'R':
      return [1, 1 - row, 1 - col]
    case 'L':
      return [-1, 1 - row, col - 1]
    default:
      return null
  }
}

function stickerGeometry() {
  const size = 0.91
  const radius = 0.125
  const half = size / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half + radius, -half)
  shape.lineTo(half - radius, -half)
  shape.quadraticCurveTo(half, -half, half, -half + radius)
  shape.lineTo(half, half - radius)
  shape.quadraticCurveTo(half, half, half - radius, half)
  shape.lineTo(-half + radius, half)
  shape.quadraticCurveTo(-half, half, -half, half - radius)
  shape.lineTo(-half, -half + radius)
  shape.quadraticCurveTo(-half, -half, -half + radius, -half)
  return new THREE.ShapeGeometry(shape, 8)
}

const STICKER_GEOMETRY = stickerGeometry()

function makeSticker(color, normal) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.44,
    metalness: 0.02,
    emissive: new THREE.Color(color).multiplyScalar(0.06),
  })
  const mesh = new THREE.Mesh(STICKER_GEOMETRY, material)
  const offset = 0.5
  mesh.position.set(normal[0] * offset, normal[1] * offset, normal[2] * offset)

  if (normal[2] === -1) mesh.rotation.y = Math.PI
  if (normal[0] === 1) mesh.rotation.y = Math.PI / 2
  if (normal[0] === -1) mesh.rotation.y = -Math.PI / 2
  if (normal[1] === 1) mesh.rotation.x = -Math.PI / 2
  if (normal[1] === -1) mesh.rotation.x = Math.PI / 2

  return mesh
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
}

function invertMove(move) {
  if (move.endsWith('2')) return move
  if (move.endsWith("'")) return move.slice(0, -1)
  return `${move}'`
}

export class CubeView {
  constructor(container, facelet, moves = [], options = {}) {
    this.container = container
    this.facelet = facelet
    this.moves = moves
    this.onViewChange = options.onViewChange || null
    this.cubies = []
    this.animating = false
    this.destroyed = false
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.pointer = null
    this.dragged = false
    this.intro = options.intro === false ? 1 : 0
    this.ambient = options.ambient === true
    this.zoomEnabled = options.zoom === true
    this.zoom = 1
    this.inertia = 0
    this.idleTime = 0
    this.ambientTime = 0

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.container.appendChild(this.renderer.domElement)

    this.viewGroup = new THREE.Group()
    this.cubeRoot = new THREE.Group()
    this.scene.add(this.viewGroup)
    this.viewGroup.add(this.cubeRoot)
    this.viewGroup.rotation.y = -0.02

    const ambient = new THREE.AmbientLight(0xffffff, 0.95)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(6, 8, 7)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x9ab7ff, 0.5)
    fill.position.set(-6, 3, 5)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xd7ff63, 0.32)
    rim.position.set(2, -5, -7)
    this.scene.add(rim)

    this.build(facelet)
    this.bindPointer()
    this.resize()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.lastFrameTime = performance.now()
    this.animate = this.animate.bind(this)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  build(facelet) {
    for (const cubie of this.cubies) {
      this.cubeRoot.remove(cubie)
      cubie.traverse((object) => {
        if (object.geometry && object.geometry !== STICKER_GEOMETRY) object.geometry.dispose?.()
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.())
          else object.material.dispose?.()
        }
      })
    }
    this.cubies = []

    const stickerLookup = new Map()
    for (const face of FACE_ORDER) {
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const [x, y, z] = faceletPosition(face, row, col)
          stickerLookup.set(`${x},${y},${z},${face}`, facelet[faceletIndex(face, row, col)])
        }
      }
    }

    const bodyGeometry = new THREE.BoxGeometry(0.985, 0.985, 0.985)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c0e11,
      roughness: 0.62,
      metalness: 0.18,
    })

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          if (x === 0 && y === 0 && z === 0) continue
          const cubie = new THREE.Group()
          cubie.position.set(x, y, z)
          cubie.userData.coord = { x, y, z }

          const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
          cubie.add(body)

          if (x === 1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},R`, 'R')
          if (x === -1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},L`, 'L')
          if (y === 1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},U`, 'U')
          if (y === -1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},D`, 'D')
          if (z === 1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},F`, 'F')
          if (z === -1) this.addSticker(cubie, stickerLookup, `${x},${y},${z},B`, 'B')

          this.cubeRoot.add(cubie)
          this.cubies.push(cubie)
        }
      }
    }
  }

  addSticker(cubie, lookup, key, face) {
    const char = lookup.get(key)
    const color = CHAR_TO_HEX[char] || '#a1a7ae'
    cubie.add(makeSticker(color, NORMALS[face]))
  }

  bindPointer() {
    const el = this.renderer.domElement
    this.onPointerDown = (event) => {
      this.pointer = { x: event.clientX, y: event.clientY }
      this.dragged = false
      this.inertia = 0
      this.idleTime = 0
      el.setPointerCapture?.(event.pointerId)
      el.classList.add('is-dragging')
    }
    this.onPointerMove = (event) => {
      if (!this.pointer || this.animating) return
      const dx = event.clientX - this.pointer.x
      const dy = event.clientY - this.pointer.y
      if (Math.abs(dx) + Math.abs(dy) > 3 && !this.dragged) {
        this.dragged = true
        this.onViewChange?.()
      }
      this.pointer = { x: event.clientX, y: event.clientY }
      this.viewGroup.rotation.y += dx * 0.007
      this.viewGroup.rotation.x = Math.max(-0.85, Math.min(0.85, this.viewGroup.rotation.x + dy * 0.006))
      if (this.ambient) this.inertia = dx * 0.004
      this.idleTime = 0
    }
    this.onPointerUp = () => {
      this.pointer = null
      el.classList.remove('is-dragging')
    }
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointercancel', this.onPointerUp)

    this.onWheel = (event) => {
      if (!this.zoomEnabled) return
      event.preventDefault()
      this.zoom = Math.min(1.7, Math.max(0.7, this.zoom * (event.deltaY > 0 ? 0.92 : 1.08)))
      this.container.style.setProperty('--cube-scale', String(this.zoom))
    }
    el.addEventListener('wheel', this.onWheel, { passive: false })
  }

  resize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    const distance = this.camera.aspect < 0.85 ? 11.6 : 9.8
    const direction = new THREE.Vector3(1, 0.83, 1.14).normalize()
    this.camera.position.copy(direction.multiplyScalar(distance))
    this.camera.lookAt(0, -0.08, 0)
    this.camera.updateProjectionMatrix()
  }

  animate() {
    if (this.destroyed) return
    this.animationFrame = requestAnimationFrame(this.animate)
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000)
    this.lastFrameTime = now
    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt * 2.4)
      const eased = easeInOutCubic(this.intro)
      this.cubeRoot.scale.setScalar(0.88 + eased * 0.12)
      this.viewGroup.rotation.y = -0.35 * (1 - eased)
    }

    if (this.ambient && !this.reduceMotion) {
      this.ambientTime += dt
      if (this.pointer) {
        this.idleTime = 0
      } else {
        this.idleTime += dt
        if (Math.abs(this.inertia) > 0.0002) {
          this.viewGroup.rotation.y += this.inertia
          this.inertia *= 0.94
        } else if (this.idleTime > 1.2 && !this.animating) {
          this.viewGroup.rotation.y += dt * 0.26
        }
      }
      this.cubeRoot.position.y = this.animating
        ? 0
        : Math.sin(this.ambientTime * 1.1) * 0.05 + 0.02
    }

    this.renderer.render(this.scene, this.camera)
  }

  selectLayer(face) {
    const meta = MOVE_META[face]
    return this.cubies.filter((cubie) => cubie.userData.coord[meta.axis] === meta.layer)
  }

  moveAngle(move) {
    const face = move[0]
    const meta = MOVE_META[face]
    let quarter = meta.dir
    if (move.endsWith("'")) quarter *= -1
    if (move.endsWith('2')) quarter *= 2
    return quarter * (Math.PI / 2)
  }

  applyMove(move, { animate = true, duration = 420 } = {}) {
    if (!move || this.destroyed) return Promise.resolve()
    const face = move[0]
    const meta = MOVE_META[face]
    if (!meta) return Promise.resolve()
    const angle = this.moveAngle(move)
    const selected = this.selectLayer(face)

    return new Promise((resolve) => {
      const pivot = new THREE.Group()
      this.cubeRoot.add(pivot)
      for (const cubie of selected) pivot.attach(cubie)

      const finalize = () => {
        pivot.rotation[meta.axis] = angle
        pivot.updateMatrixWorld(true)
        for (const cubie of selected) {
          this.cubeRoot.attach(cubie)
          cubie.position.set(
            Math.round(cubie.position.x),
            Math.round(cubie.position.y),
            Math.round(cubie.position.z),
          )
          cubie.userData.coord = {
            x: cubie.position.x,
            y: cubie.position.y,
            z: cubie.position.z,
          }
        }
        this.cubeRoot.remove(pivot)
        this.animating = false
        resolve()
      }

      if (!animate || this.reduceMotion) {
        finalize()
        return
      }

      this.animating = true
      const start = performance.now()
      const step = (now) => {
        if (this.destroyed) {
          resolve()
          return
        }
        const progress = Math.min(1, (now - start) / duration)
        pivot.rotation[meta.axis] = angle * easeInOutCubic(progress)
        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          finalize()
        }
      }
      requestAnimationFrame(step)
    })
  }

  async resetTo(facelet, moves = this.moves, targetStep = 0) {
    while (this.animating) await new Promise((resolve) => setTimeout(resolve, 30))
    this.build(facelet)
    for (let i = 0; i < targetStep; i += 1) {
      await this.applyMove(moves[i], { animate: false })
    }
  }

  undoMove(move) {
    return this.applyMove(invertMove(move))
  }

  resetView() {
    if (this.destroyed) return
    this.intro = 1
    this.cubeRoot.scale.setScalar(1)
    const startX = this.viewGroup.rotation.x
    const startY = this.viewGroup.rotation.y

    if (this.reduceMotion) {
      this.viewGroup.rotation.x = 0
      this.viewGroup.rotation.y = 0
      return
    }

    const started = performance.now()
    const duration = 320
    const step = (now) => {
      if (this.destroyed) return
      const progress = Math.min(1, (now - started) / duration)
      const eased = easeInOutCubic(progress)
      this.viewGroup.rotation.x = startX * (1 - eased)
      this.viewGroup.rotation.y = startY * (1 - eased)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver?.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('pointercancel', this.onPointerUp)
    el.removeEventListener('wheel', this.onWheel)
    this.scene.traverse((object) => {
      if (object.geometry && object.geometry !== STICKER_GEOMETRY) object.geometry.dispose?.()
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.())
        else object.material.dispose?.()
      }
    })
    this.renderer.dispose()
    el.remove()
  }
}

export { invertMove }
