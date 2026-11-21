import { useEffect, useLayoutEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { t, lang, LANGUAGES, remember } from './i18n'
import { supabase, countdown, formatRange, whenOf, type Trip } from './lib'
import { StoreProvider, useStore } from './store'
import { Cover, Icon, Segmented, Sheet, go, useHash } from './ui'
import { TripForm, TripPage } from './Trip'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="splash">✈︎</div>
  if (!session) return <Login />
  return <StoreProvider><Routes /></StoreProvider>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(t('login.failed'))
    setBusy(false)
  }
  return (
    <form className="login" onSubmit={submit}>
      <div className="login-mark">✈︎</div>
      <h1>{t('app.name')}</h1>
      <p className="muted">{t('login.text')}</p>
      <input type="email" autoComplete="email" placeholder={t('login.email')} value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" autoComplete="current-password" placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={busy}>{t('login.go')}</button>
    </form>
  )
}

// Scroll position per screen, so going back lands where she was
const scrolls = new Map<string, number>()
// Switching tabs inside one trip keeps the scroll position; any other screen change restores or resets it
const screenOf = (hash: string) => hash.replace(/^(#\/t\/[^/]+)\/(plan|memories)$/, '$1')
let lastScreen = ''

function Routes() {
  const hash = useHash()
  const { trips, loading, error } = useStore()
  const parts = hash.replace(/^#\/?/, '').split('/')

  useLayoutEffect(() => {
    const screen = screenOf(hash)
    if (screen !== lastScreen) window.scrollTo(0, scrolls.get(screen) ?? 0)
    lastScreen = screen
    const save = () => scrolls.set(screen, scrollY)
    addEventListener('scroll', save, { passive: true })
    return () => removeEventListener('scroll', save)
  }, [hash, loading])

  if (loading) return <div className="splash">✈︎</div>
  if (parts[0] === 'new') return <TripForm kind={parts[1] === 'dream' ? 'dream' : 'trip'} />
  if (parts[0] === 't') {
    const trip = trips.find(x => x.id === parts[1])
    if (!trip) return <NotFound />
    if (parts[2] === 'edit') return <TripForm trip={trip} kind={trip.kind} />
    return <TripPage trip={trip} tab={parts[2]} />
  }
  return <Home section={parts[0] === 'dreams' ? 'dreams' : 'trips'} error={error} />
}

function NotFound() {
  return <div className="page content"><p className="empty">{t('common.notFound')}</p><a className="btn soft" href="#/">{t('common.back')}</a></div>
}

function Home({ section, error }: { section: 'trips' | 'dreams'; error: string | null }) {
  const { trips } = useStore()
  const [settings, setSettings] = useState(false)
  const real = trips.filter(x => x.kind === 'trip')
  const dreams = trips.filter(x => x.kind === 'dream')
  const by = (w: string) => real.filter(x => whenOf(x) === w)
  const groups: { id: string; list: Trip[] }[] = [
    { id: 'now', list: by('now') },
    { id: 'soon', list: by('soon').sort((a, b) => a.start_date!.localeCompare(b.start_date!)) },
    { id: 'undated', list: by('undated') },
    { id: 'past', list: by('past').sort((a, b) => b.start_date!.localeCompare(a.start_date!)) },
  ]

  return (
    <div className="page home">
      <header className="top home-top">
        <div className="grow">
          <h1>{t('app.name')}</h1>
          <p className="muted small">{t('home.stats', { trips: real.length, dreams: dreams.length })}</p>
        </div>
        <button className="round" onClick={() => setSettings(true)} aria-label={t('settings.title')}><Icon name="settings" /></button>
      </header>
      <div className="content">
        <div className="home-bar">
          <Segmented value={section} onChange={v => go(v === 'dreams' ? '#/dreams' : '#/')} options={[
            { id: 'trips', label: '🧳 ' + t('home.trips'), count: real.length },
            { id: 'dreams', label: '✨ ' + t('home.dreams'), count: dreams.length },
          ]} />
          <a className="btn primary" href={section === 'dreams' ? '#/new/dream' : '#/new/trip'}>
            <Icon name="plus" size={18} />{t(section === 'dreams' ? 'home.addDream' : 'home.addTrip')}
          </a>
        </div>
        {error && <p className="error">{error}</p>}

        {section === 'trips' && (real.length === 0
          ? <Empty text={t('home.emptyTrips')} href="#/new/trip" cta={t('home.addTrip')} />
          : groups.filter(g => g.list.length).map(g => (
              <section key={g.id}>
                <h3 className="section-title">{t('when.' + g.id)}</h3>
                <div className="grid">{g.list.map(x => <TripCard key={x.id} trip={x} />)}</div>
              </section>
            )))}

        {section === 'dreams' && (dreams.length === 0
          ? <Empty text={t('home.emptyDreams')} href="#/new/dream" cta={t('home.addDream')} />
          : <div className="grid">{dreams.map(x => <TripCard key={x.id} trip={x} />)}</div>)}
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="empty-big">
      <div className="empty-mark">🗺️</div>
      <p>{text}</p>
      <a className="btn primary" href={href}><Icon name="plus" size={18} />{cta}</a>
    </div>
  )
}

function TripCard({ trip }: { trip: Trip }) {
  const { places } = useStore()
  const mine = places.filter(p => p.trip_id === trip.id)
  const been = mine.filter(p => p.status === 'been').length
  const cd = countdown(trip)
  return (
    <a className="trip-card" href={`#/t/${trip.id}`}>
      <Cover path={trip.cover_path} seed={trip.title}>
        {cd && <span className="pill glass">{cd}</span>}
        {trip.rating != null && <span className="pill glass">★ {trip.rating}</span>}
      </Cover>
      <div className="trip-card-body">
        <b>{trip.title}</b>
        {trip.destination && <span className="muted small">{trip.destination}</span>}
        <span className="small card-meta">
          {trip.kind === 'trip' && trip.start_date && <span>{formatRange(trip.start_date, trip.end_date)}</span>}
          {mine.length > 0 && <span className="muted">{whenOf(trip) === 'past' ? t('home.beenOf', { been, count: mine.length }) : t('home.places', { count: mine.length })}</span>}
        </span>
      </div>
    </a>
  )
}

function Settings({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={t('settings.title')} onClose={onClose}>
      <div className="field">
        <span>{t('settings.language')}</span>
        <div className="segmented">
          {LANGUAGES.map(l => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => { if (remember(l)) location.reload() }}>{t('languages.' + l)}</button>
          ))}
        </div>
      </div>
      <p className="muted small">{t('settings.install')}</p>
      <div className="sheet-foot">
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>{t('settings.signOut')}</button>
      </div>
    </Sheet>
  )
}
