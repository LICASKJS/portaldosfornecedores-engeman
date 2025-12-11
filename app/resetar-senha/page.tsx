"use client"

import { useState, useEffect } from "react"

import Link from "next/link"
import { Lock, Eye, EyeOff, CheckCircle, ArrowRight, Sun, Moon, Shield } from "lucide-react"
import { extractMessage, parseJsonSafe } from "../services/http-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://backend-engeman-1.onrender.com"
export default function NewPassword() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<"success" | "error">("success")

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get("token")
    if (urlToken) setToken(urlToken)
  }, [])

  useEffect(() => {
    const currentTheme = localStorage.getItem("theme") || "light"
    setIsDarkMode(currentTheme === "dark")
    document.body.classList.toggle("dark-mode", currentTheme === "dark")
    document.body.classList.toggle("light-mode", currentTheme !== "dark")
  }, [])

  const toggleTheme = () => {
    const newTheme = isDarkMode ? "light" : "dark"
    setIsDarkMode(!isDarkMode)
    document.body.classList.toggle("dark-mode", !isDarkMode)
    document.body.classList.toggle("light-mode", isDarkMode)
    localStorage.setItem("theme", newTheme)
  }

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    if (pwd.length < 8) errors.push("Mínimo de 8 caracteres")
    if (!/[A-Z]/.test(pwd)) errors.push("Pelo menos uma letra maiúscula")
    if (!/[a-z]/.test(pwd)) errors.push("Pelo menos uma letra minúscula")
    if (!/\d/.test(pwd)) errors.push("Pelo menos um número")
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errors.push("Pelo menos um caractere especial")
    return errors
  }

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message)
    setToastType(type)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      showToast("Token não encontrado na URL.", "error")
      return
    }

    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      setErrors(passwordErrors)
      return
    }

    if (password !== confirmPassword) {
      setErrors(["As senhas não coincidem"])
      return
    }

    setIsLoading(true)
    setErrors([])

    try {
      const response = await fetch(`${API_BASE}/api/redefinir-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nova_senha: password }),
      })

      const { json, text } = await parseJsonSafe(response)

      if (!response.ok) {
        showToast(extractMessage(json, text || "Erro ao redefinir senha"), "error")
        return
      }

      showToast("Senha redefinida com sucesso! Faca login.", "success")
      setTimeout(() => {
        window.location.href = "/entrar"
      }, 1500)
    } catch {
      showToast("Erro de rede ou servidor.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = () => {
    const validations = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password),
    ]
    const strength = validations.filter(Boolean).length
    if (strength <= 2) return { label: "Fraca", color: "bg-red-500", width: "w-1/3" }
    if (strength <= 3) return { label: "Média", color: "bg-yellow-500", width: "w-2/3" }
    if (strength <= 4) return { label: "Forte", color: "bg-orange-500", width: "w-5/6" }
    return { label: "Muito Forte", color: "bg-emerald-500", width: "w-full" }
  }

  const strength = getPasswordStrength()

{/* Página para Redefinir a Senha*/}
  return (
    <div
      className={`min-h-screen flex transition-all duration-300 ${
        isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute w-96 h-96 -top-48 -right-48 rounded-full bg-gradient-to-br from-orange-400 to-red-500 ${
            isDarkMode ? "opacity-5" : "opacity-10"
          } animate-pulse`}
        ></div>
        <div
          className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full bg-gradient-to-br from-orange-400 to-red-500 ${
            isDarkMode ? "opacity-5" : "opacity-10"
          } animate-pulse delay-1000`}
        ></div>
        <div
          className={`absolute w-48 h-48 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-orange-400 to-red-500 ${
            isDarkMode ? "opacity-5" : "opacity-10"
          } animate-pulse delay-2000`}
        ></div>
      </div>

      <button
        onClick={toggleTheme}
        className="fixed bottom-8 right-8 w-15 h-15 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-400/25 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-orange-400/40 z-50"
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl mb-6 shadow-lg shadow-orange-400/25">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Nova Senha</h1>
            <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
              Defina uma nova senha segura para sua conta
            </p>
          </div>

          <div
            className={`border rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="p-6 pb-0">
              <h2 className="text-2xl font-semibold mb-1">Criar Nova Senha</h2>
              <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Sua nova senha deve ser forte e única.
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className={`w-full h-12 pl-10 pr-12 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      }`}
                      placeholder="Digite sua nova senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Força da senha:</span>
                        <span
                          className={`font-medium ${
                            strength.label === "Fraca"
                              ? "text-red-500"
                              : strength.label === "Média"
                                ? "text-yellow-500"
                                : strength.label === "Forte"
                                  ? "text-orange-500"
                                  : "text-emerald-500"
                          }`}
                        >
                          {strength.label}
                        </span>
                      </div>
                      <div className={`h-2 rounded-full ${isDarkMode ? "bg-slate-600" : "bg-slate-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full h-12 pl-10 pr-12 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      }`}
                      placeholder="Confirme sua nova senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <ul className="text-red-600 text-sm space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-400/25 disabled:opacity-80 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Salvando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Salvar Nova Senha</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </button>
              </form>

              <div
                className={`flex items-center justify-center gap-2 mt-8 text-sm ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Sua senha será criptografada e armazenada com segurança</span>
              </div>

              <Link
                href="/"
                className="block w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-400/25 flex items-center justify-center"
              >
                Voltar ao Início
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className={`border rounded-2xl p-8 text-center max-w-md w-full mx-4 ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Senha Atualizada!</h3>
            <p className={`mb-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Sua nova senha foi definida com sucesso. Agora você pode fazer login com ela.
            </p>
            <Link
              href="/entrar"
              className="block w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-400/25 flex items-center justify-center"
            >
              Fazer Login
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

