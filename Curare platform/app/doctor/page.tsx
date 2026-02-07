"use client"

import { useState, useEffect, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Navigation,
  Clock,
  User,
  DollarSign,
  Phone,
  MessageCircle,
  Check,
  X,
  ChevronRight,
  Home,
  Calendar,
  Settings,
  Heart,
  Activity,
  Stethoscope,
  Car,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Loader2,
  LogOut,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/phone-input"
import Link from "next/link"

// Actions
import { providerSignIn, providerSignUp, resendConfirmationEmail, getCurrentProvider, signOut } from "@/lib/actions/auth"
import {
  setProviderAvailability,
  updateProviderLocation,
  acceptCareRequest,
  declineCareRequest,
  startEnRoute,
  markArrived,
  startVisit,
  completeVisit,
  getProviderDashboardStats,
} from "@/lib/actions/provider"

// Hooks
import { useAvailableRequests, useActiveRequest } from "@/lib/hooks/use-care-request"

// Types
import type { Provider, CareRequest, ProviderDashboardStats } from "@/lib/types/database"

type DoctorView = "launch" | "login" | "signup" | "signup-success" | "home" | "request-detail" | "navigation" | "visit" | "summary"

export default function DoctorApp() {
  const [currentView, setCurrentView] = useState<DoctorView>("launch")
  const [isPending, startTransition] = useTransition()
  
  // Auth state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState<string | null>(null)
  const [currentProvider, setCurrentProvider] = useState<Provider | null>(null)
  
  // Signup form state
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    dialCode: "+1",
    licenseNumber: "",
    specialty: "House Call",
  })
  const [resendSuccess, setResendSuccess] = useState(false)
  
  // Dashboard state
  const [isOnline, setIsOnline] = useState(false)
  const [stats, setStats] = useState<ProviderDashboardStats>({
    todayEarnings: 0,
    todayVisits: 0,
    rating: 5.0,
    availableRequests: 0,
  })
  const [selectedRequest, setSelectedRequest] = useState<CareRequest | null>(null)
  const [visitNotes, setVisitNotes] = useState("")
  const [navigationProgress, setNavigationProgress] = useState(0)

  // Real-time data
  const { requests: availableRequests, loading: requestsLoading, removeRequest } = useAvailableRequests()
  const { activeRequest, loading: activeLoading } = useActiveRequest()

  // Launch auto-transition
  useEffect(() => {
    if (currentView === "launch") {
      const timer = setTimeout(() => {
        startTransition(async () => {
          const provider = await getCurrentProvider()
          if (provider) {
            setCurrentProvider(provider)
            setIsOnline(provider.is_available)
            setCurrentView("home")
          } else {
            setCurrentView("login")
          }
        })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [currentView])

  // Load dashboard stats
  useEffect(() => {
    if (currentProvider && currentView === "home") {
      startTransition(async () => {
        const dashboardStats = await getProviderDashboardStats()
        setStats(dashboardStats)
      })
    }
  }, [currentProvider, currentView])

  // Check for active request on load
  useEffect(() => {
    if (activeRequest && !selectedRequest) {
      setSelectedRequest(activeRequest)
      if (activeRequest.status === "matched") {
        setCurrentView("navigation")
      } else if (activeRequest.status === "en_route") {
        setCurrentView("navigation")
      } else if (["arrived", "in_progress"].includes(activeRequest.status)) {
        setCurrentView("visit")
      }
    }
  }, [activeRequest, selectedRequest])

  // Navigation simulation
  useEffect(() => {
    if (currentView === "navigation" && navigationProgress < 100) {
      const interval = setInterval(() => {
        setNavigationProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 2
        })
      }, 200)
      return () => clearInterval(interval)
    }
  }, [currentView, navigationProgress])

  // Auth handlers
  const handleLogin = () => {
    if (!email || !password) {
      setAuthError("Please enter email and password")
      return
    }
    setAuthError(null)
    startTransition(async () => {
      const result = await providerSignIn(email, password)
      if (result.error) {
        setAuthError(result.error)
      } else {
        const provider = await getCurrentProvider()
        setCurrentProvider(provider)
        setIsOnline(provider?.is_available || false)
        setCurrentView("home")
      }
    })
  }

  // Signup handler
  const handleSignup = () => {
    if (!signupData.email || !signupData.password || !signupData.firstName || !signupData.lastName) {
      setAuthError("Please fill in all required fields")
      return
    }
    if (signupData.password.length < 6) {
      setAuthError("Password must be at least 6 characters")
      return
    }
    setAuthError(null)
    startTransition(async () => {
      const fullPhone = `${signupData.dialCode}${signupData.phone.replace(/\D/g, "")}`
      const result = await providerSignUp(
        signupData.email,
        signupData.password,
        signupData.firstName,
        signupData.lastName,
        fullPhone,
        signupData.licenseNumber,
        "",
        signupData.specialty
      )
      if (result.error) {
        setAuthError(result.error)
      } else {
        setCurrentView("signup-success")
      }
    })
  }

  // Resend confirmation email
  const handleResendEmail = () => {
    if (!signupData.email) return
    setResendSuccess(false)
    startTransition(async () => {
      const result = await resendConfirmationEmail(signupData.email)
      if (result.success) {
        setResendSuccess(true)
      } else {
        setAuthError(result.error || "Failed to resend email")
      }
    })
  }

  // Demo login
  const handleDemoLogin = () => {
    setCurrentProvider({
      id: "demo-provider",
      phone: "+15559876543",
      first_name: "Sarah",
      last_name: "Chen",
      avatar_url: null,
      license_number: "MD12345",
      license_state: "CA",
      specialty: "Family Medicine",
      years_experience: 8,
      bio: "Board-certified family medicine physician",
      rating: 4.9,
      total_reviews: 234,
      hourly_rate: 175,
      is_available: true,
      current_latitude: 37.7749,
      current_longitude: -122.4194,
      service_radius_miles: 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Provider)
    setIsOnline(true)
    setStats({
      todayEarnings: 847,
      todayVisits: 5,
      rating: 4.9,
      availableRequests: availableRequests.length,
    })
    setCurrentView("home")
  }

  const handleToggleOnline = async (online: boolean) => {
    setIsOnline(online)
    startTransition(async () => {
      await setProviderAvailability(online)
    })
  }

  const handleAcceptRequest = async (request: CareRequest) => {
    startTransition(async () => {
      const result = await acceptCareRequest(request.id)
      if (result.success) {
        setSelectedRequest(request)
        removeRequest(request.id)
        setNavigationProgress(0)
        
        // Start en route
        await startEnRoute(request.id)
        setCurrentView("navigation")
      }
    })
  }

  const handleDeclineRequest = async (requestId: string) => {
    await declineCareRequest(requestId)
    removeRequest(requestId)
  }

  const handleArrived = async () => {
    if (!selectedRequest) return
    startTransition(async () => {
      await markArrived(selectedRequest.id)
      await startVisit(selectedRequest.id)
      setCurrentView("visit")
    })
  }

  const handleCompleteVisit = async () => {
    if (!selectedRequest) return
    startTransition(async () => {
      await completeVisit(selectedRequest.id, visitNotes)
      setCurrentView("summary")
    })
  }

  const handleFinish = () => {
    setSelectedRequest(null)
    setVisitNotes("")
    setNavigationProgress(0)
    setCurrentView("home")
    // Refresh stats
    startTransition(async () => {
      const dashboardStats = await getProviderDashboardStats()
      setStats(dashboardStats)
    })
  }

  const handleLogout = () => {
    startTransition(async () => {
      await signOut()
      setCurrentProvider(null)
      setEmail("")
      setPassword("")
      setCurrentView("login")
    })
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "bg-urgent text-urgent-foreground"
      case "medium":
        return "bg-amber-500 text-white"
      default:
        return "bg-success text-success-foreground"
    }
  }

  // Calculate urgency from symptoms
  const getRequestUrgency = (request: CareRequest): "low" | "medium" | "high" => {
    const hasUrgent = request.case_patients?.some(p => 
      p.symptoms?.some(s => s.symptom?.requires_immediate_care)
    )
    if (hasUrgent) return "high"
    const avgSeverity = request.case_patients?.reduce((sum, p) => {
      const patientAvg = p.symptoms?.reduce((s, sym) => s + (sym.severity || 3), 0) || 0
      return sum + patientAvg / (p.symptoms?.length || 1)
    }, 0) || 0
    if (avgSeverity > 7) return "high"
    if (avgSeverity > 4) return "medium"
    return "low"
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-[390px] h-[844px] bg-background rounded-[40px] shadow-2xl overflow-hidden relative border-[8px] border-foreground/10">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-foreground/90 rounded-b-2xl z-50" />

        <AnimatePresence mode="wait">
          {/* Launch Screen */}
          {currentView === "launch" && (
            <motion.div
              key="launch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center bg-primary"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary-foreground/40 flex items-center justify-center">
                    <Stethoscope className="h-10 w-10 text-primary-foreground" />
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
                Provider Portal
              </motion.p>
            </motion.div>
          )}

          {/* Login Screen */}
          {currentView === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-16 px-6 pb-8"
            >
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Stethoscope className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Curare Provider</h1>
                    <p className="text-sm text-muted-foreground">Sign in to your account</p>
                  </div>
                </div>

                {authError && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {authError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                    <Input
                      type="email"
                      placeholder="doctor@example.com"
                      className="h-12"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
                    <Input
                      type="password"
                      placeholder="********"
                      className="h-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={handleLogin}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full h-12 bg-transparent"
                    onClick={handleDemoLogin}
                  >
                    Continue as Demo Provider
                  </Button>
                </div>

<p className="mt-6 text-sm text-center text-muted-foreground">
  Not a provider yet?{" "}
  <button 
    type="button"
    onClick={() => setCurrentView("signup")} 
    className="text-primary font-medium hover:underline"
  >
    Apply to join
  </button>
  </p>
              </div>
            </motion.div>
          )}

          {/* Signup Screen */}
          {currentView === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-16 px-6 pb-8 overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setCurrentView("login")}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                >
                  <ChevronRight className="h-5 w-5 text-foreground rotate-180" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Join Curare</h1>
                  <p className="text-sm text-muted-foreground">Create your provider account</p>
                </div>
              </div>

              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {authError}
                </div>
              )}

              <div className="space-y-4 pb-8">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">First Name *</label>
                    <Input
                      placeholder="Carlos"
                      className="h-11"
                      value={signupData.firstName}
                      onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Last Name *</label>
                    <Input
                      placeholder="Rodriguez"
                      className="h-11"
                      value={signupData.lastName}
                      onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Email *</label>
                  <Input
                    type="email"
                    placeholder="doctor@example.com"
                    className="h-11"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Password *</label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    className="h-11"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
                  <PhoneInput
                    value={signupData.phone}
                    onChange={(full, dial, local) => {
                      setSignupData({ ...signupData, dialCode: dial, phone: local })
                    }}
                    placeholder="000 000 0000"
                    defaultCountry="US"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Medical License Number</label>
                  <Input
                    placeholder="e.g. MD-12345-FL"
                    className="h-11"
                    value={signupData.licenseNumber}
                    onChange={(e) => setSignupData({ ...signupData, licenseNumber: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Include state abbreviation if applicable</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Service Type</label>
                  <select
                    className="w-full h-11 px-3 rounded-md border border-input bg-background text-foreground"
                    value={signupData.specialty}
                    onChange={(e) => setSignupData({ ...signupData, specialty: e.target.value })}
                  >
                    <option value="House Call">House Call</option>
                    <option value="Online Consultation">Online Consultation</option>
                    <option value="House Call & Online">Both (House Call & Online)</option>
                  </select>
                </div>

                <Button
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-4"
                  onClick={handleSignup}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By creating an account, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </motion.div>
          )}

          {/* Signup Success Screen */}
          {currentView === "signup-success" && (
            <motion.div
              key="signup-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center px-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6"
              >
                <CheckCircle2 className="h-10 w-10 text-success" />
              </motion.div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">Check Your Email</h1>
              <p className="text-muted-foreground text-center mb-8 max-w-[280px]">
                {"We've sent a confirmation link to your email. Please verify your account to continue."}
              </p>

              <Button
                className="w-full max-w-[280px] h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => setCurrentView("login")}
              >
                Back to Login
              </Button>

{resendSuccess ? (
                <p className="mt-4 text-sm text-success">
                  Email sent! Check your inbox.
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {"Didn't receive the email?"}{" "}
                  <button 
                    type="button" 
                    className="text-primary font-medium hover:underline disabled:opacity-50"
                    onClick={handleResendEmail}
                    disabled={isPending}
                  >
                    {isPending ? "Sending..." : "Resend"}
                  </button>
                </p>
              )}
            </motion.div>
          )}

          {/* Home - Request Queue */}
          {currentView === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-foreground">Curare Provider</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
                        <Avatar className="h-10 w-10 border-2 border-primary cursor-pointer hover:opacity-80 transition-opacity">
                          <AvatarImage src={currentProvider?.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {currentProvider?.first_name?.[0] || "D"}{currentProvider?.last_name?.[0] || "R"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span className="font-medium">{currentProvider?.first_name} {currentProvider?.last_name}</span>
                          <span className="text-xs text-muted-foreground font-normal">{currentProvider?.specialty || "Provider"}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={handleLogout}
                        disabled={isPending}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{isPending ? "Signing out..." : "Sign out"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Online Toggle */}
                <Card className="bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                        <div>
                          <p className="font-medium text-foreground">{isOnline ? "Online" : "Offline"}</p>
                          <p className="text-sm text-muted-foreground">
                            {isOnline ? "Accepting new requests" : "Not accepting requests"}
                          </p>
                        </div>
                      </div>
                      <Switch checked={isOnline} onCheckedChange={handleToggleOnline} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Stats Row */}
              <div className="px-5 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">${stats.todayEarnings}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats.todayVisits}</p>
                      <p className="text-xs text-muted-foreground">Visits</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{stats.rating}</p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Request Queue */}
              <div className="flex-1 overflow-y-auto px-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-foreground">Available Requests</h2>
                  <span className="text-sm text-muted-foreground">
                    {availableRequests.length} nearby
                  </span>
                </div>

                {!isOnline ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Activity className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-center">Go online to see available requests</p>
                  </div>
                ) : requestsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading requests...</p>
                  </div>
                ) : availableRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-center">No requests available nearby</p>
                    <p className="text-sm text-muted-foreground mt-1">New requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableRequests.map((request) => {
                      const urgency = getRequestUrgency(request)
                      const patientName = request.case_patients?.[0]?.name || 
                        `${(request as any).patient?.first_name || ""} ${(request as any).patient?.last_name || ""}`.trim() || 
                        "Patient"
                      const symptoms = request.case_patients?.flatMap(p => 
                        p.symptoms?.map(s => s.symptom?.name || s.custom_symptom) || []
                      ) || []
                      
                      return (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                        >
                          <Card className="overflow-hidden">
                            <CardContent className="p-0">
                              {/* Urgency Banner */}
                              <div className={`px-4 py-2 ${getUrgencyColor(urgency)}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium capitalize">{urgency} Priority</span>
                                  <span className="text-sm">Just now</span>
                                </div>
                              </div>

                              <div className="p-4">
                                {/* Patient Info */}
                                <div className="flex items-start gap-3 mb-3">
                                  <Avatar className="h-12 w-12">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                      {patientName.split(" ").map((n) => n[0]).join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="font-semibold text-foreground">{patientName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {request.case_patients?.length || 1} patient(s)
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-success">${request.total_price}</p>
                                    <p className="text-xs text-muted-foreground">Est. pay</p>
                                  </div>
                                </div>

                                {/* Symptoms */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {symptoms.slice(0, 3).map((symptom, idx) => (
                                    <span key={idx} className="px-2 py-1 text-xs bg-muted rounded-full text-foreground">
                                      {symptom}
                                    </span>
                                  ))}
                                  {symptoms.length > 3 && (
                                    <span className="px-2 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                                      +{symptoms.length - 3} more
                                    </span>
                                  )}
                                </div>

                                {/* Location */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                  <MapPin className="h-4 w-4" />
                                  <span className="truncate flex-1">
                                    {request.address_line1}, {request.city}
                                  </span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    className="flex-1 bg-transparent"
                                    onClick={() => handleDeclineRequest(request.id)}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Decline
                                  </Button>
                                  <Button 
                                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground" 
                                    onClick={() => handleAcceptRequest(request)}
                                    disabled={isPending}
                                  >
                                    {isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Accept
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="h-20 border-t border-border bg-card flex items-center justify-around px-6 pb-2">
                <button className="flex flex-col items-center gap-1 text-primary">
                  <Home className="h-6 w-6" />
                  <span className="text-xs font-medium">Home</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Calendar className="h-6 w-6" />
                  <span className="text-xs font-medium">Schedule</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-6 w-6" />
                  <span className="text-xs font-medium">Earnings</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Settings className="h-6 w-6" />
                  <span className="text-xs font-medium">Settings</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Navigation View */}
          {currentView === "navigation" && selectedRequest && (
            <motion.div
              key="navigation"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Map Placeholder */}
              <div className="flex-1 bg-muted relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Navigation className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-semibold text-foreground">Navigating...</p>
                    <p className="text-muted-foreground">
                      {selectedRequest.address_line1}, {selectedRequest.city}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: `${navigationProgress}%` }}
                  />
                </div>
              </div>

              {/* Bottom Card */}
              <div className="bg-card border-t border-border p-5">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {(selectedRequest.case_patients?.[0]?.name || "P")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {selectedRequest.case_patients?.[0]?.name || "Patient"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.address_line1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 text-center p-3 bg-muted rounded-xl">
                    <Car className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-sm font-medium text-foreground">2.3 mi</p>
                    <p className="text-xs text-muted-foreground">Distance</p>
                  </div>
                  <div className="flex-1 text-center p-3 bg-muted rounded-xl">
                    <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-sm font-medium text-foreground">
                      {Math.round((100 - navigationProgress) * 0.12)} min
                    </p>
                    <p className="text-xs text-muted-foreground">ETA</p>
                  </div>
                  <div className="flex-1 text-center p-3 bg-muted rounded-xl">
                    <DollarSign className="h-5 w-5 text-success mx-auto mb-1" />
                    <p className="text-sm font-medium text-foreground">${selectedRequest.total_price}</p>
                    <p className="text-xs text-muted-foreground">Earnings</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="icon" className="h-12 w-12 bg-transparent">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-12 w-12 bg-transparent">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  <Button 
                    className="flex-1 h-12 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={handleArrived}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        I&apos;ve Arrived
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Visit View */}
          {currentView === "visit" && selectedRequest && (
            <motion.div
              key="visit"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-12"
            >
              {/* Header */}
              <div className="px-5 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">Visit In Progress</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.address_line1}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Patient Info */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {(selectedRequest.case_patients?.[0]?.name || "P")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">
                          {selectedRequest.case_patients?.[0]?.name || "Patient"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedRequest.case_patients?.[0]?.gender || "Not specified"}
                        </p>
                      </div>
                    </div>

                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Chief Complaints</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedRequest.case_patients?.flatMap(p => 
                        p.symptoms?.map((s, idx) => (
                          <span 
                            key={`${p.id}-${idx}`}
                            className="px-3 py-1.5 bg-urgent/10 text-urgent rounded-full text-sm font-medium"
                          >
                            {s.symptom?.name || s.custom_symptom}
                            {s.severity && ` (${s.severity}/10)`}
                          </span>
                        )) || []
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Visit Notes */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Visit Notes</h3>
                    <Textarea
                      placeholder="Document findings, diagnosis, and treatment plan..."
                      className="min-h-[150px] resize-none"
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                    />
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-14 flex-col gap-1 bg-transparent">
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">Prescribe</span>
                  </Button>
                  <Button variant="outline" className="h-14 flex-col gap-1 bg-transparent">
                    <Camera className="h-5 w-5" />
                    <span className="text-xs">Add Photo</span>
                  </Button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card">
                <Button 
                  className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground font-semibold"
                  onClick={handleCompleteVisit}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Complete Visit
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Summary View */}
          {currentView === "summary" && selectedRequest && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full flex flex-col pt-12"
            >
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-success flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="h-10 w-10 text-success-foreground" />
                </motion.div>

                <h2 className="text-2xl font-bold text-foreground mb-2">Visit Complete!</h2>
                <p className="text-muted-foreground text-center mb-8">
                  Great work! The patient has been notified.
                </p>

                <Card className="w-full mb-6">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Patient</span>
                      <span className="font-medium text-foreground">
                        {selectedRequest.case_patients?.[0]?.name || "Patient"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-foreground capitalize">
                        {selectedRequest.service_type?.name.replace("_", " ") || "House Call"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-muted-foreground">Your Earnings</span>
                      <span className="text-xl font-bold text-success">${selectedRequest.total_price}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card">
                <Button
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={handleFinish}
                >
                  Back to Home
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
