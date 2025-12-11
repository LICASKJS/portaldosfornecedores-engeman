/**
 * Página de Administração - Dashboard de Fornecedores
 * 
 * Este componente gerencia a interface administrativa do portal de fornecedores.
 * Permite que administradores visualizem, filtrem, aprovem/reprovem fornecedores,
 * editem notas de homologação, baixem documentos e gerem relatórios.
 * 
 * Funcionalidades principais:
 * - Autenticação de administradores
 * - Visualização de dashboard com estatísticas
 * - Listagem e busca de fornecedores
 * - Aprovação/reprovação de fornecedores com diálogo de confirmação
 * - Edição de notas de homologação
 * - Download de documentos
 * - Geração de relatórios em PDF
 * - Sistema de notificações em tempo real
 * - Tema claro/escuro
 * 
 * @module app/admin/page
 * @author Sistema Engeman
 */

"use client"

{/* Bibliotecas utilizadas */}

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  LogOut,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
  ArrowRight,
} from "lucide-react"
import type { JSX } from "react/jsx-runtime"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

{/* URL temporária de hospedagem do back-end*/}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const STORAGE_TOKEN_KEY = "admin_portal_token"
const STORAGE_EMAIL_KEY = "admin_portal_email"

const ADMIN_HINT = "Acesso restrito aos administradores"
const LIMITE_DOCUMENTOS_VISIVEIS = 5

{/* Número real dos dados dos fornecedores */}

type DashboardResumo = {
  total_cadastrados: number
  total_aprovados: number
  total_em_analise: number
  total_reprovados: number
  total_documentos: number
}

{/* Documentos anexados pelos fornecedores no portal */}

type DocumentoResumo = {
  id: number
  nome: string
  categoria: string
  data_upload: string | null
}

{/* Aprovação do fornecedor */}

type FornecedorAdmin = {
  id: number
  nome: string
  email: string
  cnpj: string
  categoria?: string | null
  status: "APROVADO" | "A CADASTRAR " | "REPROVADO"
  aprovado: boolean
  nota_homologacao: number | null
  nota_iqf: number | null
  documentos: DocumentoResumo[]
  total_documentos: number
  ultima_atividade: string | null
  data_cadastro: string | null
}

type NotasFornecedorEdicao = {
  notaHomologacao?: string
}

{/* Notificação em tempo real */}

type NotificacaoItem = {
  id: string
  tipo: "cadastro" | "documento"
  titulo: string
  descricao: string
  timestamp: string
  detalhes?: Record<string, string>
}

type StatusFiltro = "TODOS" | "APROVADO" | "REPROVADO" | "PENDENTE"

/**
 * Formata um número para exibição no formato brasileiro (pt-BR).
 * 
 * Converte números para o formato brasileiro com separadores de milhar.
 * Se o valor for undefined ou null, retorna "0".
 * 
 * @param value - Número a ser formatado
 * @returns String formatada no padrão brasileiro (ex: "1.234,56")
 */
function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return "0"
  return new Intl.NumberFormat("pt-BR").format(value)
}

/**
 * Formata uma data/hora para exibição no formato brasileiro.
 * 
 * Converte uma string de data/hora ISO para o formato brasileiro (dd/mm/aaaa, hh:mm).
 * Se o valor for inválido ou vazio, retorna "—".
 * 
 * @param value - String de data/hora ISO ou null/undefined
 * @returns String formatada (ex: "15/01/2025, 14:30") ou "—" se inválido
 */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

/**
 * Formata uma data para exibição relativa (tempo decorrido).
 * 
 * Calcula o tempo decorrido desde a data fornecida e retorna uma string
 * amigável como "há 5 min", "há 2 h", "há 3 d" ou a data formatada se
 * for mais de 7 dias.
 * 
 * @param value - String de data/hora ISO
 * @returns String com tempo relativo ou data formatada
 */
function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "agora"
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.round(diffMs / (60 * 1000))
  if (diffMinutes < 1) return "agora"
  if (diffMinutes < 60) return `há ${diffMinutes} min`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `há ${diffHours} h`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays} d`
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date)
}

/**
 * Encurta o nome de um documento para caber na interface.
 * 
 * Trunca o nome do documento se exceder o comprimento máximo,
 * adicionando "..." no final. Garante que pelo menos 3 caracteres
 * sejam mostrados antes do "...".
 * 
 * @param value - Nome completo do documento
 * @param maxLength - Comprimento máximo desejado (padrão: 36)
 * @returns Nome truncado com "..." se necessário
 */
function shortenDocumentName(value: string, maxLength = 36): string {
  const formatted = (value || "").trim()
  if (formatted.length <= maxLength) return formatted
  const safeLength = Math.max(3, maxLength - 3)
  return `${formatted.slice(0, safeLength).trimEnd()}...`
}

/**
 * Normaliza um valor para número, suportando formatos brasileiros.
 * 
 * Converte strings com vírgula ou ponto como separador decimal para número.
 * Suporta formatos como "90,5", "90.5", "90,50", etc.
 * Retorna null se não for possível converter.
 * 
 * @param value - Valor a ser normalizado (string, número, etc.)
 * @returns Número normalizado ou null se inválido
 */
function normalizeNota(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null

    const numericSymbols = trimmed.replace(/[^\d,.\-]/g, "")
    if (!numericSymbols) return null

    const lastComma = numericSymbols.lastIndexOf(",")
    const lastDot = numericSymbols.lastIndexOf(".")
    let normalized = numericSymbols

    if (lastComma > -1 && lastDot > -1) {
      normalized =
        lastComma > lastDot
          ? numericSymbols.replace(/\./g, "").replace(/,/g, ".")
          : numericSymbols.replace(/,/g, "")
    } else if (lastComma > -1) {
      normalized = numericSymbols.replace(/\./g, "").replace(/,/g, ".")
    } else if (lastDot > -1) {
      const parts = numericSymbols.split(".")
      const decimal = parts.pop()
      normalized = `${parts.join("")}.${decimal ?? ""}`
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

/**
 * Formata uma nota numérica para exibição com 2 casas decimais.
 * 
 * Converte um número para string formatada no padrão brasileiro com
 * sempre 2 casas decimais. Se o valor for null ou undefined, retorna "—".
 * 
 * @param value - Nota numérica a ser formatada
 * @returns String formatada (ex: "90,50") ou "—" se inválido
 */
function formatNota(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "\u2014"
  }

  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

/**
 * Verifica se um valor é um objeto JSON válido (não array, não null).
 * 
 * Type guard que verifica se o valor é um objeto plano que pode ser
 * usado como Record<string, unknown>.
 * 
 * @param value - Valor a ser verificado
 * @returns True se for um objeto JSON válido
 */
const isJsonObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Sanitiza uma mensagem do servidor removendo HTML e normalizando.
 * 
 * Remove tags HTML, normaliza espaços em branco e filtra mensagens
 * genéricas de erro 404. Retorna null se a mensagem for vazia ou inválida.
 * 
 * @param value - Mensagem do servidor a ser sanitizada
 * @returns Mensagem sanitizada ou null se inválida
 */
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

/**
 * Extrai mensagem de erro de uma resposta do servidor.
 * 
 * Busca mensagens em campos comuns (message, detail, error) em objetos JSON
 * ou tenta extrair de strings. Se não encontrar, retorna o fallback fornecido.
 * 
 * @param data - Dados da resposta do servidor (objeto, string, etc.)
 * @param fallback - Mensagem padrão se não encontrar mensagem válida
 * @returns Mensagem extraída e sanitizada ou fallback
 */
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

/**
 * Faz parse seguro de uma resposta HTTP para JSON.
 * 
 * Verifica o Content-Type da resposta e tenta fazer parse como JSON.
 * Se falhar ou não for JSON, retorna o texto como objeto com campo message.
 * 
 * @param response - Objeto Response da fetch API
 * @returns Objeto parseado ou null se não for possível
 */
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
    return { message: text }
  }
}

/**
 * Adapta lista de fornecedores do servidor para o formato usado no admin.
 * 
 * Normaliza e adapta dados de fornecedores vindos da API, unificando
 * diferentes nomes de campos (nota_iqf, notaIQF, media_iqf, etc.) para
 * um formato consistente. Normaliza notas para números válidos.
 * 
 * @param lista - Lista de objetos de fornecedores do servidor
 * @returns Array de FornecedorAdmin com dados normalizados
 */
function adaptFornecedores(lista: unknown[]): FornecedorAdmin[] {
  return lista
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const base = item as Record<string, unknown> & Partial<FornecedorAdmin>
      const notaIQF =
        normalizeNota(
          base.nota_iqf ??
            base.notaIQF ??
            base["media_iqf"] ??
            base["mediaIQF"] ??
            base["iqf"] ??
            base["nota_iqf_media"] ??
            base["notaIQFMedia"],
        ) ?? null

      const notaHomologacao =
        normalizeNota(
          base.nota_homologacao ??
            base.notaHomologacao ??
            base["media_homologacao"] ??
            base["mediaHomologacao"] ??
            base["homologacao"] ??
            base["nota_homolog"],
        ) ?? null

      return {
        ...(item as FornecedorAdmin),
        nota_iqf: notaIQF,
        nota_homologacao: notaHomologacao,
      }
    })
}

/**
 * Normaliza o status de um fornecedor para um dos valores válidos.
 * 
 * Converte strings de status para um dos três valores padronizados:
 * APROVADO, REPROVADO ou PENDENTE. Case-insensitive.
 * 
 * @param rawStatus - Status bruto do fornecedor (pode ser string, null, undefined)
 * @returns Status normalizado: "APROVADO", "REPROVADO" ou "PENDENTE"
 */
function normalizarStatus(rawStatus: string | null | undefined): "APROVADO" | "REPROVADO" | "PENDENTE" {
  const normalized = (rawStatus ?? "").toString().trim().toUpperCase()
  if (normalized === "APROVADO") return "APROVADO"
  if (normalized === "REPROVADO") return "REPROVADO"
  return "PENDENTE"
}

/**
 * Retorna configuração visual (cores, ícones) para um status.
 * 
 * Retorna um objeto com label, cores (texto, fundo, borda) e ícone
 * apropriados para exibir o status do fornecedor na interface.
 * As cores variam conforme o tema (claro/escuro).
 * 
 * @param status - Status do fornecedor
 * @param isDarkMode - Se o tema escuro está ativo
 * @returns Objeto com configuração visual do status
 */
function statusConfig(status: FornecedorAdmin["status"], isDarkMode: boolean) {
  const normalized = normalizarStatus(status)
  switch (normalized) {
    case "APROVADO":
      return {
        label: "Aprovado",
        color: isDarkMode ? "text-emerald-400" : "text-emerald-600",
        bg: isDarkMode ? "bg-emerald-500/10" : "bg-emerald-100",
        border: isDarkMode ? "border-emerald-500/30" : "border-emerald-300",
        icon: <CheckCircle2 className="w-4 h-4" />,
      }
    case "REPROVADO":
      return {
        label: "Reprovado",
        color: isDarkMode ? "text-red-400" : "text-red-600",
        bg: isDarkMode ? "bg-red-500/10" : "bg-red-100",
        border: isDarkMode ? "border-red-500/30" : "border-red-300",
        icon: <XCircle className="w-4 h-4" />,
      }
    default:
      return {
        label: "A cadastrar",
        color: isDarkMode ? "text-amber-400" : "text-amber-600",
        bg: isDarkMode ? "bg-amber-500/10" : "bg-amber-100",
        border: isDarkMode ? "border-amber-500/30" : "border-amber-300",
        icon: <AlertCircle className="w-4 h-4" />,
      }
  }
}

/**
 * Hook personalizado para debounce de valores.
 * 
 * Atrasa a atualização de um valor até que não haja mudanças por um
 * período especificado. Útil para evitar requisições excessivas durante
 * digitação em campos de busca.
 * 
 * @param value - Valor a ser debounced
 * @param delay - Tempo de espera em milissegundos (padrão: 400ms)
 * @returns Valor debounced
 */
function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
{/* Funções para controlar os dados, documentos e notas dos fornecedores*/}

export default function AdminDashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardResumo | null>(null)
  const [fornecedores, setFornecedores] = useState<FornecedorAdmin[]>([])
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [carregandoDashboard, setCarregandoDashboard] = useState(false)
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(false)
  const [carregandoNotificacoes, setCarregandoNotificacoes] = useState(false)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("TODOS")
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)
  const [mostrarIndicadorNotificacoes, setMostrarIndicadorNotificacoes] = useState(false)
  const filtroRef = useRef<HTMLDivElement | null>(null)
  const notificacoesRef = useRef<HTMLDivElement | null>(null)
  const notificacoesCountRef = useRef(0)
  const [processandoDecisaoId, setProcessandoDecisaoId] = useState<number | null>(null)
  const [downloadDocumentoId, setDownloadDocumentoId] = useState<number | null>(null)
  const [notasEdicao, setNotasEdicao] = useState<Record<number, NotasFornecedorEdicao>>({})
  const [salvandoNotaId, setSalvandoNotaId] = useState<number | null>(null)
  const [notaHomologacaoEditandoId, setNotaHomologacaoEditandoId] = useState<number | null>(null)
  const [fornecedorParaExcluir, setFornecedorParaExcluir] = useState<FornecedorAdmin | null>(null)
  const [excluindoFornecedorId, setExcluindoFornecedorId] = useState<number | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)
  const [documentosExpandidos, setDocumentosExpandidos] = useState<Record<number, boolean>>({})
  const [token, setToken] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginSenha, setLoginSenha] = useState("")
  const [loginErro, setLoginErro] = useState<string | null>(null)
  const [autenticando, setAutenticando] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [fornecedorParaDecisao, setFornecedorParaDecisao] = useState<{ fornecedor: FornecedorAdmin; status: "APROVADO" | "REPROVADO" } | null>(null)
  const buscaDebounced = useDebounce(busca)
  const exclusaoEmAndamento =
    fornecedorParaExcluir !== null && excluindoFornecedorId !== null
      ? excluindoFornecedorId === fornecedorParaExcluir.id
      : false

  const totaisPorStatus = useMemo(() => (
    fornecedores.reduce(
      (acumulado, fornecedor) => {
        const statusNormalizado = normalizarStatus(fornecedor.status)
        acumulado[statusNormalizado] += 1
        return acumulado
      },
      { APROVADO: 0, REPROVADO: 0, PENDENTE: 0 } as Record<"APROVADO" | "REPROVADO" | "PENDENTE", number>,
    )
  ), [fornecedores])

  const fornecedoresFiltrados = useMemo(() => {
    if (filtroStatus === "TODOS") {
      return fornecedores
    }
    return fornecedores.filter((fornecedor) => {
      const statusNormalizado = normalizarStatus(fornecedor.status)
      if (filtroStatus === "PENDENTE") {
        return statusNormalizado === "PENDENTE"
      }
      return statusNormalizado === filtroStatus
    })
  }, [fornecedores, filtroStatus])

  {/* Filtragem de acesso*/}

  const opcoesFiltro = useMemo(() => [
    {
      valor: "TODOS" as StatusFiltro,
      rotulo: "Todos",
      descricao: "Mostrar todos os fornecedores",
      contagem: fornecedores.length,
    },
    {
      valor: "APROVADO" as StatusFiltro,
      rotulo: "Aprovados",
      descricao: "Somente fornecedores homologados",
      contagem: totaisPorStatus.APROVADO,
    },
    {
      valor: "PENDENTE" as StatusFiltro,
      rotulo: "A cadastrar",
      descricao: "Cadastros aguardando decisão",
      contagem: totaisPorStatus.PENDENTE,
    },
    {
      valor: "REPROVADO" as StatusFiltro,
      rotulo: "Reprovados",
      descricao: "Fornecedores nao aprovados",
      contagem: totaisPorStatus.REPROVADO,
    },
  ], [fornecedores.length, totaisPorStatus.APROVADO, totaisPorStatus.PENDENTE, totaisPorStatus.REPROVADO])

  const filtroSelecionado = useMemo(
    () => opcoesFiltro.find((opcao) => opcao.valor === filtroStatus),
    [opcoesFiltro, filtroStatus],
  )

  useEffect(() => {
    if (!filtroAberto) return
    const handleClickOutside = (event: MouseEvent) => {
      if (filtroRef.current && !filtroRef.current.contains(event.target as Node)) {
        setFiltroAberto(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [filtroAberto])

  useEffect(() => {
    if (!notificacoesAbertas) return
    const handleClickOutside = (event: MouseEvent) => {
      if (notificacoesRef.current && !notificacoesRef.current.contains(event.target as Node)) {
        setNotificacoesAbertas(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [notificacoesAbertas])

  useEffect(() => {
    const quantidade = notificacoes.length
    if (quantidade === 0) {
      notificacoesCountRef.current = 0
      setMostrarIndicadorNotificacoes(false)
      return
    }
    if (quantidade > notificacoesCountRef.current && !notificacoesAbertas) {
      setMostrarIndicadorNotificacoes(true)
    }
    notificacoesCountRef.current = quantidade
  }, [notificacoes.length, notificacoesAbertas])

  useEffect(() => {
    if (!mensagemSucesso) return
    const timer = window.setTimeout(() => setMensagemSucesso(null), 4000)
    return () => window.clearTimeout(timer)
  }, [mensagemSucesso])

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

  const getGradientClasses = () => {
    return isDarkMode ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-orange-400 to-red-500"
  }

  const getAccentColor = () => {
    return isDarkMode ? "text-orange-400" : "text-orange-500"
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
    const storedEmail = localStorage.getItem(STORAGE_EMAIL_KEY)
    if (storedToken) {
      setToken(storedToken)
      setAdminEmail(storedEmail)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setDashboard(null)
      setFornecedores([])
      setNotificacoes([])
      setNotificacoesAbertas(false)
      setMostrarIndicadorNotificacoes(false)
      notificacoesCountRef.current = 0
    }
  }, [token])

  const handleLogout = () => {
    setToken(null)
    setAdminEmail(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_TOKEN_KEY)
      localStorage.removeItem(STORAGE_EMAIL_KEY)
    }
  }

  const authorizedFetch = async (path: string, options: RequestInit = {}) => {
    if (!token) throw new Error("Token não disponível")
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
    if (response.status === 401 || response.status === 403) {
      handleLogout()
      throw new Error("Sessão expirada")
    }
    return response
  }

  {/* Tela de Login com acesso apenas aos admin*/}

  /**
   * Processa o login do administrador.
   * 
   * Valida credenciais, faz requisição ao endpoint /api/admin/login,
   * armazena token e email no localStorage e atualiza estados de autenticação.
   * Redireciona para dashboard em caso de sucesso.
   * 
   * @param event - Evento de submit do formulário de login
   */
  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginErro(null)
    setAutenticando(true)
    try {
      const resposta = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, senha: loginSenha }),
      })
      const dados = await parseJsonSafe(resposta)
      if (!resposta.ok) {
        setLoginErro(getMessageFromData(dados, "Credenciais invalidas. Verifique o e-mail autorizado e a senha informada."))
        return
      }
      if (!isJsonObject(dados) || typeof dados.access_token !== "string") {
        setLoginErro("Resposta invalida do servidor. Tente novamente.")
        return
      }
      const novoToken = dados.access_token
      setToken(novoToken)
      setAdminEmail(loginEmail.trim())
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_TOKEN_KEY, novoToken)
        localStorage.setItem(STORAGE_EMAIL_KEY, loginEmail.trim())
      }
      setLoginSenha("")
    } catch (error) {
      console.error(error)
      setLoginErro("Erro ao autenticar. Tente novamente em instantes.")
    } finally {
      setAutenticando(false)
    }
  }

  const handleSelecionarFiltroStatus = (valor: StatusFiltro) => {
    setFiltroStatus(valor)
    setFiltroAberto(false)
  }

{/* Função de decisão para aprovar ou reprovar o fornecedor */}

  const handleRegistrarDecisao = async (fornecedor: FornecedorAdmin, status: "APROVADO" | "REPROVADO") => {
    setFornecedorParaDecisao({ fornecedor, status })
    setShowConfirmDialog(true)
  }

  const handleConfirmarDecisao = async () => {
    if (!fornecedorParaDecisao) return
    const { fornecedor, status } = fornecedorParaDecisao
    setShowConfirmDialog(false)
    try {
      setProcessandoDecisaoId(fornecedor.id)
      setErro(null)
      const observacaoPadrao =
        status === "APROVADO"
          ? "Fornecedor aprovado no processo de homologação."
          : "Fornecedor reprovado no processo de homologação."
      const payload = {
        status,
        notaReferencia: null,
        observacao: observacaoPadrao,
        enviarEmail: true,
      }
      const resposta = await authorizedFetch(`/api/admin/fornecedores/${fornecedor.id}/decisão`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const dados = await parseJsonSafe(resposta)
      if (!resposta.ok) {
        setErro(getMessageFromData(dados, "Não foi possivel registrar a decisão."))
        return
      }

      const dadosRegistro = isJsonObject(dados) ? dados : null
      const fornecedorPayload = dadosRegistro?.fornecedor

      if (fornecedorPayload) {
        const fornecedorAtualizado = adaptFornecedores([fornecedorPayload])[0]
        if (fornecedorAtualizado) {
          setFornecedores((prev) =>
            prev.map((item) => (item.id === fornecedorAtualizado.id ? fornecedorAtualizado : item)),
          )
        }
      } else {
        const params = buscaDebounced ? `?search=${encodeURIComponent(buscaDebounced)}` : ""
        const listaResposta = await authorizedFetch(`/api/admin/fornecedores${params}`)
        const listaDados = await parseJsonSafe(listaResposta)
        if (Array.isArray(listaDados)) {
          setFornecedores(adaptFornecedores(listaDados))
        } else if (isJsonObject(listaDados) && Array.isArray(listaDados.fornecedores)) {
          setFornecedores(adaptFornecedores(listaDados.fornecedores))
        } else {
          setFornecedores([])
          setErro(getMessageFromData(listaDados, "Não foi possivel atualizar a lista de fornecedores apos a decisão."))
        }
      }

      const emailEnviadoRaw = dadosRegistro?.emailEnviado
      const emailEnviadoFlag =
        typeof emailEnviadoRaw === "boolean"
          ? emailEnviadoRaw
          : typeof emailEnviadoRaw === "number"
            ? emailEnviadoRaw !== 0
            : undefined

      let mensagemFinal =
        status === "APROVADO"
          ? `Fornecedor ${fornecedor.nome} aprovado com sucesso.`
          : `Fornecedor ${fornecedor.nome} marcado como reprovado.`
      if (emailEnviadoFlag === false) {
        mensagemFinal += " Email não foi enviado automaticamente. Verifique as configurações."
      } else {
        mensagemFinal += " Email enviado ao fornecedor com o resultado."
      }
      setMensagemSucesso(mensagemFinal.trim())
      setFornecedorParaDecisao(null)
    } catch (error) {
      console.error(error)
      setErro("Falha ao registrar a decisão. Tente novamente.")
    } finally {
      setProcessandoDecisaoId(null)
    }
  }

  const handleCancelarDecisao = () => {
    setShowConfirmDialog(false)
    setFornecedorParaDecisao(null)
  }

  /**
   * Solicita a exclusão de um fornecedor (abre modal de confirmação).
   * 
   * Define o fornecedor a ser excluído e abre o modal de confirmação.
   * Não executa a exclusão, apenas prepara o estado para o modal.
   * 
   * @param fornecedor - Fornecedor a ser excluído
   */
  const handleSolicitarExclusaoFornecedor = (fornecedor: FornecedorAdmin) => {
    setErro(null)
    setFornecedorParaExcluir(fornecedor)
  }

  /**
   * Fecha o modal de exclusão de fornecedor.
   * 
   * Limpa o estado do fornecedor a ser excluído, mas apenas se não
   * houver exclusão em andamento (para evitar fechar durante o processo).
   */
  const handleFecharModalExclusao = () => {
    if (excluindoFornecedorId !== null) return
    setFornecedorParaExcluir(null)
  }

  /**
   * Confirma e executa a exclusão de um fornecedor.
   * 
   * Faz requisição DELETE ao servidor para excluir o fornecedor,
   * remove da lista local e exibe mensagem de sucesso. Em caso de
   * erro, exibe mensagem de erro.
   */
  const handleConfirmarExcluirFornecedor = async () => {
    if (!fornecedorParaExcluir) return
    setExcluindoFornecedorId(fornecedorParaExcluir.id)
    try {
      setErro(null)
      const resposta = await authorizedFetch(`/api/admin/fornecedores/${fornecedorParaExcluir.id}`, {
        method: "DELETE",
      })
      const dados = await parseJsonSafe(resposta)
      if (!resposta.ok) {
        setErro(getMessageFromData(dados, "Nao foi possivel excluir o fornecedor."))
        return
      }

      setFornecedores((prev) => prev.filter((item) => item.id !== fornecedorParaExcluir.id))
      const mensagem = getMessageFromData(
        dados,
        `Fornecedor ${fornecedorParaExcluir.nome} excluido com sucesso.`,
      )
      setMensagemSucesso(mensagem)
      setFornecedorParaExcluir(null)
    } catch (error) {
      console.error(error)
      setErro("Falha ao excluir o fornecedor. Tente novamente.")
    } finally {
      setExcluindoFornecedorId(null)
    }
  }

  /**
   * Faz download de um documento enviado por um fornecedor.
   * 
   * Faz requisição autenticada ao endpoint de download, converte
   * a resposta para blob, cria URL temporária e inicia o download
   * automaticamente. Abre o arquivo em nova aba e faz download.
   * 
   * @param documento - Documento a ser baixado
   */
  const handleDownloadDocumento = async (documento: DocumentoResumo) => {
    try {
      setDownloadDocumentoId(documento.id)
      setErro(null)
      const resposta = await authorizedFetch(`/api/admin/documentos/${documento.id}/download`, {
        method: "GET",
      })
      if (!resposta.ok) {
        setErro("Não foi possivel baixar o documento. Tente novamente.")
        return
      }
      const blob = await resposta.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener")
      const link = document.createElement("a")
      link.href = url
      link.download = documento.nome || `documento-${documento.id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 2000)
      setMensagemSucesso(`Download iniciado para ${documento.nome}`)
    } catch (error) {
      console.error(error)
      setErro("Não foi possível baixar o documento. Tente novamente.")
    } finally {
      setDownloadDocumentoId(null)
    }
  }

  /**
   * Alterna a visualização completa da lista de documentos de um fornecedor.
   *
   * Permite expandir ou recolher a lista de documentos exibida,
   * facilitando o acesso a todos os arquivos quando existem muitos anexos.
   *
   * @param fornecedorId - ID do fornecedor que terá a lista alternada
   */
  const toggleDocumentosFornecedor = (fornecedorId: number) => {
    setDocumentosExpandidos((prev) => ({
      ...prev,
      [fornecedorId]: !prev[fornecedorId],
    }))
  }

  /**
   * Inicia a edição da nota de homologação de um fornecedor.
   * 
   * Preenche o campo de edição com a nota atual (convertida para formato
   * brasileiro com vírgula) e habilita o modo de edição para o fornecedor.
   * 
   * @param fornecedor - Fornecedor cuja nota será editada
   */
  const handleEditarNotaHomologacao = (fornecedor: FornecedorAdmin) => {
    const valorAtual =
      fornecedor.nota_homologacao !== null && fornecedor.nota_homologacao !== undefined
        ? String(fornecedor.nota_homologacao).replace(".", ",")
        : ""
    setNotasEdicao((prev) => ({
      ...prev,
      [fornecedor.id]: {
        ...prev[fornecedor.id],
        notaHomologacao: prev[fornecedor.id]?.notaHomologacao ?? valorAtual,
      },
    }))
    setNotaHomologacaoEditandoId(fornecedor.id)
  }

  /**
   * Atualiza o valor da nota de homologação durante a edição.
   * 
   * Atualiza o estado de edição com o novo valor digitado pelo usuário,
   * sem salvar ainda. Permite que o usuário digite e veja o valor atualizado.
   * 
   * @param fornecedorId - ID do fornecedor
   * @param valor - Novo valor da nota (string digitada pelo usuário)
   */
  const handleAlterarNotaHomologacao = (fornecedorId: number, valor: string) => {
    setNotasEdicao((prev) => ({
      ...prev,
      [fornecedorId]: {
        ...prev[fornecedorId],
        notaHomologacao: valor,
      },
    }))
  }

  /**
   * Cancela a edição da nota de homologação.
   * 
   * Remove o fornecedor do estado de edição e desabilita o modo de edição,
   * descartando qualquer alteração não salva.
   * 
   * @param fornecedorId - ID do fornecedor cuja edição será cancelada
   */
  const handleCancelarNotaHomologacao = (fornecedorId: number) => {
    setNotasEdicao((prev) => {
      if (!(fornecedorId in prev)) return prev
      const { [fornecedorId]: _, ...rest } = prev
      return rest
    })
    setNotaHomologacaoEditandoId((current) => (current === fornecedorId ? null : current))
  }

  /**
   * Salva a nota de homologação editada no servidor.
   * 
   * Normaliza o valor da nota, valida e faz requisição ao servidor para
   * atualizar. Tenta múltiplos endpoints (PATCH/POST em /notas ou /nota)
   * para compatibilidade. Atualiza a lista local após sucesso.
   * 
   * @param fornecedor - Fornecedor cuja nota será salva
   */
  const handleSalvarNotaHomologacao = async (fornecedor: FornecedorAdmin) => {
    const valor = notasEdicao[fornecedor.id]?.notaHomologacao ?? ""
    const notaNormalizada = normalizeNota(valor)
    if (notaNormalizada === null) {
      setErro("Informe uma nota de homologação válida.")
      return
    }

    try {
      setSalvandoNotaId(fornecedor.id)
      setErro(null)
      const mensagemErroPadrao = "Erro ao salvar a nota de homologação."
      const payload = JSON.stringify({ notaHomologacao: notaNormalizada })
      const basePath = `/api/admin/fornecedores/${fornecedor.id}`
      const tentativas = [
        { path: `${basePath}/notas`, method: "PATCH" as const },
        { path: `${basePath}/notas`, method: "POST" as const },
        { path: `${basePath}/nota`, method: "PATCH" as const },
        { path: `${basePath}/nota`, method: "POST" as const },
      ]

      let respostaFinal: Response | null = null
      let dadosResposta: unknown = null
      let ultimaMensagemErro: string | null = null

      for (const tentativa of tentativas) {
        const respostaTentativa = await authorizedFetch(tentativa.path, {
          method: tentativa.method,
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
        })

        const dadosTentativa = await parseJsonSafe(respostaTentativa)

        if (respostaTentativa.ok) {
          respostaFinal = respostaTentativa
          dadosResposta = dadosTentativa
          break
        }

        ultimaMensagemErro = getMessageFromData(dadosTentativa, mensagemErroPadrao)

        if (!(respostaTentativa.status === 404 || respostaTentativa.status === 405)) {
          respostaFinal = respostaTentativa
          dadosResposta = dadosTentativa
          break
        }
      }

      if (!respostaFinal || !respostaFinal.ok) {
        throw new Error(ultimaMensagemErro ?? mensagemErroPadrao)
      }

      const dadosNotas = isJsonObject(dadosResposta) ? dadosResposta : null

      if (dadosNotas?.fornecedor) {
        const adaptados = adaptFornecedores([dadosNotas.fornecedor])
        if (adaptados.length > 0) {
          const atualizado = adaptados[0]
          setFornecedores((prev) =>
            prev.map((item) => (item.id === fornecedor.id ? { ...item, ...atualizado } : item)),
          )
        }
      } else {
        setFornecedores((prev) =>
          prev.map((item) =>
            item.id === fornecedor.id ? { ...item, nota_homologacao: notaNormalizada } : item,
          ),
        )
      }

      setMensagemSucesso("Nota de homologação atualizada com sucesso.")
      setNotasEdicao((prev) => {
        const { [fornecedor.id]: _, ...rest } = prev
        return rest
      })
      setNotaHomologacaoEditandoId(null)
    } catch (error) {
      console.error(error)
      setErro(error instanceof Error ? error.message : "Erro ao salvar a nota de homologação.")
    } finally {
      setSalvandoNotaId(null)
    }
  }

  useEffect(() => {
    if (!token) return
    
    /**
     * Carrega estatísticas do dashboard administrativo.
     * 
     * Faz requisição ao endpoint /api/admin/dashboard para obter totais
     * de fornecedores cadastrados, aprovados, reprovados, em análise e
     * total de documentos. Atualiza o estado do dashboard.
     */
    const carregarDashboard = async () => {
      try {
        setCarregandoDashboard(true)
        const resposta = await authorizedFetch("/api/admin/dashboard")
        const dados = await parseJsonSafe(resposta)
        if (!resposta.ok) {
          setErro(getMessageFromData(dados, "Falha ao carregar os indicadores do painel."))
          setDashboard(null)
          return
        }
        if (isJsonObject(dados)) {
          setDashboard(dados as DashboardResumo)
        } else {
          setDashboard(null)
        }

      } catch (error) {
        console.error(error)
        setErro("Falha ao carregar os indicadores do painel.")
      } finally {
        setCarregandoDashboard(false)
      }
    }

    /**
     * Carrega notificações recentes do sistema.
     * 
     * Faz requisição ao endpoint /api/admin/notificacoes para obter
     * eventos recentes: novos cadastros de fornecedores e envios de
     * documentos. Limita a 25 notificações mais recentes.
     */
    const carregarNotificacoes = async () => {
      try {
        setCarregandoNotificacoes(true)
        const resposta = await authorizedFetch("/api/admin/notificacoes?limit=25")
        const dados = await parseJsonSafe(resposta)
        if (!resposta.ok) {
          setNotificacoes([])
          setErro(getMessageFromData(dados, "Falha ao carregar as notificacoes recentes."))
          return
        }
        if (Array.isArray(dados)) {
          setNotificacoes(dados)
          return
        }
        if (isJsonObject(dados) && Array.isArray(dados.eventos)) {
          setNotificacoes(dados.eventos)
          return
        }
        setNotificacoes([])
        const mensagemNotificacoes = getMessageFromData(dados, "")
        if (mensagemNotificacoes) {
          setErro(mensagemNotificacoes)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setCarregandoNotificacoes(false)
      }
    }

    carregarDashboard()
    carregarNotificacoes()
  }, [token])

  useEffect(() => {
    if (!token) return
    const carregarFornecedores = async () => {
      try {
        setCarregandoFornecedores(true)
        const params = buscaDebounced ? `?search=${encodeURIComponent(buscaDebounced)}` : ""
        const resposta = await authorizedFetch(`/api/admin/fornecedores${params}`)
        const dados = await parseJsonSafe(resposta)
        if (!resposta.ok) {
          setFornecedores([])
          setErro(getMessageFromData(dados, "Falha ao carregar a lista de fornecedores."))
          return
        }
        if (Array.isArray(dados)) {
          setFornecedores(adaptFornecedores(dados))
          return
        }
        if (isJsonObject(dados) && Array.isArray(dados.fornecedores)) {
          setFornecedores(adaptFornecedores(dados.fornecedores))
          return
        }
        setFornecedores([])
        const mensagemFornecedores = getMessageFromData(dados, "")
        if (mensagemFornecedores) {
          setErro(mensagemFornecedores)
        }
      } catch (error) {
        console.error(error)
        setErro("Falha ao carregar a lista de fornecedores.")
      } finally {
        setCarregandoFornecedores(false)
      }
    }

    carregarFornecedores()
  }, [buscaDebounced, token])

  /**
   * Gera relatório mensal em PDF com estatísticas dos fornecedores.
   * 
   * Filtra fornecedores cadastrados no mês atual, calcula totais por status,
   * cria HTML formatado com cards de resumo e tabela detalhada, e gera PDF
   * usando jsPDF e html2canvas. Faz download automático do PDF gerado.
   */
  const handleGenerateMonthlyReport = () => {
    if (gerandoRelatorio || typeof window === "undefined") {
      return
    }

    setGerandoRelatorio(true)
    setErro(null)

    try {
      const agora = new Date()
      const mesAtual = agora.getMonth()
      const anoAtual = agora.getFullYear()

      const fornecedoresDoMes = fornecedores.filter((fornecedor) => {
        if (!fornecedor.data_cadastro) return false
        const dataCadastro = new Date(fornecedor.data_cadastro)
        if (Number.isNaN(dataCadastro.getTime())) return false
        return dataCadastro.getMonth() === mesAtual && dataCadastro.getFullYear() === anoAtual
      })

      const totais = fornecedoresDoMes.reduce(
        (acumulado, fornecedor) => {
          acumulado.total += 1
          if (fornecedor.status === "APROVADO") {
            acumulado.aprovados += 1
          } else if (fornecedor.status === "REPROVADO") {
            acumulado.reprovados += 1
          } else {
            acumulado.emAnalise += 1
          }
          return acumulado
        },
        { total: 0, aprovados: 0, reprovados: 0, emAnalise: 0 },
      )

      const mesLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(agora)
      const dataGeracao = formatDateTime(agora.toISOString())

      const summaryCards = [
        {
          label: "Total cadastrados",
          valor: totais.total,
          bg: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(37,99,235,0.12))",
          border: "rgba(59,130,246,0.45)",
          text: "#1d4ed8",
        },
        {
          label: "Aprovados",
          valor: totais.aprovados,
          bg: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.12))",
          border: "rgba(34,197,94,0.45)",
          text: "#047857",
        },
        {
          label: "A cadastrar",
          valor: totais.emAnalise,
          bg: "linear-gradient(135deg, rgba(234,179,8,0.1), rgba(249,115,22,0.12))",
          border: "rgba(234,179,8,0.45)",
          text: "#b45309",
        },
        {
          label: "Reprovados",
          valor: totais.reprovados,
          bg: "linear-gradient(135deg, rgba(248,113,113,0.1), rgba(239,68,68,0.12))",
          border: "rgba(248,113,113,0.45)",
          text: "#b91c1c",
        },
      ]

      const cardsHtml = summaryCards
        .map((card) => {
          const valorFormatado = formatNumber(card.valor)
          return `
            <div class="card" style="background:${card.bg};border-color:${card.border}">
              <div class="card-label">${card.label.toUpperCase()}</div>
              <div class="card-value" style="color:${card.text}">${valorFormatado}</div>
            </div>
          `
        })
        .join("")

      const emptyStateHtml =
        totais.total === 0 ? '<p class="empty-state">Não há fornecedores cadastrados neste mês.</p>' : ""

      const popup = window.open("", "_blank", "width=900,height=720")
      if (!popup || popup.closed) {
        throw new Error("popup_closed")
      }

      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório Mensal de Fornecedores</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%);
      color: #0f172a;
      padding: 40px 0 60px;
    }
    .wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffffcc;
      backdrop-filter: blur(12px);
      border-radius: 24px;
      padding: 48px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 40px 80px -32px rgba(15, 23, 42, 0.2);
    }
    header {
      text-align: center;
      margin-bottom: 40px;
    }
    header h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
    }
    header p {
      font-size: 14px;
      color: #475569;
    }
    .meta {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 12px;
      font-size: 13px;
      color: #64748b;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }
    .card {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    .card-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      color: #475569;
    }
    .card-value {
      margin-top: 12px;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .divider {
      margin: 36px 0;
      height: 1px;
      background: linear-gradient(90deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.45), rgba(148, 163, 184, 0));
    }
    .context {
      text-align: center;
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
    }
    .empty-state {
      margin-top: 16px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
    }
    footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <h1>Relatório Mensal de Fornecedores</h1>
      <p>Resumo de homologações e status no período.</p>
      <div class="meta">
        <span>Período: ${mesLabel}</span>
        <span>Gerado em: ${dataGeracao}</span>
      </div>
    </header>
    <section>
      <div class="cards-grid">
        ${cardsHtml}
      </div>
      ${emptyStateHtml}
      <div class="divider"></div>
      <p class="context">
        Os números refletem fornecedores com data de cadastro dentro do mês selecionado.
      </p>
    </section>
    <footer>
      Portal de Fornecedores Engeman — Relatório automático
    </footer>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      setTimeout(function () {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`

      popup.document.open()
      popup.document.write(htmlContent)
      popup.document.close()
      popup.focus()
      setTimeout(() => {
        setGerandoRelatorio(false)
      }, 800)
    } catch (error) {
      console.error(error)
      setGerandoRelatorio(false)
      setErro("Não foi possível gerar o relatório mensal. Tente novamente.")
    }
  }

  {/* Cards com os resumos dos fornecedores cadastrados, reprovados, aprovados, a cadastrar*/}
  const resumoCards = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 transition-all duration-500">
        <ResumoCard
          title="Fornecedores cadastrados"
          value={formatNumber(dashboard?.total_cadastrados)}
          icon={<Users className="w-5 h-5" />}
          accent="from-orange-500 to-red-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Aprovados"
          value={formatNumber(dashboard?.total_aprovados)}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="from-emerald-500 to-green-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="A cadastrar"
          value={formatNumber(dashboard?.total_em_analise)}
          icon={<ShieldCheck className="w-5 h-5" />}
          accent="from-amber-500 to-orange-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Reprovados"
          value={formatNumber(dashboard?.total_reprovados)}
          icon={<XCircle className="w-5 h-5" />}
          accent="from-pink-500 to-rose-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
        <ResumoCard
          title="Documentos enviados"
          value={formatNumber(dashboard?.total_documentos)}
          icon={<FileText className="w-5 h-5" />}
          accent="from-purple-500 to-indigo-500"
          loading={carregandoDashboard}
          isDarkMode={isDarkMode}
        />
      </div>
    ),
    [dashboard, carregandoDashboard, isDarkMode],
  )

  if (!token) {
    return (
      <div
        className={`min-h-screen transition-all duration-300 ${
          isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        }`}
      >
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
              isDarkMode
                ? "bg-gradient-to-br  from-orange-400 to-red-500 opacity-5"
                : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
            } animate-pulse`}
          ></div>
          <div
            className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
              isDarkMode
                ? "bg-gradient-to-br  from-orange-400 to-red-500 opacity-5"
                : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
            } animate-pulse delay-1000`}
          ></div>
        </div>

        {/* Menu principal (NAV) */}

        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div
            className={`w-full max-w-xl rounded-3xl border backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 ${
              isDarkMode ? "bg-slate-800/95 border-slate-700" : "bg-white/95 border-slate-200"
            }`}
          >
            <div className="px-8 py-10 space-y-8">
              <div>
                <div
                  className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm mb-4 ${
                    isDarkMode
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-700"
                      : "border-orange-500/30 bg-orange-500/10 text-orange-700"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Portal Administrativo
                </div>
                <h1 className="text-3xl font-bold mb-2">Acesso restrito</h1>
                <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{ADMIN_HINT}</p>
              </div>

              {/* Input de e-mail e senha  */}

              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label
                    className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                    />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="nome.sobrenome@engeman.net"
                      className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                        isDarkMode
                          ? "border-slate-700 bg-slate-900/80 focus:ring-orange-400/40"
                          : "border-slate-300 bg-slate-50 focus:ring-orange-400/40"
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={loginSenha}
                    onChange={(event) => setLoginSenha(event.target.value)}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border py-3 px-3 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                      isDarkMode
                        ? "border-slate-700 bg-slate-900/80 focus:ring-orange-400/40"
                        : "border-slate-300 bg-slate-50 focus:ring-orange-400/40"
                    }`}
                  />
                  
                </div>

                {loginErro && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm flex items-center gap-2 ${
                      isDarkMode
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : "border-red-300 bg-red-50 text-red-700"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {loginErro}
                  </div>
                )}

                {/* Botão de acesso ao painel de admin*/}

                <button
                  type="submit"
                  disabled={autenticando}
                  className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                      : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  } ${autenticando ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {autenticando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
                    </>
                  ) : (
                    <>
                      ENTRAR NO PAINEL
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              
            </div>
          </div>
        </div>

        {/* Botão de alterar tema (Modo claro/escuro)*/}

        <button
          onClick={toggleTheme}
          className={`fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 ${
            isDarkMode
              ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
              : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
          }`}
          title="Alternar tema"
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen transition-all duration-300 ${
        isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse`}
        ></div>
        <div
          className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-1000`}
        ></div>
      </div>

      {/* Cabeçalho */}

      <header
        className={`fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-50 transition-all duration-300 ${
          isDarkMode ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <img
              src={isDarkMode ? "/logo-marca.png" : "/colorida.png"}
              alt="Logo Engeman"
              className="hidden sm:block h-8 transition-transform duration-300 hover:scale-100"
            />
            <img 
            src={isDarkMode ? "logo.png" : "/logo-branca.png"}
            alt= "Logo Mobile"
            className="flex sm:hidden h-8 mb-2 transition-transform duration-400 hover:scale-100 items-center justify-center mx-auto"
            />
            <p className={`text-xs ${isDarkMode ? "text-slate-300 text-center" : "text-slate-400 text-center"}`}>
                Portal de Fornecedores
              </p>
            </div>
            <div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-300"
                  : "bg-slate-100 border-slate-300 text-slate-600"
              }`}
            >
              <Users className={`w-4 h-4 ${getAccentColor()}`} />
              {adminEmail}
            </div>

            {/* Leva ao Mapa indicador de Suprimentos*/}
            <a
              href="https://mapaindicador-engeman.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkMode
                  ? "border-slate-700 text-slate-300 hover:text-white hover:border-orange-400/60"
                  : "border-slate-300 text-slate-600 hover:text-slate-900 hover:border-orange-400/60"
              }`}
            >
              Mapa indicador
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkMode
                  ? "border-slate-700 text-slate-300 hover:text-white hover:border-slate-600"
                  : "border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400"
              }`}
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Sessão principal */}

      <main className="relative z-10 pt-24 pb-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12">
            
            <h2 className="text-3xl md:text-4xl font-bold mb-4 p-1">
              Bem-vindo ao{" "}
              <span
                className={`bg-clip-text text-transparent ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              >
                Painel de Controle
              </span>
            </h2>
            <p className={`text-lg ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Acompanhe em tempo real o desempenho dos fornecedores, receba alertas sobre novos cadastros e monitore
              envios de documentos.
            </p>
          </div>

          {resumoCards}

          {mensagemSucesso && (
            <div
              className={`mt-8 rounded-xl border px-4 py-3 flex items-center gap-3 ${
                isDarkMode ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{mensagemSucesso}</span>
            </div>
          )}

          {erro && (
            <div
              className={`mt-8 rounded-xl border px-4 py-3 flex items-center gap-3 ${
                isDarkMode ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              <AlertCircle className="w-5 h-5" />
              <span>{erro}</span>
            </div>
          )}
          {/* Tabela com os dados dos fornecedores e documentacoes */}

          <div className="mt-12 space-y-6">
            <section className="flex flex-col space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Fornecedores</h3>
                  <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Pesquise por nome fantasia ou CNPJ para visualizar status e documentos atualizados.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 sm:min-w-[14rem] lg:w-72">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    />
                    <input
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Buscar por nome ou CNPJ"
                      className={`w-full border rounded-xl py-2.5 pl-10 pr-12 text-sm focus:outline-none focus:ring-2 transition-all duration-300 ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 focus:ring-orange-400/40"
                          : "bg-slate-50 border-slate-300 focus:ring-orange-400/40"
                      }`}
                    />
                    {busca && (
                      <button
                        type="button"
                        onClick={() => setBusca("")}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                        }`}
                        aria-label="Limpar busca"
                      >
                        X
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end w-full sm:w-auto">
                    <div ref={filtroRef} className="relative w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setFiltroAberto((prev) => !prev)}
                        className={`flex items-center justify-between gap-2 w-full sm:w-auto border rounded-xl px-4 py-2 text-sm transition-all duration-300 ${
                          isDarkMode
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                            : "bg-slate-50 border-slate-300 text-slate-600 hover:border-slate-400"
                        } ${filtroAberto ? "ring-2 ring-orange-400/40" : ""}`}
                        aria-expanded={filtroAberto}
                        aria-haspopup="true"
                      >
                        <Filter className="w-4 h-4" />
                        <span>{filtroSelecionado?.rotulo ?? "Filtro"}</span>
                        {filtroStatus !== "TODOS" && (
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {fornecedoresFiltrados.length}
                          </span>
                        )}
                      </button>
                      {filtroAberto && (
                        <div
                          className={`absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-30 ${
                            isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="p-2 space-y-1">
                            {opcoesFiltro.map((opcao) => {
                              const selecionado = opcao.valor === filtroStatus
                              return (
                                <button
                                  key={opcao.valor}
                                  type="button"
                                  onClick={() => handleSelecionarFiltroStatus(opcao.valor)}
                                  className={`w-full rounded-xl px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors duration-200 ${
                                    selecionado
                                      ? isDarkMode
                                        ? "bg-slate-800 border border-orange-400/40 text-orange-200"
                                        : "bg-orange-50 border border-orange-400/40 text-orange-700"
                                      : isDarkMode
                                        ? "text-slate-200 hover:bg-slate-800/70"
                                        : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <div>
                                    <p className="font-semibold">{opcao.rotulo}</p>
                                    <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                      {opcao.descricao}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                      selecionado
                                        ? isDarkMode
                                          ? "bg-orange-500/30 text-orange-200"
                                          : "bg-orange-100 text-orange-600"
                                        : isDarkMode
                                          ? "bg-slate-800 text-slate-300"
                                          : "bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {opcao.contagem}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={notificacoesRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setNotificacoesAbertas((prev) => {
                            const seguinte = !prev
                            if (seguinte) {
                              setMostrarIndicadorNotificacoes(false)
                            }
                            return seguinte
                          })
                        }
                        className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 ${
                          isDarkMode
                            ? "border-slate-700 bg-slate-800/70 text-slate-200 hover:border-orange-400/40 hover:text-orange-200"
                            : "border-slate-300 bg-white text-slate-600 hover:border-orange-400/60 hover:text-orange-600"
                        } ${notificacoesAbertas ? "ring-2 ring-orange-400/40" : ""}`}
                        aria-expanded={notificacoesAbertas}
                        aria-haspopup="true"
                        title="Notificacoes"
                      >
                        <Bell className="w-5 h-5" />
                        {mostrarIndicadorNotificacoes && (
                          <span
                            className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 ${
                              isDarkMode ? "border-slate-900 bg-orange-400" : "border-white bg-orange-500"
                            }`}
                          />
                        )}
                      </button>
                      {notificacoesAbertas && (
                        <div
                          className={`absolute right-0 mt-3 w-80 max-h-[26rem] rounded-2xl border shadow-2xl backdrop-blur p-6 z-40 ${
                            isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-white/80 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <Bell className={`w-4 h-4 ${getAccentColor()}`} />
                              Notificações
                            </h3>
                            {carregandoNotificacoes && (
                              <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                            )}
                          </div>
                          <div className="space-y-4 max-h-[18rem] overflow-y-auto pr-1">
                            {notificacoes.length === 0 ? (
                              <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                Nenhuma notificação recente.
                              </p>
                            ) : (
                              notificacoes.map((item) => (
                                <div
                                  key={item.id}
                                  className={`rounded-2xl border p-4 flex flex-col gap-2 transition-all duration-300 ${
                                    isDarkMode
                                      ? "border-slate-700/50 bg-slate-900/60 hover:bg-slate-900/80"
                                      : "border-slate-200/50 bg-slate-50/60 hover:bg-slate-50/80"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span
                                      className={`text-xs uppercase tracking-widest ${
                                        isDarkMode ? "text-slate-400" : "text-slate-500"
                                      }`}
                                    >
                                      {item.tipo === "cadastro" ? "Cadastro" : "Documento"}
                                    </span>
                                    <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                                      {formatRelativeTime(item.timestamp)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium">{item.titulo}</p>
                                  <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                                    {item.descricao}
                                  </p>
                                  {item.detalhes && (
                                    <div className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                      {Object.entries(item.detalhes).map(([chave, valor]) => (
                                        <div key={`${item.id}-${chave}`}>- {chave}: {valor}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div
                className={`rounded-3xl border backdrop-blur shadow-2xl overflow-hidden transition-all duration-300 ${
                  isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-white/60 border-slate-200"
                }`}
              >
                <div className="overflow-x-auto">
                  <div className="md:min-w-[880px]">
                    <div
                    className={`hidden md:grid grid-cols-[18rem_minmax(9rem,_0.85fr)_minmax(14rem,_1.05fr)_minmax(18rem,_1.1fr)_minmax(13rem,_0.9fr)] gap-5 px-6 py-4 text-xs font-medium uppercase tracking-widest border-b ${
                        isDarkMode
                          ? "text-slate-400 border-slate-700 bg-slate-800/80"
                          : "text-slate-500 border-slate-200 bg-slate-50/80"
                      }`}
                    >
                      <span>Fornecedor</span>
                      <span>Status</span>
                      <span>Notas</span>
                      <span>Documentos</span>
                      <span>Ações</span>
                    </div>
                    <div className={`divide-y ${isDarkMode ? "divide-slate-700/40" : "divide-slate-200/40"}`}>
                      {carregandoFornecedores ? (
                        <div
                          className={`flex items-center justify-center py-16 gap-3 ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Carregando fornecedores...
                        </div>
                      ) : fornecedoresFiltrados.length === 0 ? (
                        <div
                          className={`flex flex-col items-center justify-center py-16 gap-2 ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          <ShieldCheck className="w-8 h-8 opacity-50" />
                          <p className="text-sm">Nenhum fornecedor encontrado. Ajuste a busca ou os filtros.</p>
                        </div>
                      ) : (
                        fornecedoresFiltrados.map((fornecedor) => {
                          const status = statusConfig(fornecedor.status, isDarkMode)
                          const estaExpandido = documentosExpandidos[fornecedor.id] ?? false
                          const podeExpandirDocumentos = fornecedor.total_documentos > LIMITE_DOCUMENTOS_VISIVEIS
                          const documentosVisiveis = estaExpandido
                            ? fornecedor.documentos
                            : fornecedor.documentos.slice(0, LIMITE_DOCUMENTOS_VISIVEIS)
                          const documentosExtrasAoExpandir = Math.max(
                            fornecedor.total_documentos - LIMITE_DOCUMENTOS_VISIVEIS,
                            0,
                          )
                          const notaHomologacaoEmEdicao = notaHomologacaoEditandoId === fornecedor.id
                          const notaHomologacaoInput = notasEdicao[fornecedor.id]?.notaHomologacao ?? ""
                          const homologacaoFormatada = formatNota(fornecedor.nota_homologacao)
                          const excluindoFornecedorAtual = excluindoFornecedorId === fornecedor.id

                          return (
                            <div
                              key={fornecedor.id}
                              className={`flex flex-col md:grid md:grid-cols-[18rem_minmax(9rem,_0.85fr)_minmax(14rem,_1.05fr)_minmax(18rem,_1.1fr)_minmax(13rem,_0.9fr)] gap-5 md:gap-6 px-6 py-5 transition-colors ${
                                isDarkMode ? "hover:bg-slate-800/80" : "hover:bg-slate-50/80"
                              }`}
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`rounded-xl p-2 ${
                                        isDarkMode
                                          ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 text-orange-300"
                                          : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/20 text-orange-600"
                                      }`}
                                    >
                                      <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="font-semibold leading-tight">{fornecedor.nome}</p>
                                      <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                        CNPJ {fornecedor.cnpj}
                                      </p>
                                      {fornecedor.categoria && (
                                        <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                          Categoria: {fornecedor.categoria}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSolicitarExclusaoFornecedor(fornecedor)}
                                    disabled={excluindoFornecedorAtual}
                                    className={`flex-shrink-0 rounded-full border p-2 transition-colors ${
                                      isDarkMode
                                        ? "border-slate-700 text-slate-400 hover:border-red-400/60 hover:text-red-300"
                                        : "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
                                    } ${excluindoFornecedorAtual ? "cursor-not-allowed opacity-60" : ""}`}
                                    title={`Excluir fornecedor ${fornecedor.nome}`}
                                    aria-label={`Excluir fornecedor ${fornecedor.nome}`}
                                  >
                                    {excluindoFornecedorAtual ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                                <div
                                  className={`flex items-center gap-2 text-xs ${
                                    isDarkMode ? "text-slate-400" : "text-slate-500"
                                  }`}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  {fornecedor.email}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <span
                                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-center border leading-tight ${status.bg} ${status.border} ${status.color}`}
                                >
                                  {status.icon}
                                  {status.label}
                                </span>
                                <span className={`text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                  Desde {formatDateTime(fornecedor.data_cadastro)}
                                </span>
                              </div>

                              <div
                                className={`flex flex-col gap-3 text-sm md:min-w-[14rem] md:max-w-[20rem] rounded-2xl border p-4 shadow-sm transition-colors ${
                                  isDarkMode
                                    ? "border-slate-700/60 bg-slate-900/40"
                                    : "border-slate-200 bg-white/70"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <TrendingUp className={`w-4 h-4 ${getAccentColor()}`} />
                                  <span className="font-semibold">IQF {formatNota(fornecedor.nota_iqf)}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck className={`w-4 h-4 ${getAccentColor()}`} />
                                      <span className="font-semibold">Homologação {homologacaoFormatada}</span>
                                    </div>
                                    {!notaHomologacaoEmEdicao && (
                                      <button
                                        type="button"
                                        onClick={() => handleEditarNotaHomologacao(fornecedor)}
                                        className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${
                                          isDarkMode
                                            ? "border-slate-700 text-slate-200 hover:border-orange-400/40 hover:text-orange-200"
                                            : "border-slate-300 text-slate-600 hover:border-orange-400/60 hover:text-orange-600"
                                        }`}
                                      >
                                        Editar
                                      </button>
                                    )}
                                  </div>
                                  {notaHomologacaoEmEdicao && (
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={notaHomologacaoInput}
                                        onChange={(event) =>
                                          handleAlterarNotaHomologacao(fornecedor.id, event.target.value)
                                        }
                                        disabled={salvandoNotaId === fornecedor.id}
                                        className={`w-full sm:w-32 rounded-xl border px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                                          isDarkMode
                                            ? "border-slate-600/70 bg-slate-900/60 text-slate-100 focus:border-orange-400 focus:ring-orange-400/40"
                                            : "border-slate-200 bg-white text-slate-800 focus:border-orange-500 focus:ring-orange-500/30"
                                        }`}
                                        placeholder="Ex: 95,5"
                                      />
                                      <div className="flex flex-wrap gap-3">
                                        <button
                                          type="button"
                                          onClick={() => handleSalvarNotaHomologacao(fornecedor)}
                                          disabled={salvandoNotaId === fornecedor.id}
                                          className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold mt-2 transition-colors ${
                                            isDarkMode
                                              ? "bg-orange-500/20 border border-orange-400/40 text-orange-100 hover:bg-orange-500/30"
                                              : "bg-orange-500 text-white hover:bg-orange-600"
                                          } ${salvandoNotaId === fornecedor.id ? "cursor-wait opacity-70" : ""}`}
                                        >
                                          {salvandoNotaId === fornecedor.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            "Salvar"
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCancelarNotaHomologacao(fornecedor.id)}
                                          disabled={salvandoNotaId === fornecedor.id}
                                          className={`inline-flex items-center justify-column gap-1 rounded-full px-1 py-2 text-xs mt-2 font-semibold transition-colors ${
                                            isDarkMode
                                              ? "border border-slate-700 text-slate-200 hover:border-slate-600 hover:text-white"
                                              : "border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                          } ${salvandoNotaId === fornecedor.id ? "cursor-not-allowed opacity-70" : ""}`}
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div
                                className={`flex flex-col gap-3 md:min-w-[15rem] md:max-w-[22rem] rounded-2xl border p-4 shadow-sm transition-colors ${
                                  isDarkMode
                                    ? "border-slate-700/60 bg-slate-900/40"
                                    : "border-slate-200 bg-white/70"
                                }`}
                              >
                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                                  {documentosVisiveis.map((doc) => (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      onClick={() => handleDownloadDocumento(doc)}
                                      disabled={downloadDocumentoId === doc.id}
                                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors ${
                                        isDarkMode
                                          ? "border-slate-700 bg-slate-800/60 hover:border-orange-400/40"
                                          : "border-slate-300 bg-slate-100/60 hover:border-orange-400/60"
                                      } ${downloadDocumentoId === doc.id ? "opacity-70 cursor-wait" : ""}`}
                                      title={doc.nome}
                                    >
                                      {downloadDocumentoId === doc.id ? (
                                        <Loader2 className={`w-3 h-3 animate-spin ${getAccentColor()}`} />
                                      ) : (
                                        <FileText className={`w-3 h-3 ${getAccentColor()}`} />
                                      )}
                                      <span className="truncate">{shortenDocumentName(doc.nome)}</span>
                                    </button>
                                  ))}
                                  {podeExpandirDocumentos && (
                                    <button
                                      type="button"
                                      onClick={() => toggleDocumentosFornecedor(fornecedor.id)}
                                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                        isDarkMode
                                          ? "bg-slate-800/80 text-slate-200 hover:bg-slate-700/70"
                                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      }`}
                                    >
                                      {estaExpandido
                                        ? "Mostrar menos"
                                        : `Ver todos (+${documentosExtrasAoExpandir})`}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div
                                className={`flex flex-col gap-2 md:min-w-[13rem] rounded-2xl border p-4 shadow-sm transition-colors ${
                                  isDarkMode
                                    ? "border-slate-700/60 bg-slate-900/40"
                                    : "border-slate-200 bg-white/70"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleRegistrarDecisao(fornecedor, "APROVADO")}
                                  disabled={processandoDecisaoId === fornecedor.id}
                                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                    isDarkMode
                                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:border-emerald-400"
                                      : "bg-emerald-50 border border-emerald-200 text-emerald-600 hover:border-emerald-300"
                                  } ${processandoDecisaoId === fornecedor.id ? "opacity-70 cursor-wait" : ""}`}
                                >
                                  {processandoDecisaoId === fornecedor.id ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Processando</>
                                  ) : (
                                    <><CheckCircle2 className="w-3 h-3" /> Aprovar</>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRegistrarDecisao(fornecedor, "REPROVADO")}
                                  disabled={processandoDecisaoId === fornecedor.id}
                                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                    isDarkMode
                                      ? "bg-red-500/15 border border-red-500/30 text-red-200 hover:border-red-400"
                                      : "bg-red-50 border border-red-200 text-red-600 hover:border-red-300"
                                  } ${processandoDecisaoId === fornecedor.id ? "opacity-70 cursor-wait" : ""}`}
                                >
                                  {processandoDecisaoId === fornecedor.id ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Processando</>
                                  ) : (
                                    <><XCircle className="w-3 h-3" /> Reprovar</>
                                  )}
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div
              className={`rounded-3xl border p-6 transition-all duration-300 ${
                isDarkMode
                  ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent"
                  : "border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-red-500/10 to-transparent"
              }`}
            >
              <h3 className="text-lg font-semibold mb-2">Dica Rápida</h3>
              <p className={`text-sm mb-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Mantenha o painel aberto enquanto realiza homologações. As metricas são atualizadas em tempo real conforme os documentos chegam.
              </p>
              <button
                onClick={handleGenerateMonthlyReport}
                disabled={gerandoRelatorio || carregandoFornecedores || fornecedores.length === 0}
                className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:-translate-y-0 ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-500/20 hover:shadow-orange-500/30"
                    : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-500/20 hover:shadow-orange-500/30"
                }`}
              >
                {gerandoRelatorio ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...</>
                ) : (
                  <>Gerar relatório (PDF) <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

        </div>
      </main>

      {fornecedorParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={handleFecharModalExclusao}
          ></div>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-excluir-fornecedor"
            className={`relative w-full max-w-lg rounded-3xl border p-6 shadow-2xl ${
              isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-2xl p-3 ${
                  isDarkMode ? "bg-red-500/20 text-red-200" : "bg-red-50 text-red-600"
                }`}
              >
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Excluir fornecedor
                </p>
                <h3 id="modal-excluir-fornecedor" className="text-xl font-semibold">
                  Confirme esta exclusão
                </h3>
              </div>
            </div>
            <p className={`mt-4 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Esta ação remove definitivamente o cadastro, notas e documentos associados ao fornecedor{" "}
              <span className="font-semibold">{fornecedorParaExcluir.nome}</span>.
            </p>
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                isDarkMode ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="font-medium">{fornecedorParaExcluir.nome}</p>
              <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>CNPJ {fornecedorParaExcluir.cnpj}</p>
              <p className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {fornecedorParaExcluir.email}
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleFecharModalExclusao}
                disabled={exclusaoEmAndamento}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  isDarkMode
                    ? "border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white"
                    : "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                } ${exclusaoEmAndamento ? "cursor-not-allowed opacity-60" : ""}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExcluirFornecedor}
                disabled={exclusaoEmAndamento}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  isDarkMode
                    ? "bg-red-500/20 border border-red-400/60 text-red-100 hover:bg-red-500/30"
                    : "bg-red-500 text-white hover:bg-red-600"
                } ${exclusaoEmAndamento ? "cursor-wait opacity-80" : ""}`}
              >
                {exclusaoEmAndamento ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir fornecedor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className={isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {fornecedorParaDecisao?.status === "APROVADO" ? "Confirmar Aprovação" : "Confirmar Reprovação"}
            </AlertDialogTitle>
            <AlertDialogDescription className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
              {fornecedorParaDecisao?.status === "APROVADO"
                ? `Confirma a aprovação do fornecedor ${fornecedorParaDecisao?.fornecedor.nome}? Um e-mail será enviado com o resultado.`
                : `Confirma a reprovação do fornecedor ${fornecedorParaDecisao?.fornecedor.nome}? Um e-mail será enviado com o resultado.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelarDecisao}
              className={isDarkMode ? "border-slate-700 text-slate-200 hover:border-slate-500" : ""}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarDecisao}
              className={
                fornecedorParaDecisao?.status === "APROVADO"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }
            >
              {fornecedorParaDecisao?.status === "APROVADO" ? "Aprovar" : "Reprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button
        onClick={toggleTheme}
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 ${
          isDarkMode
            ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
            : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25 hover:shadow-orange-400/40"
        }`}
        title="Alternar tema"
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>
    </div>
  )
}

type ResumoCardProps = {
  title: string
  value: string
  icon: JSX.Element
  accent: string
  loading?: boolean
  isDarkMode: boolean
}

function ResumoCard({ title, value, icon, accent, loading, isDarkMode }: ResumoCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border backdrop-blur px-6 py-5 shadow-2xl transition-all duration-500 hover:-translate-y-2 ${
        isDarkMode ? "bg-slate-800/70 border-slate-700" : "bg-white/70 border-slate-200"
      }`}
    >
      <div
        className={`absolute inset-x-0 -top-10 h-28 bg-gradient-to-br ${accent} opacity-[0.22] blur-3xl pointer-events-none`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {loading ? (
              <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
            ) : (
              value
            )}
          </p>
        </div>
        <div
          className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
            isDarkMode ? "bg-slate-700/50" : "bg-slate-100"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
