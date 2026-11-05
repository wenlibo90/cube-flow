import '../vendor/cubejs/cube.js'
import '../vendor/cubejs/solve.js'
import { COLOR_KEYS, ROLE_BY_COLOR, rotateGrid } from '../lib/colors.js'

const Cube = globalThis.Cube

const NET_ORDER = ['U', 'R', 'F', 'D', 'L', 'B']

const CORNER_POSITIONS = [
  { key: 'URF', indices: [8, 9, 20], pieces: 'FRU' },
  { key: 'UFL', indices: [6, 18, 38], pieces: 'FLU' },
  { key: 'ULB', indices: [0, 36, 47], pieces: 'BLU' },
  { key: 'UBR', indices: [2, 45, 11], pieces: 'BRU' },
  { key: 'DFR', indices: [29, 26, 15], pieces: 'FRD' },
  { key: 'DLF', indices: [27, 44, 24], pieces: 'FLD' },
  { key: 'DBL', indices: [33, 53, 42], pieces: 'BLD' },
  { key: 'DRB', indices: [35, 17, 51], pieces: 'BRD' },
]

const EDGE_POSITIONS = [
  { key: 'UR', indices: [5, 10], pieces: 'RU' },
  { key: 'UF', indices: [7, 19], pieces: 'FU' },
  { key: 'UL', indices: [3, 37], pieces: 'LU' },
  { key: 'UB', indices: [1, 46], pieces: 'BU' },
  { key: 'DR', indices: [32, 16], pieces: 'RD' },
  { key: 'DF', indices: [28, 25], pieces: 'FD' },
  { key: 'DL', indices: [30, 43], pieces: 'LD' },
  { key: 'DB', indices: [34, 52], pieces: 'BD' },
  { key: 'FR', indices: [23, 12], pieces: 'FR' },
  { key: 'FL', indices: [21, 41], pieces: 'FL' },
  { key: 'BL', indices: [50, 39], pieces: 'BL' },
  { key: 'BR', indices: [48, 14], pieces: 'BR' },
]

let solverReady = false

function ensureSolver() {
  if (solverReady) return
  Cube.initSolver()
  solverReady = true
}

function pieceKey(letters) {
  return [...letters].sort().join('')
}

function hasValidPieces(facelet) {
  const validCorners = new Set(CORNER_POSITIONS.map((position) => pieceKey(position.pieces)))
  const validEdges = new Set(EDGE_POSITIONS.map((position) => pieceKey(position.pieces)))
  const corners = new Set()
  for (const position of CORNER_POSITIONS) {
    const key = pieceKey(position.indices.map((index) => facelet[index]))
    if (!validCorners.has(key)) return false
    if (corners.has(key)) return false
    corners.add(key)
  }

  const edges = new Set()
  for (const position of EDGE_POSITIONS) {
    const key = pieceKey(position.indices.map((index) => facelet[index]))
    if (!validEdges.has(key)) return false
    if (edges.has(key)) return false
    edges.add(key)
  }

  return corners.size === 8 && edges.size === 12
}

function permutationParity(array) {
  let inversions = 0
  for (let i = 0; i < array.length; i += 1) {
    for (let j = i + 1; j < array.length; j += 1) {
      if (array[i] > array[j]) inversions += 1
    }
  }
  return inversions % 2
}

function stateIsLegal(facelet) {
  if (facelet.length !== 54) return false
  if (![...facelet].every((char) => NET_ORDER.includes(char))) return false
  if (!hasValidPieces(facelet)) return false

  const cube = Cube.fromString(facelet)
  if (!cube) return false
  if (cube.center.some((value, index) => value !== index)) return false
  if (cube.cp.some((value) => value < 0 || value > 7)) return false
  if (cube.ep.some((value) => value < 0 || value > 11)) return false
  if (new Set(cube.cp).size !== 8 || new Set(cube.ep).size !== 12) return false
  if (cube.co.reduce((sum, value) => sum + value, 0) % 3 !== 0) return false
  if (cube.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0) return false
  if (permutationParity(cube.cp) !== permutationParity(cube.ep)) return false

  return cube
}

function buildFacelet(roleFaces, rotations) {
  const letters = []
  for (let roleIndex = 0; roleIndex < NET_ORDER.length; roleIndex += 1) {
    const role = NET_ORDER[roleIndex]
    const face = roleFaces.get(role)
    if (!face) return null
    const rotated = rotateGrid(face.grid, rotations[roleIndex])
    for (const row of rotated) {
      for (const key of row) {
        const letter = ROLE_BY_COLOR[key]
        if (!letter) return null
        letters.push(letter)
      }
    }
  }
  return letters.join('')
}

function solveScannedFaces(faces) {
  if (faces.length !== 6) {
    return { ok: false, error: '需要完整的六个面' }
  }

  const roleFaces = new Map()
  const centerKeys = new Set()
  for (const face of faces) {
    if (!COLOR_KEYS.includes(face.center)) {
      return { ok: false, error: '中心块颜色无法识别' }
    }
    if (centerKeys.has(face.center)) {
      return { ok: false, error: '有两个面的中心色相同' }
    }
    centerKeys.add(face.center)
    const role = ROLE_BY_COLOR[face.center]
    if (!role || roleFaces.has(role)) {
      return { ok: false, error: '中心块颜色组合不完整' }
    }
    roleFaces.set(role, face)
  }

  if (roleFaces.size !== 6) {
    return { ok: false, error: '六个中心色不完整' }
  }

  const candidates = []
  const total = 4 ** 6
  for (let mask = 0; mask < total; mask += 1) {
    const rotations = []
    let cursor = mask
    let rotationCost = 0
    for (let i = 0; i < 6; i += 1) {
      const turns = cursor % 4
      rotations.push(turns)
      rotationCost += turns
      cursor = Math.floor(cursor / 4)
    }

    const facelet = buildFacelet(roleFaces, rotations)
    if (!facelet) continue
    const cube = stateIsLegal(facelet)
    if (cube) {
      candidates.push({ facelet, cube, rotations, rotationCost })
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: '色块组合不合法，请检查中心块和角块',
      candidates: 0,
    }
  }

  candidates.sort((a, b) => a.rotationCost - b.rotationCost)

  let best = null
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const solution = candidate.cube.solve()
      const moves = solution ? solution.split(' ').filter(Boolean) : []
      if (
        !best ||
        candidate.rotationCost < best.rotationCost ||
        (candidate.rotationCost === best.rotationCost && moves.length < best.moves.length)
      ) {
        best = {
          ok: true,
          facelet: candidate.facelet,
          moves,
          candidates: candidates.length,
          rotationCost: candidate.rotationCost,
        }
      }
    } catch {
    }
  }

  if (!best) {
    return { ok: false, error: '还原步骤计算失败，请检查色块或重新扫描', candidates: candidates.length }
  }

  return best
}

self.onmessage = (event) => {
  const { type, faces, requestId } = event.data || {}

  try {
    ensureSolver()

    if (type === 'warm') {
      self.postMessage({ type: 'ready', requestId })
      return
    }

    if (type === 'solve') {
      const result = solveScannedFaces(faces)
      self.postMessage({ type: 'solved', requestId, ...result })
      return
    }

    if (type === 'demo') {
      let randomCube = Cube.random()
      let facelet = randomCube.asString()
      let solution = randomCube.solve()
      let guard = 0
      while (!solution && guard < 8) {
        randomCube = Cube.random()
        facelet = randomCube.asString()
        solution = randomCube.solve()
        guard += 1
      }
      self.postMessage({
        type: 'demo',
        requestId,
        ok: true,
        facelet,
        moves: solution ? solution.split(' ').filter(Boolean) : [],
      })
      return
    }

    self.postMessage({ type: 'error', requestId, error: '未知任务' })
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error?.message || '求解器发生错误',
    })
  }
}

self.postMessage({ type: 'booting' })
setTimeout(() => {
  try {
    ensureSolver()
    self.postMessage({ type: 'ready' })
  } catch (error) {
    self.postMessage({ type: 'init-error', error: error?.message || '求解器初始化失败' })
  }
}, 0)
