import { useState } from 'react'
import { t } from './i18n'
import { useStore } from './store'
import { countdown, formatRange, normalizeUrl, removePhotos, tripDays, whenOf, type Kind, type Trip } from './lib'
import { AutoField, ConfirmDelete, Cover, Icon, LinkChip, PhotoButton, PhotoGrid, Segmented, Sheet, Stars, go } from './ui'
import { PlaceRow, PlaceSheet, PlacesList } from './Places'
import { Plan } from './Plan'

type Tab = 'places' | 'plan' | 'memories'

export function TripPage({ trip, tab }: { trip: Trip; tab: string | undefined }) {
  const { places } = useStore()
  const [convert, setConvert] = useState(false)
  const dream = trip.kind === 'dream'
  const mine = places.filter(p => p.trip_id === trip.id)
  const days = tripDays(trip)
  const when = whenOf(trip)
  const current: Tab = dream ? 'places' : tab === 'plan' || tab === 'memories' ? tab : 'places'
  const back = dream ? '#/dreams' : '#/'

  return (
    <div className="page trip-page">
      <Cover path={trip.cover_path} seed={trip.title} thumb={false} className="hero">
        <div className="hero-bar">
          <a className="round glass" href={back} aria-label={t('common.back')}><Icon name="back" /></a>
          <a className="round glass" href={`#/t/${trip.id}/edit`} aria-label={t('common.edit')}><Icon name="edit" /></a>
        </div>
        <div className="hero-text">
          {dream && <span className="pill">✨ {t('dream.badge')}</span>}
          <h1>{trip.title}</h1>
          {trip.destination && <p><Icon name="pin" size={16} /> {trip.destination}</p>}
          {dream && trip.best_time && <p><Icon name="calendar" size={16} /> {trip.best_time}</p>}
          {!dream && trip.start_date && (
            <p><Icon name="calendar" size={16} /> {formatRange(trip.start_date, trip.end_date)}
              {days > 1 && <> · {t('trip.days', { count: days })}</>}
              {countdown(trip) && <span className="pill soft">{countdown(trip)}</span>}
            </p>
          )}
        </div>
      </Cover>

      <div className="content">
        <div className="info-grid">
          {trip.why && (
            <div className="card why"><h4>{t('dream.why')}</h4><p className="pre">{trip.why}</p></div>
          )}
          {(trip.hotel_url || trip.notes) && (
            <div className="card notes">
              {trip.hotel_url && (
                <div className="row hotel"><Icon name="bed" size={18} /><span className="grow">{t('trip.hotel')}</span><LinkChip url={trip.hotel_url} /></div>
              )}
              {trip.notes && <p className="pre">{trip.notes}</p>}
            </div>
          )}
          {dream && (
            <button className="card convert" onClick={() => setConvert(true)}>
              <Icon name="plane" size={22} />
              <span className="grow"><b>{t('dream.convert')}</b><br /><span className="muted small">{t('dream.convertHint')}</span></span>
              <Icon name="chevron" />
            </button>
          )}
        </div>

        {!dream && (
          <Segmented<Tab> value={current} onChange={v => go(`#/t/${trip.id}${v === 'places' ? '' : '/' + v}`)} options={[
            { id: 'places', label: t('tab.places'), count: mine.length },
            { id: 'plan', label: t('tab.plan') },
            { id: 'memories', label: when === 'soon' ? t('tab.memoriesLater') : t('tab.memories') },
          ]} />
        )}
        {dream && <h3 className="section-title">{t('dream.ideas')}</h3>}

        {current === 'places' && <PlacesList trip={trip} />}
        {current === 'plan' && <Plan trip={trip} />}
        {current === 'memories' && <Memories trip={trip} />}
      </div>
      {convert && <ConvertSheet trip={trip} onClose={() => setConvert(false)} />}
    </div>
  )
}

function Memories({ trip }: { trip: Trip }) {
  const { places, updateTrip } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const mine = places.filter(p => p.trip_id === trip.id)
  const been = mine.filter(p => p.status === 'been').sort((a, b) => (a.day ?? 99) - (b.day ?? 99) || a.sort - b.sort)
  const want = mine.filter(p => p.status === 'want')
  const openPlace = mine.find(p => p.id === open)
  return (
    <div className="stack">
      <div className="card memory-box">
        <h4>{t('memory.trip')}</h4>
        <Stars value={trip.rating} onChange={v => updateTrip(trip.id, { rating: v })} size={30} />
        <AutoField value={trip.impression} multiline placeholder={t('memory.tripPh')} onSave={v => updateTrip(trip.id, { impression: v })} />
        <PhotoGrid paths={trip.photos} onChange={photos => updateTrip(trip.id, { photos })} />
      </div>

      <h3 className="section-title">{t('memory.beenTitle', { count: been.length })}</h3>
      {been.length === 0
        ? <p className="empty">{t('memory.beenEmpty')}</p>
        : <div className="memory-list">
            {been.map(p => (
              <button key={p.id} className="card memory-place" onClick={() => setOpen(p.id)}>
                <div className="row">
                  <b className="grow">{p.name}</b>
                  {p.rating != null ? <Stars value={p.rating} size={16} /> : <span className="muted small">{t('memory.rate')}</span>}
                </div>
                {p.impression && <p className="pre">{p.impression}</p>}
                {p.photos.length > 0 && <div className="mini-photos">{p.photos.slice(0, 4).map(ph => <PhotoThumb key={ph} path={ph} />)}</div>}
              </button>
            ))}
          </div>}

      {want.length > 0 && (
        <>
          <h3 className="section-title">{t('memory.tickTitle')}</h3>
          <div className="card list">{want.map(p => <PlaceRow key={p.id} place={p} onOpen={() => setOpen(p.id)} />)}</div>
        </>
      )}
      {openPlace && <PlaceSheet place={openPlace} trip={trip} onClose={() => setOpen(null)} />}
    </div>
  )
}

function PhotoThumb({ path }: { path: string }) {
  return <Cover path={path} seed={path} className="mini" />
}

function ConvertSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { updateTrip } = useStore()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    await updateTrip(trip.id, { kind: 'trip', start_date: start || null, end_date: end || start || null })
    onClose()
    go(`#/t/${trip.id}`)
  }
  return (
    <Sheet title={t('dream.convert')} onClose={onClose}>
      <p className="muted">{t('dream.convertText')}</p>
      <div className="two">
        <label className="field"><span>{t('trip.start')}</span><input type="date" value={start} onChange={e => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value) }} /></label>
        <label className="field"><span>{t('trip.end')}</span><input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <div className="sheet-foot">
        <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={busy || !start} onClick={run}><Icon name="plane" size={18} />{t('dream.convertGo')}</button>
      </div>
    </Sheet>
  )
}

// Create or edit a trip or a dream
export function TripForm({ trip, kind }: { trip?: Trip; kind: Kind }) {
  const { createTrip, updateTrip, deleteTrip } = useStore()
  const dream = kind === 'dream'
  const [f, setF] = useState({
    title: trip?.title ?? '', destination: trip?.destination ?? '', start_date: trip?.start_date ?? '', end_date: trip?.end_date ?? '',
    hotel_url: trip?.hotel_url ?? '', notes: trip?.notes ?? '', why: trip?.why ?? '', best_time: trip?.best_time ?? '', cover_path: trip?.cover_path ?? null as string | null,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof f>) => setF(x => ({ ...x, ...patch }))
  const back = trip ? `#/t/${trip.id}` : dream ? '#/dreams' : '#/'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.title.trim()) { setError(t('form.needTitle')); return }
    setBusy(true); setError('')
    const row: Partial<Trip> = {
      kind, title: f.title.trim(), destination: f.destination.trim() || null, notes: f.notes.trim() || null, cover_path: f.cover_path,
      ...(dream
        ? { why: f.why.trim() || null, best_time: f.best_time.trim() || null }
        : { start_date: f.start_date || null, end_date: f.end_date || f.start_date || null, hotel_url: f.hotel_url.trim() ? normalizeUrl(f.hotel_url) : null, why: f.why.trim() || null }),
    }
    try {
      if (trip) {
        if (trip.cover_path && trip.cover_path !== f.cover_path) removePhotos(trip.cover_path)
        await updateTrip(trip.id, row); go(`#/t/${trip.id}`)
      } else {
        const created = await createTrip(row); go(`#/t/${created.id}`)
      }
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <div className="page form-page">
      <header className="top">
        <a className="round" href={back} aria-label={t('common.back')}><Icon name="back" /></a>
        <h2 className="grow">{t(trip ? (dream ? 'form.editDream' : 'form.editTrip') : (dream ? 'form.newDream' : 'form.newTrip'))}</h2>
      </header>
      <form className="content stack" onSubmit={save}>
        <div className="cover-edit">
          <Cover path={f.cover_path} seed={f.title || 'travel'} thumb={false} className="hero small" />
          <div className="row">
            <PhotoButton multiple={false} label={t(f.cover_path ? 'form.coverChange' : 'form.coverAdd')} onAdded={([p]) => {
              if (f.cover_path && f.cover_path !== trip?.cover_path) removePhotos(f.cover_path)
              set({ cover_path: p })
            }} />
            {f.cover_path && <button type="button" className="btn ghost" onClick={() => set({ cover_path: null })}>{t('form.coverRemove')}</button>}
          </div>
        </div>
        <label className="field"><span>{t('form.title')}</span>
          <input value={f.title} autoFocus={!trip} placeholder={t(dream ? 'form.titlePhDream' : 'form.titlePh')} onChange={e => set({ title: e.target.value })} /></label>
        <label className="field"><span>{t('form.destination')}</span>
          <input value={f.destination} placeholder={t(dream ? 'form.destinationPhDream' : 'form.destinationPh')} onChange={e => set({ destination: e.target.value })} /></label>
        {!dream && (
          <>
            <div className="two">
              <label className="field"><span>{t('trip.start')}</span>
                <input type="date" value={f.start_date} onChange={e => set({ start_date: e.target.value, end_date: !f.end_date || f.end_date < e.target.value ? e.target.value : f.end_date })} /></label>
              <label className="field"><span>{t('trip.end')}</span>
                <input type="date" value={f.end_date} min={f.start_date || undefined} onChange={e => set({ end_date: e.target.value })} /></label>
            </div>
            <label className="field"><span>{t('trip.hotel')}</span>
              <input value={f.hotel_url} inputMode="url" autoCapitalize="off" placeholder="https://booking.com/…" onChange={e => set({ hotel_url: e.target.value })} /></label>
          </>
        )}
        {dream && (
          <label className="field"><span>{t('dream.when')}</span>
            <input value={f.best_time} placeholder={t('form.whenPh')} onChange={e => set({ best_time: e.target.value })} /></label>
        )}
        {(dream || f.why) && (
          <label className="field"><span>{t('dream.why')}</span>
            <textarea rows={3} value={f.why} placeholder={t('form.whyPh')} onChange={e => set({ why: e.target.value })} /></label>
        )}
        <label className="field"><span>{t('form.notes')}</span>
          <textarea rows={4} value={f.notes} placeholder={t(dream ? 'form.notesPhDream' : 'form.notesPh')} onChange={e => set({ notes: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <div className="form-foot">
          {trip && <ConfirmDelete label={t(dream ? 'form.deleteDream' : 'form.deleteTrip')} onConfirm={async () => { await deleteTrip(trip.id); go(dream ? '#/dreams' : '#/') }} />}
          <span className="grow" />
          <button className="btn primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </div>
  )
}
