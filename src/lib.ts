import { createClient } from '@supabase/supabase-js'
import { t, locale } from './i18n'

// Publishable key of the Supabase project "Style" (shared with Capsule): data is protected by RLS and password login
export const supabase = createClient(
  'https://ajbdkvpyhoyzzzlrlttk.supabase.co',
  'sb_publishable_zyycYXIPLQCCxPsccMttlQ_SglhZaMg',
)

export type Kind = 'trip' | 'dream'
export type Category = 'see' | 'do' | 'eat'
export const CATEGORIES: Category[] = ['see', 'do', 'eat']
export const CATEGORY_EMOJI: Record<Category, string> = { see: '🏛️', do: '🎒', eat: '🍝' }

export type Trip = {
  id: string
  kind: Kind
  title: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  cover_path: string | null
  hotel_url: string | null
  notes: string | null
  why: string | null
  rating: number | null
  impression: string | null
  photos: string[]
  created_at: string
  updated_at: string
}

export type Place = {
  id: string
  trip_id: string
  name: string
  category: Category
  city: string | null
  url: string | null
  note: string | null
  status: 'want' | 'been'
  day: number | null
  sort: number
  rating: number | null
  impression: string | null
  photos: string[]
  created_at: string
}

// ---------- dates ----------

const DAY = 86400000
const parse = (d: string) => new Date(d + 'T00:00:00')
export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const addDays = (d: string, n: number) => {
  const x = new Date(parse(d).getTime() + n * DAY + 12 * 3600000)
  return x.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY)

// Number of days in the trip (1 for a one-day trip), 0 without dates
export function tripDays(trip: Trip) {
  if (!trip.start_date) return 0
  const end = trip.end_date && trip.end_date >= trip.start_date ? trip.end_date : trip.start_date
  return daysBetween(trip.start_date, end) + 1
}

export function formatRange(start: string | null, end: string | null) {
  if (!start) return ''
  const f = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
  if (!end || end <= start) return f.format(parse(start))
  return f.formatRange(parse(start), parse(end))
}

export const formatDay = (d: string) =>
  new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(d))

export type When = 'now' | 'soon' | 'past' | 'undated'
export function whenOf(trip: Trip): When {
  if (!trip.start_date) return 'undated'
  const today = todayISO()
  const end = trip.end_date && trip.end_date >= trip.start_date ? trip.end_date : trip.start_date
  if (end < today) return 'past'
  if (trip.start_date <= today) return 'now'
  return 'soon'
}

// "in 23 days", "tomorrow", "day 3 of 7"
export function countdown(trip: Trip) {
  const w = whenOf(trip)
  if (w === 'soon') {
    const n = daysBetween(todayISO(), trip.start_date!)
    return n === 1 ? t('when.tomorrow') : t('when.inDays', { count: n })
  }
  if (w === 'now') return t('when.dayOf', { day: daysBetween(trip.start_date!, todayISO()) + 1, total: tripDays(trip) })
  return ''
}

// ---------- links ----------

export function normalizeUrl(raw: string) {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return 'https://' + s
  return s
}
export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(normalizeUrl(s))

// Pulls a link out of shared text ("Look at this! https://…")
export function extractUrl(text: string) {
  const m = text.match(/https?:\/\/\S+/i)
  return m ? m[0].replace(/[),.]+$/, '') : isUrl(text) ? normalizeUrl(text) : ''
}

export type LinkKind = 'maps' | 'instagram' | 'tiktok' | 'booking' | 'web'
export function linkKind(url: string): LinkKind {
  const h = hostOf(url)
  if (/(^|\.)google\.[a-z.]+$/.test(h) && url.includes('/maps') || /maps\.app\.goo\.gl|goo\.gl$|maps\.apple/.test(h)) return 'maps'
  if (/instagram\.com$|instagr\.am$/.test(h)) return 'instagram'
  if (/tiktok\.com$/.test(h)) return 'tiktok'
  if (/booking\.com$|airbnb\.|hotels\.com$|agoda\.com$/.test(h)) return 'booking'
  return 'web'
}
export function hostOf(url: string) {
  try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '') } catch { return '' }
}

// Best guess of a place name from its link (Google Maps place links carry the name, Instagram profiles a handle)
export function guessName(url: string) {
  try {
    const u = new URL(normalizeUrl(url))
    const place = u.pathname.match(/\/maps\/place\/([^/@]+)/)
    if (place) return decodeURIComponent(place[1].replace(/\+/g, ' ')).trim()
    const q = u.searchParams.get('q') ?? u.searchParams.get('query')
    if (q && linkKind(url) === 'maps') return q.trim()
    if (linkKind(url) === 'instagram') {
      const seg = u.pathname.split('/').filter(Boolean)
      if (seg.length === 1 && !['p', 'reel', 'reels', 'stories', 'explore'].includes(seg[0])) return '@' + seg[0]
      return ''
    }
    if (linkKind(url) === 'web') {
      const host = u.hostname.replace(/^www\./, '').split('.')
      return host.length > 1 ? host[host.length - 2].replace(/^./, c => c.toUpperCase()) : ''
    }
  } catch { /* not a link */ }
  return ''
}

// ---------- photos ----------

const FULL = 1600
const THUMB = 600
const BUCKET = 'travel'

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h))
  return c
}

// Stepped downscale keeps photos sharp
function downscale(src: CanvasImageSource & { width: number; height: number }, max: number) {
  let cur: CanvasImageSource = src
  let w = src.width, h = src.height
  const target = Math.min(1, max / Math.max(w, h))
  const tw = w * target, th = h * target
  while (w / 2 >= tw) {
    w /= 2; h /= 2
    const c = canvasOf(w, h); const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, c.width, c.height); cur = c
  }
  const c = canvasOf(tw, th); const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, c.width, c.height)
  return c
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error(t('error.photo')))), type, q))
}
async function encode(c: HTMLCanvasElement) {
  const webp = await toBlob(c, 'image/webp', 0.88)
  return webp.type === 'image/webp' ? webp : toBlob(c, 'image/jpeg', 0.88)
}
const extOf = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg')

// Thumbnail path of a photo: <uuid>.webp -> <uuid>_t.webp
export const thumbOf = (path: string) => path.replace(/\.(\w+)$/, '_t.$1')

// Compresses and uploads a photo (full + thumbnail); returns the full photo's path
export async function uploadPhoto(file: Blob) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error(t('error.signIn'))
  const bitmap = await createImageBitmap(file)
  const full = await encode(downscale(bitmap, FULL))
  const thumb = await encode(downscale(bitmap, THUMB))
  bitmap.close?.()
  const path = `${user.id}/${crypto.randomUUID()}.${extOf(full)}`
  for (const [p, blob] of [[path, full], [thumbOf(path), thumb]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(p, blob, { contentType: blob.type })
    if (error) throw error
  }
  return path
}

export async function removePhotos(...paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p).flatMap(p => [p, thumbOf(p)])
  if (list.length) await supabase.storage.from(BUCKET).remove(list)
}

// Signed URLs, requested in batches and cached for most of their 24h life
const signed = new Map<string, { url: string; until: number }>()
let pending: { path: string; resolve: (u: string) => void }[] = []
let timer: number | null = null

export function signedUrl(path: string): Promise<string> {
  const hit = signed.get(path)
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url)
  return new Promise(resolve => {
    pending.push({ path, resolve })
    if (timer == null) timer = window.setTimeout(flush, 10)
  })
}
export const cachedUrl = (path: string) => {
  const hit = signed.get(path)
  return hit && hit.until > Date.now() ? hit.url : null
}

async function flush() {
  const batch = pending; pending = []; timer = null
  const paths = [...new Set(batch.map(b => b.path))]
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 86400)
  const until = Date.now() + 20 * 3600000
  for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, until })
  for (const b of batch) b.resolve(signed.get(b.path)?.url ?? '')
}

// Soft gradient cover for trips without a photo, stable for the same title
export function gradientFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const a = h % 360, b = (a + 40 + (h >> 9) % 60) % 360
  return `linear-gradient(135deg, hsl(${a} 55% 62%), hsl(${b} 60% 45%))`
}

// Cities used in a list of places, most used first
export function citiesOf(places: { city: string | null }[]) {
  const n = new Map<string, number>()
  for (const p of places) if (p.city) n.set(p.city, (n.get(p.city) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
}
