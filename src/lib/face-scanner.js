import { classifyRGB, medianPatch } from './color-vision.js'
import { cloneGrid } from './colors.js'

const SAMPLE_INTERVAL = 130
const FRAME_SIZE = 720

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function isCenterCell(row, col) {
  return row === 1 && col === 1
}

export class FaceScanner {
  constructor({ video, stageEl, frameEl, onPreview }) {
    this.video = video
    this.stageEl = stageEl
    this.frameEl = frameEl
    this.onPreview = onPreview

    this.stream = null
    this.canvas = document.createElement('canvas')
    this.canvas.width = FRAME_SIZE
    this.canvas.height = FRAME_SIZE
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    this.active = false
    this.timer = null
  }

  async openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持相机访问，请使用系统浏览器或 Chrome / Safari 打开。')
    }

    this.stopCamera()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
    })

    this.stream = stream
    this.video.srcObject = stream
    this.video.muted = true
    this.video.playsInline = true

    await this.video.play()
    if (!this.video.videoWidth) {
      for (let i = 0; i < 30; i += 1) {
        await sleep(60)
        if (this.video.videoWidth) break
      }
    }
    this.stageEl.classList.add('is-live')
  }

  stopCamera() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
    }
    this.stream = null
    this.video.pause()
    this.video.srcObject = null
    this.stageEl.classList.remove('is-live')
  }

  start() {
    if (this.active) return
    this.active = true
    this.schedule()
  }

  pause() {
    this.active = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  destroy() {
    this.pause()
    this.stopCamera()
  }

  schedule() {
    if (!this.active) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.tick()
      this.schedule()
    }, SAMPLE_INTERVAL)
  }

  tick() {
    if (!this.active || !this.stream) return
    if (this.video.readyState < 2) {
      this.onPreview?.(null, { valid: false, center: null, stable: false })
      return
    }

    const frame = this.readFrame()
    if (!frame) {
      this.onPreview?.(null, { valid: false, center: null, stable: false })
      return
    }

    const { grid } = frame
    const valid = grid.every((row, r) => row.every((key, c) => (isCenterCell(r, c) ? true : Boolean(key))))
    const center = grid[1][1]
    this.onPreview?.(cloneGrid(grid), { valid, center, stable: valid })
  }

  snapshot() {
    const frame = this.readFrame()
    return frame ? cloneGrid(frame.grid) : null
  }

  capturePhoto() {
    const frame = this.readFrame()
    if (!frame) return null

    let image = ''
    try {
      image = this.canvas.toDataURL('image/jpeg', 0.86)
    } catch {
      return null
    }
    if (!image) return null

    return {
      grid: cloneGrid(frame.grid),
      confidences: frame.confidences.map((row) => row.slice()),
      image,
    }
  }

  frameSourceRect() {
    const video = this.video
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh || !this.frameEl || !this.stageEl) return null

    const stageRect = this.stageEl.getBoundingClientRect()
    const frameRect = this.frameEl.getBoundingClientRect()
    if (stageRect.width < 40 || frameRect.width < 40) return null

    const displayScale = Math.max(stageRect.width / vw, stageRect.height / vh)
    const offsetX = (stageRect.width - vw * displayScale) / 2
    const offsetY = (stageRect.height - vh * displayScale) / 2

    const maxSize = Math.min(vw, vh)
    const size = Math.min(maxSize, frameRect.width / displayScale)
    if (size < 8) return null

    const x = clamp((frameRect.left - stageRect.left - offsetX) / displayScale, 0, Math.max(0, vw - size))
    const y = clamp((frameRect.top - stageRect.top - offsetY) / displayScale, 0, Math.max(0, vh - size))

    return { x, y, size }
  }

  readFrame() {
    const rect = this.frameSourceRect()
    if (!rect) return null

    try {
      this.ctx.drawImage(this.video, rect.x, rect.y, rect.size, rect.size, 0, 0, FRAME_SIZE, FRAME_SIZE)
    } catch {
      return null
    }

    const cellSize = FRAME_SIZE / 3
    const half = Math.max(6, Math.round(cellSize * 0.17))
    const grid = []
    const confidences = []

    for (let r = 0; r < 3; r += 1) {
      const row = []
      const confidenceRow = []
      for (let c = 0; c < 3; c += 1) {
        const cx = cellSize * (c + 0.5)
        const cy = cellSize * (r + 0.5)
        const x = Math.max(0, Math.round(cx - half))
        const y = Math.max(0, Math.round(cy - half))
        const w = Math.max(2, Math.min(FRAME_SIZE - x, half * 2))
        const h = Math.max(2, Math.min(FRAME_SIZE - y, half * 2))

        let key = null
        let confidence = 0
        try {
          const patch = this.ctx.getImageData(x, y, w, h)
          const rgb = medianPatch(patch)
          if (rgb) {
            const result = classifyRGB(rgb[0], rgb[1], rgb[2])
            confidence = result.confidence
            if (confidence >= 0.3) key = result.key
          }
        } catch {
          key = null
          confidence = 0
        }
        row.push(key)
        confidenceRow.push(confidence)
      }
      grid.push(row)
      confidences.push(confidenceRow)
    }

    return { grid, confidences }
  }
}
