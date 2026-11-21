import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from './i18n'
import { cachedUrl, signedUrl, thumbOf, uploadPhoto, gradientFor, linkKind, hostOf, normalizeUrl } from './lib'

// ---------- icons (24px stroke) ----------

const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  back: 'M15 18l-6-6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  bed: 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11.5a1.5 1.5 0 1 0 0-.01',
  plane: 'M10.5 13.5L3 11l1.5-1.5 8 1 4-4.5a2 2 0 0 1 3 3l-4.5 4 1 8L14.5 22 12 14.5 8 18v2.5L6.5 22 5 18.5 1.5 17 3 15.5h2.5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  clipboard: 'M9 4h6v3H9zM9 5H6v16h12V5h-3',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  chevron: 'M9 6l6 6-6 6',
}

export function Icon({ name, size = 20, fill = false }: { name: string; size?: number; fill?: boolean }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={name === 'grip' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

// ---------- routing ----------

export function useHash() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}
export const go = (hash: string) => { location.hash = hash }

// ---------- photos ----------

export function useSigned(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => (path ? cachedUrl(path) : null))
  useEffect(() => {
    if (!path) { setUrl(null); return }
    const hit = cachedUrl(path)
    if (hit) { setUrl(hit); return }
    let alive = true
    signedUrl(path).then(u => { if (alive) setUrl(u || null) })
    return () => { alive = false }
  }, [path])
  return url
}

export function Img({ path, thumb, alt = '', className }: { path: string; thumb?: boolean; alt?: string; className?: string }) {
  const url = useSigned(thumb ? thumbOf(path) : path)
  const [loaded, setLoaded] = useState(false)
  return url
    ? <img src={url} alt={alt} className={`${className ?? ''} ${loaded ? 'in' : 'loading'}`} onLoad={() => setLoaded(true)} draggable={false} />
    : <div className={`${className ?? ''} loading`} />
}

export function Cover({ path, seed, className, thumb = true, children }: { path: string | null; seed: string; className?: string; thumb?: boolean; children?: ReactNode }) {
  return (
    <div className={`cover ${className ?? ''}`} style={{ background: path ? undefined : gradientFor(seed) }}>
      {path && <Img path={path} thumb={thumb} />}
      {children}
    </div>
  )
}

// Picks image files, compresses and uploads them; returns the new paths
export function PhotoButton({ onAdded, multiple = true, label, className }: { onAdded: (paths: string[]) => void; multiple?: boolean; label?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function pick(files: FileList | null) {
    if (!files?.length) return
    setBusy(true); setError('')
    try {
      const paths: string[] = []
      for (const f of Array.from(files)) paths.push(await uploadPhoto(f))
      onAdded(paths)
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }
  return (
    <>
      <button type="button" className={className ?? 'btn soft'} disabled={busy} onClick={() => ref.current?.click()}>
        <Icon name="camera" size={18} />{busy ? t('common.uploading') : label ?? t('photos.add')}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} hidden onChange={e => pick(e.target.files)} />
      {error && <p className="error">{error}</p>}
    </>
  )
}

export function PhotoGrid({ paths, onChange }: { paths: string[]; onChange?: (next: string[]) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      {paths.length > 0 && (
        <div className="photo-grid">
          {paths.map((p, i) => (
            <button key={p} className="photo-tile" onClick={() => setOpen(i)}><Img path={p} thumb /></button>
          ))}
        </div>
      )}
      {onChange && <PhotoButton onAdded={added => onChange([...paths, ...added])} />}
      {open != null && paths[open] && (
        <Viewer paths={paths} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          onDelete={onChange ? () => { onChange(paths.filter((_, i) => i !== open)); setOpen(null) } : undefined} />
      )}
    </>
  )
}

function Viewer({ paths, index, onIndex, onClose, onDelete }: { paths: string[]; index: number; onIndex: (i: number) => void; onClose: () => void; onDelete?: () => void }) {
  const startX = useRef<number | null>(null)
  const step = (d: number) => onIndex((index + d + paths.length) % paths.length)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  return (
    <div className="viewer" onClick={onClose}
      onTouchStart={e => { startX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (startX.current == null) return
        const dx = e.changedTouches[0].clientX - startX.current
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
        startX.current = null
      }}>
      <Img path={paths[index]} />
      <div className="viewer-bar" onClick={e => e.stopPropagation()}>
        <button className="round" onClick={onClose} aria-label={t('common.close')}><Icon name="close" /></button>
        {paths.length > 1 && <span>{index + 1} / {paths.length}</span>}
        {onDelete ? <ConfirmDelete onConfirm={onDelete} compact /> : <span />}
      </div>
    </div>
  )
}

// ---------- small pieces ----------

export function Stars({ value, onChange, size = 26 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <div className={`stars ${onChange ? 'edit' : ''}`} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!onChange} className={value != null && n <= value ? 'on' : ''}
          aria-label={String(n)} onClick={() => onChange?.(value === n ? null : n)}>
          <Icon name="star" size={size} fill={value != null && n <= value} />
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children, wide }: { title?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', key)
    document.body.classList.add('locked')
    return () => { removeEventListener('keydown', key); document.body.classList.remove('locked') }
  }, [onClose])
  return (
    <div className="sheet-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog">
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="round" onClick={onClose} aria-label={t('common.close')}><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

// Two taps to delete: the first one asks, the second one deletes
export function ConfirmDelete({ onConfirm, label, compact }: { onConfirm: () => void; label?: string; compact?: boolean }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <button type="button" className={`btn ${armed ? 'danger' : 'ghost'} ${compact ? 'compact' : ''}`}
      onClick={e => { e.stopPropagation(); if (armed) onConfirm(); else setArmed(true) }}>
      <Icon name="trash" size={18} />{armed ? t('common.confirmDelete') : label ?? t('common.delete')}
    </button>
  )
}

export function LinkChip({ url }: { url: string }) {
  const kind = linkKind(url)
  return (
    <a className={`link-chip ${kind}`} href={normalizeUrl(url)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <Icon name={kind === 'maps' ? 'pin' : kind === 'booking' ? 'bed' : 'link'} size={14} />
      {kind === 'web' ? hostOf(url) || t('link.web') : t('link.' + kind)}
    </a>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map(o => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}{o.count ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

// Text field that saves when it loses focus (and on Enter for single-line fields)
export function AutoField({ value, onSave, placeholder, multiline, type = 'text', className }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string; multiline?: boolean; type?: string; className?: string }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = () => { const next = v.trim() || null; if (next !== (value ?? null)) onSave(next) }
  return multiline
    ? <textarea className={className} value={v} placeholder={placeholder} rows={3} onChange={e => setV(e.target.value)} onBlur={commit} />
    : <input className={className} type={type} value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}
