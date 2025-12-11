"use client"

import { useState, useEffect } from "react"

import { Lock, CheckCircle, ArrowRight, Sun, Moon } from "lucide-react"
import { extractMessage, parseJsonSafe } from "../services/http-utils"

import Link from "next/link"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://backend-engeman-1.onrender.com"
export default function ValidarToken() {
  const [token, setToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<"success" | "error">("success")

  useEffect(() => {
    const currentTheme = localStorage.getItem("theme") || "light"
    setIsDarkMode(currentTheme === "dark")

    if (currentTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark"
    setIsDarkMode(!isDarkMode)
    if (newTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }
    localStorage.setItem("theme", newTheme)
  }

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/validar-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const { json, text } = await parseJsonSafe(response)

      if (!response.ok) {
        showToast(extractMessage(json, text || "Token invalido!"), "error")
        return
      }

      if (!json || typeof json.message !== "string" || !json.message.trim()) {
        showToast("Resposta invalida do servidor.", "error")
        return
      }

      showToast(json.message, "success")
      setTimeout(() => {
        window.location.href = `/resetar-senha?token=${token}`
      }, 1500)
    } catch {
      showToast("Erro de rede ou servidor.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  {/* Página de validação de token (Recuperação de Senha)*/}

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-300 ${isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"}`}>
      <button onClick={toggleTheme} className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white shadow-lg z-50">
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">
            <Link href="/validacao"> Validar Token</Link>
          </h1>
          <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Digite o código de 6 dígitos enviado por e-mail</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder="Código de 6 dígitos"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full h-12 px-4 border rounded-lg focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            required
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white font-semibold rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isLoading ? "Validando..." : "Validar Token"}
          </button>
        </form>

        {toastMessage && (
          <div className={`mt-4 p-3 text-center rounded-lg ${toastType === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  )
}

