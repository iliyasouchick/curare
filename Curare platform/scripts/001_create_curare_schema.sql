-- Curare Healthcare Platform - Complete Database Schema
-- Supports: Patient App, Doctor App, Admin Panel

-- =============================================
-- USERS & PROFILES
-- =============================================

-- Patient profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  avatar_url TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  insurance_provider TEXT,
  insurance_member_id TEXT,
  insurance_group_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor/Provider profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  license_number TEXT NOT NULL,
  license_state TEXT NOT NULL,
  specialty TEXT DEFAULT 'General Practice',
  years_experience INTEGER DEFAULT 0,
  bio TEXT,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  total_reviews INTEGER DEFAULT 0,
  hourly_rate DECIMAL(10, 2) DEFAULT 150.00,
  is_available BOOLEAN DEFAULT FALSE,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  service_radius_miles INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'support')),
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SERVICES & PRICING
-- =============================================

-- Available service types
CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default service types
INSERT INTO public.service_types (name, description, base_price, duration_minutes, icon) VALUES
  ('house_call', 'In-person visit at your location', 199.00, 45, 'home'),
  ('video_visit', 'Virtual consultation via video call', 79.00, 20, 'video'),
  ('lab_work', 'On-site lab tests and blood work', 149.00, 30, 'flask')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- CARE REQUESTS & CASES
-- =============================================

-- Symptoms catalog
CREATE TABLE IF NOT EXISTS public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  severity_weight INTEGER DEFAULT 1,
  requires_immediate_care BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common symptoms
INSERT INTO public.symptoms (name, category, severity_weight, requires_immediate_care) VALUES
  ('Headache', 'neurological', 2, FALSE),
  ('Fever', 'general', 3, FALSE),
  ('Chest Pain', 'cardiovascular', 5, TRUE),
  ('Difficulty Breathing', 'respiratory', 5, TRUE),
  ('Nausea', 'gastrointestinal', 2, FALSE),
  ('Dizziness', 'neurological', 3, FALSE),
  ('Back Pain', 'musculoskeletal', 2, FALSE),
  ('Sore Throat', 'respiratory', 1, FALSE),
  ('Cough', 'respiratory', 2, FALSE),
  ('Fatigue', 'general', 2, FALSE),
  ('Abdominal Pain', 'gastrointestinal', 3, FALSE),
  ('Skin Rash', 'dermatological', 2, FALSE)
ON CONFLICT DO NOTHING;

-- Care requests (the main "order" entity)
CREATE TABLE IF NOT EXISTS public.care_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'searching', 'matched', 'en_route', 
    'arrived', 'in_progress', 'completed', 'cancelled'
  )),
  
  -- Location
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- Timing
  scheduled_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Pricing (Good Faith Estimate)
  base_price DECIMAL(10, 2) NOT NULL,
  additional_fees DECIMAL(10, 2) DEFAULT 0,
  donation_amount DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL,
  insurance_coverage DECIMAL(10, 2) DEFAULT 0,
  patient_responsibility DECIMAL(10, 2) NOT NULL,
  
  -- Notes
  patient_notes TEXT,
  provider_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case patients (for multi-patient requests)
CREATE TABLE IF NOT EXISTS public.case_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_request_id UUID NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT DEFAULT 'self',
  date_of_birth DATE,
  gender TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case patient symptoms (many-to-many)
CREATE TABLE IF NOT EXISTS public.case_patient_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_patient_id UUID NOT NULL REFERENCES public.case_patients(id) ON DELETE CASCADE,
  symptom_id UUID REFERENCES public.symptoms(id),
  custom_symptom TEXT,
  severity INTEGER DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  duration TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROVIDER TRACKING & AVAILABILITY
-- =============================================

-- Provider location history (for tracking)
CREATE TABLE IF NOT EXISTS public.provider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  care_request_id UUID REFERENCES public.care_requests(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider availability schedule
CREATE TABLE IF NOT EXISTS public.provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAYMENTS & TRANSACTIONS
-- =============================================

-- Payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank', 'insurance')),
  last_four TEXT,
  brand TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  stripe_payment_method_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_request_id UUID NOT NULL REFERENCES public.care_requests(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'refund', 'payout')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =============================================
-- REVIEWS & RATINGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_request_id UUID NOT NULL REFERENCES public.care_requests(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  provider_id UUID NOT NULL REFERENCES public.providers(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('patient', 'provider', 'admin')),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info',
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_patient_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Patients policies
CREATE POLICY "patients_select_own" ON public.patients FOR SELECT USING (auth.uid() = id);
CREATE POLICY "patients_insert_own" ON public.patients FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "patients_update_own" ON public.patients FOR UPDATE USING (auth.uid() = id);

-- Providers policies (providers can see other providers for matching)
CREATE POLICY "providers_select_all" ON public.providers FOR SELECT USING (TRUE);
CREATE POLICY "providers_insert_own" ON public.providers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "providers_update_own" ON public.providers FOR UPDATE USING (auth.uid() = id);

-- Service types (public read)
CREATE POLICY "service_types_select_all" ON public.service_types FOR SELECT USING (TRUE);

-- Symptoms (public read)
CREATE POLICY "symptoms_select_all" ON public.symptoms FOR SELECT USING (TRUE);

-- Care requests policies
CREATE POLICY "care_requests_patient_select" ON public.care_requests FOR SELECT 
  USING (auth.uid() = patient_id);
CREATE POLICY "care_requests_provider_select" ON public.care_requests FOR SELECT 
  USING (auth.uid() = provider_id);
CREATE POLICY "care_requests_patient_insert" ON public.care_requests FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "care_requests_patient_update" ON public.care_requests FOR UPDATE 
  USING (auth.uid() = patient_id OR auth.uid() = provider_id);

-- Case patients policies
CREATE POLICY "case_patients_select" ON public.case_patients FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.care_requests 
    WHERE id = care_request_id AND (patient_id = auth.uid() OR provider_id = auth.uid())
  ));
CREATE POLICY "case_patients_insert" ON public.case_patients FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.care_requests 
    WHERE id = care_request_id AND patient_id = auth.uid()
  ));

-- Case patient symptoms policies
CREATE POLICY "case_patient_symptoms_select" ON public.case_patient_symptoms FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.case_patients cp
    JOIN public.care_requests cr ON cp.care_request_id = cr.id
    WHERE cp.id = case_patient_id AND (cr.patient_id = auth.uid() OR cr.provider_id = auth.uid())
  ));
CREATE POLICY "case_patient_symptoms_insert" ON public.case_patient_symptoms FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.case_patients cp
    JOIN public.care_requests cr ON cp.care_request_id = cr.id
    WHERE cp.id = case_patient_id AND cr.patient_id = auth.uid()
  ));

-- Provider locations policies
CREATE POLICY "provider_locations_provider_select" ON public.provider_locations FOR SELECT 
  USING (auth.uid() = provider_id OR EXISTS (
    SELECT 1 FROM public.care_requests 
    WHERE id = care_request_id AND patient_id = auth.uid()
  ));
CREATE POLICY "provider_locations_insert" ON public.provider_locations FOR INSERT 
  WITH CHECK (auth.uid() = provider_id);

-- Provider availability policies
CREATE POLICY "provider_availability_select" ON public.provider_availability FOR SELECT USING (TRUE);
CREATE POLICY "provider_availability_insert" ON public.provider_availability FOR INSERT 
  WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "provider_availability_update" ON public.provider_availability FOR UPDATE 
  USING (auth.uid() = provider_id);

-- Payment methods policies
CREATE POLICY "payment_methods_select" ON public.payment_methods FOR SELECT 
  USING (auth.uid() = patient_id);
CREATE POLICY "payment_methods_insert" ON public.payment_methods FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "payment_methods_update" ON public.payment_methods FOR UPDATE 
  USING (auth.uid() = patient_id);
CREATE POLICY "payment_methods_delete" ON public.payment_methods FOR DELETE 
  USING (auth.uid() = patient_id);

-- Transactions policies
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.care_requests 
    WHERE id = care_request_id AND (patient_id = auth.uid() OR provider_id = auth.uid())
  ));

-- Reviews policies
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = patient_id);

-- Notifications policies
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id::uuid);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id::uuid);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_care_requests_updated_at BEFORE UPDATE ON public.care_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_care_requests_patient ON public.care_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_provider ON public.care_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_status ON public.care_requests(status);
CREATE INDEX IF NOT EXISTS idx_provider_locations_provider ON public.provider_locations(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_locations_request ON public.provider_locations(care_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
