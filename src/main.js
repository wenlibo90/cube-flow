import './style.css'
import {
  COLORS,
  COLOR_KEYS,
  FACE_NAMES,
  MOVE_META,
  ROLE_BY_COLOR,
  cloneGrid,
  countColors,
  isCountComplete,
} from './lib/colors.js'
import { FaceScanner } from './lib/face-scanner.js'
import { SolverClient } from './lib/solver-client.js'
import { icon } from './lib/icons.js'

const CHAR_TO_COLOR = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' }
const NET_ORDER = ['U', 'R', 'F', 'D', 'L', 'B']

const SCAN_STEPS = [
  { role: 'F', color: 'green', label: '绿色面', pose: '白色中心朝上，绿色面对准取景框', short: '白上 · 绿前' },
  { role: 'R', color: 'red', label: '红色面', pose: '保持白色朝上，把红色面对准取景框', short: '白上 · 红前' },
  { role: 'B', color: 'blue', label: '蓝色面', pose: '保持白色朝上，把蓝色面对准取景框', short: '白上 · 蓝前' },
  { role: 'L', color: 'orange', label: '橙色面', pose: '保持白色朝上，把橙色面对准取景框', short: '白上 · 橙前' },
  { role: 'U', color: 'white', label: '白色面', pose: '把白色面对准取景框，绿色边朝下', short: '白面 · 绿边朝下' },
  { role: 'D', color: 'yellow', label: '黄色面', pose: '把黄色面对准取景框，绿色边朝上', short: '黄面 · 绿边朝上' },
]

const TURN_HINTS = [
  null,
  { icon: 'rotateCcw', text: '向左转 90°' },
  { icon: 'rotateCcw', text: '向左转 90°' },
  { icon: 'rotateCcw', text: '向左转 90°' },
  { icon: 'arrowUp', text: '向前翻转 90°' },
  { icon: 'refresh', text: '再向后翻转 180°' },
]

const HERO_FACELETS = [
  'UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB',
  'RFBBUBUUBRULLRRFFLFLUDFFDDRBLUUDUFBDBRLBLFDRLURDDBLFDR',
  'URLUULRBBUFFLRRFBFUULDFBBFDLDRFDDRLLRLBULRDUDUFFBBRDDB',
  'DLFLULBBLBURFRRFUDDDUBFDFDUDLLFDBURRBFRULRRRLUBLUBFFDB',
  'FDBBUDBRUFRULRBFBBDULDFBBFLUUDFDDFFDUURULFDLLRLRRBLLRR',
  'ULLDUBBRURLFFRULDUDBFFFURDBDRDLDBDUBBFRLLRFDFUFRBBULRL',
]
let heroFacelet = HERO_FACELETS[0]

const state = {
  faces: [],
  scanMode: 'full',
  scanStep: 0,
  rescanIndex: null,
  captureBusy: false,
  capturePending: null,
  reviewDirty: false,
  solution: null,
  actionKind: 'disabled',
  busy: false,
  stepIndex: 0,
  stepBusy: false,
  autoTimer: null,
  solveToken: 0,
  scanToken: 0,
  cameraLive: false,
  toastTimer: null,
  guideViewMoved: false,
}

let scanner = null
let solver = null
let cubeView = null
let heroCubeView = null
let heroCubeToken = 0
let cubeViewModulePromise = null
let qrRenderToken = 0

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function webglHint() {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (context) return ''
    return '当前设备的图形渲染（WebGL）不可用，请检查系统 WebView 是否为最新版本。'
  } catch {
    return '当前设备的图形渲染（WebGL）不可用，请检查系统 WebView 是否为最新版本。'
  }
}

const app = document.querySelector('#app')
app.innerHTML = renderApp()
cacheDom()
bindStaticEvents()
mountHeroCube()
renderScanProgress()
resetLivePreview()
initScanner()
initSolver()

function renderApp() {
  return `
    <div class="ambient ambient-a"></div>
    <div class="ambient ambient-b"></div>

    <section class="screen landing-screen is-active" data-screen="landing">
      <header class="site-head">
        <button class="brand" data-action="home" aria-label="返回首页">
          <img class="brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span class="brand-copy"><strong>CubScan</strong></span>
        </button>
        <div class="local-badge">${icon('shield', 'icon', 15)}<span>本地识别</span></div>
      </header>

      <main class="hero">
        <div class="hero-copy">
          <span class="hero-eyebrow">在线学习 · 拍照还原魔方</span>
          <h1>拍魔方，<br /><span>轻松还原魔方。</span></h1>
          <p class="hero-sub">身边有魔方，打开相机扫描，跟着步骤一步一步还原魔方；没有魔方，也能在线学习，用虚拟魔方看懂每一步。</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="start-camera">
              <span>${icon('camera', 'icon', 21)}</span>
              <span>打开相机，开始扫描</span>
              <span class="btn-arrow">${icon('arrowRight', 'icon', 18)}</span>
            </button>
            <button class="btn btn-ghost btn-lg" id="demo-button">
              ${icon('book', 'icon', 18)}
              <span>在线学习</span>
            </button>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <div class="orbit orbit-one"></div>
          <div class="orbit orbit-two"></div>
          <div class="hero-cube" id="hero-cube"></div>
        </div>
      </main>
    </section>

    <section class="screen scan-screen" data-screen="scan">
      <header class="app-head">
        <button class="brand brand-small" data-action="home" aria-label="返回首页">
          <img class="brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span class="brand-copy"><strong>拍魔方</strong><em>CubScan</em></span>
        </button>
        <div class="stage-nav" aria-label="当前步骤">
          <span class="is-active" data-stage="scan"><b>01</b> 扫描</span>
          <span data-stage="review"><b>02</b> 校验</span>
          <span data-stage="guide"><b>03</b> 还原</span>
        </div>
        <button class="icon-btn" id="scan-back" aria-label="退出扫描">${icon('close', 'icon', 20)}</button>
      </header>

      <main class="scan-layout">
        <div class="scan-main">
          <div class="camera-shell" id="camera-shell">
            <video id="camera-video" autoplay muted playsinline></video>
            <div class="camera-vignette"></div>
            <div class="scan-frame" id="scan-frame">
              <div class="scan-grid" id="scan-grid">
                ${Array.from({ length: 9 }, () => '<i></i>').join('')}
              </div>
              <span class="corner tl"></span><span class="corner tr"></span>
              <span class="corner bl"></span><span class="corner br"></span>
              <div class="scan-beam"></div>
            </div>
            <div class="scan-hint" id="scan-hint" hidden></div>
            <div class="scan-target" id="scan-target">
              <span class="target-dot" id="scan-target-dot"></span>
              <div><em>当前目标</em><strong id="scan-target-label">绿色面</strong><small id="scan-target-pose">白上 · 绿前</small></div>
            </div>
            <div class="camera-status" id="camera-status" role="status" aria-live="polite">正在打开相机…</div>
            <div class="camera-flash" id="camera-flash"></div>
            <div class="camera-connecting" id="camera-connecting">
              <span class="spinner"></span>
              <strong>正在打开相机</strong>
              <small>首次使用请允许相机权限</small>
            </div>
            <div class="camera-error" id="camera-error" hidden>
              <div class="error-icon">${icon('cameraOff', 'icon', 28)}</div>
              <h3>相机没有打开</h3>
              <p id="camera-error-text">请允许相机权限后再试。</p>
              <div class="error-actions">
                <button class="btn btn-primary btn-sm" id="retry-camera">${icon('refresh', 'icon', 16)} 重试</button>
                <button class="btn btn-ghost btn-sm" id="error-demo">没魔方 · 在线学习</button>
              </div>
            </div>
            <div class="capture-review" id="capture-review" hidden>
              <div class="capture-photo-wrap">
                <img id="capture-photo" alt="已拍下的一面" />
                <div class="capture-grid" id="capture-grid" role="group" aria-label="点格子修正颜色">
                  ${Array.from({ length: 9 }, (_, index) => {
                    const row = Math.floor(index / 3)
                    const col = index % 3
                    return `<button type="button" class="capture-cell ${row === 1 && col === 1 ? 'is-center' : ''}" data-row="${row}" data-col="${col}"><span class="capture-cell-label"></span><span class="capture-cell-lock" hidden>${icon('lock', 'icon', 11)}</span></button>`
                  }).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="capture-panel" id="capture-panel" hidden>
            <div class="capture-copy">
              <strong id="capture-title">确认绿色面</strong>
              <small id="capture-note">点格子修正颜色，中心色固定为绿色。</small>
              <p class="capture-warning" id="capture-warning" role="status" hidden></p>
            </div>
            <div class="capture-actions">
              <button class="btn btn-ghost btn-sm" id="capture-retake" type="button">重拍</button>
              <button class="btn btn-primary btn-sm" id="capture-confirm" type="button">确认这一面</button>
            </div>
          </div>

          <div class="shutter-dock" id="shutter-dock">
            <div class="shutter-copy">
              <span>当前目标</span>
              <strong id="shutter-label">拍摄绿色面</strong>
              <small id="shutter-message">白色中心朝上，绿色面对准取景框</small>
            </div>
            <button class="shutter-btn" id="shutter-btn" aria-label="拍摄绿色面" disabled>
              <span class="shutter-icon">${icon('camera', 'icon', 27)}</span>
            </button>
            <div class="shutter-count"><span>已确认</span><strong><b id="shutter-count">0</b> / 6</strong></div>
          </div>

          <p class="scan-footnote">${icon('camera', 'icon', 15)} 每个面按一次快门，拍好后点格子修正，确认后进入下一面。</p>
        </div>

        <aside class="scan-side">
          <div class="panel progress-card">
            <div class="panel-head">
              <span>扫描进度</span>
              <strong><b id="progress-count">0</b><em>/ 6</em></strong>
            </div>
            <div class="face-progress" id="face-progress"></div>
            <p class="progress-note" id="progress-note" aria-live="polite">每个面按一次快门。</p>
          </div>

          <div class="panel live-card">
            <div class="panel-head">
              <span>当前画面</span>
              <em id="live-center">未锁定</em>
            </div>
            <div class="live-preview" id="live-preview">
              ${Array.from({ length: 9 }, () => '<i></i>').join('')}
            </div>
            <p class="live-note" id="live-note">保持整面位于取景框内</p>
          </div>

          <button class="text-btn scan-reset" id="scan-rescan-all" type="button">${icon('refresh', 'icon', 15)} 重新扫描全部</button>
        </aside>
      </main>
    </section>

    <section class="screen review-screen" data-screen="review">
      <header class="app-head">
        <button class="brand brand-small" data-action="home" aria-label="返回首页">
          <img class="brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span class="brand-copy"><strong>拍魔方</strong><em>CubScan</em></span>
        </button>
        <div class="stage-nav" aria-label="当前步骤">
          <span class="is-done" data-stage="scan"><b>01</b> 扫描</span>
          <span class="is-active" data-stage="review"><b>02</b> 校验</span>
          <span data-stage="guide"><b>03</b> 还原</span>
        </div>
        <button class="icon-btn" data-action="home" aria-label="退出">${icon('close', 'icon', 20)}</button>
      </header>

      <main class="review-layout">
        <section class="review-main">
          <div class="review-alert" id="review-alert" role="status"></div>
          <div class="review-grid" id="review-grid"></div>
          <p class="review-tip">${icon('info', 'icon', 15)} 点一下色块，可切换颜色。中心块用于定位，不可修改。</p>
        </section>

        <aside class="review-side">
          <div class="panel counts-card">
            <div class="panel-head">
              <span>颜色核对</span>
              <em>每色固定 9 块</em>
            </div>
            <div class="color-counts" id="color-counts"></div>
          </div>

          <div class="panel review-status" id="review-status"></div>

          <button class="btn btn-primary btn-wide" id="review-action" disabled>
            <span class="btn-label">先修正色块</span>
            <span class="btn-arrow">${icon('arrowRight', 'icon', 18)}</span>
          </button>
          <button class="text-btn" id="rescan-all">${icon('refresh', 'icon', 15)} 重新扫描全部</button>
        </aside>
      </main>
    </section>

    <section class="screen guide-screen" data-screen="guide">
      <header class="app-head">
        <button class="brand brand-small" data-action="home" aria-label="返回首页">
          <img class="brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span class="brand-copy"><strong>拍魔方</strong><em>CubScan</em></span>
        </button>
        <div class="stage-nav" aria-label="当前步骤">
          <span class="is-done" data-stage="scan"><b>01</b> 扫描</span>
          <span class="is-done" data-stage="review"><b>02</b> 校验</span>
          <span class="is-active" data-stage="guide"><b>03</b> 还原</span>
        </div>
        <button class="icon-btn" data-action="home" aria-label="退出">${icon('close', 'icon', 20)}</button>
      </header>

      <main class="guide-layout">
        <div class="guide-stage-column">
          <section class="cube-stage" id="cube-stage">
            <div class="cube-stage-grid" aria-hidden="true"></div>
            <div class="cube-glow" aria-hidden="true"></div>
            <div class="cube-canvas" id="cube-canvas"></div>
            <div class="cube-topline">
              <span class="stage-label"><span class="status-dot"></span>3D 还原预览</span>
              <span class="orientation-chip">${icon('info', 'icon', 13)}保持<i class="swatch white"></i>白上<i class="swatch green"></i>绿前</span>
            </div>
            <div class="cube-bottomline">
              <button class="cube-view-toggle" id="cube-view-toggle" type="button">${icon('drag', 'icon', 14)}<span>拖动可旋转视角</span></button>
              <span id="guide-counter">0 / 0</span>
            </div>
          </section>

          <div class="guide-actions" id="guide-actions">
            <button class="btn btn-ghost" id="step-prev">${icon('arrowLeft', 'icon', 18)} 上一步</button>
            <button class="btn btn-primary btn-step" id="step-next">
              <span id="step-next-label">下一步</span>
              ${icon('arrowRight', 'icon', 18)}
            </button>
          </div>
        </div>

        <aside class="guide-side">
          <div class="step-top">
            <span class="step-summary" id="step-summary">准备开始</span>
            <div class="progress-track"><span id="step-progress"></span></div>
          </div>

          <div class="step-panel" id="step-panel">
            <div class="sequence-wrap" id="sequence-wrap">
              <div class="sequence-head"><span>完整步骤</span><span>先看步骤</span></div>
              <div class="sequence-strip" id="sequence-strip"></div>
            </div>
            <div class="step-detail" id="step-detail"></div>
          </div>
        </aside>
      </main>
    </section>

    <div class="qr-modal" id="qr-modal" hidden>
      <button class="qr-backdrop" id="qr-backdrop" aria-label="关闭二维码"></button>
      <div class="qr-card" role="dialog" aria-modal="true" aria-labelledby="qr-title">
        <button class="qr-close" id="qr-close" aria-label="关闭">${icon('close', 'icon', 18)}</button>
        <p class="eyebrow">CONTINUE ON PHONE</p>
        <h2 id="qr-title">用手机扫描</h2>
        <p class="qr-sub">当前设备不启用相机，请用手机扫描打开页面。</p>
        <div class="qr-code"><canvas id="qr-canvas"></canvas></div>
        <p class="qr-url" id="qr-url"></p>
      </div>
    </div>

    <div class="toast-layer" id="toast-layer" aria-live="polite"></div>
  `
}

function cacheDom() {
  state.dom = {
    screens: document.querySelectorAll('.screen'),
    cameraShell: document.querySelector('#camera-shell'),
    video: document.querySelector('#camera-video'),
    scanFrame: document.querySelector('#scan-frame'),
    scanGrid: Array.from(document.querySelectorAll('#scan-grid i')),
    livePreview: Array.from(document.querySelectorAll('#live-preview i')),
    liveCenter: document.querySelector('#live-center'),
    liveNote: document.querySelector('#live-note'),
    cameraStatus: document.querySelector('#camera-status'),
    scanTarget: document.querySelector('#scan-target'),
    scanTargetDot: document.querySelector('#scan-target-dot'),
    scanTargetLabel: document.querySelector('#scan-target-label'),
    scanTargetPose: document.querySelector('#scan-target-pose'),
    shutterDock: document.querySelector('#shutter-dock'),
    shutterBtn: document.querySelector('#shutter-btn'),
    shutterLabel: document.querySelector('#shutter-label'),
    shutterMessage: document.querySelector('#shutter-message'),
    scanHint: document.querySelector('#scan-hint'),
    shutterCount: document.querySelector('#shutter-count'),
    captureReview: document.querySelector('#capture-review'),
    capturePhoto: document.querySelector('#capture-photo'),
    captureGrid: Array.from(document.querySelectorAll('#capture-grid .capture-cell')),
    capturePanel: document.querySelector('#capture-panel'),
    captureTitle: document.querySelector('#capture-title'),
    captureNote: document.querySelector('#capture-note'),
    captureWarning: document.querySelector('#capture-warning'),
    captureRetake: document.querySelector('#capture-retake'),
    captureConfirm: document.querySelector('#capture-confirm'),
    cameraFlash: document.querySelector('#camera-flash'),
    cameraConnecting: document.querySelector('#camera-connecting'),
    cameraError: document.querySelector('#camera-error'),
    cameraErrorText: document.querySelector('#camera-error-text'),
    progressCount: document.querySelector('#progress-count'),
    faceProgress: document.querySelector('#face-progress'),
    progressNote: document.querySelector('#progress-note'),
    scanRescanAll: document.querySelector('#scan-rescan-all'),
    reviewGrid: document.querySelector('#review-grid'),
    reviewAlert: document.querySelector('#review-alert'),
    colorCounts: document.querySelector('#color-counts'),
    reviewStatus: document.querySelector('#review-status'),
    reviewAction: document.querySelector('#review-action'),
    cubeViewToggle: document.querySelector('#cube-view-toggle'),
    guideCounter: document.querySelector('#guide-counter'),
    stepSummary: document.querySelector('#step-summary'),
    stepProgress: document.querySelector('#step-progress'),
    stepPanel: document.querySelector('#step-panel'),
    stepDetail: document.querySelector('#step-detail'),
    sequenceStrip: document.querySelector('#sequence-strip'),
    guideActions: document.querySelector('#guide-actions'),
    stepPrev: document.querySelector('#step-prev'),
    stepNext: document.querySelector('#step-next'),
    stepNextLabel: document.querySelector('#step-next-label'),
    cubeStage: document.querySelector('#cube-stage'),
    cubeCanvas: document.querySelector('#cube-canvas'),
    qrModal: document.querySelector('#qr-modal'),
    qrCanvas: document.querySelector('#qr-canvas'),
    qrUrl: document.querySelector('#qr-url'),
    qrClose: document.querySelector('#qr-close'),
    qrBackdrop: document.querySelector('#qr-backdrop'),
    toastLayer: document.querySelector('#toast-layer'),
  }
}

function bindStaticEvents() {
  document.querySelector('#start-camera').addEventListener('click', handleStartCamera)
  document.querySelector('#demo-button').addEventListener('click', runDemo)
  document.querySelector('#qr-close').addEventListener('click', closeQrModal)
  document.querySelector('#qr-backdrop').addEventListener('click', closeQrModal)
  document.querySelector('#scan-back').addEventListener('click', handleScanBack)
  document.querySelector('#retry-camera').addEventListener('click', () => beginScan({ mode: state.scanMode, rescanIndex: state.rescanIndex, resume: true }))
  document.querySelector('#shutter-btn').addEventListener('click', triggerCapture)
  document.querySelector('#scan-rescan-all').addEventListener('click', restartScanAll)
  document.querySelector('#face-progress').addEventListener('click', handleScanProgressClick)
  document.querySelector('#capture-confirm').addEventListener('click', confirmCapture)
  document.querySelector('#capture-retake').addEventListener('click', retakeCapture)
  document.querySelector('#capture-grid').addEventListener('click', handleCaptureGridClick)
  document.querySelector('#error-demo').addEventListener('click', runDemo)
  document.querySelector('#review-action').addEventListener('click', handleReviewAction)
  document.querySelector('#rescan-all').addEventListener('click', () => beginScan({ mode: 'full' }))
  document.querySelectorAll('[data-action="home"]').forEach((button) => {
    button.addEventListener('click', () => goHome())
  })
  document.querySelector('#review-grid').addEventListener('click', handleReviewGridClick)
  document.querySelector('#step-prev').addEventListener('click', handleStepPrev)
  document.querySelector('#step-next').addEventListener('click', handleStepNext)
  document.querySelector('#step-panel').addEventListener('click', handleStepPanelClick)
  document.addEventListener('click', (event) => {
    const stageItem = event.target.closest('.stage-nav [data-stage]')
    if (!stageItem) return
    goToStage(stageItem.dataset.stage)
  })
  document.querySelector('#cube-view-toggle').addEventListener('click', () => {
    if (!cubeView || !state.guideViewMoved) return
    cubeView.resetView()
    updateCubeViewHint(false)
  })

  document.addEventListener('keydown', (event) => {
    if (!state.dom.qrModal.hidden && event.key === 'Escape') {
      closeQrModal()
      return
    }
    if (isScreen('scan') && event.code === 'Space' && !event.repeat) {
      if (document.activeElement?.tagName === 'BUTTON') return
      event.preventDefault()
      if (state.capturePending) confirmCapture()
      else triggerCapture()
      return
    }
    if (!isScreen('guide')) return
    if (event.key === 'ArrowRight' || event.key === ' ') {
      if (document.activeElement?.tagName === 'BUTTON') return
      event.preventDefault()
      handleStepNext()
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      handleStepPrev()
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (!state.cameraLive) return
    if (document.hidden) scanner.pause()
    else if (!state.capturePending) scanner.start()
  })

  window.addEventListener('beforeunload', () => {
    scanner?.destroy()
    solver?.destroy()
    cubeView?.destroy()
    heroCubeView?.destroy()
  })
}

function isScreen(name) {
  return document.querySelector(`[data-screen="${name}"]`)?.classList.contains('is-active')
}

function isMobileScanDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

function handleStartCamera() {
  if (isMobileScanDevice()) {
    beginScan({ mode: 'full' })
    return
  }
  openQrModal()
}

async function openQrModal() {
  const url = window.location.href
  const token = ++qrRenderToken
  state.dom.qrUrl.textContent = url
  state.dom.qrModal.hidden = false
  document.body.classList.add('is-qr-open')
  state.dom.qrClose.focus({ preventScroll: true })

  try {
    const { default: QRCode } = await import('qrcode')
    if (token !== qrRenderToken || state.dom.qrModal.hidden) return
    await QRCode.toCanvas(state.dom.qrCanvas, url, {
      width: 218,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#08090b', light: '#f3f4ef' },
    })
  } catch {
    if (token === qrRenderToken) state.dom.qrUrl.textContent = `请用手机打开下方地址\n${url}`
  }
}

function closeQrModal() {
  if (state.dom.qrModal.hidden) return
  state.dom.qrModal.hidden = true
  document.body.classList.remove('is-qr-open')
  qrRenderToken += 1
  document.querySelector('#start-camera')?.focus({ preventScroll: true })
}

function setScreen(name) {
  state.screen = name
  for (const screen of state.dom.screens) {
    screen.classList.toggle('is-active', screen.dataset.screen === name)
  }
  window.scrollTo({ top: 0, behavior: 'auto' })
  updateStageNav()
  if (name === 'landing') mountHeroCube()
  else unmountHeroCube()
}

function stageLocks() {
  const scanDone = state.faces.length === 6
  const reviewDone = Boolean(state.solution?.ok)
  return { scanDone, reviewDone }
}

function updateStageNav() {
  const { scanDone, reviewDone } = stageLocks()
  state.dom.screens.forEach((screen) => {
    screen.querySelectorAll('.stage-nav [data-stage]').forEach((item) => {
      const stage = item.dataset.stage
      const enabled = stage === 'scan'
        || (stage === 'review' && scanDone)
        || (stage === 'guide' && reviewDone)
      const active = stage === state.screen
      item.classList.toggle('is-active', active)
      item.classList.toggle('is-done', !active && ((stage === 'scan' && scanDone) || (stage === 'review' && reviewDone)))
      item.classList.toggle('is-locked', !enabled)
      item.setAttribute('aria-disabled', enabled ? 'false' : 'true')
    })
  })
}

function goToStage(stage) {
  const { scanDone, reviewDone } = stageLocks()
  if (stage === state.screen) return
  if (stage === 'scan') {
    cleanupCubeView()
    setScreen('scan')
    renderScanProgress()
    if (!scanDone && state.cameraLive) scanner.start()
    return
  }
  if (stage === 'review') {
    if (!scanDone) return
    cleanupCubeView()
    openReview({ autoEnter: false, autoSolve: false, solution: reviewDone ? state.solution : null })
    return
  }
  if (stage === 'guide' && reviewDone) enterGuide({ resume: true })
}

function initScanner() {
  scanner = new FaceScanner({
    video: state.dom.video,
    stageEl: state.dom.cameraShell,
    frameEl: state.dom.scanFrame,
    onPreview: handlePreview,
  })
}

function initSolver() {
  solver = new SolverClient()
  solver.readyPromise?.catch?.(() => {})
}

function loadCubeView() {
  if (!cubeViewModulePromise) cubeViewModulePromise = import('./lib/cube-view.js')
  return cubeViewModulePromise
}

function handleScannerStatus(text, tone = 'neutral') {
  if (state.dom.cameraStatus.textContent === text && state.dom.cameraStatus.dataset.tone === tone) return
  state.dom.cameraStatus.textContent = text
  state.dom.cameraStatus.dataset.tone = tone
  if (tone === 'success') state.dom.cameraShell.classList.add('is-capturing')
  else state.dom.cameraShell.classList.remove('is-capturing')
}

function handlePreview(grid, meta) {
  if (state.capturePending) return

  const step = currentScanStep()
  const displayGrid = grid ? cloneGrid(grid) : null
  if (displayGrid && step) displayGrid[1][1] = step.color
  updateGridCells(state.dom.scanGrid, displayGrid, 'scan')
  updateGridCells(state.dom.livePreview, displayGrid, 'solid')

  const ready = Boolean(step && meta?.valid)
  state.dom.scanFrame.classList.toggle('is-stable', ready)
  state.dom.cameraShell.classList.toggle('has-face', Boolean(meta?.valid))
  state.dom.shutterBtn.classList.toggle('is-ready', ready && !state.captureBusy)

  state.dom.liveCenter.dataset.center = meta?.center || ''
  if (step) {
    state.dom.liveCenter.textContent = `中心固定${COLORS[step.color].label}`
    state.dom.liveCenter.style.color = COLORS[step.color].hex
    state.dom.liveNote.textContent = meta?.valid ? '整面已进入取景框，按快门' : '保持整面位于取景框内'
  } else {
    state.dom.liveCenter.textContent = '未锁定'
    state.dom.liveCenter.style.color = ''
    state.dom.liveNote.textContent = '保持整面位于取景框内'
  }

  if (!state.cameraLive || state.captureBusy) return
  if (!step) return
  handleScannerStatus(ready ? '整面已进入取景框，按下快门' : `把${step.label}整面对准取景框`, ready ? 'ready' : 'target')
}

function updateGridCells(elements, grid, variant = 'solid') {
  let index = 0
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const el = elements[index]
      const key = grid?.[r]?.[c]
      if (key) {
        if (variant === 'scan') {
          el.style.background = ''
          el.style.setProperty('--cell-color', COLORS[key].hex)
        } else {
          el.style.background = COLORS[key].hex
          el.style.removeProperty('--cell-color')
        }
        el.classList.add('has-color')
      } else {
        el.style.background = ''
        el.style.removeProperty('--cell-color')
        el.classList.remove('has-color')
      }
      index += 1
    }
  }
}

function resetLivePreview() {
  updateGridCells(state.dom.scanGrid, null, 'scan')
  updateGridCells(state.dom.livePreview, null, 'solid')
  state.dom.liveCenter.textContent = '未锁定'
  state.dom.liveCenter.style.color = ''
  state.dom.liveCenter.dataset.center = ''
  state.dom.liveNote.textContent = '保持整面位于取景框内'
}

function resetScanUi() {
  hideCaptureReview()
  resetLivePreview()
  state.dom.cameraError.hidden = true
  state.dom.cameraError.classList.remove('is-visible')
  state.dom.cameraShell.classList.remove('is-error', 'is-capturing', 'has-face')
  state.dom.cameraConnecting.classList.add('is-visible')
  state.dom.cameraStatus.textContent = '正在打开相机…'
  state.dom.cameraStatus.dataset.tone = 'neutral'
  state.dom.scanFrame.classList.remove('is-stable')
  state.dom.cameraFlash.classList.remove('is-active')
}

function stepForFaceIndex(index) {
  const face = state.faces[index]
  if (!face) return SCAN_STEPS[index] || null
  return SCAN_STEPS.find((step) => step.role === ROLE_BY_COLOR[face.center]) || SCAN_STEPS[index] || null
}

function currentScanStep() {
  if (state.scanMode === 'rescan') {
    return state.rescanIndex == null ? null : stepForFaceIndex(state.rescanIndex)
  }
  return SCAN_STEPS[state.scanStep] || null
}

function updateScanTarget(step) {
  if (!step) {
    state.dom.scanTarget.hidden = true
    return
  }
  state.dom.scanTarget.hidden = false
  state.dom.scanTargetDot.style.background = COLORS[step.color].hex
  state.dom.scanTargetLabel.textContent = step.label
  state.dom.scanTargetPose.textContent = step.short
}

function updateScanHint() {
  const hint = state.dom.scanHint
  if (!hint) return
  const step = currentScanStep()
  if (!step) {
    hint.hidden = true
    hint.innerHTML = ''
    return
  }
  const meta = state.scanMode === 'full' ? TURN_HINTS[state.scanStep] : null
  hint.hidden = false
  hint.innerHTML = meta
    ? `${icon(meta.icon, 'icon', 13)}<span>${meta.text}<em>让${step.label}朝前</em></span>`
    : `${icon('cube', 'icon', 13)}<span><i class="swatch white"></i>白面向上<i class="swatch green"></i>绿面朝前</span>`
}

function setShutterMessage(text, tone = 'neutral') {
  state.dom.shutterMessage.textContent = text
  state.dom.shutterMessage.dataset.tone = tone
}

function updateShutterState() {
  const step = currentScanStep()
  const ready = Boolean(step && state.cameraLive && !state.captureBusy && !state.capturePending)
  state.dom.shutterBtn.disabled = !ready
  state.dom.shutterBtn.classList.toggle('is-busy', state.captureBusy)
  if (state.captureBusy || state.capturePending) state.dom.shutterBtn.classList.remove('is-ready')
  state.dom.shutterBtn.setAttribute('aria-label', step ? `拍摄${step.label}` : '扫描完成')
  state.dom.shutterLabel.textContent = state.capturePending
    ? '这一面已拍下'
    : state.captureBusy
      ? '正在拍下…'
      : step
        ? `拍摄${step.label}`
        : '六个面已拍完'
  state.dom.shutterCount.textContent = String(state.faces.length)
}

function countOuterFilled(grid) {
  let filled = 0
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (r === 1 && c === 1) continue
      if (grid?.[r]?.[c]) filled += 1
    }
  }
  return filled
}

function outerConfidence(confidences) {
  let total = 0
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (r === 1 && c === 1) continue
      total += confidences?.[r]?.[c] || 0
    }
  }
  return total
}

async function triggerCapture() {
  if (state.captureBusy || state.capturePending || !state.cameraLive) return
  const step = currentScanStep()
  if (!step) return
  const token = state.scanToken
  state.captureBusy = true
  updateShutterState()
  setShutterMessage('正在拍下这一面…', 'busy')
  handleScannerStatus('已按下快门，正在拍下…', 'success')
  flashCamera()
  scanner.pause()

  let best = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shot = scanner.capturePhoto()
    if (shot) {
      const filled = countOuterFilled(shot.grid)
      const confidence = outerConfidence(shot.confidences)
      if (!best || filled > best.filled || (filled === best.filled && confidence > best.confidence)) {
        best = { ...shot, filled, confidence }
      }
    }
    if (attempt < 2) await wait(60)
  }

  if (token !== state.scanToken) {
    state.captureBusy = false
    return
  }

  state.captureBusy = false

  if (!best) {
    resumeLiveAfterCapture('没有读到画面，请对准后重拍')
    return
  }

  best.grid[1][1] = step.color

  showCaptureReview({
    step,
    grid: best.grid,
    image: best.image,
  })
}

function resumeLiveAfterCapture(message) {
  updateShutterState()
  const step = currentScanStep()
  if (state.cameraLive && !state.capturePending) scanner.start()
  if (message) setShutterMessage(message, 'error')
  if (step) handleScannerStatus(`把${step.label}整面对准取景框`, 'target')
}

function showCaptureReview({ step, grid, image, adjustIndex = null }) {
  const adjusting = adjustIndex != null
  state.capturePending = { step, grid, image, adjustIndex }
  state.dom.capturePhoto.hidden = !image
  if (image) state.dom.capturePhoto.src = image
  else state.dom.capturePhoto.removeAttribute('src')
  state.dom.capturePhoto.alt = `已拍下的${step.label}`
  state.dom.captureTitle.textContent = adjusting ? `修改${step.label}` : `确认${step.label}`
  state.dom.captureNote.textContent = adjusting
    ? `点格子修正颜色，中心色固定为${COLORS[step.color].name}，修改后保存。`
    : `点格子修正颜色，中心色固定为${COLORS[step.color].name}。`
  state.dom.captureRetake.textContent = adjusting ? '返回' : '重拍'
  state.dom.captureConfirm.textContent = adjusting ? '保存修改' : '确认这一面'
  state.dom.captureReview.hidden = false
  state.dom.capturePanel.hidden = false
  state.dom.shutterDock.hidden = true
  state.dom.cameraShell.classList.add('is-frozen')
  state.dom.cameraShell.classList.remove('is-capturing')
  state.dom.scanFrame.classList.remove('is-stable')
  renderCaptureGrid()
  updateGridCells(state.dom.livePreview, grid, 'solid')
  state.dom.liveCenter.textContent = adjusting ? '修改中' : '已拍下'
  state.dom.liveCenter.style.color = ''
  state.dom.liveCenter.dataset.center = ''
  state.dom.liveNote.textContent = '点格子修正颜色'
  state.dom.progressNote.textContent = adjusting ? '修改这一面后保存，返回当前拍摄。' : '这一面已拍下，点格子修正后确认。'
  updateShutterState()
}

function hideCaptureReview() {
  state.capturePending = null
  state.dom.captureReview.hidden = true
  state.dom.capturePanel.hidden = true
  state.dom.shutterDock.hidden = false
  state.dom.cameraShell.classList.remove('is-frozen')
  state.dom.capturePhoto.removeAttribute('src')
  state.dom.captureWarning.hidden = true
  state.dom.captureWarning.textContent = ''
  for (const cell of state.dom.captureGrid) cell.classList.remove('is-active')
}

function renderCaptureGrid() {
  const pending = state.capturePending
  if (!pending) return
  state.dom.captureGrid.forEach((cell, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    const center = row === 1 && col === 1
    const key = pending.grid[row][col] || null
    cell.disabled = center
    cell.classList.toggle('is-center', center)
    cell.classList.remove('is-active')
    const lock = cell.querySelector('.capture-cell-lock')
    if (lock) lock.hidden = !center
    setCaptureCell(cell, key, row, col, center)
  })
  updateCaptureWarning()
  updateCaptureConfirmState()
}

function isCaptureComplete() {
  const grid = state.capturePending?.grid
  if (!grid) return false
  return grid.every((row) => row.every(Boolean))
}

function updateCaptureWarning() {
  const pending = state.capturePending
  if (!pending) return
  const missing = 8 - countOuterFilled(pending.grid)
  const text = missing > 0 ? `有 ${missing} 个格子没识别到，点格子修正或重拍。` : ''
  state.dom.captureWarning.hidden = !text
  state.dom.captureWarning.textContent = text
}

function updateCaptureConfirmState() {
  state.dom.captureConfirm.disabled = !isCaptureComplete()
}

function setCaptureCell(cell, key, row, col, center) {
  const label = cell.querySelector('.capture-cell-label')
  if (key) {
    cell.style.setProperty('--cell-color', COLORS[key].hex)
    cell.classList.remove('is-empty')
    if (label) {
      label.textContent = COLORS[key].label
      label.dataset.ink = key === 'blue' || key === 'red' ? 'light' : 'dark'
    }
  } else {
    cell.style.removeProperty('--cell-color')
    cell.classList.add('is-empty')
    if (label) {
      label.textContent = '?'
      label.dataset.ink = 'light'
    }
  }
  cell.setAttribute(
    'aria-label',
    center
      ? `中心块，固定${COLORS[key]?.name || '目标色'}`
      : `第${row + 1}行第${col + 1}列，当前${COLORS[key]?.name || '未知'}，点击切换颜色`,
  )
}

function openFaceAdjust(index) {
  if (state.captureBusy || state.capturePending) return
  const face = state.faces[index]
  if (!face) return
  const step = stepForFaceIndex(index)
  if (!step) return
  state.solution = null
  scanner.pause()
  showCaptureReview({
    step,
    grid: cloneGrid(face.grid),
    image: face.image || '',
    adjustIndex: index,
  })
}

function handleScanProgressClick(event) {
  const button = event.target.closest('[data-progress-index]')
  if (!button) return
  const index = Number(button.dataset.progressIndex)
  if (Number.isNaN(index) || !state.faces[index]) return
  if (state.capturePending) {
    if (state.capturePending.adjustIndex === index) return
    hideCaptureReview()
  }
  openFaceAdjust(index)
}

function restartScanAll() {
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  state.scanToken += 1
  state.solveToken += 1
  state.captureBusy = false
  hideCaptureReview()
  state.scanMode = 'full'
  state.rescanIndex = null
  state.scanStep = 0
  state.faces = []
  state.solution = null
  state.reviewDirty = false
  renderScanProgress()
  const step = currentScanStep()
  if (step) {
    updateScanTarget(step)
    setShutterMessage(step.pose)
    handleScannerStatus(`把${step.label}整面对准取景框`, 'target')
  }
  if (state.cameraLive) {
    scanner.start()
    showToast('已重新开始扫描', null, '重新拍六个面')
  } else {
    beginScan({ mode: 'full' })
  }
}

function handleCaptureGridClick(event) {
  const cell = event.target.closest('.capture-cell')
  if (!cell || !state.capturePending) return
  const row = Number(cell.dataset.row)
  const col = Number(cell.dataset.col)
  if (row === 1 && col === 1) return
  const grid = state.capturePending.grid
  const current = grid[row][col]
  const next = COLOR_KEYS[(COLOR_KEYS.indexOf(current) + 1) % COLOR_KEYS.length]
  grid[row][col] = next
  for (const item of state.dom.captureGrid) item.classList.remove('is-active')
  cell.classList.add('is-active')
  setCaptureCell(cell, next, row, col, false)
  updateCaptureWarning()
  updateCaptureConfirmState()
}

function retakeCapture() {
  if (!state.capturePending) return
  const { step, adjustIndex } = state.capturePending
  if (adjustIndex != null) {
    hideCaptureReview()
    renderScanProgress()
    if (!completeScanIfReady() && state.cameraLive) scanner.start()
    return
  }
  hideCaptureReview()
  renderScanProgress()
  setShutterMessage(`重拍${step.label}，${step.pose}`)
  handleScannerStatus(`把${step.label}整面对准取景框`, 'target')
  if (state.cameraLive) scanner.start()
}

function confirmCapture() {
  if (!state.capturePending || !isCaptureComplete()) {
    updateCaptureWarning()
    updateCaptureConfirmState()
    return
  }
  const { step, grid, image, adjustIndex } = state.capturePending
  if (adjustIndex != null) {
    const face = state.faces[adjustIndex]
    if (!face) {
      hideCaptureReview()
      renderScanProgress()
      return
    }
    face.grid = grid
    face.center = step.color
    face.grid[1][1] = step.color
    face.capturedAt = Date.now()
    hideCaptureReview()
    renderScanProgress()
    const current = currentScanStep()
    if (current) {
      setShutterMessage(`${COLORS[face.center].name}面已保存，继续拍${current.label}`, 'success')
      handleScannerStatus(`把${current.label}整面对准取景框`, 'target')
      if (state.cameraLive) scanner.start()
      showToast(`${COLORS[face.center].name}面已保存`, face.center, `继续拍${current.label}`)
    } else {
      completeScanIfReady()
    }
    return
  }
  const face = {
    grid,
    center: step.color,
    image,
    capturedAt: Date.now(),
  }
  hideCaptureReview()
  handleCapture(face)
}

async function beginScan({ mode = 'full', rescanIndex = null, resume = false } = {}) {
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  cleanupCubeView()
  state.scanMode = mode
  state.rescanIndex = rescanIndex
  state.reviewDirty = false
  state.solution = null
  state.busy = false
  state.stepIndex = 0
  state.stepBusy = false
  state.solveToken += 1
  state.captureBusy = false
  state.capturePending = null
  if (mode === 'full' && !resume) {
    state.faces = []
    state.scanStep = 0
  }

  loadCubeView().catch(() => {})
  const token = ++state.scanToken
  setScreen('scan')
  resetScanUi()
  renderScanProgress()
  const step = currentScanStep()
  state.dom.cameraStatus.textContent = step?.pose || '正在打开相机…'

  scanner.pause()

  try {
    await scanner.openCamera()
    if (token !== state.scanToken) {
      scanner.stopCamera()
      return
    }
    state.dom.cameraConnecting.classList.remove('is-visible')
    state.dom.cameraShell.classList.add('is-live')
    state.cameraLive = true
    scanner.start()
    updateShutterState()
    setShutterMessage(step?.pose || '对准后按一次快门')
    handleScannerStatus(step ? `把${step.label}整面对准取景框` : '正在识别', 'target')
  } catch (error) {
    if (token !== state.scanToken) return
    scanner.stopCamera()
    showCameraError(error)
  }
}

function showCameraError(error) {
  state.dom.cameraConnecting.classList.remove('is-visible')
  state.dom.cameraShell.classList.add('is-error')
  state.dom.cameraShell.classList.remove('is-live')
  state.cameraLive = false
  state.dom.cameraError.hidden = false
  requestAnimationFrame(() => state.dom.cameraError.classList.add('is-visible'))
  state.dom.cameraErrorText.textContent = readableCameraError(error)
  updateShutterState()
  setShutterMessage('相机未就绪，请重试', 'error')
  state.dom.cameraStatus.textContent = '相机未就绪'
  state.dom.cameraStatus.dataset.tone = 'error'
}

function readableCameraError(error) {
  const message = error?.message || ''
  if (message.includes('Permission') || message.includes('NotAllowed')) {
    return '相机权限被拒绝。请在浏览器地址栏的权限设置中允许相机，然后重试。'
  }
  if (message.includes('NotFound') || message.includes('Devices')) {
    return '没有找到可用的相机。你仍然可以查看演示，或换一台设备重试。'
  }
  if (message.includes('secure') || message.includes('HTTPS')) {
    return '相机需要 HTTPS 环境。请使用安全链接打开页面，或查看演示。'
  }
  return message || '请允许相机权限，或换一个浏览器重试。'
}

function handleScanBack() {
  state.scanToken += 1
  hideCaptureReview()
  scanner.pause()
  scanner.stopCamera()
  state.cameraLive = false
  if (state.scanMode === 'rescan' && state.faces.length === 6) {
    state.scanMode = 'full'
    state.rescanIndex = null
    openReview({ autoEnter: false, autoSolve: true })
  } else {
    goHome()
  }
}

function handleCapture(face) {
  if (state.scanMode === 'rescan') {
    const index = state.rescanIndex
    if (index == null) return
    const step = stepForFaceIndex(index)
    if (step) {
      face.center = step.color
      face.grid[1][1] = step.color
    }
    state.faces[index] = face
    state.scanMode = 'full'
    state.rescanIndex = null
    state.scanStep = SCAN_STEPS.length
    scanner.pause()
    scanner.stopCamera()
    state.cameraLive = false
    state.captureBusy = false
    updateShutterState()
    showToast(`${COLORS[face.center].name}面已更新`, face.center, '重新校验中')
    openReview({ autoEnter: false, autoSolve: true })
    return
  }

  const step = SCAN_STEPS[state.scanStep]
  if (!step) return
  face.center = step.color
  face.grid[1][1] = step.color
  face.role = step.role
  state.faces.push(face)
  state.scanStep += 1

  if (state.scanStep >= SCAN_STEPS.length) {
    renderScanProgress()
    state.dom.cameraStatus.textContent = '六个面收集完成'
    state.dom.cameraStatus.dataset.tone = 'success'
    scanner.pause()
    scanner.stopCamera()
    state.cameraLive = false
    state.captureBusy = false
    updateShutterState()
    setShutterMessage('六个面已确认，正在进入核对页', 'success')
    showToast(`${COLORS[face.center].name}面已确认`, face.center, '6 / 6 · 进入核对页')
    completeScanIfReady()
    return
  }

  const next = SCAN_STEPS[state.scanStep]
  updateScanTarget(next)
  renderScanProgress()
  setShutterMessage(`${COLORS[face.center].name}面已确认，继续拍${next.label}`, 'success')
  handleScannerStatus(`把${next.label}整面对准取景框`, 'target')
  if (state.cameraLive) scanner.start()
  showToast(`${COLORS[face.center].name}面已确认`, face.center, `下一面：${next.label}`)
}

function flashCamera() {
  state.dom.cameraFlash.classList.remove('is-active')
  void state.dom.cameraFlash.offsetWidth
  state.dom.cameraFlash.classList.add('is-active')
}

function renderScanProgress() {
  state.dom.progressCount.textContent = String(state.faces.length)
  state.dom.progressNote.dataset.tone = ''
  state.dom.faceProgress.innerHTML = SCAN_STEPS.map((step, index) => {
    const face = state.faces[index]
    const target = state.scanMode === 'rescan' && state.rescanIndex === index
    const next = state.scanMode === 'full' && index === state.scanStep
    if (!face) {
      return `
        <div class="progress-face is-empty ${next ? 'is-next' : ''} ${target ? 'is-target' : ''}" title="待采集：${step.label}">
          <span class="expected-dot" style="background:${COLORS[step.color].hex}"></span>
          <span class="slot-index">${index + 1}</span>
        </div>
      `
    }
    return `
      <button type="button" class="progress-face is-captured ${target ? 'is-target' : ''}" data-progress-index="${index}" title="查看并修改${COLORS[face.center].name}面" aria-label="查看并修改${COLORS[face.center].name}面">
        <span class="mini-face">${miniFaceMarkup(face.grid)}</span>
        <span class="mini-check">${icon('check', 'icon', 9)}</span>
      </button>
    `
  }).join('')

  const step = currentScanStep()
  updateScanTarget(step)
  updateScanHint()
  updateShutterState()
  if (step) {
    state.dom.progressNote.textContent = state.scanMode === 'rescan'
      ? `重拍第 ${state.rescanIndex + 1} 面 · ${step.pose}`
      : `${step.label} · ${step.pose}`
    setShutterMessage(step.pose)
  } else if (state.scanMode === 'full' && state.faces.length === 6) {
    state.dom.progressNote.textContent = '六个面已拍完，点任意一面可查看修改。'
  } else {
    state.dom.progressNote.textContent = '按目标提示拍摄六个面。'
  }
}

function completeScanIfReady() {
  if (state.scanMode !== 'full' || state.faces.length !== 6) return false
  openReview({ autoEnter: true, autoSolve: true })
  return true
}

function miniFaceMarkup(grid) {
  return grid.flat().map((key) => `<i style="background:${COLORS[key]?.hex || '#22262c'}"></i>`).join('')
}

function openReview({ autoEnter = false, autoSolve = true, solution = null } = {}) {
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  state.reviewDirty = false
  state.solution = solution
  state.actionKind = 'disabled'
  state.busy = false
  state.solveToken += 1
  setScreen('review')
  renderReview()
  const counts = countColors(state.faces)
  const centers = new Set(state.faces.map((face) => face.center))
  if (!isCountComplete(counts) || centers.size !== 6) {
    showCountError(counts)
    return
  }

  if (solution?.ok) {
    state.actionKind = 'guide'
    updateReviewAction('开始还原')
    renderReviewStatus('校验通过，可以开始还原。')
    setReviewAlert(
      'success',
      '校验通过',
      `已计算 ${solution.moves.length} 步还原方案。${autoEnter ? '即将自动进入还原指导。' : '点击下方按钮开始还原。'}`,
    )
    if (autoEnter) {
      state.autoTimer = setTimeout(() => {
        if (state.solution && isScreen('review')) enterGuide()
      }, 1450)
    }
    return
  }

  if (autoSolve) {
    validateAndSolve({ autoEnter })
  } else {
    setReviewAlert('info', '色块已更新', '点击下方按钮重新校验并计算还原步骤。')
    state.actionKind = 'solve'
    updateReviewAction('校验并开始还原')
    renderReviewStatus()
  }
}

function renderReview() {
  state.dom.reviewGrid.innerHTML = state.faces.map((face, index) => {
    const role = ROLE_BY_COLOR[face.center] || '?'
    return `
      <article class="face-card${face.image ? ' has-photo' : ''}" data-face="${index}">
        <header class="face-card-head">
          <div class="face-identity">
            <span class="face-center-dot" style="background:${COLORS[face.center]?.hex || '#555'}"></span>
            <div>
              <strong class="face-role">${FACE_NAMES[role] || '第 ' + (index + 1) + ' 面'}</strong>
              <span class="face-sub">${role} · ${COLORS[face.center]?.name || '未知'}中心</span>
            </div>
          </div>
          <button class="face-rescan" data-rescan="${index}" aria-label="重新扫描这一面" title="重新扫描这一面">
            ${icon('camera', 'icon', 16)}
          </button>
        </header>
        <div class="face-photo-wrap">
          ${face.image ? `<img class="face-photo" src="${face.image}" alt="${FACE_NAMES[role] || '第 ' + (index + 1) + ' 面'}原图" loading="lazy" />` : ''}
          <div class="sticker-grid">
            ${face.grid.flatMap((row, r) => row.map((key, c) => {
              const center = r === 1 && c === 1
              return `<button class="sticker ${center ? 'is-center' : ''}" data-face="${index}" data-row="${r}" data-col="${c}"${center ? ' disabled' : ''} style="--sticker:${COLORS[key]?.hex || '#333'}" aria-label="${center ? '中心块不可修改' : `第${r + 1}行第${c + 1}列，当前${COLORS[key]?.name || '未知'}，点击切换颜色`}"><span></span></button>`
            })).join('')}
          </div>
        </div>
      </article>
    `
  }).join('')
  renderColorCounts(countColors(state.faces))
  renderReviewStatus()
}

function renderColorCounts(counts) {
  state.dom.colorCounts.innerHTML = COLOR_KEYS.map((key) => {
    const count = counts[key]
    return `
      <div class="count-chip ${count === 9 ? 'is-ok' : 'is-bad'}">
        <span class="count-dot" style="background:${COLORS[key].hex}"></span>
        <span>${COLORS[key].label}</span>
        <strong>${count}<em>/9</em></strong>
      </div>
    `
  }).join('')
}

function renderReviewStatus(extra = '') {
  const counts = countColors(state.faces)
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const complete = isCountComplete(counts)
  const centers = new Set(state.faces.map((face) => face.center))
  state.dom.reviewStatus.innerHTML = `
    <div class="panel-head">
      <span>色块采集</span>
      <em>${total} / 54</em>
    </div>
    <div class="status-rows">
      <div class="status-row"><span>颜色数量</span><strong class="${complete ? 'good' : 'bad'}">${complete ? '6 / 6 正确' : '需要修正'}</strong></div>
      <div class="status-row"><span>中心色</span><strong class="${centers.size === 6 ? 'good' : 'bad'}">${centers.size} / 6 唯一</strong></div>
      ${extra ? `<p class="status-extra">${extra}</p>` : ''}
    </div>
  `
}

function handleReviewGridClick(event) {
  const rescanButton = event.target.closest('[data-rescan]')
  if (rescanButton) {
    const index = Number(rescanButton.dataset.rescan)
    beginScan({ mode: 'rescan', rescanIndex: index })
    return
  }

  const sticker = event.target.closest('.sticker')
  if (!sticker) return
  const faceIndex = Number(sticker.dataset.face)
  const row = Number(sticker.dataset.row)
  const col = Number(sticker.dataset.col)
  const face = state.faces[faceIndex]
  const current = face.grid[row][col]
  const nextIndex = (COLOR_KEYS.indexOf(current) + 1) % COLOR_KEYS.length
  const next = COLOR_KEYS[nextIndex]
  face.grid[row][col] = next

  sticker.style.setProperty('--sticker', COLORS[next].hex)
  sticker.setAttribute('aria-label', `第${row + 1}行第${col + 1}列，当前${COLORS[next].name}，点击切换颜色`)

  state.reviewDirty = true
  state.solution = null
  state.solveToken += 1
  state.busy = false
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  renderColorCounts(countColors(state.faces))
  renderReviewStatus('色块已修改。确认无误后点击下方按钮重新校验。')

  const counts = countColors(state.faces)
  const centers = new Set(state.faces.map((item) => item.center))
  if (!isCountComplete(counts)) {
    state.actionKind = 'disabled'
    updateReviewAction('先修正色块')
    showCountError(counts)
  } else if (centers.size !== 6) {
    state.actionKind = 'disabled'
    updateReviewAction('修正重复的中心色')
    setReviewAlert('error', '中心色重复', '两个面出现了相同中心色，请重新扫描对应面。')
  } else {
    state.actionKind = 'solve'
    updateReviewAction('校验并开始还原')
    setReviewAlert('info', '已修改色块', '颜色数量正确，点击按钮重新校验色块组合。')
  }
}

function showCountError(counts) {
  const badKeys = COLOR_KEYS.filter((key) => counts[key] !== 9)
  const detail = badKeys.length
    ? badKeys.map((key) => `${COLORS[key].label}色 ${counts[key]}/9`).join(' · ')
    : ''
  setReviewAlert(
    'error',
    '识别有问题',
    '识别有问题，请重新扫描，或点色块修正',
    detail ? `数量不对：${detail}` : '',
  )
  state.actionKind = 'disabled'
  updateReviewAction('先修正色块')
}

function setReviewAlert(type, title, detail, extra = '') {
  const icons = { error: 'alert', success: 'check', info: 'info', busy: 'refresh' }
  state.dom.reviewAlert.className = `review-alert is-${type}`
  state.dom.reviewAlert.setAttribute('role', type === 'error' ? 'alert' : 'status')
  state.dom.reviewAlert.innerHTML = `
    <span class="alert-icon">${type === 'busy' ? '<span class="spinner small"></span>' : icon(icons[type] || 'info', 'icon', 18)}</span>
    <div><strong>${title}</strong><p>${detail}</p>${extra ? `<small>${extra}</small>` : ''}</div>
  `
}

function updateReviewAction(label) {
  const labelEl = state.dom.reviewAction.querySelector('.btn-label')
  if (labelEl) labelEl.textContent = label
  state.dom.reviewAction.disabled = state.actionKind === 'disabled' || state.busy
  state.dom.reviewAction.classList.toggle('is-loading', state.busy)
  if (state.busy) {
    state.dom.reviewAction.querySelector('.btn-arrow').innerHTML = '<span class="spinner small on-dark"></span>'
  } else {
    state.dom.reviewAction.querySelector('.btn-arrow').innerHTML = icon('arrowRight', 'icon', 18)
  }
}

async function validateAndSolve({ autoEnter = false } = {}) {
  const counts = countColors(state.faces)
  const centers = new Set(state.faces.map((face) => face.center))
  renderColorCounts(counts)
  renderReviewStatus()

  if (!isCountComplete(counts)) {
    showCountError(counts)
    return
  }
  if (centers.size !== 6) {
    state.actionKind = 'disabled'
    updateReviewAction('修正重复的中心色')
    setReviewAlert('error', '中心色重复', '两个面出现了相同中心色，请重新扫描对应面。')
    return
  }
  if (state.faces.length !== 6) {
    setReviewAlert('error', '面数不完整', '需要六个面都识别完成才能计算。请重新扫描。')
    return
  }

  const token = ++state.solveToken
  state.busy = true
  state.solution = null
  state.actionKind = 'disabled'
  updateReviewAction('正在校验色块…')
  setReviewAlert('busy', '色块数量正确', '正在校验色块组合，并计算还原步骤…')

  try {
    const result = await solver.solve(state.faces.map((face) => ({ center: face.center, grid: face.grid })))
    if (token !== state.solveToken) return

    state.busy = false
    if (!result.ok) {
      state.actionKind = 'solve'
      updateReviewAction('重新校验')
      setReviewAlert('error', '色块组合不合法', result.error || '请检查中心块与角块，修正后重试。')
      renderReviewStatus('色块数量正确，但组合无法还原。')
      return
    }

    state.solution = result
    state.actionKind = 'guide'
    updateReviewAction('开始还原')
    updateStageNav()
    setReviewAlert(
      'success',
      '校验通过',
      `已计算 ${result.moves.length} 步还原方案。${autoEnter ? '即将自动进入还原指导。' : '点击下方按钮开始还原。'}`,
      result.candidates > 1 ? '识别方向存在少量歧义，已选择较短方案。' : '',
    )
    renderReviewStatus('校验通过，可以开始还原。')

    if (autoEnter) {
      clearTimeout(state.autoTimer)
      state.autoTimer = setTimeout(() => {
        if (state.solution && isScreen('review')) enterGuide()
      }, 1450)
    }
  } catch (error) {
    if (token !== state.solveToken) return
    state.busy = false
    state.actionKind = 'solve'
    updateReviewAction('重试')
    setReviewAlert('error', '计算失败', error?.message || '求解器没有响应，请重试。')
    renderReviewStatus('计算失败，可重试或重新扫描。')
  }
}

function handleReviewAction() {
  if (state.busy) return
  if (state.actionKind === 'guide' && state.solution) {
    enterGuide()
    return
  }
  if (state.actionKind === 'solve') {
    validateAndSolve({ autoEnter: true })
  }
}

let lastDemoFacelet = ''

async function runDemo() {
  loadCubeView().catch(() => {})
  state.scanToken += 1
  scanner?.pause()
  scanner?.stopCamera()
  state.cameraLive = false

  const demoButton = document.querySelector('#demo-button')
  if (demoButton) demoButton.disabled = true
  showToast('正在生成演示魔方', null, '稍等片刻')

  try {
    let result = await solver.demo()
    let retries = 0
    while (result.ok && result.facelet === lastDemoFacelet && retries < 3) {
      result = await solver.demo()
      retries += 1
    }
    if (!result.ok) throw new Error('演示生成失败')
    lastDemoFacelet = result.facelet
    state.faces = facesFromFacelet(result.facelet)
    state.reviewDirty = false
    state.solution = null
    showToast('演示魔方已载入', null, '自动进入识别校验')
    openReview({ autoEnter: true, autoSolve: true })
  } catch (error) {
    showToast('演示加载失败', null, error?.message || '求解器尚未就绪')
  } finally {
    if (demoButton) demoButton.disabled = false
  }
}

function facesFromFacelet(facelet) {
  return NET_ORDER.map((role, faceIndex) => {
    const grid = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, col) => CHAR_TO_COLOR[facelet[faceIndex * 9 + row * 3 + col]]),
    )
    return { grid, center: grid[1][1], capturedAt: Date.now() }
  })
}

async function enterGuide({ resume = false } = {}) {
  if (!state.solution?.ok) return
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  scanner.pause()
  scanner.stopCamera()
  state.cameraLive = false
  if (!resume) state.stepIndex = 0
  state.stepBusy = false
  state.busy = false
  let CubeViewClass
  try {
    const module = await loadCubeView()
    CubeViewClass = module.CubeView
  } catch {
    setReviewAlert('error', '3D 预览加载失败', '请检查网络后重试，或刷新页面。')
    return
  }
  if (!state.solution?.ok) return
  cleanupCubeView()
  setScreen('guide')
  state.dom.cubeCanvas.innerHTML = ''
  try {
    cubeView = new CubeViewClass(state.dom.cubeCanvas, state.solution.facelet, state.solution.moves, {
      onViewChange: () => updateCubeViewHint(true),
    })
  } catch (error) {
    setScreen('review')
    setReviewAlert(
      'error',
      '3D 预览无法启动',
      webglHint() || `当前环境的 WebGL 初始化失败：${error?.message || '未知错误'}`
    )
    return
  }
  updateCubeViewHint(false)
  state.dom.cubeStage.classList.remove('is-complete')
  state.dom.guideActions.hidden = false
  state.dom.stepSummary.textContent = `准备开始 / 共 ${state.solution.moves.length} 步`
  state.dom.guideCounter.textContent = `0 / ${state.solution.moves.length}`
  renderSequence()
  const moves = state.solution.moves
  if (moves.length === 0) {
    state.stepIndex = 0
    renderSuccess(true)
  } else if (resume && state.stepIndex > 0) {
    await cubeView.resetTo(state.solution.facelet, moves, state.stepIndex)
    if (state.stepIndex >= moves.length) renderSuccess(false)
    else renderStep()
  } else {
    renderStep()
  }
}

function updateCubeViewHint(moved) {
  state.guideViewMoved = moved
  const button = state.dom.cubeViewToggle
  if (!button) return
  button.classList.toggle('is-action', moved)
  button.innerHTML = moved
    ? `${icon('refresh', 'icon', 13)}<span>还原视角</span>`
    : `${icon('drag', 'icon', 14)}<span>拖动可旋转视角</span>`
}

function cleanupCubeView() {
  if (cubeView) {
    cubeView.destroy()
    cubeView = null
  }
}

function formatMove(move) {
  if (!move) return ''
  return move.replace("'", '′')
}

function moveDetail(move) {
  const face = move[0]
  const suffix = move.slice(1)
  const meta = MOVE_META[face]
  const color = COLORS[meta.color]
  const direction = suffix === "2" ? '旋转 180°' : suffix === "'" ? '逆时针 90°' : '顺时针 90°'
  const directionIcon = suffix === "2" ? 'refresh' : suffix === "'" ? 'rotateCcw' : 'rotate'
  return {
    face,
    meta,
    color,
    direction,
    directionIcon,
    description: `${meta.face} · ${color.name}面`,
  }
}

function renderStep() {
  const moves = state.solution?.moves || []
  const move = moves[state.stepIndex]
  if (!move) {
    renderSuccess(false)
    return
  }
  const info = moveDetail(move)
  const total = moves.length
  state.dom.cubeStage.classList.remove('is-complete')
  state.dom.guideActions.hidden = false
  state.dom.stepSummary.textContent = `第 ${state.stepIndex + 1} 步 / 共 ${total} 步`
  state.dom.stepProgress.style.width = `${(state.stepIndex / total) * 100}%`
  state.dom.guideCounter.textContent = `${state.stepIndex} / ${total}`
  state.dom.stepDetail.innerHTML = `
    <div class="step-card">
      <div class="step-card-top">
        <span class="step-face-chip"><i style="background:${info.color.hex}"></i>${info.color.name}面</span>
        <span class="step-number">${String(state.stepIndex + 1).padStart(2, '0')}</span>
      </div>
      <div class="move-hero">
        <div class="move-notation">${formatMove(move)}</div>
        <div class="move-orbit" style="--move-color:${info.color.hex}">
          <span>${icon(info.directionIcon, 'icon orbit-icon', 26)}</span>
        </div>
      </div>
      <div class="move-copy">
        <h3>${info.description}</h3>
        <p>${info.direction}</p>
      </div>
      <div class="move-axis">
        <span><i style="background:${info.color.hex}"></i>${info.meta.face}</span>
        <span>以该面正对你判断方向</span>
      </div>
    </div>
  `
  state.dom.stepNextLabel.textContent = state.stepIndex === total - 1 ? '完成还原' : '下一步'
  state.dom.stepPrev.disabled = state.stepIndex === 0 || state.stepBusy
  state.dom.stepNext.disabled = state.stepBusy
  state.dom.stepNext.classList.toggle('is-busy', state.stepBusy)
  highlightSequence()
}

function renderSuccess(alreadySolved = false) {
  const moves = state.solution?.moves || []
  state.dom.cubeStage.classList.add('is-complete')
  state.dom.stepSummary.textContent = `全部完成 / 共 ${moves.length} 步`
  state.dom.stepProgress.style.width = '100%'
  state.dom.guideCounter.textContent = `${moves.length} / ${moves.length}`
  state.dom.guideActions.hidden = true
  state.dom.stepDetail.innerHTML = `
    <div class="success-card">
      <div class="success-mark">${icon('check', 'icon', 28)}</div>
      <h2>${alreadySolved ? '它本来就是还原状态。' : '还原完成。'}</h2>
      <p>${alreadySolved ? '没有任何步骤需要执行。' : `${moves.length} 步全部完成，魔方的六个面已经回到纯色。`}</p>
      <div class="success-stats">
        <span><strong>${moves.length}</strong><em>步操作</em></span>
        <span><strong>6</strong><em>面识别</em></span>
        <span><strong>0</strong><em>手动输入</em></span>
      </div>
      <div class="success-actions">
        <button class="btn btn-primary" data-success="again">${icon('camera', 'icon', 18)} 再扫一个</button>
        <button class="btn btn-ghost" data-success="rewatch">${icon('restart', 'icon', 17)} 回看步骤</button>
      </div>
    </div>
  `
  highlightSequence(true)
}

function renderSequence() {
  const moves = state.solution?.moves || []
  state.dom.sequenceStrip.innerHTML = moves
    .map((move, index) => `<span class="seq-token" data-step="${index}">${formatMove(move)}</span>`)
    .join('')
  highlightSequence()
}

function highlightSequence(complete = false) {
  if (!state.dom.sequenceStrip) return
  const tokens = state.dom.sequenceStrip.querySelectorAll('.seq-token')
  tokens.forEach((token, index) => {
    token.classList.toggle('is-done', complete || index < state.stepIndex)
    token.classList.toggle('is-current', !complete && index === state.stepIndex)
  })
  const current = complete ? tokens[tokens.length - 1] : tokens[state.stepIndex]
  if (current) {
    const strip = state.dom.sequenceStrip
    const target = current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }
}

async function handleStepNext() {
  const moves = state.solution?.moves || []
  if (state.stepBusy || state.stepIndex >= moves.length) return
  state.stepBusy = true
  state.dom.stepPrev.disabled = true
  state.dom.stepNext.disabled = true
  state.dom.stepNextLabel.textContent = '转动中…'
  const move = moves[state.stepIndex]
  await cubeView.applyMove(move)
  state.stepIndex += 1
  state.stepBusy = false
  if (state.stepIndex >= moves.length) {
    renderSuccess(false)
  } else {
    renderStep()
  }
}

async function handleStepPrev() {
  const moves = state.solution?.moves || []
  if (state.stepBusy || state.stepIndex <= 0) return
  state.stepBusy = true
  state.dom.stepPrev.disabled = true
  state.dom.stepNext.disabled = true
  const move = moves[state.stepIndex - 1]
  await cubeView.undoMove(move)
  state.stepIndex -= 1
  state.stepBusy = false
  renderStep()
}

async function handleStepPanelClick(event) {
  const button = event.target.closest('[data-success]')
  if (!button) return
  const action = button.dataset.success
  if (action === 'again') {
    cleanupCubeView()
    beginScan({ mode: 'full' })
  }
  if (action === 'rewatch') {
    state.stepBusy = true
    await cubeView.resetTo(state.solution.facelet, state.solution.moves, 0)
    state.stepIndex = 0
    state.stepBusy = false
    renderStep()
  }
}

function goHome() {
  clearTimeout(state.autoTimer)
  state.autoTimer = null
  state.scanToken += 1
  state.solveToken += 1
  scanner?.pause()
  scanner?.stopCamera()
  state.cameraLive = false
  cleanupCubeView()
  state.faces = []
  state.scanStep = 0
  state.captureBusy = false
  state.solution = null
  state.reviewDirty = false
  state.busy = false
  state.stepIndex = 0
  renderScanProgress()
  setScreen('landing')
}

function showToast(title, colorKey = null, sub = '') {
  clearTimeout(state.toastTimer)
  const dot = colorKey
    ? `<span class="toast-dot" style="background:${COLORS[colorKey].hex}"></span>`
    : `<span class="toast-icon">${icon('spark', 'icon', 15)}</span>`
  state.dom.toastLayer.innerHTML = `
    <div class="toast">
      ${dot}
      <div class="toast-copy"><strong>${title}</strong>${sub ? `<span>${sub}</span>` : ''}</div>
    </div>
  `
  const toast = state.dom.toastLayer.querySelector('.toast')
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  state.toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible')
    setTimeout(() => {
      if (!toast.classList.contains('is-visible')) state.dom.toastLayer.innerHTML = ''
    }, 260)
  }, 2200)
}

async function mountHeroCube() {
  const container = document.querySelector('#hero-cube')
  if (!container || heroCubeView || !isScreen('landing')) return
  const token = ++heroCubeToken
  let CubeViewClass
  try {
    const module = await loadCubeView()
    CubeViewClass = module.CubeView
  } catch {
    return
  }
  if (token !== heroCubeToken || heroCubeView || !isScreen('landing')) return
  container.innerHTML = ''
  try {
    heroFacelet = pickDifferent(HERO_FACELETS, heroFacelet)
    heroCubeView = new CubeViewClass(container, heroFacelet, [], { intro: false, ambient: true })
  } catch {
    heroCubeView = null
  }
}

function pickDifferent(list, current) {
  const others = list.filter((item) => item !== current)
  return others[Math.floor(Math.random() * others.length)] || current
}

function unmountHeroCube() {
  heroCubeToken += 1
  if (!heroCubeView) return
  heroCubeView.destroy()
  heroCubeView = null
}
