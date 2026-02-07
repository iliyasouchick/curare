"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { CareRequest, Provider, ProviderDashboardStats } from "@/lib/types/database"

// Profile Management
export async function updateProviderProfile(data: Partial<Provider>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('providers')
    .update(data)
    .eq('id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('provider', 'max')
  return { success: true }
}

// Availability Toggle
export async function setProviderAvailability(isAvailable: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('providers')
    .update({ is_available: isAvailable })
    .eq('id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('provider', 'max')
  return { success: true }
}

// Update Provider Location
export async function updateProviderLocation(
  latitude: number, 
  longitude: number, 
  careRequestId?: string,
  heading?: number,
  speed?: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  // Update current location on provider profile
  await supabase
    .from('providers')
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
    })
    .eq('id', user.id)
  
  // Record location history
  const { error } = await supabase
    .from('provider_locations')
    .insert({
      provider_id: user.id,
      care_request_id: careRequestId,
      latitude,
      longitude,
      heading,
      speed,
    })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

// Get Available Requests (nearby)
export async function getAvailableRequests(): Promise<CareRequest[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return []
  }
  
  // Get provider's location and service radius
  const { data: provider } = await supabase
    .from('providers')
    .select('current_latitude, current_longitude, service_radius_miles')
    .eq('id', user.id)
    .single()
  
  if (!provider?.current_latitude || !provider?.current_longitude) {
    // Return all pending requests if location not set
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
    
    return data || []
  }
  
  // For now, return all pending requests
  // In production, you'd use PostGIS for geographic queries
  const { data, error } = await supabase
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
  
  if (error) {
    console.error('Failed to fetch available requests:', error)
    return []
  }
  
  return data || []
}

// Accept a Care Request
export async function acceptCareRequest(careRequestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  // Check if request is still available
  const { data: request } = await supabase
    .from('care_requests')
    .select('status, provider_id')
    .eq('id', careRequestId)
    .single()
  
  if (!request) {
    return { error: 'Request not found' }
  }
  
  if (request.provider_id) {
    return { error: 'Request already accepted by another provider' }
  }
  
  if (!['pending', 'searching'].includes(request.status)) {
    return { error: 'Request is no longer available' }
  }
  
  // Accept the request
  const { error } = await supabase
    .from('care_requests')
    .update({
      provider_id: user.id,
      status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', careRequestId)
    .is('provider_id', null)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Decline a Care Request (just hide from this provider's view)
export async function declineCareRequest(careRequestId: string) {
  // For now, just acknowledge - in production you might track declined requests
  return { success: true }
}

// Start En Route
export async function startEnRoute(careRequestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('care_requests')
    .update({ status: 'en_route' })
    .eq('id', careRequestId)
    .eq('provider_id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Mark Arrived
export async function markArrived(careRequestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('care_requests')
    .update({
      status: 'arrived',
      arrived_at: new Date().toISOString(),
    })
    .eq('id', careRequestId)
    .eq('provider_id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Start Visit
export async function startVisit(careRequestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('care_requests')
    .update({ status: 'in_progress' })
    .eq('id', careRequestId)
    .eq('provider_id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Complete Visit
export async function completeVisit(careRequestId: string, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('care_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      provider_notes: notes,
    })
    .eq('id', careRequestId)
    .eq('provider_id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Get Provider's Active Request
export async function getActiveRequest(): Promise<CareRequest | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }
  
  const { data, error } = await supabase
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
  
  if (error) {
    return null
  }
  
  return data
}

// Get Provider Dashboard Stats
export async function getProviderDashboardStats(): Promise<ProviderDashboardStats> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return {
      todayEarnings: 0,
      todayVisits: 0,
      rating: 0,
      availableRequests: 0,
    }
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Get today's completed visits
  const { data: todayRequests } = await supabase
    .from('care_requests')
    .select('total_price')
    .eq('provider_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', today.toISOString())
  
  const todayEarnings = todayRequests?.reduce((sum, r) => sum + Number(r.total_price), 0) || 0
  const todayVisits = todayRequests?.length || 0
  
  // Get provider rating
  const { data: provider } = await supabase
    .from('providers')
    .select('rating')
    .eq('id', user.id)
    .single()
  
  // Get available requests count
  const { count } = await supabase
    .from('care_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'searching'])
    .is('provider_id', null)
  
  return {
    todayEarnings,
    todayVisits,
    rating: Number(provider?.rating) || 5.0,
    availableRequests: count || 0,
  }
}

// Get Provider's Completed Requests History
export async function getProviderHistory(): Promise<CareRequest[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return []
  }
  
  const { data, error } = await supabase
    .from('care_requests')
    .select(`
      *,
      service_type:service_types(*),
      patient:patients(id, first_name, last_name),
      case_patients(name)
    `)
    .eq('provider_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50)
  
  if (error) {
    console.error('Failed to fetch provider history:', error)
    return []
  }
  
  return data || []
}
