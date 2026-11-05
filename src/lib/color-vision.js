function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function rgbToHsv(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6
    else if (max === gn) hue = (bn - rn) / delta + 2
    else hue = (rn - gn) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }

  return {
    h: hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

function hueDistanceToRange(hue, start, end) {
  if (hue >= start && hue <= end) {
    return Math.min(hue - start, end - hue)
  }
  const toStart = Math.min(Math.abs(hue - start), 360 - Math.abs(hue - start))
  const toEnd = Math.min(Math.abs(hue - end), 360 - Math.abs(hue - end))
  return -Math.min(toStart, toEnd)
}

export function classifyRGB(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b)
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b

  if (luma < 24 || v < 0.1) {
    return { key: null, confidence: 0, h, s, v }
  }

  if ((s < 0.17 && v > 0.34) || (s < 0.3 && v > 0.76)) {
    const confidence = clamp(0.5 + (0.3 - s) * 1.4 + v * 0.2, 0, 1)
    return { key: 'white', confidence, h, s, v }
  }

  if (s < 0.24) {
    return { key: null, confidence: 0, h, s, v }
  }

  let key = null
  let range = null

  if (h < 13 || h >= 340) {
    key = 'red'
    range = h >= 340 ? [340, 373] : [-20, 13]
  } else if (h < 38) {
    key = 'orange'
    range = [13, 38]
  } else if (h < 72) {
    key = 'yellow'
    range = [38, 72]
  } else if (h < 172) {
    key = 'green'
    range = [72, 172]
  } else if (h < 258) {
    key = 'blue'
    range = [172, 258]
  } else {
    key = 'red'
    range = [258, 340]
  }

  const margin = range ? Math.max(0, hueDistanceToRange(h, range[0], range[1])) : 0
  const saturationWeight = clamp((s - 0.2) / 0.45, 0, 1)
  const brightnessWeight = clamp((v - 0.12) / 0.4, 0, 1)
  const hueWeight = clamp(margin / 18, 0, 1)
  const confidence = clamp(0.32 + saturationWeight * 0.36 + brightnessWeight * 0.16 + hueWeight * 0.16, 0, 1)

  return { key, confidence, h, s, v }
}

export function medianPatch(imageData) {
  const { data, width, height } = imageData
  const pixels = []

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 128) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max < 24) continue
    if (min > 248 && max - min < 12) continue
    pixels.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b])
  }

  if (pixels.length < 10) return null

  pixels.sort((a, b) => a[3] - b[3])
  const from = Math.floor(pixels.length * 0.16)
  const to = Math.max(from + 1, Math.ceil(pixels.length * 0.84))
  let r = 0
  let g = 0
  let b = 0
  let weight = 0

  for (let i = from; i < to; i += 1) {
    const pixel = pixels[i]
    const luma = pixel[3]
    const w = 0.7 + Math.min(luma, 220) / 300
    r += pixel[0] * w
    g += pixel[1] * w
    b += pixel[2] * w
    weight += w
  }

  return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)]
}

