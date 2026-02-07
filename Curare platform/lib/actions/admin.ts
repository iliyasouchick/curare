"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { 
  CareRequest, 
  Provider, 
  Patient, 
  AdminDashboardStats 
} from "@/lib/types/database"

// Verify Admin Access
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated', isAdmin: false }
  }
  
  const { data: admin } = await supabase
    .from('admins')
    .select('id, role')
    .eq('id', user.id)
    .single()
  
  if (!admin) {
    return { error: 'Not authorized', isAdmin: false }
  }
  
  return { isAdmin: true, role: admin.role, userId: user.id }
}

// Dashboard Stats
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return {
      totalRevenue: 0,
      revenueChange: 0,
      activeProviders: 0,
      providerChange: 0,
      totalPatients: 0,
      patientChange: 0,
      completedVisits: 0,
      visitChange: 0,
    }
  }
  
  const supabase = await createClient()
  
  // Get total revenue
  const { data: revenueData } = await supabase
    .from('care_requests')
    .select('total_price')
    .eq('status', 'completed')
  
  const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.total_price), 0) || 0
  
  // Get active providers count
  const { count: activeProviders } = await supabase
    .from('providers')
    .select('id', { count: 'exact', head: true })
    .eq('is_available', true)
  
  // Get total patients count
  const { count: totalPatients } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
  
  // Get completed visits count
  const { count: completedVisits } = await supabase
    .from('care_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
  
  return {
    totalRevenue,
    revenueChange: 12.5, // Mock for now - would calculate from historical data
    activeProviders: activeProviders || 0,
    providerChange: 3,
    totalPatients: totalPatients || 0,
    patientChange: 89,
    completedVisits: completedVisits || 0,
    visitChange: -2.3,
  }
}

// Providers Management
export async function getAllProviders(): Promise<Provider[]> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return []
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Failed to fetch providers:', error)
    return []
  }
  
  return data || []
}

export async function updateProviderStatus(
  providerId: string, 
  status: 'active' | 'suspended'
) {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return { error: 'Not authorized' }
  }
  
  const supabase = await createClient()
  
  // For now, we'll use is_available as a proxy for suspended status
  // In production, you'd add a dedicated status field
  const { error } = await supabase
    .from('providers')
    .update({ 
      is_available: status === 'active' ? true : false 
    })
    .eq('id', providerId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('providers', 'max')
  return { success: true }
}

export async function getProviderDetails(providerId: string): Promise<Provider | null> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return null
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .single()
  
  if (error) {
    console.error('Failed to fetch provider:', error)
    return null
  }
  
  return data
}

// Patients Management
export async function getAllPatients(): Promise<Patient[]> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return []
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Failed to fetch patients:', error)
    return []
  }
  
  return data || []
}

export async function getPatientDetails(patientId: string): Promise<Patient | null> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return null
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .single()
  
  if (error) {
    console.error('Failed to fetch patient:', error)
    return null
  }
  
  return data
}

// Care Requests Management
export async function getAllCareRequests(
  status?: string,
  limit = 50
): Promise<CareRequest[]> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return []
  }
  
  const supabase = await createClient()
  
  let query = supabase
    .from('care_requests')
    .select(`
      *,
      service_type:service_types(*),
      patient:patients(id, first_name, last_name, phone),
      provider:providers(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Failed to fetch care requests:', error)
    return []
  }
  
  return data || []
}

export async function getCareRequestDetails(requestId: string): Promise<CareRequest | null> {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return null
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('care_requests')
    .select(`
      *,
      service_type:service_types(*),
      patient:patients(*),
      provider:providers(*),
      case_patients(
        *,
        symptoms:case_patient_symptoms(
          *,
          symptom:symptoms(*)
        )
      )
    `)
    .eq('id', requestId)
    .single()
  
  if (error) {
    console.error('Failed to fetch care request:', error)
    return null
  }
  
  return data
}

// Assign Provider to Request (manual override)
export async function assignProviderToRequest(
  requestId: string, 
  providerId: string
) {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return { error: 'Not authorized' }
  }
  
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('care_requests')
    .update({
      provider_id: providerId,
      status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Cancel Request (admin override)
export async function adminCancelRequest(requestId: string, reason: string) {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return { error: 'Not authorized' }
  }
  
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('care_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: `[Admin] ${reason}`,
    })
    .eq('id', requestId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Billing & Transactions
export async function getTransactionsSummary() {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return {
      totalRevenue: 0,
      totalRefunds: 0,
      totalPayouts: 0,
      pendingPayouts: 0,
    }
  }
  
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('transactions')
    .select('amount, type, status')
  
  if (!data) {
    return {
      totalRevenue: 0,
      totalRefunds: 0,
      totalPayouts: 0,
      pendingPayouts: 0,
    }
  }
  
  const totalRevenue = data
    .filter(t => t.type === 'charge' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  
  const totalRefunds = data
    .filter(t => t.type === 'refund' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  
  const totalPayouts = data
    .filter(t => t.type === 'payout' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  
  const pendingPayouts = data
    .filter(t => t.type === 'payout' && t.status === 'pending')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  
  return {
    totalRevenue,
    totalRefunds,
    totalPayouts,
    pendingPayouts,
  }
}

// Service Types Management
export async function updateServiceType(
  serviceTypeId: string,
  data: { base_price?: number; is_active?: boolean }
) {
  const auth = await verifyAdmin()
  if (!auth.isAdmin) {
    return { error: 'Not authorized' }
  }
  
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('service_types')
    .update(data)
    .eq('id', serviceTypeId)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('service-types', 'max')
  return { success: true }
}
