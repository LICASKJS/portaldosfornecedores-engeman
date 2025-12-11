"use client"

{/* Bibliotecas utilizadas */}

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Eye, EyeOff, Mail, Lock, Shield, Users, TrendingUp, ArrowRight, CheckCircle, Sun, Moon, AlertCircle } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const ADMIN_ALLOWED_EMAILS = ["pedro.vilaca@engeman.net", "sofia.beltrao@engeman.net", "lucas.mateus@engeman.net"]

const isJsonObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const sanitizeServerMessage = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const maybeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed)
  const normalized = maybeHtml
    ? trimmed.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : trimmed

  if (!normalized) {
    return null
  }

  const normalizedLower = normalized.toLowerCase()
  if (
    normalizedLower.startsWith("404 not found") ||
    normalizedLower.includes("requested url was not found") ||
    normalizedLower === "not found"
  ) {
    return null
  }

  return normalized
}

const getMessageFromData = (data: unknown, fallback: string): string => {
  if (isJsonObject(data)) {
    const candidates = ["message", "detail", "error"]
    for (const key of candidates) {
      const raw = data[key]
      if (typeof raw === "string" && raw.trim().length > 0) {
        const sanitized = sanitizeServerMessage(raw)
        if (sanitized) {
          return sanitized
        }
      }
    }
  }
  if (typeof data === "string" && data.trim().length > 0) {
    const sanitized = sanitizeServerMessage(data)
    if (sanitized) {
      return sanitized
    }
  }
  return fallback
}

const parseJsonSafe = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  const isJsonContent =
    contentType.includes("application/json") || contentType.includes("application/problem+json")

  if (isJsonContent) {
    try {
      return await response.json()
    } catch (error) {
      console.error("Falha ao analisar JSON da resposta:", error)
      return null
    }
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })
  

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

  {/* Função do acesso a página de admin com os e-mail liberados */}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const emailLower = formData.email.trim().toLowerCase()
    const senha = formData.password

    try {
      if (ADMIN_ALLOWED_EMAILS.includes(emailLower)) {

        const adminResponse = await fetch(`${API_BASE}/api/admin/login`, {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({ email: emailLower, senha }),

        })

        const adminData = await parseJsonSafe(adminResponse)

        if (!adminResponse.ok) {

          if (adminResponse.status === 401) {

            throw new Error("Credenciais invalidas para acesso administrativo.")

          }

          throw new Error(getMessageFromData(adminData, "Erro ao autenticar administrador."))

        }

        if (!isJsonObject(adminData) || typeof adminData.access_token !== "string") {

          throw new Error("Resposta invalida do servidor para login administrativo.")

        }

        localStorage.setItem("admin_portal_token", adminData.access_token)

        localStorage.setItem("admin_portal_email", emailLower)

        localStorage.removeItem("access_token")

        window.location.href = "/admin"

        return

      }

      {/* Tela de para acesso do fornecedor */}
        
      const response = await fetch(`${API_BASE}/api/login`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ email: formData.email, senha }),

      })

      const data = await parseJsonSafe(response)

      if (!response.ok) {

        const mensagemErroPadrao =

          response.status === 401 || response.status === 403

            ? "Credenciais invalidas!"

            : "Erro ao autenticar fornecedor."

        throw new Error(getMessageFromData(data, mensagemErroPadrao))

      }

      if (!isJsonObject(data) || typeof data.access_token !== "string") {

        throw new Error("Resposta invalida do servidor para login de fornecedor.")

      }

      localStorage.setItem("access_token", data.access_token)

      window.location.href = "/portal"

      return

    } catch (error) {
      console.error("Erro ao tentar fazer login", error)
      const mensagem = error instanceof Error ? error.message : "Erro de conexao"
      setErrorMessage(mensagem)
    } finally {
      setIsLoading(false)
    }
  }


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const getAccentColor = () => {
    return isDarkMode ? "text-orange-400" : "text-orange-500"
  }

  const getFocusClasses = () => {
    return isDarkMode
      ? "focus:border-orange-400 focus:ring-orange-400/10"
      : "focus:border-orange-400 focus:ring-orange-400/10"
  }

  const getButtonClasses = () => {
    return isDarkMode
      ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
      : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
  }

  return (
    <div
      className={`min-h-screen flex transition-all duration-300 ${
        isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse`}
        ></div>
        <div
          className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-1000`}
        ></div>
        <div
          className={`absolute w-48 h-48 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-105"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-2000`}
        ></div>
      </div>

      <button
        onClick={toggleTheme}
        className={`fixed bottom-8 right-8 w-15 h-15 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 ${
          isDarkMode
            ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
            : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
        }`}
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      {/*informações */}

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
              <img
              src={isDarkMode ? "/logo-marca.png" : "/colorida.png"}
              alt="Logo Engeman"
              className="h-10 mx-auto mb-4 transition-transform duration-300 hover:scale-105"
            />
           
            <h1
                  className={`text-3xl md:text-3xl font-bold mb-3 bg-gradient-to-r ${
                    isDarkMode ? "from-orange-400 to-red-500" : "from-orange-400 to-red-500"
                  } bg-clip-text text-transparent`}
                >
                  Bem-vindo de Volta
                </h1>
            <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
              Acesse sua conta para acompanhar seu processo de homologação
            </p>
          </div>

          <div
            className={`border rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="p-6 pb-0">
              <h2 className="text-2xl font-semibold mb-1">Entrar</h2>
              <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Digite suas credenciais para acessar o sistema
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage}
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full h-12 pl-10 pr-4 border rounded-lg font-size-0.95rem transition-all duration-300 focus:outline-none focus:ring-3 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      } ${getFocusClasses()}`}
                      placeholder="seu.email@empresa.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Senha
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
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`w-full h-12 pl-10 pr-12 border rounded-lg font-size-0.95rem transition-all duration-300 focus:outline-none focus:ring-3 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      } ${getFocusClasses()}`}
                      placeholder="Digite sua senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 ${
                        isDarkMode ? "text-slate-500 hover:text-orange-500" : "text-slate-500 hover:text-orange-500"
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <div className="relative">
                      <div
                        className={`w-5 h-5 border-2 rounded transition-all duration-300 ${
                          formData.rememberMe
                            ? isDarkMode
                              ? "bg-orange-500 border-orange-500"
                              : "bg-orange-500 border-orange-500"
                            : isDarkMode
                              ? "border-slate-400"
                              : "border-slate-300"
                        }`}
                      >
                        {formData.rememberMe && (
                          <CheckCircle className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                        )}
                      </div>
                    </div>
                    <span className={`ml-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      Lembrar-me
                    </span>
                  </label>
                  <Link href="/senha" className={`text-sm hover:underline ${getAccentColor()}`}>
                    Esqueceu a senha?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-12 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden ${getButtonClasses()}`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Entrando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Entrar</span>
                      <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  className={`
                  }`}
                >                
                </button>
              </form>

              <div className="text-center mt-6">
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Não tem uma conta?{" "}
                  <Link href="/cadastro" className={`hover:underline font-medium ${getAccentColor()}`}>
                    Cadastre-se
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <div
            className={`flex items-center justify-center gap-2 mt-8 text-sm ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
          </div>
        </div>
      </div>

            {/* Detalhes da Gestão dos fornecedores */}
      <div
        className={`hidden lg:flex flex-1 relative overflow-hidden ${
          isDarkMode ? "bg-gradient-to-br from-orange-400 to-red-500" : "bg-gradient-to-br from-orange-400 to-red-500"
        }`}
      >
        <div className="absolute inset-0 bg-black/10"></div>

        <div className="absolute w-32 h-32 bg-white/10 rounded-full top-20 right-20 blur-xl"></div>
        <div className="absolute w-24 h-24 bg-white/10 rounded-full bottom-40 left-20 blur-xl"></div>
        <div className="absolute w-40 h-40 bg-white/10 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 blur-xl"></div>

        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-center text-white">
          <div className="max-w-md">
            <div className="mb-8">
              <h2 className="text-4xl font-bold mb-4">Gestão de Fornecedor</h2>
              <p className="text-xl text-white/90 leading-relaxed">
                Gerencie seus dados, feedbacks e avaliações em nosso sistema
              </p>
            </div>

            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Gestão de Equipes</h3>
                  <p className="text-sm text-white/80">Controle total sobre usuários</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Análise Detalhada</h3>
                  <p className="text-sm text-white/80">Relatórios em tempo real</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Segurança Máxima</h3>
                  <p className="text-sm text-white/80">Proteção de dados garantida</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-white/80">Ativos</div>
              </div>
              <div className="w-px h-8 bg-white/30"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">100%</div>
                <div className="text-sm text-white/80">Média de Cadastro</div>
              </div>
              <div className="w-px h-8 bg-white/30"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">48hr</div>
                <div className="text-sm text-white/80">Média</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
