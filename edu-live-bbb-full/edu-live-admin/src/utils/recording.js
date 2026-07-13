const DIRECT_MEDIA_EXTENSIONS = [
  'mp4',
  'm3u8',
  'webm',
  'mov',
  'm4v',
  'mp3',
  'wav',
  'ogg',
  'flv'
]

export const normalizeReplayUrl = (value) => (typeof value === 'string' ? value.trim() : '')

const detectMediaType = (url = '') => {
  const lower = url.toLowerCase()
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v') || lower.endsWith('.mov')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.m3u8')) return 'application/x-mpegURL'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  return ''
}

export const isBbbPlaybackUrl = (value) => {
  const url = normalizeReplayUrl(value)
  if (!url) return false

  try {
    const parsed = new URL(url, window.location.origin)
    return /\/playback\/(presentation|video)\//i.test(parsed.pathname)
  } catch (err) {
    return /\/playback\/(presentation|video)\//i.test(url)
  }
}

export const isDirectMediaReplayUrl = (value) => {
  const url = normalizeReplayUrl(value)
  if (!url || isBbbPlaybackUrl(url)) return false

  try {
    const parsed = new URL(url, window.location.origin)
    return DIRECT_MEDIA_EXTENSIONS.some((ext) => parsed.pathname.toLowerCase().endsWith(`.${ext}`))
  } catch (err) {
    return DIRECT_MEDIA_EXTENSIONS.some((ext) => url.toLowerCase().includes(`.${ext}`))
  }
}

export const getDirectReplaySources = (value) => {
  const url = normalizeReplayUrl(value)
  if (!url) return []

  if (isDirectMediaReplayUrl(url)) {
    return [{ src: url, type: detectMediaType(url) }]
  }

  if (!isBbbPlaybackUrl(url)) return []

  try {
    const parsed = new URL(url, window.location.origin)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const recordId = pathParts[pathParts.length - 1]
    if (!recordId) return []

    return [
      { src: `${parsed.origin}/presentation/${recordId}/video/webcams.mp4`, type: 'video/mp4' },
      { src: `${parsed.origin}/presentation/${recordId}/video/webcams.webm`, type: 'video/webm' }
    ]
  } catch (err) {
    return []
  }
}