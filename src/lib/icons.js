const PATHS = {
  camera: `
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/>
    <circle cx="12" cy="13" r="3.4"/>`,
  cameraOff: `
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/>
    <circle cx="12" cy="13" r="3.4"/>
    <path d="m3 3 18 18"/>`,
  arrowRight: `<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>`,
  arrowLeft: `<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  check: `<path d="m5 12 4.5 4.5L19 7"/>`,
  alert: `<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  rotate: `
    <path d="M20 8.5A8 8 0 1 0 20 16"/>
    <path d="M20 3v5.5h-5.5"/>`,
  rotateCcw: `
    <path d="M4 8.5A8 8 0 1 1 4 16"/>
    <path d="M4 3v5.5h5.5"/>`,
  refresh: `
    <path d="M20 11a8 8 0 0 0-14.9-4"/>
    <path d="M4 4v6h6"/>
    <path d="M4 13a8 8 0 0 0 14.9 4"/>
    <path d="M20 20v-6h-6"/>`,
  lock: `<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`,
  cube: `
    <path d="M12 2.8 21 7.4v9.2l-9 4.6-9-4.6V7.4l9-4.6Z"/>
    <path d="m3.4 7.6 8.6 4.5 8.6-4.5"/>
    <path d="M12 21v-8.9"/>`,
  drag: `
    <path d="M12 2v20M2 12h20"/>
    <path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>`,
  scan: `
    <path d="M4 8V5a1 1 0 0 1 1-1h3"/>
    <path d="M16 4h3a1 1 0 0 1 1 1v3"/>
    <path d="M20 16v3a1 1 0 0 1-1 1h-3"/>
    <path d="M8 20H5a1 1 0 0 1-1-1v-3"/>`,
  spark: `
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>`,
  shield: `<path d="M12 3 4.5 6v5.3c0 4.5 3 8.6 7.5 9.7 4.5-1.1 7.5-5.2 7.5-9.7V6L12 3Z"/><path d="m9 12 2 2 4-4"/>`,
  chevronRight: `<path d="m9 5 7 7-7 7"/>`,
  restart: `<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>`,
}

export function icon(name, className = 'icon', size = 20) {
  const body = PATHS[name] || PATHS.info
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}
