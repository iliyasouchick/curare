'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CareRequest, Provider, ProviderLocation } from '@/lib/types/database'

// Real-time care request updates for patients
export function useRealtimeCareRequest(requestId: string | null) {
  const [request, setRequest] = useState<CareRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!requestId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Initial fetch
    const fetchRequest = async () => {
      const { data, error } = await supabase
        .from('care_requests')
        .select(`
          *,
          provider:providers(*),
          patients:care_request_patients(
            *,
            patient:patients(*)
          )
        `)
        .eq('id', requestId)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setRequest(data as CareRequest)
      }
      setLoading(false)
    }

    fetchRequest()

    // Subscribe to changes
    const channel = supabase
      .channel(`care_request:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRequest((prev) => prev ? { ...prev, ...payload.new } : payload.new as CareRequest)
          } else if (payload.eventType === 'DELETE') {
            setRequest(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId])

  return { request, loading, error }
}

// Real-time provider location tracking
export function useRealtimeProviderLocation(providerId: string | null) {
  const [location, setLocation] = useState<ProviderLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Initial fetch
    const fetchLocation = async () => {
      const { data } = await supabase
        .from('provider_locations')
        .select('*')
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setLocation(data as ProviderLocation)
      }
      setLoading(false)
    }

    fetchLocation()

    // Subscribe to location changes
    const channel = supabase
      .channel(`provider_location:${providerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_locations',
          filter: `provider_id=eq.${providerId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setLocation(payload.new as ProviderLocation)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [providerId])

  return { location, loading }
}

// Real-time queue for doctors - incoming care requests
export function useRealtimeQueue(providerId: string | null) {
  const [queue, setQueue] = useState<CareRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Fetch pending requests in provider's area
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('care_requests')
        .select(`
          *,
          patients:care_request_patients(
            *,
            patient:patients(*)
          )
        `)
        .eq('status', 'searching')
        .order('urgency_level', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(20)

      if (data) {
        setQueue(data as CareRequest[])
      }
      setLoading(false)
    }

    fetchQueue()

    // Subscribe to new requests
    const channel = supabase
      .channel('care_requests_queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'searching') {
            setQueue((prev) => [payload.new as CareRequest, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setQueue((prev) => {
              // Remove if no longer searching
              if (payload.new.status !== 'searching') {
                return prev.filter((r) => r.id !== payload.new.id)
              }
              // Update if still in queue
              return prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r))
            })
          } else if (payload.eventType === 'DELETE') {
            setQueue((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [providerId])

  return { queue, loading }
}

// Real-time active request for doctors
export function useRealtimeActiveRequest(providerId: string | null) {
  const [activeRequest, setActiveRequest] = useState<CareRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    const fetchActive = async () => {
      const { data } = await supabase
        .from('care_requests')
        .select(`
          *,
          patients:care_request_patients(
            *,
            patient:patients(*)
          )
        `)
        .eq('provider_id', providerId)
        .in('status', ['matched', 'en_route', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      setActiveRequest(data as CareRequest | null)
      setLoading(false)
    }

    fetchActive()

    const channel = supabase
      .channel(`provider_active:${providerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
          filter: `provider_id=eq.${providerId}`,
        },
        (payload) => {
          const status = payload.new?.status
          if (['matched', 'en_route', 'arrived', 'in_progress'].includes(status)) {
            setActiveRequest(payload.new as CareRequest)
          } else if (payload.eventType === 'UPDATE' && status === 'completed') {
            setActiveRequest(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [providerId])

  return { activeRequest, loading }
}

// Real-time notifications
export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter((n) => !n.read_at).length)
      }
    }

    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = useCallback(async (notificationId: string) => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)

    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    setUnreadCount(0)
  }, [userId])

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}

// Real-time admin dashboard stats
export function useRealtimeAdminStats() {
  const [stats, setStats] = useState({
    activeRequests: 0,
    availableProviders: 0,
    completedToday: 0,
    revenueToday: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [activeRes, providersRes, completedRes, revenueRes] = await Promise.all([
        supabase
          .from('care_requests')
          .select('id', { count: 'exact' })
          .in('status', ['searching', 'matched', 'en_route', 'arrived', 'in_progress']),
        supabase
          .from('providers')
          .select('id', { count: 'exact' })
          .eq('is_available', true)
          .eq('is_verified', true),
        supabase
          .from('care_requests')
          .select('id', { count: 'exact' })
          .eq('status', 'completed')
          .gte('completed_at', today),
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', today),
      ])

      setStats({
        activeRequests: activeRes.count || 0,
        availableProviders: providersRes.count || 0,
        completedToday: completedRes.count || 0,
        revenueToday: revenueRes.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      })
      setLoading(false)
    }

    fetchStats()

    // Subscribe to care_requests changes for live stats
    const channel = supabase
      .channel('admin_stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'care_requests' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'providers' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { stats, loading }
}
