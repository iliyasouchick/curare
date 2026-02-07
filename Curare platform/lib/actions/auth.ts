"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import { headers } from "next/headers"

function getBaseUrl() {
  const headersList = headers()
  const host = headersList.get("host") || ""
  const protocol = host.includes("localhost") ? "http" : "https"
  return `${protocol}://${host}`
}

// Patient Auth (Email Magic Link)
export async function sendMagicLink(email: string) {
  const supabase = await createClient()
  const baseUrl = getBaseUrl()
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${baseUrl}/patient?auth=callback`,
    }
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

// Handle magic link callback and create patient profile
export async function handleMagicLinkCallback() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { error: 'Authentication failed' }
  }
  
  // Create patient profile if doesn't exist
  const { error: profileError } = await supabase
    .from('patients')
    .upsert({
      id: user.id,
      email: user.email,
    }, { onConflict: 'id' })
  
  if (profileError) {
    console.error('Failed to create patient profile:', profileError)
  }
  
  revalidateTag('user', 'max')
  return { success: true, user }
}

// Legacy Phone Auth (requires Twilio configuration)
export async function sendOTP(phone: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'sms',
    }
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

export async function verifyOTP(phone: string, token: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms'
  })
  
  if (error) {
    return { error: error.message }
  }
  
  // Create patient profile if doesn't exist
  if (data.user) {
    const { error: profileError } = await supabase
      .from('patients')
      .upsert({
        id: data.user.id,
        phone,
      }, { onConflict: 'id' })
    
    if (profileError) {
      console.error('Failed to create patient profile:', profileError)
    }
  }
  
  revalidateTag('user', 'max')
  return { success: true, user: data.user }
}

// Provider Auth (Email-based)
export async function providerSignIn(email: string, password: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  // Verify this user is a provider
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select('id')
    .eq('id', data.user.id)
    .single()
  
  if (providerError || !provider) {
    await supabase.auth.signOut()
    return { error: 'This account is not registered as a provider' }
  }
  
  revalidateTag('user', 'max')
  return { success: true, user: data.user }
}

export async function providerSignUp(
  email: string, 
  password: string, 
  firstName: string,
  lastName: string,
  phone: string,
  licenseNumber: string,
  licenseState: string,
  specialty: string = "General Medicine"
) {
  const supabase = await createClient()
  
  const baseUrl = getBaseUrl()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${baseUrl}/doctor`,
      data: {
        user_type: 'provider',
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        license_number: licenseNumber,
        license_state: licenseState,
        specialty: specialty,
      }
    }
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true, user: data.user }
}

// Admin Auth (Email-based)
export async function adminSignIn(email: string, password: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    return { error: error.message }
  }
  
  // Verify this user is an admin
  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('id, role')
    .eq('id', data.user.id)
    .single()
  
  if (adminError || !admin) {
    await supabase.auth.signOut()
    return { error: 'This account does not have admin access' }
  }
  
  revalidateTag('user', 'max')
  return { success: true, user: data.user, role: admin.role }
}

// Resend confirmation email
export async function resendConfirmationEmail(email: string) {
  const supabase = await createClient()
  const baseUrl = getBaseUrl()
  
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${baseUrl}/doctor`,
    }
  })
  
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

// Shared
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidateTag('user', 'max')
  return { success: true }
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  return user
}

export async function getCurrentPatient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return patient
}

export async function getCurrentProvider() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return provider
}

export async function getCurrentAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return admin
}
