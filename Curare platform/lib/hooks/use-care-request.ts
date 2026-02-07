"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CareRequest, ProviderLocation } from "@/lib/types/database"

// Hook for tracking a care request with real-time updates
export function useCareRequest(careRequestId: string | null) {
  const [careRequest, setCareRequest] = useState<CareRequest | null>(null)
  const [providerLocation, setProviderLocation] = useState<ProviderLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!careRequestId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Fetch initial data
    async function fetchData() {
      setLoading(true)
      
      const { data, error: fetchError } = await supabase
        .from('care_requests')
        .select(`
          *,
          service_type:service_types(*),
          provider:providers(id, first_name, last_name, avatar_url, rating, specialty, phone),
          case_patients(
            *,
            symptoms:case_patient_symptoms(
              *,
              symptom:symptoms(*)
            )
          )
        `)
        .eq('id', careRequestId)
        .single()

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setCareRequest(data)
      }

      // Fetch provider location if en_route or arrived
      if (data?.provider_id && ['en_route', 'arrived'].includes(data.status)) {
        const { data: locationData } = await supabase
          .from('provider_locations')
          .select('*')
          .eq('care_request_id', careRequestId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .single()

        if (locationData) {
          setProviderLocation(locationData)
        }
      }

      setLoading(false)
    }

    fetchData()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`care-request-${careRequestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
          filter: `id=eq.${careRequestId}`,
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            // Refetch to get joined data
            const { data } = await supabase
              .from('care_requests')
              .select(`
                *,
                service_type:service_types(*),
                provider:providers(id, first_name, last_name, avatar_url, rating, specialty, phone),
                case_patients(
                  *,
                  symptoms:case_patient_symptoms(
                    *,
                    symptom:symptoms(*)
                  )
                )
              `)
              .eq('id', careRequestId)
              .single()
            
            if (data) {
              setCareRequest(data)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'provider_locations',
          filter: `care_request_id=eq.${careRequestId}`,
        },
        (payload) => {
          setProviderLocation(payload.new as ProviderLocation)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [careRequestId])

  return { careRequest, providerLocation, loading, error }
}

// Hook for available requests (provider view)
export function useAvailableRequests() {
  const [requests, setRequests] = useState<CareRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchRequests() {
      const { data } = await supabase
        .from('care_requests')
        .select(`
          *,
          service_type:service_types(*),
          patient:patients(id, first_name, last_name),
          case_patients(
            *,
            symptoms:case_patient_symptoms(
              *,
              symptom:symptoms(*)
            )
          )
        `)
        .in('status', ['pending', 'searching'])
        .is('provider_id', null)
        .order('created_at', { ascending: false })
        .limit(20)

      setRequests(data || [])
      setLoading(false)
    }

    fetchRequests()

    // Subscribe to new requests
    const channel = supabase
      .channel('available-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
        },
        () => {
          // Refetch on any change
          fetchRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const removeRequest = useCallback((requestId: string) => {
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }, [])

  return { requests, loading, removeRequest }
}

// Hook for provider's active request
export function useActiveRequest() {
  const [activeRequest, setActiveRequest] = useState<CareRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchActiveRequest() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('care_requests')
        .select(`
          *,
          service_type:service_types(*),
          patient:patients(id, first_name, last_name, phone, avatar_url),
          case_patients(
            *,
            symptoms:case_patient_symptoms(
              *,
              symptom:symptoms(*)
            )
          )
        `)
        .eq('provider_id', user.id)
        .in('status', ['matched', 'en_route', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      setActiveRequest(data || null)
      setLoading(false)
    }

    fetchActiveRequest()

    // Subscribe to updates
    const channel = supabase
      .channel('active-request')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'care_requests',
        },
        () => {
          fetchActiveRequest()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { activeRequest, loading }
}
