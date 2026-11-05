export const COLORS = {
  white: {
    key: 'white',
    label: '白',
    name: '白色',
    hex: '#F5F2E8',
    rgb: [245, 242, 232],
    role: 'U',
    faceName: '上面',
  },
  yellow: {
    key: 'yellow',
    label: '黄',
    name: '黄色',
    hex: '#F2CE1B',
    rgb: [242, 206, 27],
    role: 'D',
    faceName: '下面',
  },
  green: {
    key: 'green',
    label: '绿',
    name: '绿色',
    hex: '#28B56F',
    rgb: [40, 181, 111],
    role: 'F',
    faceName: '前面',
  },
  blue: {
    key: 'blue',
    label: '蓝',
    name: '蓝色',
    hex: '#2D6BE0',
    rgb: [45, 107, 224],
    role: 'B',
    faceName: '后面',
  },
  red: {
    key: 'red',
    label: '红',
    name: '红色',
    hex: '#E8483F',
    rgb: [232, 72, 63],
    role: 'R',
    faceName: '右面',
  },
  orange: {
    key: 'orange',
    label: '橙',
    name: '橙色',
    hex: '#FF8A2A',
    rgb: [255, 138, 42],
    role: 'L',
    faceName: '左面',
  },
}

export const COLOR_KEYS = ['white', 'yellow', 'green', 'blue', 'red', 'orange']

export const COLOR_BY_ROLE = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  R: 'red',
  L: 'orange',
}

export const ROLE_BY_COLOR = {
  white: 'U',
  yellow: 'D',
  green: 'F',
  blue: 'B',
  red: 'R',
  orange: 'L',
}

export const FACE_NAMES = {
  U: '上面',
  D: '下面',
  F: '前面',
  B: '后面',
  R: '右面',
  L: '左面',
}

export const MOVE_META = {
  U: { axis: 'y', layer: 1, dir: -1, face: '上层', color: 'white', side: '上' },
  D: { axis: 'y', layer: -1, dir: 1, face: '下层', color: 'yellow', side: '下' },
  R: { axis: 'x', layer: 1, dir: -1, face: '右层', color: 'red', side: '右' },
  L: { axis: 'x', layer: -1, dir: 1, face: '左层', color: 'orange', side: '左' },
  F: { axis: 'z', layer: 1, dir: -1, face: '前层', color: 'green', side: '前' },
  B: { axis: 'z', layer: -1, dir: 1, face: '后层', color: 'blue', side: '后' },
}

export function colorHex(key) {
  return COLORS[key]?.hex || '#62666d'
}

export function colorLabel(key) {
  return COLORS[key]?.name || '未知'
}

export function emptyGrid() {
  return Array.from({ length: 3 }, () => Array(3).fill(null))
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice())
}

export function rotateGrid(grid, times = 1) {
  let current = cloneGrid(grid)
  const turns = ((times % 4) + 4) % 4
  for (let t = 0; t < turns; t += 1) {
    const next = emptyGrid()
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        next[r][c] = current[2 - c][r]
      }
    }
    current = next
  }
  return current
}

export function countColors(faces) {
  const counts = Object.fromEntries(COLOR_KEYS.map((key) => [key, 0]))
  for (const face of faces) {
    for (const row of face.grid) {
      for (const key of row) {
        if (key && counts[key] !== undefined) counts[key] += 1
      }
    }
  }
  return counts
}

export function isCountComplete(counts) {
  return COLOR_KEYS.every((key) => counts[key] === 9)
}

export function formatCountsSummary(counts) {
  return COLOR_KEYS.map((key) => `${COLORS[key].label}${counts[key]}/9`).join(' · ')
}
