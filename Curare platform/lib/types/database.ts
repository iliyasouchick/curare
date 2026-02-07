// Curare Database Types - Generated from schema

export interface Patient {
  id: string
  phone: string | null
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: string | null
  avatar_url: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  latitude: number | null
  longitude: number | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  insurance_provider: string | null
  insurance_member_id: string | null
  insurance_group_number: string | null
  created_at: string
  updated_at: string
}

export interface Provider {
  id: string
  phone: string | null
  first_name: string
  last_name: string
  avatar_url: string | null
  license_number: string
  license_state: string
  specialty: string
  years_experience: number
  bio: string | null
  rating: number
  total_reviews: number
  hourly_rate: number
  is_available: boolean
  current_latitude: number | null
  current_longitude: number | null
  service_radius_miles: number
  created_at: string
  updated_at: string
}

export interface Admin {
  id: string
  first_name: string
  last_name: string
  role: 'admin' | 'super_admin' | 'support'
  permissions: string[]
  created_at: string
  updated_at: string
}

export interface ServiceType {
  id: string
  name: string
  description: string | null
  base_price: number
  duration_minutes: number
  icon: string | null
  is_active: boolean
  created_at: string
}

export interface Symptom {
  id: string
  name: string
  category: string | null
  severity_weight: number
  requires_immediate_care: boolean
  created_at: string
}

export type CareRequestStatus = 
  | 'pending' 
  | 'searching' 
  | 'matched' 
  | 'en_route' 
  | 'arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled'

export interface CareRequest {
  id: string
  patient_id: string
  provider_id: string | null
  service_type_id: string
  status: CareRequestStatus
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  scheduled_at: string | null
  matched_at: string | null
  arrived_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  base_price: number
  additional_fees: number
  donation_amount: number
  total_price: number
  insurance_coverage: number
  patient_responsibility: number
  patient_notes: string | null
  provider_notes: string | null
  created_at: string
  updated_at: string
  // Joined relations
  patient?: Patient
  provider?: Provider
  service_type?: ServiceType
  case_patients?: CasePatient[]
}

export interface CasePatient {
  id: string
  care_request_id: string
  name: string
  relationship: string
  date_of_birth: string | null
  gender: string | null
  notes: string | null
  created_at: string
  // Joined relations
  symptoms?: CasePatientSymptom[]
}

export interface CasePatientSymptom {
  id: string
  case_patient_id: string
  symptom_id: string | null
  custom_symptom: string | null
  severity: number
  duration: string | null
  notes: string | null
  created_at: string
  // Joined relations
  symptom?: Symptom
}

export interface ProviderLocation {
  id: string
  provider_id: string
  care_request_id: string | null
  latitude: number
  longitude: number
  heading: number | null
  speed: number | null
  recorded_at: string
}

export interface PaymentMethod {
  id: string
  patient_id: string
  type: 'card' | 'bank' | 'insurance'
  last_four: string | null
  brand: string | null
  exp_month: number | null
  exp_year: number | null
  is_default: boolean
  stripe_payment_method_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
  care_request_id: string
  payment_method_id: string | null
  amount: number
  type: 'charge' | 'refund' | 'payout'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  stripe_payment_intent_id: string | null
  created_at: string
  completed_at: string | null
}

export interface Review {
  id: string
  care_request_id: string
  patient_id: string
  provider_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  user_type: 'patient' | 'provider' | 'admin'
  title: string
  body: string | null
  type: string
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

// Dashboard Stats
export interface AdminDashboardStats {
  totalRevenue: number
  revenueChange: number
  activeProviders: number
  providerChange: number
  totalPatients: number
  patientChange: number
  completedVisits: number
  visitChange: number
}

export interface ProviderDashboardStats {
  todayEarnings: number
  todayVisits: number
  rating: number
  availableRequests: number
}
