import { useEffect, useRef, useState } from 'react'
import { t } from './i18n'
import { useStore } from './store'
import { CATEGORIES, CATEGORY_EMOJI, addDays, extractUrl, formatDay, guessName, isUrl, normalizeUrl, tripDays, type Category, type Place, type Trip } from './lib'
import { AutoField, ConfirmDelete, Icon, LinkChip, PhotoGrid, Sheet, Stars } from './ui'

// Quick add: paste a link (the name is guessed from Google Maps links), type a name, tap a category — saved
export function QuickAdd({ trip }: { trip: Trip }) {
  const { addPlace } = useStore()
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  function takeLink(raw: string) {
    const url = extractUrl(raw)
    if (!url) {
      // Not a link: treat it as the name
      if (!name) { setName(raw.trim()); setTouched(true) }
      setLink('')
      return
    }
    setLink(url)
    if (!touched || !name) {
      const guess = guessName(url)
      setName(guess)
      if (!guess) setTimeout(() => nameRef.current?.focus(), 0)
    }
  }

  async function paste() {
    try { takeLink(await navigator.clipboard.readText()) } catch { setError(t('quick.pasteFailed')) }
  }

  async function save(category: Category) {
    const n = name.trim() || guessName(link)
    if (!n) { setError(t('quick.needName')); nameRef.current?.focus(); return }
    setBusy(true); setError('')
    try {
      await addPlace({ trip_id: trip.id, name: n, category, url: link ? normalizeUrl(link) : null })
      setLink(''); setName(''); setTouched(false)
      setDone(n); setTimeout(() => setDone(''), 2200)
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="card quick">
      <div className="quick-row">
        <input value={link} placeholder={t('quick.link')} inputMode="url" autoCapitalize="off"
          onChange={e => setLink(e.target.value)}
          onPaste={e => { e.preventDefault(); takeLink(e.clipboardData.getData('text')) }}
          onBlur={() => link && takeLink(link)} />
        {canPaste && <button type="button" className="btn soft" onClick={paste}><Icon name="clipboard" size={18} />{t('quick.paste')}</button>}
      </div>
      <input ref={nameRef} value={name} placeholder={t('quick.name')}
        onChange={e => { setName(e.target.value); setTouched(true) }}
        onKeyDown={e => { if (e.key === 'Enter') save('see') }} />
      <div className="quick-cats">
        {CATEGORIES.map(c => (
          <button key={c} type="button" className={`cat-btn ${c}`} disabled={busy} onClick={() => save(c)}>
            <span>{CATEGORY_EMOJI[c]}</span>{t('cat.' + c)}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {done ? <p className="hint ok"><Icon name="check" size={16} /> {t('quick.added', { name: done })}</p>
        : <p className="hint">{t('quick.hint')}</p>}
    </div>
  )
}

export function PlaceRow({ place, onOpen, showDay, trip }: { place: Place; onOpen: () => void; showDay?: boolean; trip?: Trip }) {
  const { updatePlace } = useStore()
  const been = place.status === 'been'
  const days = trip ? tripDays(trip) : 0
  return (
    <div className={`place-row ${been ? 'been' : ''}`} onClick={onOpen}>
      <span className={`cat-dot ${place.category}`} title={t('cat.' + place.category)}>{CATEGORY_EMOJI[place.category]}</span>
      <div className="grow place-main">
        <div className="place-name">{place.name}</div>
        <div className="place-meta">
          {place.url && <LinkChip url={place.url} />}
          {showDay && place.day != null && place.day <= days && <span className="tag">{t('plan.dayN', { n: place.day })}</span>}
          {place.rating != null && <span className="tag star">★ {place.rating}</span>}
          {place.note && <span className="place-note">{place.note}</span>}
        </div>
      </div>
      <button className={`been-btn ${been ? 'on' : ''}`} aria-label={t('place.been')} title={been ? t('place.been') : t('place.want')}
        onClick={e => { e.stopPropagation(); updatePlace(place.id, { status: been ? 'want' : 'been' }) }}>
        <Icon name="check" size={18} />
      </button>
    </div>
  )
}

export function PlacesList({ trip }: { trip: Trip }) {
  const { places } = useStore()
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [open, setOpen] = useState<string | null>(null)
  const mine = places.filter(p => p.trip_id === trip.id)
  const shown = mine.filter(p => filter === 'all' || p.category === filter)
    .sort((a, b) => Number(a.status === 'been') - Number(b.status === 'been') || a.created_at.localeCompare(b.created_at))
  const openPlace = mine.find(p => p.id === open)

  return (
    <div className="stack">
      <QuickAdd trip={trip} />
      {mine.length > 0 && (
        <div className="chips">
          {(['all', ...CATEGORIES] as const).map(c => {
            const n = c === 'all' ? mine.length : mine.filter(p => p.category === c).length
            return (
              <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
                {c !== 'all' && CATEGORY_EMOJI[c] + ' '}{t(c === 'all' ? 'cat.all' : 'cat.' + c)} <span className="count">{n}</span>
              </button>
            )
          })}
        </div>
      )}
      {mine.length === 0
        ? <p className="empty">{t(trip.kind === 'dream' ? 'place.emptyDream' : 'place.empty')}</p>
        : <div className="card list">{shown.map(p => <PlaceRow key={p.id} place={p} trip={trip} showDay onOpen={() => setOpen(p.id)} />)}</div>}
      {openPlace && <PlaceSheet place={openPlace} trip={trip} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function PlaceSheet({ place, trip, onClose }: { place: Place; trip: Trip; onClose: () => void }) {
  const { updatePlace, deletePlace } = useStore()
  const save = (patch: Partial<Place>) => updatePlace(place.id, patch)
  const days = tripDays(trip)
  const been = place.status === 'been'
  const [url, setUrl] = useState(place.url ?? '')
  useEffect(() => setUrl(place.url ?? ''), [place.url])

  return (
    <Sheet title={t('place.title')} onClose={onClose}>
      <label className="field">
        <span>{t('place.name')}</span>
        <AutoField value={place.name} onSave={v => v && save({ name: v })} />
      </label>
      <div className="field">
        <span>{t('place.category')}</span>
        <div className="quick-cats">
          {CATEGORIES.map(c => (
            <button key={c} type="button" className={`cat-btn ${c} ${place.category === c ? 'on' : ''}`} onClick={() => save({ category: c })}>
              <span>{CATEGORY_EMOJI[c]}</span>{t('cat.' + c)}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>{t('place.link')}</span>
        <div className="quick-row">
          <input value={url} inputMode="url" autoCapitalize="off" placeholder="https://…" onChange={e => setUrl(e.target.value)}
            onBlur={() => { const v = url.trim() ? normalizeUrl(extractUrl(url) || url) : null; if (v !== place.url) save({ url: v }) }} />
          {place.url && isUrl(place.url) && <LinkChip url={place.url} />}
        </div>
      </label>
      <label className="field">
        <span>{t('place.note')}</span>
        <AutoField value={place.note} multiline placeholder={t('place.notePh')} onSave={v => save({ note: v })} />
      </label>
      {trip.kind === 'trip' && days > 1 && (
        <label className="field">
          <span>{t('plan.day')}</span>
          <select value={place.day != null && place.day <= days ? place.day : ''} onChange={e => save({ day: e.target.value ? Number(e.target.value) : null, sort: Date.now() / 1000 })}>
            <option value="">{t('plan.unplanned')}</option>
            {Array.from({ length: days }, (_, i) => (
              <option key={i} value={i + 1}>{t('plan.dayN', { n: i + 1 })} · {formatDay(addDays(trip.start_date!, i))}</option>
            ))}
          </select>
        </label>
      )}

      <div className="field">
        <span>{t('place.status')}</span>
        <div className="segmented">
          <button className={!been ? 'on' : ''} onClick={() => save({ status: 'want' })}>{t('place.want')}</button>
          <button className={been ? 'on' : ''} onClick={() => save({ status: 'been' })}>✓ {t('place.been')}</button>
        </div>
      </div>
      {been && (
        <div className="memory-box">
          <div className="field">
            <span>{t('memory.rating')}</span>
            <Stars value={place.rating} onChange={v => save({ rating: v })} />
          </div>
          <label className="field">
            <span>{t('memory.words')}</span>
            <AutoField value={place.impression} multiline placeholder={t('memory.wordsPh')} onSave={v => save({ impression: v })} />
          </label>
          <PhotoGrid paths={place.photos} onChange={photos => save({ photos })} />
        </div>
      )}
      <div className="sheet-foot">
        <ConfirmDelete onConfirm={() => { onClose(); deletePlace(place.id) }} />
        <button className="btn primary" onClick={onClose}>{t('common.done')}</button>
      </div>
    </Sheet>
  )
}
