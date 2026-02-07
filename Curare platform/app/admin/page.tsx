"use client"

import { useState, useEffect, useTransition } from "react"
import { motion } from "framer-motion"
import {
  Users,
  Stethoscope,
  DollarSign,
  Activity,
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Shield,
  Settings,
  BarChart3,
  FileText,
  Heart,
  Loader2,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

// Actions
import { adminSignIn, getCurrentAdmin, signOut } from "@/lib/actions/auth"
import {
  getAdminDashboardStats,
  getAllProviders,
  getAllPatients,
  getAllCareRequests,
  updateProviderStatus,
  adminCancelRequest,
} from "@/lib/actions/admin"

// Types
import type { 
  Admin, 
  Provider, 
  Patient, 
  CareRequest, 
  AdminDashboardStats 
} from "@/lib/types/database"

type AdminTab = "overview" | "providers" | "patients" | "requests" | "billing"

export default function AdminPanel() {
  const [isPending, startTransition] = useTransition()
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState<string | null>(null)
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null)
  
  // Data state
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalRevenue: 0,
    revenueChange: 0,
    activeProviders: 0,
    providerChange: 0,
    totalPatients: 0,
    patientChange: 0,
    completedVisits: 0,
    visitChange: 0,
  })
  const [providers, setProviders] = useState<Provider[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [requests, setRequests] = useState<CareRequest[]>([])
  const [loading, setLoading] = useState(true)
  
  // UI state
  const [activeTab, setActiveTab] = useState<AdminTab>("overview")
  const [searchQuery, setSearchQuery] = useState("")

  // Check auth on mount
  useEffect(() => {
    startTransition(async () => {
      const admin = await getCurrentAdmin()
      if (admin) {
        setCurrentAdmin(admin)
        setIsLoggedIn(true)
      }
      setLoading(false)
    })
  }, [])

  // Load data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadDashboardData()
    }
  }, [isLoggedIn])

  const loadDashboardData = async () => {
    startTransition(async () => {
      const [dashStats, allProviders, allPatients, allRequests] = await Promise.all([
        getAdminDashboardStats(),
        getAllProviders(),
        getAllPatients(),
        getAllCareRequests(),
      ])
      setStats(dashStats)
      setProviders(allProviders)
      setPatients(allPatients)
      setRequests(allRequests)
    })
  }

  const handleLogin = () => {
    if (!email || !password) {
      setAuthError("Please enter email and password")
      return
    }
    setAuthError(null)
    startTransition(async () => {
      const result = await adminSignIn(email, password)
      if (result.error) {
        setAuthError(result.error)
      } else {
        const admin = await getCurrentAdmin()
        setCurrentAdmin(admin)
        setIsLoggedIn(true)
      }
    })
  }

  const handleDemoLogin = () => {
    setCurrentAdmin({
      id: "demo-admin",
      first_name: "Admin",
      last_name: "User",
      role: "super_admin",
      permissions: ["all"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Admin)
    setIsLoggedIn(true)
    // Load demo data
    setStats({
      totalRevenue: 127450,
      revenueChange: 12.5,
      activeProviders: 48,
      providerChange: 3,
      totalPatients: 1247,
      patientChange: 89,
      completedVisits: 3842,
      visitChange: -2.3,
    })
  }

  const handleLogout = async () => {
    await signOut()
    setIsLoggedIn(false)
    setCurrentAdmin(null)
  }

  const handleSuspendProvider = async (providerId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active"
    startTransition(async () => {
      await updateProviderStatus(providerId, newStatus as "active" | "suspended")
      await loadDashboardData()
    })
  }

  const handleCancelRequest = async (requestId: string) => {
    startTransition(async () => {
      await adminCancelRequest(requestId, "Cancelled by admin")
      await loadDashboardData()
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )
      case "offline":
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
            <Clock className="h-3 w-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )
      case "suspended":
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-urgent/10 text-urgent rounded-full">
            <XCircle className="h-3 w-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        )
      case "pending":
      case "searching":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-600 rounded-full">
            <AlertCircle className="h-3 w-3" />
            {status === "searching" ? "Searching" : "Pending"}
          </span>
        )
      case "in_progress":
      case "en_route":
      case "arrived":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
            <Activity className="h-3 w-3" />
            {status === "in_progress" ? "In Progress" : status === "en_route" ? "En Route" : "Arrived"}
          </span>
        )
      case "matched":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            Matched
          </span>
        )
      default:
        return null
    }
  }

  // Filter functions
  const filteredProviders = providers.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredPatients = patients.filter(p => 
    `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.phone || "").includes(searchQuery)
  )

  const filteredRequests = requests.filter(r => 
    r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-xl bg-foreground flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-background" />
            </div>
            <CardTitle className="text-2xl">Curare Admin</CardTitle>
            <p className="text-muted-foreground">Sign in to the management portal</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {authError}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
              <Input
                type="email"
                placeholder="admin@curare.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
              <Input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleDemoLogin}
            >
              Continue as Demo Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                <Shield className="h-5 w-5 text-background" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Curare Admin</h1>
                <p className="text-xs text-muted-foreground">Management Portal</p>
              </div>
            </Link>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {currentAdmin?.first_name?.[0] || "A"}{currentAdmin?.last_name?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-muted-foreground">
                    {currentAdmin?.first_name} {currentAdmin?.last_name}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="space-y-6">
          <TabsList className="bg-muted p-1 h-auto flex-wrap">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="providers" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="patients" className="gap-2">
              <Users className="h-4 w-4" />
              Patients
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <FileText className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-foreground mt-1">
                          ${stats.totalRevenue.toLocaleString()}
                        </p>
                        <div className={`flex items-center gap-1 mt-1 text-sm ${stats.revenueChange >= 0 ? "text-success" : "text-urgent"}`}>
                          {stats.revenueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span>{stats.revenueChange >= 0 ? "+" : ""}{stats.revenueChange}%</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Providers</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{stats.activeProviders}</p>
                        <div className="flex items-center gap-1 mt-1 text-success text-sm">
                          <TrendingUp className="h-4 w-4" />
                          <span>+{stats.providerChange} this week</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Stethoscope className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Patients</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{stats.totalPatients.toLocaleString()}</p>
                        <div className="flex items-center gap-1 mt-1 text-success text-sm">
                          <TrendingUp className="h-4 w-4" />
                          <span>+{stats.patientChange} this month</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-urgent/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-urgent" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completed Visits</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{stats.completedVisits.toLocaleString()}</p>
                        <div className={`flex items-center gap-1 mt-1 text-sm ${stats.visitChange >= 0 ? "text-success" : "text-urgent"}`}>
                          {stats.visitChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span>{stats.visitChange}%</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-amber-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Requests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {requests.slice(0, 5).map((request) => (
                      <div key={request.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {request.case_patients?.[0]?.name || 
                             `${(request as any).patient?.first_name || ""} ${(request as any).patient?.last_name || ""}`.trim() || 
                             "Patient"}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {request.service_type?.name.replace("_", " ") || "House Call"}
                          </p>
                        </div>
                        {getStatusBadge(request.status)}
                        <span className="text-sm font-medium text-foreground">${request.total_price}</span>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <div className="px-6 py-8 text-center text-muted-foreground">
                        No recent requests
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Providers</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {providers
                      .filter((p) => p.is_available)
                      .sort((a, b) => b.total_reviews - a.total_reviews)
                      .slice(0, 5)
                      .map((provider, idx) => (
                        <div key={provider.id} className="px-6 py-4 flex items-center gap-4">
                          <span className="text-sm font-bold text-muted-foreground w-4">#{idx + 1}</span>
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {provider.first_name[0]}{provider.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              Dr. {provider.first_name} {provider.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{provider.total_reviews} reviews</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Heart className="h-4 w-4 text-urgent fill-urgent" />
                              <span className="font-medium text-foreground">{provider.rating}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {providers.length === 0 && (
                      <div className="px-6 py-8 text-center text-muted-foreground">
                        No providers yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button className="gap-2">
                <Stethoscope className="h-4 w-4" />
                Add Provider
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Reviews
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Rate
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredProviders.map((provider) => (
                        <tr key={provider.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {provider.first_name[0]}{provider.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">
                                  Dr. {provider.first_name} {provider.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">{provider.specialty}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(provider.is_available ? "active" : "offline")}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Heart className="h-4 w-4 text-urgent fill-urgent" />
                              <span className="font-medium text-foreground">{provider.rating}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-foreground">{provider.total_reviews}</td>
                          <td className="px-6 py-4 font-medium text-foreground">
                            ${provider.hourly_rate}/hr
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleSuspendProvider(provider.id, provider.is_available ? "active" : "suspended")}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  {provider.is_available ? "Suspend" : "Activate"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredProviders.length === 0 && (
                    <div className="px-6 py-12 text-center text-muted-foreground">
                      No providers found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patients Tab */}
          <TabsContent value="patients" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Phone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Insurance
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {(patient.first_name?.[0] || "P")}{(patient.last_name?.[0] || "")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">
                                  {patient.first_name || ""} {patient.last_name || ""}
                                </p>
                                <p className="text-sm text-muted-foreground">{patient.gender || "Not specified"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-foreground">{patient.phone || "N/A"}</td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {patient.city && patient.state ? `${patient.city}, ${patient.state}` : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-foreground">
                            {patient.insurance_provider || "None"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredPatients.length === 0 && (
                    <div className="px-6 py-12 text-center text-muted-foreground">
                      No patients found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Request ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4 font-mono text-sm text-foreground">
                            {request.id.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-4 text-foreground">
                            {request.case_patients?.[0]?.name || 
                             `${(request as any).patient?.first_name || ""} ${(request as any).patient?.last_name || ""}`.trim() || 
                             "Patient"}
                          </td>
                          <td className="px-6 py-4 text-foreground">
                            {(request as any).provider 
                              ? `Dr. ${(request as any).provider.first_name} ${(request as any).provider.last_name}`
                              : "Unassigned"}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                          <td className="px-6 py-4 text-foreground capitalize">
                            {request.service_type?.name.replace("_", " ") || "House Call"}
                          </td>
                          <td className="px-6 py-4 font-medium text-foreground">
                            ${request.total_price}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {["pending", "searching", "matched"].includes(request.status) && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleCancelRequest(request.id)}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel Request
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRequests.length === 0 && (
                    <div className="px-6 py-12 text-center text-muted-foreground">
                      No requests found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground mt-1">${stats.totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Platform Fees</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    ${Math.round(stats.totalRevenue * 0.15).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Provider Payouts</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    ${Math.round(stats.totalRevenue * 0.85).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Pending Payouts</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">$12,450</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Transaction history will appear here once payments are processed.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
