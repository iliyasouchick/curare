"use client"

import { useState, useEffect, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Search,
  X,
  ChevronRight,
  Home,
  Clock,
  User,
  Thermometer,
  Pill,
  Heart,
  Phone,
  MessageCircle,
  Plus,
  Check,
  CreditCard,
  Shield,
  Pencil,
  Navigation,
  Car,
  Star,
  Activity,
  Loader2,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PhoneInput } from "@/components/phone-input"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

// Actions
import { sendOTP, verifyOTP, sendMagicLink, handleMagicLinkCallback, getCurrentPatient, signOut } from "@/lib/actions/auth"
import {
  getSymptoms,
  searchSymptoms,
  getServiceTypes,
  createCareRequest,
  getPatientCareRequests,
  getCareRequest,
  cancelCareRequest,
  type CreateCareRequestInput,
} from "@/lib/actions/patient"

// Hooks
import { useCareRequest } from "@/lib/hooks/use-care-request"

// Types
import type { Patient, Symptom as DBSymptom, ServiceType, CareRequest } from "@/lib/types/database"

type View = "launch" | "auth" | "otp" | "email-sent" | "onboarding" | "home" | "search" | "patient" | "case" | "care" | "verify" | "connecting" | "tracking"

interface LocalPatient {
  id: string
  name: string
  age: string
  gender: string
  symptoms: LocalSymptom[]
  isMe: boolean
}

interface LocalSymptom {
  id: string
  name: string
  icon: string
  type: "symptom" | "request"
  severity?: number
  duration?: string
  dbSymptomId?: string
}

const Loading = () => null

function PatientAppContent() {
  const searchParams = useSearchParams()
  
  // View state
  const [currentView, setCurrentView] = useState<View>("launch")
  const [isPending, startTransition] = useTransition()
  
  // Auth state
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [dialCode, setDialCode] = useState("+1")
  const [otpCode, setOtpCode] = useState("")
  const [authError, setAuthError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<Patient | null>(null)
  
  // Data state
  const [dbSymptoms, setDbSymptoms] = useState<DBSymptom[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [activeCareRequest, setActiveCareRequest] = useState<CareRequest | null>(null)
  
  // Form state
  const [patients, setPatients] = useState<LocalPatient[]>([])
  const [currentPatient, setCurrentPatient] = useState<LocalPatient | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSymptom, setSelectedSymptom] = useState<LocalSymptom | null>(null)
  const [isForMe, setIsForMe] = useState(true)
  const [showAttributesSheet, setShowAttributesSheet] = useState(false)
  const [symptomSeverity, setSymptomSeverity] = useState([5])
  const [connectingStep, setConnectingStep] = useState(0)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [donation, setDonation] = useState<number | null>(null)
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null)
  
  // Real-time tracking
  const { careRequest: trackedRequest, providerLocation } = useCareRequest(activeCareRequest?.id || null)

  // Handle magic link callback
  useEffect(() => {
    const authParam = searchParams.get("auth")
    const code = searchParams.get("code")
    
    if (authParam === "callback" || code) {
      startTransition(async () => {
        const result = await handleMagicLinkCallback()
        if (result.success) {
          const patient = await getCurrentPatient()
          setCurrentUser(patient)
          setCurrentView("home")
          // Clean URL
          window.history.replaceState({}, '', '/patient')
        } else {
          setAuthError(result.error || "Authentication failed")
          setCurrentView("auth")
        }
      })
    }
  }, [searchParams])

  // S01: Launch screen auto-transition
  useEffect(() => {
    if (currentView === "launch") {
      const timer = setTimeout(() => {
        // Check if user is already logged in
        startTransition(async () => {
          const patient = await getCurrentPatient()
          if (patient) {
            setCurrentUser(patient)
            setCurrentView("home")
          } else {
            setCurrentView("auth")
          }
        })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [currentView])

  // Load initial data when user is authenticated
  useEffect(() => {
    if (currentUser && currentView === "home") {
      startTransition(async () => {
        const [symptoms, services, requests] = await Promise.all([
          getSymptoms(),
          getServiceTypes(),
          getPatientCareRequests(),
        ])
        setDbSymptoms(symptoms)
        setServiceTypes(services)
        if (services.length > 0) {
          setSelectedServiceType(services[0])
        }
        // Check for active request
        const active = requests.find(r => 
          ['pending', 'searching', 'matched', 'en_route', 'arrived', 'in_progress'].includes(r.status)
        )
        if (active) {
          setActiveCareRequest(active)
          if (['pending', 'searching'].includes(active.status)) {
            setCurrentView("connecting")
          } else {
            setCurrentView("tracking")
          }
        }
      })
    }
  }, [currentUser, currentView])

  // S09: Connecting animation
  useEffect(() => {
    if (currentView === "connecting") {
      const steps = [0, 1, 2, 3]
      let currentIndex = 0
      const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % 4
        setConnectingStep(steps[currentIndex])
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [currentView])

  // Watch for matched status
  useEffect(() => {
    if (trackedRequest?.status === "matched" || trackedRequest?.status === "en_route") {
      setCurrentView("tracking")
    }
  }, [trackedRequest?.status])

  // Convert DB symptoms to local format
  const symptoms: LocalSymptom[] = dbSymptoms.map(s => ({
    id: s.id,
    name: s.name,
    icon: s.category === "cardiovascular" ? "heart" : 
          s.category === "respiratory" ? "thermometer" : 
          s.category === "general" ? "thermometer" : "activity",
    type: "symptom" as const,
    dbSymptomId: s.id,
  }))

  const filteredSymptoms = searchQuery 
    ? symptoms.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : symptoms

  // Auth handlers
  const switchAuthMethod = () => {
    setAuthError(null)
    setAuthMethod(authMethod === "phone" ? "email" : "phone")
  }

  const handleSendOTP = () => {
    setAuthError(null)
    
    if (authMethod === "phone") {
      if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 8) {
        setAuthError("Please enter a valid phone number")
        return
      }
      startTransition(async () => {
        const fullNumber = `${dialCode}${phoneNumber.replace(/\D/g, "")}`
        const result = await sendOTP(fullNumber)
        if (result.error) {
          setAuthError(result.error)
        } else {
          setCurrentView("otp")
        }
      })
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !emailRegex.test(email)) {
        setAuthError("Please enter a valid email address")
        return
      }
      startTransition(async () => {
        const result = await sendMagicLink(email)
        if (result.error) {
          setAuthError(result.error)
        } else {
          setCurrentView("email-sent")
        }
      })
    }
  }

  const handleVerifyOTP = () => {
    if (!otpCode || otpCode.length < 6) {
      setAuthError("Please enter the 6-digit code")
      return
    }
    setAuthError(null)
    
    if (authMethod === "phone") {
      startTransition(async () => {
        const fullNumber = `${dialCode}${phoneNumber.replace(/\D/g, "")}`
        const result = await verifyOTP(fullNumber, otpCode)
        if (result.error) {
          setAuthError(result.error)
        } else {
          const patient = await getCurrentPatient()
          setCurrentUser(patient)
          setCurrentView("home")
        }
      })
    } else {
      startTransition(async () => {
        const result = await verifyEmailOTP(email, otpCode)
        if (result.error) {
          setAuthError(result.error)
        } else {
          const patient = await getCurrentPatient()
          setCurrentUser(patient)
          setCurrentView("home")
        }
      })
    }
  }

  // For demo purposes - skip auth
  const handleDemoLogin = () => {
    setCurrentUser({
      id: "demo-user",
      phone: "+15551234567",
      first_name: "John",
      last_name: "Doe",
      date_of_birth: "1992-05-15",
      gender: "Male",
      avatar_url: null,
      address_line1: "123 Main Street",
      address_line2: null,
      city: "San Francisco",
      state: "CA",
      zip_code: "94102",
      latitude: 37.7749,
      longitude: -122.4194,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      insurance_provider: "Blue Cross",
      insurance_member_id: "BC12345",
      insurance_group_number: "GRP001",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Patient)
    setCurrentView("home")
  }

  const handleSelectSymptom = (symptom: LocalSymptom) => {
    setSelectedSymptom(symptom)
    const userName = currentUser ? `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "You" : "You"
    if (!currentPatient) {
      setCurrentPatient({
        id: Date.now().toString(),
        name: isForMe ? userName : "",
        age: isForMe ? "32" : "",
        gender: isForMe ? (currentUser?.gender || "Male") : "",
        symptoms: [symptom],
        isMe: isForMe,
      })
    } else {
      setCurrentPatient({
        ...currentPatient,
        symptoms: [...currentPatient.symptoms, symptom],
      })
    }
    setCurrentView("patient")
  }

  const handleSavePatient = () => {
    if (currentPatient) {
      setPatients([...patients, currentPatient])
      setCurrentPatient(null)
      setSelectedSymptom(null)
      setCurrentView("case")
    }
  }

  const handleAddPatient = () => {
    setIsForMe(false)
    setCurrentPatient(null)
    setSelectedSymptom(null)
    setCurrentView("search")
  }

  const handleSubmitRequest = async () => {
    if (!selectedServiceType || patients.length === 0 || !currentUser) return
    
    const input: CreateCareRequestInput = {
      service_type_id: selectedServiceType.id,
      address_line1: currentUser.address_line1 || "123 Main Street",
      city: currentUser.city || "San Francisco",
      state: currentUser.state || "CA",
      zip_code: currentUser.zip_code || "94102",
      latitude: currentUser.latitude || 37.7749,
      longitude: currentUser.longitude || -122.4194,
      donation_amount: donation || 0,
      case_patients: patients.map(p => ({
        name: p.name,
        relationship: p.isMe ? "self" : "other",
        gender: p.gender,
        symptoms: p.symptoms.map(s => ({
          symptom_id: s.dbSymptomId,
          custom_symptom: s.dbSymptomId ? undefined : s.name,
          severity: s.severity || 5,
          duration: s.duration,
        })),
      })),
    }
    
    startTransition(async () => {
      const result = await createCareRequest(input)
      if (result.success && result.careRequestId) {
        const request = await getCareRequest(result.careRequestId)
        setActiveCareRequest(request)
        setCurrentView("connecting")
      }
    })
  }

  const handleCancelRequest = async () => {
    if (!activeCareRequest) return
    startTransition(async () => {
      await cancelCareRequest(activeCareRequest.id, "Cancelled by patient")
      setActiveCareRequest(null)
      setPatients([])
      setCurrentView("home")
    })
  }

  const renderSymptomIcon = (icon: string) => {
    switch (icon) {
      case "thermometer":
        return <Thermometer className="h-5 w-5" />
      case "pill":
        return <Pill className="h-5 w-5" />
      case "heart":
        return <Heart className="h-5 w-5" />
      default:
        return <Activity className="h-5 w-5" />
    }
  }

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  }

  const userName = currentUser ? `${currentUser.first_name || ""}`.trim() || "there" : "there"

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-background rounded-[40px] shadow-2xl overflow-hidden relative border-[8px] border-foreground/10">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-foreground/90 rounded-b-2xl z-50" />

        <AnimatePresence mode="wait" initial={false}>
          {/* S01: Launch Presentation */}
          {currentView === "launch" && (
            <motion.div
              key="launch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center bg-primary"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary-foreground/40 flex items-center justify-center">
                    <Heart className="h-10 w-10 text-primary-foreground" fill="currentColor" />
                  </div>
                </div>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 text-3xl font-bold text-primary-foreground tracking-tight"
              >
                Curare
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2 text-primary-foreground/80 text-sm"
              >
                Urgent Care, On Demand
              </motion.p>
            </motion.div>
          )}

          {/* S02: Auth - Phone Entry */}
          {currentView === "auth" && (
            <motion.div
              key="auth"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-16 px-6 pb-8"
            >
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Curare</h1>
                </div>

<h2 className="text-xl font-semibold text-foreground mb-2">Welcome</h2>
                <p className="text-muted-foreground mb-8">
                  {authMethod === "phone" 
                    ? "Enter your phone number to get started" 
                    : "Enter your email to get started"}
                </p>
                
                {authError && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {authError}
                  </div>
                )}
                
                <div className="space-y-4">
                  {authMethod === "phone" ? (
                    <PhoneInput
                      value={phoneNumber}
                      onChange={(full, dial, local) => {
                        setDialCode(dial)
                        setPhoneNumber(local)
                      }}
                      placeholder="000 000 0000"
                      defaultCountry="US"
                    />
                  ) : (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="h-12 pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                  )}
                  
                  <Button
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={handleSendOTP}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Code"}
                  </Button>
                  
                  <button
                    type="button"
                    onClick={switchAuthMethod}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {authMethod === "phone" 
                      ? "No phone? Use email instead" 
                      : "Use phone number instead"}
                  </button>
                  
                  {/* Demo login for testing */}
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-transparent"
                    onClick={handleDemoLogin}
                  >
                    Continue as Demo User
                  </Button>
                </div>

                <p className="mt-6 text-xs text-center text-muted-foreground">
                  By continuing, you agree to our{" "}
                  <span className="text-primary">Terms of Service</span> and{" "}
                  <span className="text-primary">Privacy Policy</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* OTP Verification */}
          {currentView === "otp" && (
            <motion.div
              key="otp"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-16 px-6 pb-8"
            >
              <div className="flex-1 flex flex-col justify-center">
                <button
                  onClick={() => setCurrentView("auth")}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-6"
                >
                  <X className="h-5 w-5" />
                </button>

<h2 className="text-xl font-semibold text-foreground mb-2">
                  {authMethod === "phone" ? "Verify your number" : "Check your email"}
                </h2>
                <p className="text-muted-foreground mb-8">
                  Enter the 6-digit code sent to{" "}
                  {authMethod === "phone" ? `${dialCode} ${phoneNumber}` : email}
                </p>

                {authError && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {authError}
                  </div>
                )}

                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="000000"
                    className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={handleVerifyOTP}
                    disabled={isPending || otpCode.length < 6}
                  >
                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
                  </Button>
                </div>

                <button className="mt-6 text-sm text-center text-primary">
                  Resend code
                </button>
</div>
                </motion.div>
              )}

              {/* Email Sent - Magic Link */}
              {currentView === "email-sent" && (
                <motion.div
                  key="email-sent"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="h-full flex flex-col items-center justify-center px-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
                  >
                    <Mail className="h-10 w-10 text-primary" />
                  </motion.div>

                  <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Check your email</h2>
                  <p className="text-muted-foreground text-center mb-2 max-w-[280px]">
                    We sent a magic link to
                  </p>
                  <p className="text-foreground font-medium text-center mb-8">
                    {email}
                  </p>

                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px]">
                    Click the link in the email to sign in. You can close this page.
                  </p>

                  <Button
                    variant="outline"
                    className="w-full max-w-[280px] h-12 bg-transparent"
                    onClick={() => {
                      setEmail("")
                      setCurrentView("auth")
                    }}
                  >
                    Use a different email
                  </Button>
                </motion.div>
              )}

              {/* S03: Homescreen */}
              {currentView === "home" && (
            <motion.div
              key="home"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {currentUser?.address_line1 || "123 Main Street"}
                    </span>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src={currentUser?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {currentUser?.first_name?.[0] || "U"}{currentUser?.last_name?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-1">Hi, {userName}</h2>
                <p className="text-muted-foreground">How can we help you today?</p>
              </div>

              {/* Search Bar */}
              <div className="px-5 mb-6">
                <button
                  onClick={() => {
                    setIsForMe(true)
                    setCurrentView("search")
                  }}
                  className="w-full h-14 px-4 rounded-2xl bg-card border border-input flex items-center gap-3 text-left hover:border-primary/50 transition-colors shadow-sm"
                >
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">I need urgent care for...</span>
                </button>
              </div>

              {/* Panic Button */}
              <div className="flex-1 flex flex-col items-center justify-center px-5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setIsForMe(true)
                    const urgentSymptom: LocalSymptom = { 
                      id: "urgent", 
                      name: "Urgent Care Needed", 
                      icon: "heart", 
                      type: "symptom" 
                    }
                    const newPatient: LocalPatient = {
                      id: Date.now().toString(),
                      name: `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() || "You",
                      age: "32",
                      gender: currentUser?.gender || "Male",
                      symptoms: [urgentSymptom],
                      isMe: true,
                    }
                    setCurrentPatient(newPatient)
                    setPatients([newPatient])
                    setCurrentView("care")
                  }}
                  className="w-48 h-48 rounded-full bg-urgent flex flex-col items-center justify-center shadow-lg shadow-urgent/30 hover:shadow-xl hover:shadow-urgent/40 transition-all"
                >
                  <Heart className="h-12 w-12 text-urgent-foreground mb-2" />
                  <span className="text-urgent-foreground font-bold text-lg">Request</span>
                  <span className="text-urgent-foreground font-bold text-lg">Immediate Care</span>
                </motion.button>
                <p className="mt-6 text-sm text-muted-foreground text-center max-w-[200px]">
                  A doctor will arrive at your location within 30-60 minutes
                </p>
              </div>

              {/* Bottom Navigation */}
              <div className="h-20 border-t border-border bg-card flex items-center justify-around px-6 pb-2">
                <button className="flex flex-col items-center gap-1 text-primary">
                  <Home className="h-6 w-6" />
                  <span className="text-xs font-medium">Home</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Clock className="h-6 w-6" />
                  <span className="text-xs font-medium">Activity</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-muted-foreground">
                  <User className="h-6 w-6" />
                  <span className="text-xs font-medium">Profile</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* S04: Search & Triage */}
          {currentView === "search" && (
            <motion.div
              key="search"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Search Header */}
              <div className="px-5 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Describe your symptoms..."
                      className="h-12 pl-12 pr-10 rounded-xl"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentView("home")}
                    className="text-primary font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Common Symptoms & Services
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {filteredSymptoms.map((symptom) => (
                    <button
                      key={symptom.id}
                      onClick={() => handleSelectSymptom(symptom)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          symptom.type === "symptom"
                            ? "bg-urgent/10 text-urgent"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {renderSymptomIcon(symptom.icon)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-foreground">{symptom.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {symptom.type === "symptom" ? "Symptom" : "Service Request"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* S05: Patient Assembly */}
          {currentView === "patient" && (
            <motion.div
              key="patient"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentView("search")}
                    className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">Patient Details</h2>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Add More Symptoms */}
                <button
                  onClick={() => setCurrentView("search")}
                  className="w-full h-12 px-4 rounded-xl bg-muted/50 border border-dashed border-border flex items-center gap-3 text-left hover:border-primary/50 transition-colors mb-4"
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Add more symptoms...</span>
                </button>

                {/* Patient Identity Card */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-foreground">Patient Information</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">This is for me</span>
                        <Switch
                          checked={isForMe}
                          onCheckedChange={(checked) => {
                            setIsForMe(checked)
                            if (currentPatient) {
                              setCurrentPatient({ ...currentPatient, isMe: checked })
                            }
                          }}
                        />
                      </div>
                    </div>

                    {isForMe ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {currentUser?.first_name?.[0] || "U"}{currentUser?.last_name?.[0] || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {currentUser?.first_name || ""} {currentUser?.last_name || ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {currentUser?.gender || "Not specified"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input 
                          placeholder="Full Name" 
                          className="h-11"
                          value={currentPatient?.name || ""}
                          onChange={(e) => currentPatient && setCurrentPatient({
                            ...currentPatient,
                            name: e.target.value
                          })}
                        />
                        <div className="flex gap-3">
                          <Input 
                            placeholder="Age" 
                            className="h-11 w-24" 
                            type="number"
                            value={currentPatient?.age || ""}
                            onChange={(e) => currentPatient && setCurrentPatient({
                              ...currentPatient,
                              age: e.target.value
                            })}
                          />
                          <Input 
                            placeholder="Gender" 
                            className="h-11 flex-1"
                            value={currentPatient?.gender || ""}
                            onChange={(e) => currentPatient && setCurrentPatient({
                              ...currentPatient,
                              gender: e.target.value
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Symptoms Panel */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Selected Symptoms</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentPatient?.symptoms.map((symptom) => (
                        <button
                          key={symptom.id}
                          onClick={() => {
                            setSelectedSymptom(symptom)
                            setShowAttributesSheet(true)
                          }}
                          className="h-10 px-4 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-2 hover:bg-primary/20 transition-colors"
                        >
                          {renderSymptomIcon(symptom.icon)}
                          <span>{symptom.name}</span>
                          {symptom.severity && (
                            <span className="ml-1 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {symptom.severity}/10
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card">
                <Button
                  onClick={handleSavePatient}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  Save Patient
                </Button>
              </div>

              {/* Attributes Bottom Sheet */}
              <AnimatePresence>
                {showAttributesSheet && selectedSymptom && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-foreground/50 z-40"
                    onClick={() => setShowAttributesSheet(false)}
                  >
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6"
                    >
                      <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-6" />
                      <h3 className="text-lg font-semibold text-foreground mb-6">
                        {selectedSymptom.name} Details
                      </h3>

                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-3 block">
                            Severity (1-10)
                          </label>
                          <Slider
                            value={symptomSeverity}
                            onValueChange={setSymptomSeverity}
                            min={1}
                            max={10}
                            step={1}
                            className="w-full"
                          />
                          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                            <span>Mild</span>
                            <span className="font-semibold text-primary">{symptomSeverity[0]}</span>
                            <span>Severe</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-foreground mb-3 block">
                            Duration
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["Just started", "Few hours", "1-2 days", "3+ days"].map((duration) => (
                              <button
                                key={duration}
                                className="h-9 px-4 rounded-full border border-border text-sm font-medium hover:border-primary hover:text-primary transition-colors"
                              >
                                {duration}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          if (currentPatient && selectedSymptom) {
                            const updatedSymptoms = currentPatient.symptoms.map((s) =>
                              s.id === selectedSymptom.id
                                ? { ...s, severity: symptomSeverity[0] }
                                : s
                            )
                            setCurrentPatient({ ...currentPatient, symptoms: updatedSymptoms })
                          }
                          setShowAttributesSheet(false)
                        }}
                        className="w-full h-12 mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      >
                        Save Details
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* S06: Case Assembly */}
          {currentView === "case" && (
            <motion.div
              key="case"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentView("home")}
                    className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">Care Request</h2>
                    <p className="text-sm text-muted-foreground">{patients.length} patient(s)</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Patient Cards */}
                <div className="space-y-3 mb-4">
                  {patients.map((patient) => (
                    <Card key={patient.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {patient.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{patient.name}</p>
                              {patient.isMe && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {patient.age} years old, {patient.gender}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {patient.symptoms.map((symptom) => (
                                <span
                                  key={symptom.id}
                                  className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground"
                                >
                                  {symptom.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Add Patient Button */}
                <button
                  onClick={handleAddPatient}
                  className="w-full h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="font-medium">Add Another Patient</span>
                </button>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card">
                <Button
                  onClick={() => setCurrentView("care")}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  Continue to Care Selection
                </Button>
              </div>
            </motion.div>
          )}

          {/* S07: Select Care */}
          {currentView === "care" && (
            <motion.div
              key="care"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              {/* Map Background */}
              <div className="h-[45%] bg-gradient-to-b from-primary/5 to-primary/10 relative">
                <div className="absolute top-16 left-5">
                  <button
                    onClick={() => setCurrentView("case")}
                    className="h-10 w-10 rounded-full bg-card shadow-lg flex items-center justify-center"
                  >
                    <X className="h-5 w-5 text-foreground" />
                  </button>
                </div>

                {/* Map Pin */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      <MapPin className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45" />
                  </div>
                </div>

                {/* Provider Icons */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute top-1/3 left-1/4 w-8 h-8 rounded-full bg-card shadow-md flex items-center justify-center"
                >
                  <Car className="h-4 w-4 text-primary" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
                  className="absolute top-2/3 right-1/4 w-8 h-8 rounded-full bg-card shadow-md flex items-center justify-center"
                >
                  <Car className="h-4 w-4 text-primary" />
                </motion.div>
              </div>

              {/* Bottom Sheet */}
              <div className="flex-1 bg-card rounded-t-3xl -mt-6 relative z-10 flex flex-col">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-4" />

                <div className="flex-1 overflow-y-auto px-5">
                  {/* Service Selector */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Select Service</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {serviceTypes.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => setSelectedServiceType(service)}
                          className={`flex-shrink-0 w-28 p-3 rounded-xl border-2 ${
                            selectedServiceType?.id === service.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          } transition-colors`}
                        >
                          {service.name === "house_call" && <Home className={`h-6 w-6 mb-2 ${selectedServiceType?.id === service.id ? "text-primary" : "text-muted-foreground"}`} />}
                          {service.name === "video_visit" && <Phone className={`h-6 w-6 mb-2 ${selectedServiceType?.id === service.id ? "text-primary" : "text-muted-foreground"}`} />}
                          {service.name === "lab_work" && <Activity className={`h-6 w-6 mb-2 ${selectedServiceType?.id === service.id ? "text-primary" : "text-muted-foreground"}`} />}
                          <p className="text-sm font-medium text-foreground capitalize">
                            {service.name.replace("_", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">${service.base_price}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment & Insurance */}
                  <div className="space-y-2">
                    <button className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:border-primary/50 transition-colors">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">Payment Method</p>
                        <p className="text-xs text-muted-foreground">Visa 4242</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>

                    <button className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:border-primary/50 transition-colors">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">Insurance</p>
                        <p className="text-xs text-success">
                          {currentUser?.insurance_provider 
                            ? `Verified - ${currentUser.insurance_provider}`
                            : "Add insurance"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-border">
                  <Button
                    onClick={() => setCurrentView("verify")}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  >
                    Select Care
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* S08: Verification & GFE */}
          {currentView === "verify" && (
            <motion.div
              key="verify"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentView("care")}
                    className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">Confirm Request</h2>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Good Faith Estimate */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-1">Good Faith Estimate</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Required by the No Surprises Act
                    </p>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {selectedServiceType?.name.replace("_", " ") || "Service"}
                        </span>
                        <span className="text-foreground font-medium">
                          ${selectedServiceType?.base_price || 0}
                        </span>
                      </div>
                      {patients.length > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Additional patients ({patients.length - 1})
                          </span>
                          <span className="text-foreground font-medium">
                            ${(patients.length - 1) * 50}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform fee</span>
                        <span className="text-foreground font-medium">$0.00</span>
                      </div>
                      {donation && donation > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Care Fund donation</span>
                          <span className="text-foreground font-medium">${donation}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-3 flex justify-between">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-bold text-foreground text-lg">
                          ${(selectedServiceType?.base_price || 0) + ((patients.length - 1) * 50) + (donation || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Donation */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-1">Curare Care Fund</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Help provide care for those in need
                    </p>
                    <div className="flex gap-2">
                      {[0, 5, 10, 20].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setDonation(amount || null)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            donation === amount || (amount === 0 && !donation)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {amount === 0 ? "None" : `$${amount}`}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Terms */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                    I understand this is an estimate and final charges may vary. I agree to the{" "}
                    <span className="text-primary">Terms of Service</span> and{" "}
                    <span className="text-primary">Consent to Treatment</span>.
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card">
                <Button
                  onClick={handleSubmitRequest}
                  disabled={!acceptTerms || isPending}
                  className="w-full h-12 bg-urgent hover:bg-urgent/90 text-urgent-foreground font-semibold disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Request Care Now"
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* S09: Connecting */}
          {currentView === "connecting" && (
            <motion.div
              key="connecting"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary/5 to-background"
            >
              {/* Cancel Button */}
              <button
                onClick={handleCancelRequest}
                className="absolute top-16 right-5 h-10 w-10 rounded-full bg-card shadow-lg flex items-center justify-center"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>

              {/* Radar Animation */}
              <div className="relative mb-8">
                <motion.div
                  animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute inset-0 rounded-full bg-primary/30"
                />
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
                  className="absolute inset-0 rounded-full bg-primary/30"
                />
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center relative z-10">
                  <Search className="h-10 w-10 text-primary-foreground" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-foreground mb-2 text-center">
                Finding Your Provider
              </h2>
              <p className="text-muted-foreground text-center mb-8 max-w-[280px]">
                We&apos;re connecting you with the best available provider nearby
              </p>

              {/* Progress Steps */}
              <div className="w-full max-w-[280px] mb-8">
                <div className="flex gap-2 mb-3">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`flex-1 h-1.5 rounded-full transition-colors ${
                        step <= connectingStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {connectingStep === 0 && "Submitting request..."}
                  {connectingStep === 1 && "Searching nearby providers..."}
                  {connectingStep === 2 && "Matching with provider..."}
                  {connectingStep === 3 && "Almost there..."}
                </p>
              </div>

              {/* Tips */}
              <Card className="w-full">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-2">While you wait</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Gather any relevant medical records
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Prepare a list of current medications
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      Ensure easy access to your location
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* S10: Tracking */}
          {currentView === "tracking" && (trackedRequest || activeCareRequest) && (
            <motion.div
              key="tracking"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col"
            >
              {/* Map */}
              <div className="h-[55%] bg-gradient-to-b from-primary/5 to-primary/10 relative">
                {/* Your Location */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 rounded-full bg-primary border-4 border-card shadow-lg" />
                </div>

                {/* Provider */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  className="absolute top-1/3 left-1/3 w-10 h-10 rounded-full bg-card shadow-lg flex items-center justify-center"
                >
                  <Car className="h-5 w-5 text-primary" />
                </motion.div>

                {/* ETA Badge */}
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-card rounded-full px-4 py-2 shadow-lg">
                  <p className="text-sm font-semibold text-foreground">
                    {(trackedRequest || activeCareRequest)?.status === "arrived" 
                      ? "Arrived" 
                      : "12 min away"}
                  </p>
                </div>
              </div>

              {/* Bottom Sheet */}
              <div className="flex-1 bg-card rounded-t-3xl -mt-6 relative z-10 flex flex-col">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-4" />

                <div className="flex-1 overflow-y-auto px-5">
                  {/* Status */}
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <p className="text-lg font-semibold text-foreground capitalize">
                      {(trackedRequest || activeCareRequest)?.status === "en_route" && "Provider is on the way"}
                      {(trackedRequest || activeCareRequest)?.status === "arrived" && "Provider has arrived"}
                      {(trackedRequest || activeCareRequest)?.status === "in_progress" && "Visit in progress"}
                      {(trackedRequest || activeCareRequest)?.status === "matched" && "Provider assigned"}
                    </p>
                  </div>

                  {/* Provider Card */}
                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={(trackedRequest || activeCareRequest)?.provider?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            DR
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            Dr. {(trackedRequest || activeCareRequest)?.provider?.first_name || "Provider"}{" "}
                            {(trackedRequest || activeCareRequest)?.provider?.last_name || ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(trackedRequest || activeCareRequest)?.provider?.specialty || "General Practice"}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-medium">
                              {(trackedRequest || activeCareRequest)?.provider?.rating || "5.0"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Buttons */}
                      <div className="flex gap-3 mt-4">
                        <Button variant="outline" className="flex-1 h-11 bg-transparent">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button variant="outline" className="flex-1 h-11 bg-transparent">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Visit Details */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-3">Visit Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {(trackedRequest || activeCareRequest)?.address_line1 || currentUser?.address_line1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {(trackedRequest || activeCareRequest)?.service_type?.name.replace("_", " ") || "House Call"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Cancel Button */}
                <div className="p-5 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handleCancelRequest}
                    className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                  >
                    Cancel Request
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function CurareApp() {
  return (
    <Suspense fallback={<Loading />}>
      <PatientAppContent />
    </Suspense>
  )
}
