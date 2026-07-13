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