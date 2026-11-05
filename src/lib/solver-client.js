import SolverWorker from '../worker/solver-worker.js?worker'

export class SolverClient {
  constructor() {
    this.worker = new SolverWorker()
    this.pending = new Map()
    this.sequence = 0
    this.ready = false
    this.readyResolve = null
    this.readyReject = null
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })

    this.worker.onmessage = (event) => {
      const data = event.data || {}
      if (data.type === 'ready') {
        this.ready = true
        this.readyResolve?.()
        return
      }
      if (data.type === 'init-error') {
        this.readyReject?.(new Error(data.error))
        return
      }
      if (data.type === 'booting') return
      if (data.requestId == null) return
      const pending = this.pending.get(data.requestId)
      if (!pending) return
      this.pending.delete(data.requestId)
      clearTimeout(pending.timer)
      if (data.type === 'error') {
        pending.reject(new Error(data.error || '求解失败'))
      } else {
        pending.resolve(data)
      }
    }

    this.worker.onerror = (event) => {
      const error = new Error(event.message || '求解器加载失败')
      this.readyReject?.(error)
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(error)
      }
      this.pending.clear()
    }
  }

  request(type, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.sequence
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('计算超时，请重试'))
      }, timeout)
      this.pending.set(requestId, { resolve, reject, timer })
      this.worker.postMessage({ type, requestId, ...payload })
    })
  }

  async warm() {
    return this.readyPromise
  }

  async solve(faces) {
    await this.readyPromise
    return this.request('solve', { faces }, 35000)
  }

  async demo() {
    await this.readyPromise
    return this.request('demo', {}, 30000)
  }

  destroy() {
    this.worker.terminate()
    this.pending.clear()
  }
}
