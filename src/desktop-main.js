import './desktop.css'

const HERO_FACELET = 'UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB'

const cubeHost = document.querySelector('#desktop-cube')

async function mountCube() {
  if (!cubeHost) return
  try {
    const { CubeView } = await import('./lib/cube-view.js')
    new CubeView(cubeHost, HERO_FACELET, [], { intro: true, ambient: true, zoom: true })
  } catch {
    // 桌面端仅作展示，3D 不可用时保留纯文字落地页
  }
}

async function renderQr() {
  const canvas = document.querySelector('#desktop-qr')
  if (!canvas) return
  const url = `${location.origin}/`

  try {
    const { default: QRCode } = await import('qrcode')
    await QRCode.toCanvas(canvas, url, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#08090b', light: '#f3f4ef' },
    })
  } catch {
    canvas.closest('.desktop-qr')?.remove()
    return
  }

  if (/localhost|127\.0\.0\.1/i.test(location.hostname)) {
    const note = document.querySelector('.desktop-scan-note')
    if (note) note.textContent = '请用局域网地址访问本页后再扫码，localhost 手机无法打开。'
  }
}

mountCube()
renderQr()
