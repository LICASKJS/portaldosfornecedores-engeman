"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mail, Lock, Shield, CheckCircle, ArrowRight, Sun, Moon } from "lucide-react"
import { extractMessage, parseJsonSafe } from "../services/http-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://backend-engeman-1.onrender.com"

export default function SenhaPage() {
  const [email, setEmail] = useState("")
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
      const response = await fetch(`${API_BASE}/api/recuperar-senha`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const { json, text } = await parseJsonSafe(response)

      if (!response.ok) {
        showToast(extractMessage(json, text || "Erro ao enviar token"), "error")
        return
      }

      if (!json || typeof json.message !== "string" || !json.message.trim()) {
        showToast("Resposta invalida do servidor.", "error")
        return
      }

      showToast(json.message, "success")
      setShowModal(true)
      setEmail("")
    } catch (err) {
      showToast("Erro de rede ou servidor.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  {/* Página de Recuperação de Senha*/}

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
            <h1 className="text-3xl font-bold mb-2">Recuperar Senha</h1>
            <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
              Insira seu email para receber as instruções de recuperação
            </p>
          </div>

          <div
            className={`border rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="p-6 pb-0">
              <h2 className="text-2xl font-semibold mb-1">Esqueceu sua senha?</h2>
              <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Não se preocupe, enviaremos um token de recuperação para seu email.
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full h-12 pl-10 pr-4 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      }`}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-400/25 disabled:opacity-80 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Enviando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Enviar Token de Recuperação</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Lembrou da senha?{" "}
                  <Link href="/entrar" className="text-orange-400 hover:underline font-medium">
                    Fazer login
                  </Link>
                </p>
              </div>

              <div
                className={`flex items-center justify-center gap-2 mt-8 text-sm ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Suas informações estão protegidas com criptografia</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>

        <div className="absolute w-32 h-32 bg-white/10 rounded-full top-20 right-20 blur-xl"></div>
        <div className="absolute w-24 h-24 bg-white/10 rounded-full bottom-40 left-20 blur-xl"></div>
        <div className="absolute w-40 h-40 bg-white/10 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 blur-xl"></div>

        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-center text-white">
          <div className="max-w-md">
            <div className="mb-8">
              <h2 className="text-4xl font-bold mb-4">Recuperação Segura</h2>
            </div>

            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Segurança Avançada</h3>
                  <p className="text-sm text-white/80">Criptografia de ponta a ponta para proteger seus dados</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Recuperação Rápida</h3>
                  <p className="text-sm text-white/80">Processo otimizado para recuperar acesso em minutos</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold">96%</div>
                <div className="text-sm text-white/80">Agilidade</div>
              </div>
              <div className="w-px h-8 bg-white/30"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-white/80">Fornecedores</div>
              </div>
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
            <h3 className="text-xl font-semibold mb-2">Email Enviado!</h3>
            <p className={`mb-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Enviamos as instruções de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada e
              spam.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-400/25"
            >
              <Link href = "/token">
              Entendi
              </Link>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

