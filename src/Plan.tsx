import { useEffect, useRef, useState } from 'react'
import { t } from './i18n'
import { useStore } from './store'
import { CATEGORY_EMOJI, addDays, formatDay, todayISO, tripDays, type Place, type Trip } from './lib'
import { Icon, Sheet } from './ui'
import { PlaceSheet } from './Places'

type Zone = number | 'pool'
type Drag = { id: string; x: number; y: number; dx: number; dy: number; w: number; zone: Zone | null; index: number }

// Day-by-day plan: places are dragged from "Not planned yet" into days (mouse: drag; touch: hold or use the handle).
// A tap on an unplanned place opens a day picker, so it also works without dragging.
export function Plan({ trip }: { trip: Trip }) {
  const { places, updatePlace } = useStore()
  const days = tripDays(trip)
  const mine = places.filter(p => p.trip_id === trip.id)
  const inZone = (z: Zone) => mine
    .filter(p => (z === 'pool' ? p.day == null || p.day > days : p.day === z))
    .sort((a, b) => a.sort - b.sort)

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  const [pick, setPick] = useState<Place | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const press = useRef<{ id: string; x: number; y: number; timer: number | null; el: HTMLElement; mouse: boolean } | null>(null)
  const today = todayISO()

  function begin(id: string, el: HTMLElement, x: number, y: number) {
    const r = el.getBoundingClientRect()
    navigator.vibrate?.(10)
    setDrag({ id, x, y, dx: x - r.left, dy: y - r.top, w: r.width, zone: null, index: 0 })
  }

  function locate(x: number, y: number, id: string): { zone: Zone | null; index: number } {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
    if (!el) return { zone: null, index: 0 }
    const zone: Zone = el.dataset.drop === 'pool' ? 'pool' : Number(el.dataset.drop)
    const chips = [...el.querySelectorAll<HTMLElement>('[data-chip]')].filter(c => c.dataset.chip !== id)
    const index = chips.filter(c => { const r = c.getBoundingClientRect(); return r.top + r.height / 2 < y }).length
    return { zone, index }
  }

  // Window-level listeners while a press or a drag is going on
  useEffect(() => {
    let raf = 0
    function scrollLoop() {
      const d = dragRef.current
      if (d) {
        const edge = 90
        if (d.y < edge) scrollBy(0, -Math.ceil((edge - d.y) / 6))
        else if (d.y > innerHeight - edge) scrollBy(0, Math.ceil((d.y - innerHeight + edge) / 6))
      }
      raf = requestAnimationFrame(scrollLoop)
    }
    raf = requestAnimationFrame(scrollLoop)

    function move(e: PointerEvent) {
      const p = press.current
      const d = dragRef.current
      if (d) {
        const { zone, index } = locate(e.clientX, e.clientY, d.id)
        setDrag({ ...d, x: e.clientX, y: e.clientY, zone, index })
        return
      }
      if (!p) return
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y)
      if (p.mouse && moved > 4) { begin(p.id, p.el, p.x, p.y); press.current = null }
      else if (!p.mouse && moved > 8) { if (p.timer) clearTimeout(p.timer); press.current = null }
    }
    function up() {
      const p = press.current
      if (p?.timer) clearTimeout(p.timer)
      press.current = null
      const d = dragRef.current
      if (!d) return
      setDrag(null)
      if (d.zone == null) return
      const list = inZone(d.zone).filter(x => x.id !== d.id)
      const prev = list[d.index - 1]?.sort, next = list[d.index]?.sort
      const sort = prev != null && next != null ? (prev + next) / 2 : prev != null ? prev + 1 : next != null ? next - 1 : Date.now() / 1000
      updatePlace(d.id, { day: d.zone === 'pool' ? null : d.zone, sort })
    }
    // While dragging on a touch screen the page must not scroll under the finger
    function touchMove(e: TouchEvent) { if (dragRef.current) e.preventDefault() }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
    document.addEventListener('touchmove', touchMove, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', up)
      document.removeEventListener('touchmove', touchMove)
    }
  })

  function down(e: React.PointerEvent, place: Place, handle: boolean) {
    if (e.button !== 0) return
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-chip]')!
    const mouse = e.pointerType === 'mouse'
    if (handle && !mouse) { e.preventDefault(); begin(place.id, el, e.clientX, e.clientY); return }
    const timer = mouse ? null : window.setTimeout(() => {
      if (press.current) { begin(place.id, el, press.current.x, press.current.y); press.current = null }
    }, 300)
    press.current = { id: place.id, x: e.clientX, y: e.clientY, timer, el, mouse }
  }

  const dragged = drag ? mine.find(p => p.id === drag.id) : null

  function chip(place: Place) {
    const ghost = drag?.id === place.id
    return (
      <div key={place.id} data-chip={place.id} className={`plan-chip ${ghost ? 'ghosted' : ''} ${place.status === 'been' ? 'been' : ''}`}
        onPointerDown={e => down(e, place, false)}
        onClick={() => { if (!dragRef.current) (place.day == null || place.day > days ? setPick(place) : setOpen(place.id)) }}
        onContextMenu={e => e.preventDefault()}>
        <span className="cat-emoji">{CATEGORY_EMOJI[place.category]}</span>
        <span className="grow plan-name">{place.name}</span>
        {place.status === 'been' && <Icon name="check" size={16} />}
        <span className="grip" onPointerDown={e => { e.stopPropagation(); down(e, place, true) }} aria-hidden><Icon name="grip" size={18} /></span>
      </div>
    )
  }

  function zoneBox(zone: Zone, head: React.ReactNode) {
    const list = inZone(zone)
    const over = drag?.zone === zone
    const shown = list.filter(p => p.id !== drag?.id)
    return (
      <div key={String(zone)} data-drop={zone} className={`drop ${over ? 'over' : ''}`}>
        {head}
        <div className="drop-list">
          {shown.map((p, i) => (
            [over && drag!.index === i && <div key="line" className="drop-line" />, chip(p)]
          ))}
          {over && drag!.index >= shown.length && <div className="drop-line" />}
          {shown.length === 0 && !over && <div className="drop-empty">{t(zone === 'pool' ? 'plan.poolEmpty' : 'plan.dayEmpty')}</div>}
        </div>
      </div>
    )
  }

  if (days < 2) return <p className="empty">{t(trip.start_date ? 'plan.oneDay' : 'plan.noDates')}</p>

  return (
    <div className={`plan ${drag ? 'dragging' : ''}`}>
      <aside className="plan-pool">
        {zoneBox('pool', (
          <div className="zone-head">
            <h4>{t('plan.unplanned')}</h4>
            <span className="muted small">{t('plan.dragHint')}</span>
          </div>
        ))}
      </aside>
      <div className="plan-days">
        {Array.from({ length: days }, (_, i) => {
          const date = addDays(trip.start_date!, i)
          return (
            zoneBox(i + 1, (
              <div className="zone-head">
                <h4>{t('plan.dayN', { n: i + 1 })}</h4>
                <span className={`muted small ${date === today ? 'today' : ''}`}>{formatDay(date)}{date === today ? ' · ' + t('plan.today') : ''}</span>
              </div>
            ))
          )
        })}
      </div>

      {drag && dragged && (
        <div className="plan-chip floating" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}>
          <span className="cat-emoji">{CATEGORY_EMOJI[dragged.category]}</span>
          <span className="grow plan-name">{dragged.name}</span>
          <span className="grip"><Icon name="grip" size={18} /></span>
        </div>
      )}

      {pick && (
        <Sheet title={pick.name} onClose={() => setPick(null)}>
          <p className="muted small">{t('plan.pickDay')}</p>
          <div className="day-picks">
            {Array.from({ length: days }, (_, i) => (
              <button key={i} className="day-pick" onClick={() => { updatePlace(pick.id, { day: i + 1, sort: Date.now() / 1000 }); setPick(null) }}>
                <b>{t('plan.dayN', { n: i + 1 })}</b>
                <span>{formatDay(addDays(trip.start_date!, i))}</span>
                <span className="muted small">{t('plan.placesCount', { count: inZone(i + 1).length })}</span>
              </button>
            ))}
          </div>
          <div className="sheet-foot">
            <button className="btn ghost" onClick={() => { setOpen(pick.id); setPick(null) }}><Icon name="edit" size={18} />{t('plan.details')}</button>
          </div>
        </Sheet>
      )}
      {open && mine.find(p => p.id === open) && <PlaceSheet place={mine.find(p => p.id === open)!} trip={trip} onClose={() => setOpen(null)} />}
    </div>
  )
}
