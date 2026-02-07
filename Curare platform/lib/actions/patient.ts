"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { CareRequest, Patient, Symptom, ServiceType } from "@/lib/types/database"

// Profile Management
export async function updatePatientProfile(data: Partial<Patient>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('patients')
    .update(data)
    .eq('id', user.id)
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('patient', 'max')
  return { success: true }
}

// Symptoms
export async function getSymptoms(): Promise<Symptom[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .order('name')
  
  if (error) {
    console.error('Failed to fetch symptoms:', error)
    return []
  }
  
  return data || []
}

export async function searchSymptoms(query: string): Promise<Symptom[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10)
  
  if (error) {
    console.error('Failed to search symptoms:', error)
    return []
  }
  
  return data || []
}

// Service Types
export async function getServiceTypes(): Promise<ServiceType[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('is_active', true)
    .order('base_price')
  
  if (error) {
    console.error('Failed to fetch service types:', error)
    return []
  }
  
  return data || []
}

// Care Request Creation
export interface CreateCareRequestInput {
  service_type_id: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  patient_notes?: string
  donation_amount?: number
  case_patients: {
    name: string
    relationship: string
    date_of_birth?: string
    gender?: string
    notes?: string
    symptoms: {
      symptom_id?: string
      custom_symptom?: string
      severity: number
      duration?: string
      notes?: string
    }[]
  }[]
}

export async function createCareRequest(input: CreateCareRequestInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  // Get service type for pricing
  const { data: serviceType } = await supabase
    .from('service_types')
    .select('base_price')
    .eq('id', input.service_type_id)
    .single()
  
  if (!serviceType) {
    return { error: 'Invalid service type' }
  }
  
  const basePrice = Number(serviceType.base_price)
  const additionalFees = input.case_patients.length > 1 ? (input.case_patients.length - 1) * 50 : 0
  const donationAmount = input.donation_amount || 0
  const totalPrice = basePrice + additionalFees + donationAmount
  
  // Create the care request
  const { data: careRequest, error: requestError } = await supabase
    .from('care_requests')
    .insert({
      patient_id: user.id,
      service_type_id: input.service_type_id,
      status: 'pending',
      address_line1: input.address_line1,
      address_line2: input.address_line2,
      city: input.city,
      state: input.state,
      zip_code: input.zip_code,
      latitude: input.latitude,
      longitude: input.longitude,
      base_price: basePrice,
      additional_fees: additionalFees,
      donation_amount: donationAmount,
      total_price: totalPrice,
      insurance_coverage: 0,
      patient_responsibility: totalPrice,
      patient_notes: input.patient_notes,
    })
    .select()
    .single()
  
  if (requestError || !careRequest) {
    return { error: requestError?.message || 'Failed to create care request' }
  }
  
  // Add case patients
  for (const casePatient of input.case_patients) {
    const { data: patient, error: patientError } = await supabase
      .from('case_patients')
      .insert({
        care_request_id: careRequest.id,
        name: casePatient.name,
        relationship: casePatient.relationship,
        date_of_birth: casePatient.date_of_birth,
        gender: casePatient.gender,
        notes: casePatient.notes,
      })
      .select()
      .single()
    
    if (patientError || !patient) {
      console.error('Failed to add case patient:', patientError)
      continue
    }
    
    // Add symptoms for this patient
    for (const symptom of casePatient.symptoms) {
      await supabase
        .from('case_patient_symptoms')
        .insert({
          case_patient_id: patient.id,
          symptom_id: symptom.symptom_id,
          custom_symptom: symptom.custom_symptom,
          severity: symptom.severity,
          duration: symptom.duration,
          notes: symptom.notes,
        })
    }
  }
  
  // Update status to searching
  await supabase
    .from('care_requests')
    .update({ status: 'searching' })
    .eq('id', careRequest.id)
  
  revalidateTag('care-requests', 'max')
  return { success: true, careRequestId: careRequest.id }
}

// Get Patient's Care Requests
export async function getPatientCareRequests(): Promise<CareRequest[]> {
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
      provider:providers(id, first_name, last_name, avatar_url, rating, specialty),
      case_patients(
        *,
        symptoms:case_patient_symptoms(
          *,
          symptom:symptoms(*)
        )
      )
    `)
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Failed to fetch care requests:', error)
    return []
  }
  
  return data || []
}

// Get Single Care Request
export async function getCareRequest(id: string): Promise<CareRequest | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
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
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Failed to fetch care request:', error)
    return null
  }
  
  return data
}

// Cancel Care Request
export async function cancelCareRequest(id: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  const { error } = await supabase
    .from('care_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', id)
    .eq('patient_id', user.id)
    .in('status', ['pending', 'searching', 'matched'])
  
  if (error) {
    return { error: error.message }
  }
  
  revalidateTag('care-requests', 'max')
  return { success: true }
}

// Get Provider Location for Tracking
export async function getProviderLocation(careRequestId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('provider_locations')
    .select('*')
    .eq('care_request_id', careRequestId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error) {
    return null
  }
  
  return data
}
