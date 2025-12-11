"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Building,
  User,
  ArrowLeft,
  ArrowRight,
  Shield,
  Clock,
  FileText,
  CheckCircle,
  Sun,
  Moon,
  X,
  Check,
  AlertCircle,
} from "lucide-react"

import { extractMessage, parseJsonSafe } from "../services/http-utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

interface ToastProps {
  message: string
  type: "success" | "error" | "warning" | "info"
  onClose: () => void
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const getToastStyles = () => {
    const baseStyles =
      "fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-in-right"
    switch (type) {
      case "success":
        return `${baseStyles} bg-green-500 text-white`
      case "error":
        return `${baseStyles} bg-red-500 text-white`
      case "warning":
        return `${baseStyles} bg-yellow-500 text-white`
      default:
        return `${baseStyles} bg-blue-500 text-white`
    }
  }

  const getIcon = () => {
    switch (type) {
      case "success":
        return <Check className="w-5 h-5" />
      case "error":
        return <X className="w-5 h-5" />
      case "warning":
        return <AlertCircle className="w-5 h-5" />
      default:
        return <AlertCircle className="w-5 h-5" />
    }
  }

  return (
    <div className={getToastStyles()}>
      {getIcon()}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function DynamicAuthPage() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [toasts, setToasts] = useState<
    Array<{ id: number; message: string; type: "success" | "error" | "warning" | "info" }>
  >([])
  const [isTransitioning, setIsTransitioning] = useState(false)

  const [loginData, setLoginData] = useState({
  email: "",
  password: "",
  rememberMe: false,
});

const [cadastroData, setCadastroData] = useState({
  email: "",
  cnpj: "",
  nome: "",
  password: "",
  acceptTerms: false,
  rememberMe: false,
});


  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const showToast = useCallback((message: string, type: "success" | "error" | "warning" | "info" = "info") => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
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

  const calculatePasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength += 25
    if (/[A-Z]/.test(password)) strength += 25
    if (/[0-9]/.test(password)) strength += 25
    if (/[^A-Za-z0-9]/.test(password)) strength += 25
    return strength
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value
    setCadastroData((prev) => ({ ...prev, password }))
    setPasswordStrength(calculatePasswordStrength(password))
    clearError("password")
  }

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18)
  }

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setCadastroData((prev) => ({ ...prev, cnpj: formatted }))
    clearError("cnpj")
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

 const validateCNPJ = (cnpj: string) => {
  const cleanedCNPJ = cnpj.replace(/\D/g, "")  
  if (cleanedCNPJ.length !== 14) return false
  return true
}


  const setError = (field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }

  const focusCadastroField = (field: "cadastroEmail" | "cnpj") => {
    if (typeof document === "undefined") return
    const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`)
    input?.focus()
  }

  const resolveServerField = (payload: unknown): "email" | "cnpj" | null => {
    if (payload && typeof payload === "object" && "field" in payload) {
      const fieldValue = (payload as Record<string, unknown>).field
      if (typeof fieldValue === "string") {
        const normalized = fieldValue.trim().toLowerCase()
        if (normalized === "email" || normalized === "cnpj") {
          return normalized
        }
      }
    }
    return null
  }

 
  const switchToMode = (loginMode: boolean) => {
    console.log(`Mudando para modo: ${loginMode ? "Login" : "Cadastro"}`)

    if (isTransitioning) {
      console.log("Transição em andamento, ignorando...")
      return
    }

    setIsTransitioning(true)
    setIsLoginMode(loginMode)


    setTimeout(() => {
      setIsTransitioning(false)
      if (loginMode) {
        const loginEmail = document.querySelector('input[placeholder="E-mail ou CNPJ"]') as HTMLInputElement
        loginEmail?.focus()
      } else {
        const cadastroEmail = document.querySelector('input[placeholder="E-mail corporativo"]') as HTMLInputElement
        cadastroEmail?.focus()
      }
    }, 800) 
  }



const handleLoginSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const { email, password } = loginData;

  if (!email || !password) {
    showToast("Todos os campos sao obrigatorios.", "warning");
    return;
  }

  setIsLoading(true);
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const { json, text } = await parseJsonSafe(response);

    if (!response.ok) {
      showToast(extractMessage(json, text || "Credenciais invalidas!"), "error");
      return;
    }

    if (!json || typeof json.access_token !== "string" || !json.access_token.trim()) {
      showToast("Resposta invalida do servidor.", "error");
      return;
    }

    localStorage.setItem("access_token", json.access_token);
    window.location.href = "/portal";
  } catch {
    showToast("Erro de rede ou servidor.", "error");
  } finally {
    setIsLoading(false);
  }
};


const handleSubmit = async (e) => {
  e.preventDefault();
  
  const { email, cnpj, nome, password, acceptTerms } = cadastroData;
  console.log("Cadastro Data:", cadastroData);

  if (!email || !cnpj || !nome || !password) {
    showToast("Todos os campos sao obrigatorios.", "warning");
    return;
  }

  if (!validateCNPJ(cnpj)) {
    showToast("CNPJ invalido.", "error");
    return;
  }

  if (!acceptTerms) {
    showToast("Voce deve aceitar os termos e condicoes.", "warning");
    return;
  }

  setIsLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/cadastro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        cnpj,
        nome,
        senha: password,
        acceptTerms,
      }),
    });

    const { json, text } = await parseJsonSafe(response);
    if (!response.ok) {
      const message = extractMessage(json, text || "Erro no cadastro. Tente novamente.");
      const serverField = resolveServerField(json);

      if (serverField === "email") {
        setError("cadastroEmail", message);
        focusCadastroField("cadastroEmail");
      } else if (serverField === "cnpj") {
        setError("cnpj", message);
        focusCadastroField("cnpj");
      } else {
        showToast(message, "error");
      }
      return;
    }

    if (json && typeof json.access_token === "string" && json.access_token.trim()) {
      localStorage.setItem("access_token", json.access_token);
    }

    showToast("Cadastro realizado com sucesso!", "success");
    setTimeout(() => {
      window.location.href = "/portal";
    }, 1200);
  } catch (error) {
    showToast("Erro de rede ou servidor.", "error");
  } finally {
    setIsLoading(false);
  }
};


console.log("Cadastro Data:", cadastroData);


  const getStrengthColor = () => {
    if (passwordStrength < 25) return "bg-red-500"
    if (passwordStrength < 50) return "bg-yellow-500"
    if (passwordStrength < 75) return "bg-blue-500"
    return "bg-green-500"
  }

  const getStrengthText = () => {
    if (passwordStrength < 25) return "Muito fraca"
    if (passwordStrength < 50) return "Fraca"
    if (passwordStrength < 75) return "Média"
    return "Forte"
  }

  const getThemeColors = () => {
    if (isDarkMode) {
      return {
        background: "bg-slate-900",
        text: "text-white",
        panel: "bg-slate-800 border-white/10",
        input: "bg-white/5 border-white/10 text-white placeholder-slate-400",
        button: "bg-gradient-to-r from-orange-400 to-red-500",
        accent: "text-slate-300",
        hover: "hover:bg-white/5",
      }
    } else {
      return {
        background: "bg-orange-50",
        text: "text-slate-900",
        panel: "bg-white border-orange-200",
        input: "bg-white border-orange-300 text-slate-900 placeholder-slate-500",
        button: "bg-gradient-to-r from-orange-400 to-red-500",
        accent: "text-slate-600",
        hover: "hover:bg-orange-50",
      }
    }
  }

  const colors = getThemeColors()

  return (
    <div
      className={`min-h-screen flex relative overflow-hidden transition-all duration-500 ${colors.background} ${colors.text}`}
    >
     
      <div className="fixed inset-0 pointer-events-none z-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full opacity-20 animate-float ${
              isDarkMode ? "bg-orange-400" : "bg-orange-400"
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

     
      <button
        onClick={toggleTheme}
        className={`fixed bottom-8 right-8 w-14 h-14 ${colors.button} rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50`}
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

     
      <div className={`carousel-container ${!isLoginMode ? "modo-cadastro" : ""}`}>
        
        <div
          className="panel-esquerda"
          style={{
            background: isDarkMode
              ? "linear-gradient(135deg, #1a1f2e 0%, #252b3a 100%)"
              : "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
          }}
        >
          <Link
            href="/"
            className={`absolute top-6 left-6 w-10 h-10 border rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 z-20 ${
              isDarkMode
                ? "bg-white/5 border-white/10 text-slate-300 hover:bg-gradient-to-r from-orange-400 to-red-400 hover:text-white"
                : "bg-white border-orange-200 text-slate-600 hover:bg-orange-400 hover:text-white"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

         
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-400/5 to-emerald-500/5 rounded-full blur-3xl opacity-30 animate-pulse"></div>

          <div className="max-w-lg text-center relative z-10 w-full">
            <img
              src={isDarkMode ? "/logo-marca.png" : "/colorida.png"}
              alt="Logo Engeman"
              className="h-12 mx-auto mb-6 transition-transform duration-300 hover:scale-105"
            />

           
            {isLoginMode ? (
             
              <div className="animate-fade-in">
                <h1
                  className={`text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r ${
                    isDarkMode ? "from-orange-400 to-red-500" : "from-orange-400 to-red-500"
                  } bg-clip-text text-transparent`}
                >
                  Bem-vindo ao Portal de Fornecedores
                </h1>

                <p className={`mb-8 leading-relaxed ${colors.accent}`}>
                  Gerencie seus documentos, acompanhe homologações e mantenha seu cadastro sempre atualizado em nossa
                  plataforma integrada.
                </p>

                <div className="space-y-4 mb-8 text-left">
                  {[
                    { icon: Shield, text: "Segurança garantida" },
                    { icon: Clock, text: "Acompanhamento em tempo real" },
                    { icon: FileText, text: "Gestão de documentos" },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 hover:translate-x-2 ${colors.hover}`}
                    >
                      <item.icon className={`w-5 h-5 ${isDarkMode ? "text-orange-400" : "text-orange-400"}`} />
                      <span className={colors.accent}>{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => switchToMode(false)}
                  disabled={isTransitioning}
                  className={`flex items-center gap-2 ${colors.button} text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-lg mx-auto disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>Criar Conta</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
            
              <div className="animate-fade-in">
                <h1
                  className={`text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r ${
                    isDarkMode ? "from-orange-400 to-red-500" : "from-orange-400 to-red-500"
                  } bg-clip-text text-transparent`}
                >
                  Bem-vindo de Volta!
                </h1>

                <p className={`mb-8 leading-relaxed ${colors.accent}`}>
                  Já tem uma conta? Faça login para acessar seu painel de fornecedor.
                </p>

                <div className="mb-8">
                  <div className={`flex items-center gap-3 p-4 rounded-lg ${colors.hover} justify-center`}>
                    <User className={`w-6 h-6 ${isDarkMode ? "text-orange-400" : "text-orange-400"}`} />
                    <span className={colors.accent}>Acesso rápido e seguro</span>
                  </div>
                </div>

                <button
                  onClick={() => switchToMode(true)}
                  disabled={isTransitioning}
                  className={`flex items-center gap-2 ${colors.button} text-white px-8 py-4 rounded-full font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-lg mx-auto disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Fazer Login</span>
                </button>
              </div>
            )}
          </div>
        </div>

        
        <div className={`panel-direita backdrop-blur-xl border-l ${colors.panel}`}>
          <div className="w-full max-w-md relative">
            
            <div
              className={`transition-all duration-500 ${
                isLoginMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Entrar na sua conta</h2>
                <p className={colors.accent}>Acesse seu painel e gerencie seus documentos</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="E-mail ou CNPJ"
                      value={loginData.email}
                      onChange={(e) => {
                        setLoginData((prev) => ({ ...prev, email: e.target.value }))
                        clearError("loginEmail")
                      }}
                      className={`w-full h-12 pl-10 pr-4 border rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 ${colors.input} ${
                        errors.loginEmail ? "border-red-500" : ""
                      }`}
                      required
                    />
                  </div>
                  {errors.loginEmail && <p className="text-red-500 text-sm mt-1 animate-shake">{errors.loginEmail}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Senha"
                      value={loginData.password}
                      onChange={(e) => {
                        setLoginData((prev) => ({ ...prev, password: e.target.value }))
                        clearError("loginPassword")
                      }}
                      className={`w-full h-12 pl-10 pr-12 border rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 ${colors.input} ${
                        errors.loginPassword ? "border-red-500" : ""
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 p-2 rounded-lg ${colors.hover}`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.loginPassword && (
                    <p className="text-red-500 text-sm mt-1 animate-shake">{errors.loginPassword}</p>
                  )}
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loginData.rememberMe}
                      onChange={(e) => setLoginData((prev) => ({ ...prev, rememberMe: e.target.checked }))}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 border-2 rounded transition-all duration-300 ${
                        loginData.rememberMe
                          ? `${isDarkMode ? "bg-orange-400 border-orange-400" : "bg-orange-400 border-orange-400"}`
                          : isDarkMode
                            ? "border-slate-400"
                            : "border-slate-300"
                      }`}
                    >
                      {loginData.rememberMe && <CheckCircle className="w-3 h-3 text-white absolute" />}
                    </div>
                    <span className={`ml-3 text-sm ${colors.accent}`}>Lembrar de mim</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-12 ${colors.button} text-white rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link
                  href="/senha"
                  className={`${isDarkMode ? "text-orange-400" : "text-orange-400"} hover:underline text-sm`}
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <div
              className={`transition-all duration-500 ${
                !isLoginMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Criar nova conta</h2>
                <p className={colors.accent}>Preencha os dados para começar</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="email"
                      name="cadastroEmail"
                      placeholder="E-mail corporativo"
                      value={cadastroData.email}
                      onChange={(e) => {
                        setCadastroData((prev) => ({ ...prev, email: e.target.value }))
                        clearError("cadastroEmail")
                      }}
                      className={`w-full h-12 pl-10 pr-4 border rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400/20 ${colors.input} ${
                        errors.cadastroEmail ? "border-red-500" : ""
                      }`}
                      required
                    />
                  </div>
                  {errors.cadastroEmail && (
                    <p className="text-red-500 text-sm mt-1 animate-shake">{errors.cadastroEmail}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <Building
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="text"
                      name="cnpj"
                      placeholder="CNPJ"
                      value={cadastroData.cnpj}
                      onChange={handleCNPJChange}
                      className={`w-full h-12 pl-10 pr-4 border rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 ${colors.input} ${
                        errors.cnpj ? "border-red-500" : ""
                      }`}
                      required
                    />
                  </div>
                  {errors.cnpj && <p className="text-red-500 text-sm mt-1 animate-shake">{errors.cnpj}</p>}
                </div>

                <div>
                  <div className="relative">
                    <User
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Nome da empresa"
                      value={cadastroData.nome}
                      onChange={(e) => {
                        setCadastroData((prev) => ({ ...prev, nome: e.target.value }))
                        clearError("nome")
                      }}
                      className={`w-full h-12 pl-10 pr-4 border rounded-xl transition-all duration-300 focus:outline-none focus:border-oeange-400 focus:ring-2 focus:ring-orange-400/20 ${colors.input} ${
                        errors.empresa ? "border-red-500" : ""
                      }`}
                      required
                    />
                  </div>
                  {errors.empresa && <p className="text-red-500 text-sm mt-1 animate-shake">{errors.empresa}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Senha (mín. 8 caracteres)"
                      value={cadastroData.password}
                      onChange={handlePasswordChange}
                      className={`w-full h-12 pl-10 pr-12 border rounded-xl transition-all duration-300 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 ${colors.input} ${
                        errors.password ? "border-red-500" : ""
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-300 p-2 rounded-lg ${colors.hover}`}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-sm mt-1 animate-shake">{errors.password}</p>}
                  {cadastroData.password && (
                    <div className="mt-2">
                      <div
                        className={`w-full h-1 rounded-full overflow-hidden mb-1 ${
                          isDarkMode ? "bg-slate-700" : "bg-slate-200"
                        }`}
                      >
                        <div
                          className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                          style={{ width: `${passwordStrength}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs ${colors.accent}`}>{getStrengthText()}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cadastroData.acceptTerms}
                      onChange={(e) => setCadastroData((prev) => ({ ...prev, acceptTerms: e.target.checked }))}
                      className="sr-only"
                      required
                    />
                    <div
                      className={`w-5 h-5 border-2 rounded transition-all duration-300 flex-shrink-0 mt-0.5 ${
                        cadastroData.acceptTerms
                          ? `${isDarkMode ? "bg-orange-400 border-orange-400" : "bg-orange-400 border-orange-400"}`
                          : isDarkMode
                            ? "border-slate-400"
                            : "border-slate-300"
                      }`}
                    >
                      {cadastroData.acceptTerms && <CheckCircle className="w-3 h-3 text-white absolute" />}
                    </div>
                    <span className={`text-sm leading-5 ${colors.accent}`}>
                      Aceito os{" "}
                      <a href="#" className={`${isDarkMode ? "text-orange-400" : "text-orange-400"} hover:underline`}>
                        termos de uso
                      </a>{" "}
                      e{" "}
                      <a href="https://engeman.net/wp-content/uploads/2025/10/Politica-de-Privacidade-12-03-2024.pdf" className={`${isDarkMode ? "text-orange-400" : "text-orange-400"} hover:underline`}>
                        política de privacidade
                      </a>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-12 ${colors.button} text-white rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <Link href = "/portal" >
                    Criar Conta
                    </Link>
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <button
                  onClick={() => switchToMode(true)}
                  disabled={isTransitioning}
                  className={`flex items-center gap-2 ${isDarkMode ? "text-orange-400" : "text-orange-400"} hover:underline text-sm mx-auto disabled:opacity-50`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Já tenho uma conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        
        /* Container do carrossel */
        .carousel-container {
          display: flex;
          width: 100%;
          height: 100vh;
          position: relative;
          overflow: hidden;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Painéis */
        .panel-esquerda,
        .panel-direita {
          flex: 1;
          width: 50%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          position: relative;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Efeito carrossel - exatamente como no CSS original */
        .carousel-container.modo-cadastro .panel-esquerda {
          transform: translateX(100%);
        }
        
        .carousel-container.modo-cadastro .panel-direita {
          transform: translateX(-100%);
        }
        
        /* Responsividade para mobile */
        @media (max-width: 768px) {
          .carousel-container {
            flex-direction: column;
          }
          
          .panel-esquerda,
          .panel-direita {
            width: 100%;
            height: 50vh;
            padding: 1.5rem;
          }
          
          .carousel-container.modo-cadastro .panel-esquerda {
            transform: translateY(100%);
          }
          
          .carousel-container.modo-cadastro .panel-direita {
            transform: translateY(-100%);
          }
        }
        
        @media (max-width: 480px) {
          .panel-esquerda,
          .panel-direita {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
