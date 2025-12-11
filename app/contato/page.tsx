"use client"

{/* Bibliotecas utilizadas */}

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Mail, User, MessageSquare, Send, CheckCircle, ArrowRight, Sun, Moon, Phone, MapPin, Clock } from "lucide-react"
import { extractMessage, parseJsonSafe } from "../services/http-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"


{/* Função dos campos necessários*/}

export default function ContatoPage() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    assunto: "",
    mensagem: "",
  })
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  {/* Campo onde busca a API */}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/contato`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const { json, text } = await parseJsonSafe(response);

    if (!response.ok) {
      showToast(extractMessage(json, text || "Erro ao enviar mensagem."), "error");
      return;
    }

    if (!json || typeof json.message !== "string" || !json.message.trim()) {
      showToast("Resposta invalida do servidor.", "error");
      return;
    }

    setShowModal(true);
    setFormData({
      nome: "",
      email: "",
      assunto: "",
      mensagem: "",
    });
    showToast(json.message, "success");
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    showToast("Erro de rede ou servidor.", "error");
  } finally {
    setIsLoading(false);
  }
};


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

      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${toastType === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
        >
          {toastMessage}
        </div>
      )}

      <button
        onClick={toggleTheme}
        className="fixed bottom-8 right-8 w-15 h-15 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-400/25 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-orange-400/40 z-50"
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>


      {/* Campos de preenchimento*/}

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl mb-6 shadow-lg shadow-orange-400/25">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Entre em Contato</h1>
            <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
              Estamos aqui para ajudar. Envie sua mensagem e responderemos em breve
            </p>
          </div>

          <div
            className={`border rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className="p-6 pb-0">
              <h2 className="text-2xl font-semibold mb-1">Fale Conosco</h2>
              <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Preencha o formulário abaixo e nossa equipe entrará em contato
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium mb-2">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="text"
                      id="nome"
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className={`w-full h-12 pl-10 pr-4 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      }`}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                </div>

                {/* Campos de e-mail, assunto, escopo */}

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
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
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

                <div>
                  <label htmlFor="assunto" className="block text-sm font-medium mb-2">
                    Assunto
                  </label>
                  <div className="relative">
                    <Send
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="text"
                      id="assunto"
                      name="assunto"
                      value={formData.assunto}
                      onChange={handleInputChange}
                      className={`w-full h-12 pl-10 pr-4 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                          : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                      }`}
                      placeholder="Assunto da mensagem"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="mensagem" className="block text-sm font-medium mb-2">
                    Mensagem
                  </label>
                  <textarea
                    id="mensagem"
                    name="mensagem"
                    value={formData.mensagem}
                    onChange={handleInputChange}
                    rows={4}
                    className={`w-full p-4 border rounded-lg transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 resize-none ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                    }`}
                    placeholder="Digite sua mensagem aqui..."
                    required
                  />
                </div>
                      {/* Botão de envio de e-mail */}
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
                      <span>Enviar Mensagem</span>
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Precisa de ajuda imediata?{" "}
                  <Link href="/" className="text-orange-400 hover:underline font-medium">
                    Voltar ao início
                  </Link>
                </p>
              </div>

              <div
                className={`flex items-center justify-center gap-2 mt-8 text-sm ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Respondemos em até 48 horas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

                {/* Dados empresarial e Localização */}
                
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute w-32 h-32 bg-white/10 rounded-full top-20 right-20 blur-xl"></div>
        <div className="absolute w-24 h-24 bg-white/10 rounded-full bottom-40 left-20 blur-xl"></div>
        <div className="absolute w-40 h-40 bg-white/10 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 blur-xl"></div>

        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-center text-white">
          <div className="max-w-md">
            <div className="mb-8">
              <h2 className="text-4xl font-bold mb-4">Estamos Aqui</h2>
              <p className="text-lg text-white/90">
                Nossa equipe está pronta para ajudar você com qualquer dúvida ou necessidade
              </p>
            </div>

            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-sm text-white/80">suprimentos.matriz@engeman.net</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Phone className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Telefone Nacional</h3>
                  <p className="text-sm text-white/80"> 4003-4023</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Endereço</h3>
                  <p className="text-sm text-white/80">Rua Padre Carapuceiro, 706
                  7º andar • Emp. Carlos Pena Filho, Recife – PE
                  CEP: 51020-280</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold">48h</div>
                <div className="text-sm text-white/80">Resposta</div>
              </div>
              <div className="w-px h-8 bg-white/30"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">100%</div>
                <div className="text-sm text-white/80">Satisfação</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notificação de mensagem enviada*/}

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
            <h3 className="text-xl font-semibold mb-2">Mensagem Enviada!</h3>
            <p className={`mb-6 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Sua mensagem foi enviada com sucesso! Nossa equipe entrará em contato em breve através do email{" "}
              <strong>{formData.email}</strong>.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full h-12 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-lg font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-400/25"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
