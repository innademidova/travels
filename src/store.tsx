import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, removePhotos, type Trip, type Place } from './lib'

type Store = {
  trips: Trip[]
  places: Place[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  createTrip: (row: Partial<Trip>) => Promise<Trip>
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>
  deleteTrip: (id: string) => Promise<void>
  addPlace: (row: Partial<Place> & { trip_id: string; name: string }) => Promise<Place>
  updatePlace: (id: string, patch: Partial<Place>) => Promise<void>
  deletePlace: (id: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
      supabase.from('trip_places').select('*').order('sort'),
    ])
    if (a.error || b.error) setError((a.error ?? b.error)!.message)
    else { setTrips(a.data as Trip[]); setPlaces(b.data as Place[]); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
    // Fresh data when the app comes back to the screen (changes made on another device)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const value = useMemo<Store>(() => ({
    trips, places, loading, error, reload,
    async createTrip(row) {
      const { data, error } = await supabase.from('trips').insert(row).select().single()
      if (error) throw error
      setTrips(list => [data as Trip, ...list])
      return data as Trip
    },
    async updateTrip(id, patch) {
      setTrips(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)))
      const { error } = await supabase.from('trips').update(patch).eq('id', id)
      if (error) { await reload(); throw error }
    },
    async deleteTrip(id) {
      const trip = trips.find(x => x.id === id)
      const own = places.filter(p => p.trip_id === id)
      const { error } = await supabase.from('trips').delete().eq('id', id)
      if (error) throw error
      setTrips(list => list.filter(x => x.id !== id))
      setPlaces(list => list.filter(p => p.trip_id !== id))
      await removePhotos(trip?.cover_path, ...(trip?.photos ?? []), ...own.flatMap(p => p.photos))
    },
    async addPlace(row) {
      const { data, error } = await supabase.from('trip_places').insert({ sort: Date.now() / 1000, ...row }).select().single()
      if (error) throw error
      setPlaces(list => [...list, data as Place])
      return data as Place
    },
    async updatePlace(id, patch) {
      setPlaces(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)))
      const { error } = await supabase.from('trip_places').update(patch).eq('id', id)
      if (error) { await reload(); throw error }
    },
    async deletePlace(id) {
      const place = places.find(x => x.id === id)
      setPlaces(list => list.filter(x => x.id !== id))
      const { error } = await supabase.from('trip_places').delete().eq('id', id)
      if (error) { await reload(); throw error }
      await removePhotos(...(place?.photos ?? []))
    },
  }), [trips, places, loading, error, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
