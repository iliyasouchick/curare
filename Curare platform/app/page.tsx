"use client"

import { motion } from "framer-motion"
import { Heart, Stethoscope, Shield, ChevronRight } from "lucide-react"
import Link from "next/link"

const apps = [
  {
    id: "patient",
    name: "Patient App",
    description: "Request urgent care at your location",
    icon: Heart,
    href: "/patient",
    color: "bg-urgent",
    iconColor: "text-urgent-foreground",
  },
  {
    id: "doctor",
    name: "Doctor App",
    description: "Accept and fulfill care requests",
    icon: Stethoscope,
    href: "/doctor",
    color: "bg-primary",
    iconColor: "text-primary-foreground",
  },
  {
    id: "admin",
    name: "Admin Panel",
    description: "Manage users, providers, and billing",
    icon: Shield,
    href: "/admin",
    color: "bg-foreground",
    iconColor: "text-background",
  },
]

export default function AppSelector() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-primary-foreground" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Curare</h1>
          <p className="text-muted-foreground mt-1">Urgent Care Platform</p>
        </motion.div>

        {/* App Cards */}
        <div className="space-y-4">
          {apps.map((app, index) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.2 }}
            >
              <Link href={app.href}>
                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border hover:border-primary/30 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl ${app.color} flex items-center justify-center`}>
                      <app.icon className={`h-7 w-7 ${app.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {app.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">{app.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-muted-foreground mt-8"
        >
          Select an app to continue
        </motion.p>
      </div>
    </div>
  )
}
