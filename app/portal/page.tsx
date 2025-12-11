/**
 * Portal do Fornecedor - Interface Principal
 * 
 * Este componente fornece a interface principal para fornecedores acessarem
 * suas informações, enviarem documentos e visualizarem seu status de homologação.
 * 
 * Funcionalidades principais:
 * - Busca e visualização de dados do fornecedor
 * - Seleção de categorias de materiais/serviços
 * - Upload de documentos obrigatórios
 * - Envio conjunto de documentos para categoria "Outros"
 * - Visualização de histórico de envios
 * - Visualização de certificado CFE (quando aprovado)
 * - Notificações pop-up para feedback ao usuário
 * - Diálogos de confirmação para envio de documentos
 * - Tema claro/escuro
 * 
 * Comportamento especial para categoria "Outros":
 * - Permite envio de múltiplos documentos em um único envio
 * - Não envia email, documentos ficam disponíveis na página de admin
 * - Mostra notificação de sucesso no portal
 * 
 * @module app/portal/page
 * @author Sistema Engeman
 */

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Award,
  Clock,
  User,
  Building2,
  BarChart3,
  Download,
  Moon,
  Sun,
  Shield,
  History,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  RefreshCcw,
  ChevronDown,
  Send,
  Paperclip,
  X,
  Menu,
} from "lucide-react"
import { extractMessage, parseJsonSafe } from "../services/http-utils"
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


{/* Dados necessários para o portal do fornecedor*/}

type Fornecedor = {
  id: string
  nome: string
  email: string
  cnpj: string
  telefone?: string
  categoria?: string
  mediaIQF: number
  mediaHomologacao: number
  totalAvaliacoes: number
  status: string
  statusLegivel: string
  ultimaAvaliacao: string
  proximaReavaliacao: string
  feedback: string
  ocorrencias: string[]
  observacao?: string
  ultimaAtualizacao?: string
  notaHomologacaoTexto?: string
}


{/* Dados dos documentos necessários */}
type DocRequisito = {
  id: string
  titulo: string
  descricao?: string
  obrigatorio: boolean
  file?: File
}

{/* Dados dos históricos de envios */}

type HistoricoEnvio = {
  id: string
  data: string
  documentos: string[]
  status: string
  observacoes?: string
}

/**
 * Lista de documentos fixos obrigatórios para todas as categorias.
 * 
 * Estes documentos são sempre exigidos, independente da categoria
 * de material/serviço selecionada pelo fornecedor.
 * 
 * Nota: "Alvará de Funcionamento" e as declarações de risco não estão
 * mais na lista fixa, pois aparecem apenas para categorias específicas.
 */
const DOCUMENTOS_FIXOS_BASE = [
  "Código de Ética e Conduta",
  "Questionário de Fornecedor",
] as const

const criarDocumentosFixos = (): DocRequisito[] =>
  DOCUMENTOS_FIXOS_BASE.map((titulo, index) => ({
    id: `doc-fixo-${index}`,
    titulo,
    obrigatorio: true,
    descricao: "Documento obrigatório",
  }))

const formatarDocumentosDinamicos = (docs: unknown[], prefixo: string): DocRequisito[] =>
  docs
    .map((doc) => (typeof doc === "string" ? doc.trim() : ""))
    .filter((titulo): titulo is string => titulo.length > 0)
    .map((titulo, index) => ({
      id: `${prefixo}-${index}`,
      titulo,
      obrigatorio: true,
      descricao: "Conforme nosso procedimento",
    }))

/**
 * Combina classes CSS condicionalmente.
 * 
 * Utilitário simples para combinar classes CSS, filtrando valores falsy.
 * Similar ao pacote clsx, mas implementação própria e leve.
 * 
 * @param xs - Array de strings, false ou undefined para combinar
 * @returns String com classes CSS combinadas
 */
function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ")
}

/**
 * Extensões de arquivo permitidas para upload.
 * 
 * Lista de extensões aceitas pelo sistema para documentos enviados
 * pelos fornecedores. Formatos: PDF, documentos Word/Excel, imagens.
 */
const ACCEPTED_EXT = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "xlsx", "csv"]

/**
 * Verifica se a extensão do arquivo é permitida.
 * 
 * Extrai a extensão do nome do arquivo e verifica se está na lista
 * de extensões aceitas pelo sistema.
 * 
 * @param file - Objeto File do input de arquivo
 * @returns True se a extensão for permitida, False caso contrário
 */
function extOK(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase()
  return !!ext && ACCEPTED_EXT.includes(ext)
}

/**
 * Sanitiza e converte um valor para número.
 * 
 * Remove caracteres não numéricos de strings, normaliza vírgulas/pontos
 * como separadores decimais e converte para número. Retorna 0 se não
 * for possível converter.
 * 
 * @param value - Valor a ser sanitizado (string, número, etc.)
 * @returns Número sanitizado ou 0 se inválido
 */
function sanitizeNumericInput(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return 0
    }

    const onlyNumericSymbols = trimmed.replace(/[^\d,.-]/g, "")
    const lastComma = onlyNumericSymbols.lastIndexOf(",")
    const lastDot = onlyNumericSymbols.lastIndexOf(".")
    let normalized = onlyNumericSymbols

    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        normalized = onlyNumericSymbols.replace(/\./g, "").replace(/,/g, ".")
      } else {
        normalized = onlyNumericSymbols.replace(/,/g, "")
      }
    } else if (lastComma > -1) {
      normalized = onlyNumericSymbols.replace(/\./g, "").replace(/,/g, ".")
    } else if (lastDot > -1) {
      const parts = onlyNumericSymbols.split(".")
      const decimal = parts.pop()
      normalized = `${parts.join("")}.${decimal ?? ""}`
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}


/**
 * Formata um número para exibição com 1 casa decimal.
 * 
 * Converte um número para string formatada no padrão brasileiro com
 * sempre 1 casa decimal. Se o número for inválido, usa 0.
 * 
 * @param n - Número a ser formatado
 * @returns String formatada (ex: "90,5")
 */
function fmt(n: number) {
  const safeValue = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(safeValue)
}

/**
 * Encurta um texto para caber na interface.
 * 
 * Trunca o texto se exceder o comprimento máximo, adicionando "..."
 * no final. Garante que pelo menos 3 caracteres sejam mostrados.
 * 
 * @param value - Texto completo
 * @param maxLength - Comprimento máximo desejado (padrão: 48)
 * @returns Texto truncado com "..." se necessário
 */
function shortenLabel(value: string, maxLength = 48): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  const safeLength = Math.max(3, maxLength - 3)
  return `${trimmed.slice(0, safeLength).trimEnd()}...`
}

/**
 * Configurações de localização e fuso horário para formatação de datas.
 * 
 * Locale brasileiro e fuso horário de São Paulo para garantir
 * que todas as datas sejam exibidas no padrão brasileiro.
 */
const LOCALE_PT_BR = "pt-BR"
const TIME_ZONE = "America/Sao_Paulo"

/**
 * Formatador de data no padrão brasileiro (dd/mm/aaaa).
 */
const dateFormatter = new Intl.DateTimeFormat(LOCALE_PT_BR, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
})

/**
 * Formatador de hora no padrão brasileiro (hh:mm).
 */
const timeFormatter = new Intl.DateTimeFormat(LOCALE_PT_BR, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
})

/**
 * Converte um valor para objeto Date de forma segura.
 * 
 * Aceita Date, string ISO, timestamp numérico ou outros formatos.
 * Retorna null se não for possível converter.
 * 
 * @param value - Valor a ser convertido para Date
 * @returns Objeto Date ou null se inválido
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

/**
 * Formata uma data para exibição no padrão brasileiro.
 * 
 * Converte um valor para Date e formata como "dd/mm/aaaa".
 * Retorna "Data nao informada" se a data for inválida.
 * 
 * @param value - Valor a ser formatado (Date, string ISO, timestamp, etc.)
 * @returns String formatada (ex: "15/01/2025") ou "Data nao informada"
 */
function formatDate(value: unknown): string {
  const parsed = parseDate(value)
  return parsed ? dateFormatter.format(parsed) : "Data nao informada"
}

/**
 * Formata uma data/hora para exibição no padrão brasileiro.
 * 
 * Converte um valor para Date e formata como "dd/mm/aaaa às hh:mm".
 * Retorna "Data nao informada" se a data for inválida.
 * 
 * @param value - Valor a ser formatado (Date, string ISO, timestamp, etc.)
 * @returns String formatada (ex: "15/01/2025 às 14:30") ou "Data nao informada"
 */
function formatDateTime(value: unknown): string {
  const parsed = parseDate(value)
  return parsed ? `${dateFormatter.format(parsed)} às ${timeFormatter.format(parsed)}` : "Data nao informada"
}

/**
 * Adiciona meses a uma data.
 * 
 * Cria uma nova data com o número de meses especificado adicionado.
 * Não modifica a data original.
 * 
 * @param date - Data base
 * @param months - Número de meses a adicionar (pode ser negativo)
 * @returns Nova data com meses adicionados
 */
function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  result.setMonth(result.getMonth() + months)
  return result
}

{/* Função da API utilizada no Back-end (Temporária) */}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"


/**
 * Carrega os dados resumidos do fornecedor autenticado.
 * 
 * Faz requisição autenticada ao endpoint /api/portal/resumo para obter
 * informações consolidadas do fornecedor: status, notas IQF, nota de
 * homologação, feedback, ocorrências, etc. Normaliza e adapta os dados
 * para o formato usado no frontend.
 * 
 * @param token - Token JWT de autenticação do fornecedor
 * @returns Objeto Fornecedor com dados resumidos ou null se erro/token inválido
 * @throws Error se houver erro na requisição (exceto 401/403)
 */
async function carregarResumoAutenticado(token: string): Promise<Fornecedor | null> {
  try {
    const response = await fetch(`${API_BASE}/api/portal/resumo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401 || response.status === 403) {
      console.warn("Token invalido ou expirado ao buscar resumo do fornecedor.")
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Erro ao carregar resumo do fornecedor: ${response.statusText}`, errorText)
      throw new Error("Erro ao carregar resumo do fornecedor.")
    }

    const payload = await response.json()
    const apiResumo = payload?.resumo ?? payload
    if (!apiResumo) {
      console.warn("Resposta do resumo veio sem conteudo valido.")
      return null
    }

    const statusBruto = (apiResumo.status ?? "A CADASTRAR").toString().trim()
    const statusLegivelApi = (apiResumo.statusLegivel ?? statusBruto).toString().trim()
    const ocorrenciasLista = Array.isArray(apiResumo.ocorrencias)
      ? apiResumo.ocorrencias.map((item: unknown) => `${item ?? ""}`.trim()).filter(Boolean)
      : []

    const feedbackTexto = (apiResumo.feedback ?? apiResumo.observacao ?? "").toString().trim()
    const ultimaAtualizacao = (
      apiResumo.ultimaAtualizacao ??
      apiResumo.ultimaAvaliacao ??
      new Date().toISOString()
    ).toString()
    const notaHomologacaoBruta =
      apiResumo.mediaHomologacao ??
      apiResumo.media_homologacao ??
      apiResumo.notaHomologacao ??
      apiResumo.nota_homologacao ??
      apiResumo.homologacao
    const notaHomologacaoTexto =
      notaHomologacaoBruta !== undefined && notaHomologacaoBruta !== null
        ? `${notaHomologacaoBruta}`.toString().trim()
        : ""

    return {
      id: `${apiResumo.id ?? ""}`,
      nome: apiResumo.nome ?? "",
      email: apiResumo.email ?? "Nao informado",
      cnpj: apiResumo.cnpj ?? "Nao informado",
      telefone: apiResumo.telefone ?? "Nao informado",
      categoria: apiResumo.categoria ?? "",
      mediaIQF:
        sanitizeNumericInput(
          apiResumo.mediaIQF ?? apiResumo.media_iqf ?? apiResumo.notaIQF ?? apiResumo.nota_iqf ?? apiResumo.iqf,
        ) || 0,
      mediaHomologacao: sanitizeNumericInput(notaHomologacaoBruta) || 0,
      totalAvaliacoes: Number(apiResumo.totalAvaliacoes ?? 0) || 1,
      status: statusBruto || "A CADASTRAR",
      statusLegivel: statusLegivelApi || (statusBruto || "A CADASTRAR").replace("_", " "),
      ultimaAvaliacao: apiResumo.ultimaAvaliacao ?? ultimaAtualizacao,
      proximaReavaliacao:
        apiResumo.proximaReavaliacao ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      feedback: feedbackTexto || "Aguardando analise dos documentos enviados.",
      ocorrencias: ocorrenciasLista,
      observacao: apiResumo.observacao ?? feedbackTexto,
      ultimaAtualizacao,
      notaHomologacaoTexto,
    }
  } catch (error) {
    console.error("Erro inesperado ao buscar resumo autenticado:", error)
    throw error
  }
}


/**
 * Lista todas as categorias disponíveis na planilha CLAF.
 * 
 * Faz requisição ao endpoint /api/categorias para obter a lista de
 * categorias de materiais/serviços disponíveis para seleção no portal.
 * Adiciona "Outros" no final da lista para casos especiais.
 * Retorna lista vazia se houver erro na requisição.
 * 
 * @returns Array de strings com nomes das categorias disponíveis + "Outros"
 */
async function listarCategoriasDisponiveis(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/api/categorias`)
    if (!response.ok) {
      console.warn(`Falha ao carregar categorias: ${response.statusText}`)
      throw new Error("Erro ao listar categorias")
    }
    const data = await response.json()
    const materiais = Array.isArray(data?.materiais) ? data.materiais : []
    const categoriasFormatadas = materiais.map((item: unknown) => `${item ?? ""}`.trim()).filter(Boolean)
    // Adiciona "Outros" no final da lista se ainda não estiver presente
    if (!categoriasFormatadas.includes("Outros")) {
      categoriasFormatadas.push("Outros")
    }
    return categoriasFormatadas
  } catch (error) {
    console.error("Erro ao listar categorias:", error)
    // Retorna pelo menos "Outros" mesmo em caso de erro
    return ["Outros"]
  }
}


/**
 * Busca documentos necessários via API local (fallback).
 * 
 * Faz requisição ao endpoint /api/claf para buscar documentos necessários
 * para uma categoria específica. Usado como fallback quando a API principal
 * falha. Retorna null se houver erro.
 * 
 * @param categoria - Nome da categoria de material/serviço
 * @returns Array de DocRequisito ou null se erro
 */
async function buscarDocumentosViaClafLocal(categoria: string): Promise<DocRequisito[] | null> {
  if (!categoria) {
    return null
  }
  try {
    const response = await fetch(`/api/claf?categoria=${encodeURIComponent(categoria)}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = await response.text().catch(() => null)
      }
      console.warn("Fallback /api/claf respondeu com erro:", response.status, payload)
      return null
    }
    const data = await response.json()
    const docsBrutos = Array.isArray(data?.documentos)
      ? data.documentos
      : Array.isArray(data?.docs)
        ? data.docs
            .map((item: { titulo?: string }) => (typeof item?.titulo === "string" ? item.titulo : ""))
            .filter((titulo: string) => titulo.length > 0)
        : []
    return formatarDocumentosDinamicos(docsBrutos, "doc-claf")
  } catch (error) {
    console.error("Erro ao consultar fallback local do CLAF:", error)
    return null
  }
}

/**
 * Verifica se uma lista de documentos contém "Alvará de Funcionamento".
 * 
 * Verifica se o Alvará está presente na lista de documentos retornados pela API.
 * Se estiver, significa que a categoria é de alto ou baixo risco e o Alvará deve ser incluído.
 * 
 * @param documentos - Array de strings com nomes de documentos
 * @returns True se o Alvará estiver presente na lista
 */
function categoriaTemAlvara(documentos: string[]): boolean {
  const alvaraVariacoes = [
    "Alvará de Funcionamento",
    "Alvará de funcionamento",
    "ALVARÁ DE FUNCIONAMENTO",
    "Alvará",
    "alvará",
  ]
  
  return documentos.some((doc) => {
    const docNormalizado = doc.trim().toLowerCase()
    return alvaraVariacoes.some((variacao) => 
      docNormalizado === variacao.toLowerCase() || 
      docNormalizado.includes("alvará") ||
      docNormalizado.includes("alvara")
    )
  })
}

/**
 * Determina o tipo de risco de uma categoria baseado nos documentos retornados pela API.
 * 
 * Verifica se a categoria requer declaração de alto risco, baixo risco ou nenhuma.
 * A determinação é feita verificando se há documentos específicos na lista ou
 * palavras-chave relacionadas a risco na categoria.
 * 
 * @param categoria - Nome da categoria selecionada
 * @param documentos - Array de documentos retornados pela API para a categoria
 * @returns "alto" | "baixo" | null - Tipo de risco ou null se não aplicável
 */
function determinarTipoRisco(categoria: string, documentos: string[]): "alto" | "baixo" | null {
  if (!categoria || categoria.toLowerCase() === "outros") {
    return null
  }

  const categoriaLower = categoria.toLowerCase()
  const documentosLower = documentos.map((d) => d.toLowerCase())

  // Palavras-chave que indicam alto risco
  const palavrasAltoRisco = [
    "alto risco",
    "alto-risco",
    "alto_risco",
    "eletrico",
    "elétrico",
    "energia",
    "combustivel",
    "combustível",
    "quimico",
    "químico",
    "explosivo",
    "inflamavel",
    "inflamável",
    "construcao",
    "construção",
    "obra",
    "engenharia",
  ]

  // Palavras-chave que indicam baixo risco
  const palavrasBaixoRisco = [
    "baixo risco",
    "baixo-risco",
    "baixo_risco",
    "escritorio",
    "escritório",
    "administrativo",
    "servico",
    "serviço",
    "consultoria",
    "software",
    "tecnologia",
    "informatica",
    "informática",
  ]

  // Verificar se há menção explícita a risco nos documentos
  const temAltoRiscoDocs = documentosLower.some((doc) =>
    doc.includes("alto risco") || doc.includes("alto-risco")
  )
  const temBaixoRiscoDocs = documentosLower.some((doc) =>
    doc.includes("baixo risco") || doc.includes("baixo-risco")
  )

  if (temAltoRiscoDocs) return "alto"
  if (temBaixoRiscoDocs) return "baixo"

  // Verificar palavras-chave na categoria
  const temAltoRisco = palavrasAltoRisco.some((palavra) => categoriaLower.includes(palavra))
  const temBaixoRisco = palavrasBaixoRisco.some((palavra) => categoriaLower.includes(palavra))

  if (temAltoRisco) return "alto"
  if (temBaixoRisco) return "baixo"

  // Se a categoria tem Alvará, geralmente é de risco (assumir baixo risco como padrão)
  if (categoriaTemAlvara(documentos)) {
    return "baixo"
  }

  return null
}

/**
 * Busca documentos necessários para uma categoria.
 * 
 * Tenta buscar documentos via API principal (/api/documentos-necessarios).
 * Se falhar, tenta fallback local (/api/claf). Sempre inclui documentos
 * fixos obrigatórios (Código de Ética, Questionário). O Alvará de Funcionamento
 * é incluído apenas se a categoria for de alto ou baixo risco (quando a API
 * retornar esse documento na lista).
 * 
 * @param categoria - Nome da categoria de material/serviço
 * @returns Array de DocRequisito (documentos fixos + documentos da categoria, incluindo Alvará se aplicável)
 */
async function buscarDocumentosNecessarios(categoria: string): Promise<DocRequisito[]> {
  const documentosFixos = criarDocumentosFixos()
  if (!categoria) {
    return documentosFixos
  }

  const tentarFallbackLocal = async () => {
    const fallbackDocs = await buscarDocumentosViaClafLocal(categoria)
    if (fallbackDocs && fallbackDocs.length > 0) {
      // Verificar se o fallback contém Alvará
      const nomesDocs = fallbackDocs.map((d) => d.titulo)
      const temAlvara = categoriaTemAlvara(nomesDocs)
      
      let docsFinais = [...documentosFixos, ...fallbackDocs]
      
      // Se não tiver Alvará na lista mas a categoria for de risco, adicionar
      // Por enquanto, vamos confiar que se a API retornou, é porque é necessário
      // Se não retornou, não adicionamos
      
      return docsFinais
    }
    return null
  }

  try {
    const response = await fetch(`${API_BASE}/api/documentos-necessarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ categoria }),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = await response.text().catch(() => null)
      }
      console.warn("API /documentos-necessarios respondeu com erro:", response.status, payload)
      const fallbackCombinado = await tentarFallbackLocal()
      return fallbackCombinado ?? documentosFixos
    }

    const data = await response.json()
    const documentosAPI = Array.isArray(data?.documentos) ? data.documentos : []
    
    // Verificar se a categoria é de risco (contém Alvará na lista)
    const temAlvara = categoriaTemAlvara(documentosAPI)
    
    const documentosFormatados = formatarDocumentosDinamicos(documentosAPI, "doc-api")
    
    if (documentosFormatados.length === 0) {
      const fallbackCombinado = await tentarFallbackLocal()
      return fallbackCombinado ?? documentosFixos
    }

    // Se a categoria tem Alvará na lista da API, ele já estará em documentosFormatados
    // Se não tiver, não adicionamos (categoria não é de risco)
    return [...documentosFixos, ...documentosFormatados]
  } catch (error) {
    console.error("Erro ao buscar documentos:", error)
    const fallbackCombinado = await tentarFallbackLocal()
    return fallbackCombinado ?? documentosFixos
  }
}


/**
 * Envia documentos para o servidor.
 * 
 * Faz upload de um ou mais arquivos para o endpoint /api/envio-documento.
 * Valida extensões, cria FormData e envia via POST multipart/form-data.
 * Retorna resultado com sucesso, mensagem e lista de arquivos enviados.
 * 
 * @param fornecedorId - ID do fornecedor que está enviando
 * @param categoria - Categoria do documento (ex: "Material Elétrico", "Outros")
 * @param arquivos - Array de arquivos File a serem enviados
 * @returns Objeto com success (boolean), message (string) e enviados (string[])
 */
async function enviarDocumentos(
  fornecedorId: string,
  categoria: string,
  arquivos: File[],
): Promise<{ success: boolean; message: string; enviados: string[] }> {
  try {
    const formData = new FormData()
    formData.append("fornecedor_id", fornecedorId)
    formData.append("categoria", categoria)

    arquivos.forEach((arquivo) => {
      formData.append("arquivos", arquivo)
    })

    const response = await fetch(`${API_BASE}/api/envio-documento`, {
      method: "POST",
      body: formData,
    })

    const { json, text } = await parseJsonSafe(response)

    if (!response.ok) {
      return {
        success: false,
        message: extractMessage(json, text || "Erro ao enviar documentos."),
        enviados: [],
      }
    }

    const enviados =
      json && Array.isArray(json.enviados)
        ? json.enviados.map((item) => `${item ?? ""}`.trim()).filter(Boolean)
        : []

    const message =
      json && typeof json.message === "string" && json.message.trim()
        ? json.message
        : "Documentos enviados com sucesso."

    return {
      success: true,
      message,
      enviados,
    }
  } catch (error) {
    console.error("Erro ao enviar documentos:", error)
    return {
      success: false,
      message: "Erro de conexao com o servidor",
      enviados: [],
    }
  }
}

/**
 * Busca histórico de envios de documentos do fornecedor.
 * 
 * Faz requisição para obter histórico de documentos enviados anteriormente.
 * Atualmente retorna array vazio (funcionalidade a ser implementada).
 * 
 * @param fornecedorId - ID do fornecedor
 * @returns Array de HistoricoEnvio (atualmente vazio)
 */
async function buscarHistoricoEnvios(fornecedorId: string): Promise<HistoricoEnvio[]> {
return []
}


export default function PortalFornecedorPage() {
  const [isDark, setIsDark] = useState(false)
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([])
  const [docsRequisitos, setDocsRequisitos] = useState<DocRequisito[]>([])
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([])
  const [loadingCategorias, setLoadingCategorias] = useState(false)
  const [carregandoDocumentos, setCarregandoDocumentos] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resumo, setResumo] = useState<Fornecedor | null>(null)
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [erroResumo, setErroResumo] = useState<string | null>(null)

  const [historicoEnvios, setHistoricoEnvios] = useState<HistoricoEnvio[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [showHistorico, setShowHistorico] = useState(false)

  const [showCoteiModal, setShowCoteiModal] = useState(false)
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [categoriaMenuAberto, setCategoriaMenuAberto] = useState(false)
  const [coteiForm, setCoteiForm] = useState({
    email: "",
    whatsapp: "",
  })

  const [enviandoDocumentos, setEnviandoDocumentos] = useState(false)
  const [categoriasEnviadas, setCategoriasEnviadas] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [docsSelecionadosParaEnvio, setDocsSelecionadosParaEnvio] = useState<DocRequisito[]>([])
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const categoriaDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const currentTheme = localStorage.getItem("theme") || "light"
    setIsDark(currentTheme === "dark")

    if (currentTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }
  }, [])

  /**
   * Alterna entre tema claro e escuro.
   * 
   * Troca o tema da aplicação, atualiza o estado, aplica classes CSS
   * no body e salva a preferência no localStorage para persistir
   * entre sessões.
   */
  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark"
    setIsDark(!isDark)

    if (newTheme === "dark") {
      document.body.classList.add("dark-mode")
      document.body.classList.remove("light-mode")
    } else {
      document.body.classList.add("light-mode")
      document.body.classList.remove("dark-mode")
    }

    localStorage.setItem("theme", newTheme)
  }

  const emissaoCertificado = new Date()
  const validadeCertificado = addMonthsToDate(emissaoCertificado, 12)
  const normalizedId = resumo?.id ? resumo.id.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : ""
  const certificateNumber =
    normalizedId.length > 0
      ? `ENG-${normalizedId.slice(-6).padStart(6, "0")}`
      : resumo?.id
      ? `ENG-${resumo.id.toUpperCase()}`
      : "ENG-000000"

  const docsComArquivo = docsRequisitos.filter((doc) => !!doc.file)
  const totalDocsSelecionados = docsComArquivo.length
  const possuiDocsParaEnvio = totalDocsSelecionados > 0

  useEffect(() => {
    if (!categoriaMenuAberto) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoriaDropdownRef.current &&
        event.target instanceof Node &&
        !categoriaDropdownRef.current.contains(event.target)
      ) {
        setCategoriaMenuAberto(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCategoriaMenuAberto(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [categoriaMenuAberto])

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token")
    if (!storedToken) {
      window.location.href = "/entrar"
      return
    }
    setToken(storedToken)


    const carregarDados = async () => {
      setLoadingResumo(true)
      setLoadingCategorias(true)
      setErroResumo(null)
      try {
        const [resumoDados, categoriasLista] = await Promise.all([
          carregarResumoAutenticado(storedToken),
          listarCategoriasDisponiveis(),
        ])

        const categoriaResumo = resumoDados?.categoria?.trim() ?? ""
        const categoriasNormalizadas = Array.from(
          new Set(categoriasLista.map((item) => item.trim()).filter((item) => item.length > 0)),
        )
        const listaComResumo =
          categoriaResumo && !categoriasNormalizadas.includes(categoriaResumo)
            ? [categoriaResumo, ...categoriasNormalizadas]
            : categoriasNormalizadas
        setCategoriasDisponiveis(listaComResumo)

        if (resumoDados) {
          setResumo(resumoDados)
          if (categoriaResumo) {
            setCategoriasSelecionadas([categoriaResumo])
          }
          setErroResumo(null)
          carregarHistorico(resumoDados.id)
        } else {
          setResumo(null)
          setHistoricoEnvios([])
          setErroResumo("Nao foi possivel carregar os dados do fornecedor.")
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais do portal:", error)
        setErroResumo("Erro ao carregar os dados do fornecedor.")
      } finally {
        setLoadingResumo(false)
        setLoadingCategorias(false)
      }
    }

    carregarDados()
  }, [])

  useEffect(() => {
    let ativo = true
    if (categoriasSelecionadas.length > 0) {
      setCarregandoDocumentos(true)

      Promise.all(categoriasSelecionadas.map((cat) => buscarDocumentosNecessarios(cat)))
        .then((docsArrays) => {
          if (ativo) {
            const allDocs = docsArrays.flat()
            const uniqueDocs = allDocs.reduce((acc, doc) => {
              if (!acc.find((d) => d.titulo === doc.titulo)) {
                acc.push(doc)
              }
              return acc
            }, [] as DocRequisito[])
            setDocsRequisitos(uniqueDocs)
          }
        })
        .catch((error) => {
          console.error("Erro ao buscar documentos necessarios:", error)
          if (ativo) {
            setDocsRequisitos([])
          }
        })
        .finally(() => {
          if (ativo) {
            setCarregandoDocumentos(false)
          }
        })
    } else {
      setDocsRequisitos([])
      setCarregandoDocumentos(false)
    }
    return () => {
      ativo = false
    }
  }, [categoriasSelecionadas])

  /**
   * Atualiza os dados resumidos do fornecedor.
   * 
   * Faz nova requisição ao servidor para obter dados atualizados do fornecedor,
   * incluindo status, notas e feedback. Atualiza o estado e recarrega o histórico.
   * Usado quando o fornecedor precisa atualizar suas informações na tela.
   */
  const atualizarResumo = async () => {
    if (!token) {
      return
    }
    setLoadingResumo(true)
    setErroResumo(null)
    try {
      const dados = await carregarResumoAutenticado(token)
      if (dados) {
        setResumo(dados)
        if (dados.categoria) {
          setCategoriasSelecionadas([dados.categoria])
        }
        setErroResumo(null)
        carregarHistorico(dados.id)
      } else {
        setResumo(null)
        setHistoricoEnvios([])
        setErroResumo("Nao foi possivel atualizar as informacoes do fornecedor.")
      }
    } catch (error) {
      console.error("Erro ao atualizar resumo do fornecedor:", error)
      setErroResumo("Erro ao atualizar dados do fornecedor.")
    } finally {
      setLoadingResumo(false)
    }
  }

  /**
   * Carrega o histórico de envios de documentos do fornecedor.
   * 
   * Busca e atualiza a lista de documentos enviados anteriormente pelo fornecedor,
   * incluindo status e datas de envio. Exibido na seção de histórico do portal.
   * 
   * @param fornecedorId - ID do fornecedor para buscar histórico
   */
  const carregarHistorico = async (fornecedorId: string) => {
    setLoadingHistorico(true)
    try {
      const historico = await buscarHistoricoEnvios(fornecedorId)
      setHistoricoEnvios(historico)
    } catch (error) {
      console.error("Erro ao carregar historico:", error)
    } finally {
      setLoadingHistorico(false)
    }
  }

  /**
   * Abre o seletor de arquivo para um documento específico.
   * 
   * Simula um clique no input de arquivo oculto associado ao documento,
   * abrindo o diálogo nativo de seleção de arquivo do navegador.
   * 
   * @param docId - ID do documento para o qual abrir o seletor
   */
  const onPickDocFile = (docId: string) => {
    fileInputs.current[docId]?.click()
  }

  /**
   * Manipula a seleção de arquivo para um documento.
   * 
   * Valida a extensão do arquivo selecionado e atualiza o estado do documento
   * com o arquivo escolhido. Remove o arquivo se file for undefined.
   * 
   * @param docId - ID do documento
   * @param file - Arquivo selecionado ou undefined para remover
   */
  const onDocFileChange = (docId: string, file?: File) => {
    if (!file) {
      setDocsRequisitos((prev) => prev.map((d) => (d.id === docId ? { ...d, file: undefined } : d)))
      return
    }

    if (!extOK(file)) {
      alert("Formato de arquivo nao aceito. Use: PDF, DOC, DOCX, JPG, PNG, XLSX, CSV")
      return
    }

    setDocsRequisitos((prev) => prev.map((d) => (d.id === docId ? { ...d, file } : d)))
  }

  const prepararEnvioDocumentos = () => {
    if (!resumo) {
      setNotificationMessage("Busque pelo nome da sua empresa antes de enviar documentos.")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
      return
    }

    if (categoriasSelecionadas.length === 0) {
      setNotificationMessage("Selecione pelo menos uma categoria.")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
      return
    }

    if (!possuiDocsParaEnvio) {
      setNotificationMessage("Anexe pelo menos um arquivo antes de enviar.")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
      return
    }

    setDocsSelecionadosParaEnvio(docsComArquivo)
    setShowConfirmDialog(true)
  }

  /**
   * Confirma e executa o envio em lote após o diálogo de confirmação.
   *
   * O usuário confirma o envio e todos os documentos anexados são enviados
   * juntos, exibindo feedback de sucesso ou erro ao final do processo.
   */
  const handleConfirmarEnvio = async () => {
    if (!resumo) return

    if (categoriasSelecionadas.length === 0) {
      setNotificationMessage("Selecione pelo menos uma categoria.")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
      setShowConfirmDialog(false)
      setDocsSelecionadosParaEnvio([])
      return
    }

    const arquivosParaEnviar = docsSelecionadosParaEnvio
      .map((doc) => doc.file)
      .filter((file): file is File => Boolean(file))

    if (arquivosParaEnviar.length === 0) {
      setNotificationMessage("Nenhum arquivo selecionado para envio.")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
      setShowConfirmDialog(false)
      setDocsSelecionadosParaEnvio([])
      return
    }

    setShowConfirmDialog(false)
    setEnviandoDocumentos(true)

    try {
      const categoriaAtual = categoriasSelecionadas[0]
      const resultado = await enviarDocumentos(resumo.id, categoriaAtual, arquivosParaEnviar)

      if (resultado.success) {
        setNotificationMessage(resultado.message || "Documentos enviados com sucesso!")
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 5000)

        const idsEnviados = new Set(docsSelecionadosParaEnvio.map((doc) => doc.id))
        setDocsRequisitos((prev) => prev.map((d) => (idsEnviados.has(d.id) ? { ...d, file: undefined } : d)))

        setCategoriasEnviadas((prev) => {
          if (!prev.includes(categoriaAtual)) {
            return [...prev, categoriaAtual]
          }
          return prev
        })

        carregarHistorico(resumo.id)
      } else {
        setNotificationMessage("Erro ao enviar documento: " + resultado.message)
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 4000)
      }
    } catch (err) {
      console.error(err)
      setNotificationMessage("Erro de conexão com o servidor")
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 4000)
    } finally {
      setEnviandoDocumentos(false)
      setDocsSelecionadosParaEnvio([])
    }
  }

  /**
   * Cancela o envio de documentos e fecha o diálogo de confirmação.
   * 
   * Limpa todos os estados relacionados ao envio pendente e fecha
   * o diálogo de confirmação sem enviar os documentos.
   */
  const handleCancelarEnvio = () => {
    setShowConfirmDialog(false)
    setDocsSelecionadosParaEnvio([])
  }

  /**
   * Retorna classes CSS para gradiente de cores da marca.
   * 
   * Retorna classes Tailwind para gradiente laranja-vermelho usado
   * em botões e elementos de destaque. Mesmo gradiente para ambos os temas.
   * 
   * @returns String com classes CSS do gradiente
   */
  const getGradientClasses = () => {
    return isDark ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-orange-400 to-red-500"
  }

  /**
   * Retorna classe CSS para cor de destaque (accent).
   * 
   * Retorna classe Tailwind para cor de destaque laranja, variando
   * ligeiramente entre tema claro e escuro.
   * 
   * @returns String com classe CSS da cor de destaque
   */
  const getAccentColor = () => {
    return isDark ? "text-orange-400" : "text-orange-500"
  }

  const borderCard = isDark ? "border-slate-700" : "border-slate-200"
  const bgCard = isDark ? "bg-slate-800" : "bg-white"
  const textSoft = isDark ? "text-slate-300" : "text-slate-600"
  const isCategoriaDisabled = loadingCategorias || categoriasDisponiveis.length === 0

  const feedbackItems = resumo
    ? resumo.ocorrencias.length > 0
      ? resumo.ocorrencias.map((item, index) => ({
          titulo: `Ocorrencia ${index + 1}`,
          conteudo: item,
        }))
      : resumo.feedback.trim().length > 0
        ? [
            {
              titulo: "Observação geral",
              conteudo: resumo.feedback,
            },
          ]
        : []
    : []

  /**
   * Alterna a seleção de uma categoria no dropdown.
   * 
   * Adiciona a categoria à lista de selecionadas se não estiver,
   * ou remove se já estiver selecionada. Permite seleção múltipla.
   * 
   * @param valor - Nome da categoria a ser alternada
   */
  const handleCategoriaToggle = (valor: string) => {
    setCategoriasSelecionadas((prev) => {
      if (prev.includes(valor)) {
        return prev.filter((c) => c !== valor)
      } else {
        return [...prev, valor]
      }
    })
  }

  useEffect(() => {
    if (isCategoriaDisabled && categoriaMenuAberto) {
      setCategoriaMenuAberto(false)
    }
  }, [isCategoriaDisabled, categoriaMenuAberto])


  /**
   * Retorna classe CSS de cor para um status de envio.
   * 
   * Retorna classe Tailwind apropriada para exibir a cor do status:
   * verde para aprovado, amarelo para pendente, vermelho para reprovado, etc.
   * 
   * @param status - Status do envio/documento
   * @returns String com classe CSS de cor
   */
  const getSituacaoColor = (status: string) => {
    switch (status) {
      case "APROVADO":
        return "text-emerald-400"
      case "A CADASTRAR":
        return "text-amber-400"
      case "PENDENTE":
        return "text-blue-400"
      case "REPROVADO":
      case "REJEITADO":
        return "text-red-400"
      default:
        return textSoft
    }
  }

  /**
   * Retorna ícone React para um status de envio.
   * 
   * Retorna componente de ícone apropriado para o status:
   * CheckCircle para aprovado, Clock para pendente, XCircle para reprovado, etc.
   * 
   * @param status - Status do envio/documento
   * @returns Componente React de ícone
   */
  const getSituacaoIcon = (status: string) => {
    switch (status) {
      case "APROVADO":
        return <CheckCircle className="w-4 h-4" />
      case "A CADASTRAR":
        return <Clock className="w-4 h-4" />
      case "PENDENTE":
        return <AlertTriangle className="w-4 h-4" />
      case "REPROVADO":
      case "REJEITADO":
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  /**
   * Processa o registro no sistema COTEI.
   * 
   * Valida os campos do formulário COTEI (email e WhatsApp) e abre
   * uma nova aba com a URL do COTEI pré-preenchida com os dados.
   * Fecha o modal após abrir a URL.
   */
  const handleCoteiRegistration = () => {
    if (!coteiForm.email || !coteiForm.whatsapp) {
      alert("Por favor, preencha todos os campos.")
      return
    }

    const coteiUrl = `https://cotei.app/?email=${encodeURIComponent(coteiForm.email)}&whatsapp=${encodeURIComponent(coteiForm.whatsapp)}`
    window.open(coteiUrl, "_blank")
    setShowCoteiModal(false)
  }

  /**
   * Alterna a abertura/fechamento do menu mobile.
   * 
   * Inverte o estado do menu mobile (aberto/fechado).
   * Usado para controlar a exibição do menu em dispositivos móveis.
   */
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev)

  /**
   * Fecha o menu mobile.
   * 
   * Define o estado do menu mobile como fechado.
   * Usado quando o usuário clica fora do menu ou em um link.
   */
  const closeMobileMenu = () => setMobileMenuOpen(false)

  /**
   * Faz download do certificado CFE como PDF.
   * 
   * Captura o elemento HTML do certificado, converte para canvas,
   * gera um PDF usando jsPDF e faz o download automaticamente.
   * Usado quando o fornecedor aprovado quer baixar seu certificado.
   */
  const downloadCertificate = () => {
    const certificateElement = document.getElementById("cfe-certificate")
    if (!certificateElement) return

    window.print()
  }

  return (
    <div
      className={clsx(
        "min-h-screen transition-all duration-300 overflow-x-hidden",
        isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900",
      )}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute w-96 h-96 -top-48 -right-48 rounded-full ${
            isDark
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse`}
        ></div>
        <div
          className={`absolute w-72 h-72 -bottom-36 -left-36 rounded-full ${
            isDark
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-1000`}
        ></div>
        <div
          className={`absolute w-48 h-48 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full ${
            isDark
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-2000`}
        ></div>
      </div>


      <header
        className={clsx(
          "fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-50 transition-all duration-300",
          isDark ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200",
        )}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${getAccentColor()}`} />
            <span className="font-semibold text-sm sm:text-base">Portal do Fornecedor</span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-all duration-300 hover:-translate-y-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao inicio</span>
            </Link>
            <div className={`w-px h-6 ${isDark ? "bg-slate-700" : "bg-slate-300"}`}></div>
            <button
              type="button"
              onClick={() => setShowCoteiModal(true)}
              className="transition-all duration-300 hover:-translate-y-0.5 hover:scale-110"
              title="Cadastre-se para receber alertas de cotacoes por email e WhatsApp"
            >
              <Image src="/cotei-logo.png" alt="Cadastre-se no Cotei" width={80} height={40} className="object-contain" />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            className={clsx(
              "md:hidden inline-flex items-center justify-center rounded-full border p-2 transition-all duration-300",
              isDark
                ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
            )}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            className={clsx(
              "md:hidden border-t",
              isDark ? "border-slate-700 bg-slate-900/95" : "border-slate-200 bg-white/95",
            )}
          >
            <nav className="px-6 sm:px-8 py-4 flex flex-col gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold"
                onClick={() => {
                  closeMobileMenu()
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao inicio</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  setShowCoteiModal(true)
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <Image src="/cotei-logo.png" alt="Cadastre-se no Cotei" width={80} height={32} className="object-contain" />
                <span>Cadastre-se no Cotei</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      <section className="pt-32 pb-16 px-8 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <div
            className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm mb-8 animate-fade-in-up ${
              isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-600"
            }`}
          >
            <Award className={`w-4 h-4 ${getAccentColor()}`} />
            <span>Sistema de Homologação</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 animate-fade-in-up animation-delay-200">
            Gerencie Sua{" "}
            <span
              className={`bg-clip-text text-transparent ${
                isDark ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            >
              Homologação
            </span>
          </h1>

          <p
            className={`text-xl mb-12 leading-relaxed animate-fade-in-up animation-delay-400 max-w-2xl mx-auto ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Consulte suas notas IQF e de homologação, envie documentos e acompanhe seu status em tempo real.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-8 pb-16 relative z-10">
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div
              className={clsx(
                "border rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Suas informações</h2>
                  <p className={clsx("text-sm", textSoft)}>Carregadas automaticamente após o login</p>
                </div>
              </div>

              {loadingResumo ? (
                <div className="flex items-center gap-2 text-sm mb-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Atualizando seus dados...
                </div>
              ) : resumo ? (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-4 h-4 ${getAccentColor()}`} />
                    <span className="font-medium">{resumo.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-75">
                    <User className="w-3 h-3" />
                    <span>{resumo.cnpj}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-75">
                    <Phone className="w-3 h-3" />
                    <span>{resumo.telefone ?? "Não informado"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm opacity-75">
                    <Mail className="w-3 h-3" />
                    <span>{resumo.email}</span>
                  </div>
                  {resumo.ultimaAtualizacao && (
                    <div className="flex items-center gap-2 text-xs opacity-60">
                      <Clock className="w-3 h-3" />
                      <span>Última atualizacao: {formatDateTime(resumo.ultimaAtualizacao)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={clsx("text-sm mb-4", textSoft)}>
                  {erroResumo ?? "Buscando informacoes do fornecedor..."}
                </div>
              )}

              <button
                onClick={atualizarResumo}
                disabled={loadingResumo || !token}
                className={clsx(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5",
                  isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                  (loadingResumo || !token) && "opacity-60 cursor-not-allowed",
                )}
              >
                {loadingResumo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-4 h-4" />
                    Atualizar informacoes
                  </>
                )}
              </button>

              {erroResumo && !loadingResumo && (
                <p className={clsx("mt-3 text-xs", isDark ? "text-rose-300" : "text-rose-500")}>{erroResumo}</p>
              )}
            </div>

            {resumo && (
              <div
                className={clsx(
                  "border rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl animate-fade-in-up",
                  borderCard,
                  bgCard,
                  isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
                )}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Seus Indicadores</h2>
                    <p className={clsx("text-sm", textSoft)}>{resumo.totalAvaliacoes} avaliação(ões) encontrada(s)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div
                    className={clsx(
                      "rounded-3xl border p-6 bg-gradient-to-br from-orange-400/20 via-rose-400/10 to-transparent",
                      borderCard,
                    )}
                  >
                    <p className="text-xs font-semibold uppercase opacity-70 text-center mb-2">
                      Média IQF
                    </p>
                    <p className="text-5xl font-bold text-center">{fmt(resumo.mediaIQF)}%</p>
                  </div>

                  <div
                    className={clsx(
                      "rounded-3xl border p-6 bg-gradient-to-br from-orange-500/25 via-res-500/15 to-transparent",
                      borderCard,
                    )}
                  >
                    <p className="text-xs font-semibold uppercase opacity-70 text-center mb-2">
                      Média de Homologação
                    </p>
                    <p className="text-5xl font-bold text-center">{fmt(resumo.mediaHomologacao)}%</p>
                  </div>
                </div>

                <div className={clsx("rounded-xl p-4 border", borderCard)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm opacity-70">Situação Atual</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 opacity-50" />
                      <span className="text-xs opacity-50">{formatDateTime(resumo.ultimaAvaliacao)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={getSituacaoColor(resumo.status)}>{getSituacaoIcon(resumo.status)}</div>
                    <span className={`font-semibold ${getSituacaoColor(resumo.status)}`}>{resumo.statusLegivel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs opacity-70">
                    <Calendar className="w-3 h-3" />
                    <span>Próxima reavaliação: {formatDate(resumo.proximaReavaliacao)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {resumo && (
            <div
              className={clsx(
                "border rounded-3xl p-10 transition-all duration-500 hover:shadow-2xl",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                    <AlertCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Feedback Detalhado</h2>
                    <p className={clsx("text-sm", textSoft)}>
                      Acompanhe as observações emitidas pela equipe de homologação
                    </p>
                  </div>
                </div>
                {resumo.totalAvaliacoes > 0 && (
                  <span
                    className={clsx(
                      "rounded-full border px-4 py-2 text-[13px] font-semibold",
                      isDark ? "border-slate-700 text-slate-300" : "border-orange-200 text-orange-600",
                    )}
                  >
                    {resumo.totalAvaliacoes} avaliação(ões)
                  </span>
                )}
              </div>

              {feedbackItems.length ? (
                <div className="max-h-64 overflow-y-auto space-y-4 pr-2">
                  {feedbackItems.map((item, index) => (
                    <div
                      key={`${item.titulo}-${index}`}
                      className={clsx(
                        "rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg",
                        isDark
                          ? "border-slate-700/60 bg-slate-900/40 hover:bg-slate-900/60"
                          : "border-orange-100 bg-orange-50/60 hover:bg-orange-100/60",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={clsx(
                            "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold flex-shrink-0",
                            isDark ? "bg-orange-500/20 text-orange-200" : "bg-orange-200 text-orange-700",
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs uppercase opacity-70 font-semibold">
                            {item.titulo}
                          </span>
                          <p className={clsx("mt-2 text-[15px] leading-relaxed", textSoft)}>{item.conteudo}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={clsx(
                    "text-center py-12 rounded-2xl border-2 border-dashed",
                    isDark ? "border-slate-700" : "border-orange-200",
                  )}
                >
                  <AlertCircle className={clsx("w-12 h-12 mx-auto mb-3 opacity-30", getAccentColor())} />
                  <p className={clsx("text-base", textSoft)}>Nenhum feedback detalhado disponivel no momento.</p>
                </div>
              )}

              {resumo.ultimaAtualizacao && (
                <p
                  className={clsx(
                    "mt-6 text-sm flex items-center justify-center gap-2 pt-6 border-t",
                    isDark ? "border-slate-800 text-slate-400" : "border-orange-100 text-slate-500",
                  )}
                >
                  <Clock className="w-4 h-4" />
                  <span>Atualizado em {formatDateTime(resumo.ultimaAtualizacao)}</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div
              className={clsx(
                "border rounded-3xl p-6 transition-all duration-500 hover:shadow-2xl",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Categorias</h2>
                  <p className={clsx("text-xs", textSoft)}>Selecione uma ou mais categorias</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <label
                  htmlFor="categoria-select"
                  className={clsx("text-xs uppercase font-medium", textSoft)}
                >
                  Categorias previstas pela Engeman
                </label>
                <div
                  ref={categoriaDropdownRef}
                  className={clsx(
                    "relative rounded-2xl border transition-all duration-300 shadow-sm",
                    isDark ? "bg-slate-900/60 border-slate-700" : "bg-white/80 border-slate-200",
                    isCategoriaDisabled && "opacity-75 cursor-not-allowed",
                  )}
                >
                  <div
                    className={clsx(
                      "absolute inset-x-0 -top-20 h-32 pointer-events-none blur-3xl opacity-70",
                      isDark
                        ? "bg-gradient-to-br from-orange-700/20 via-rose-500/10 to-transparent"
                        : "bg-gradient-to-br from-orange-400/20 via-rose-400/10 to-transparent",
                    )}
                  />
                  <span
                    className={clsx(
                      "absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl border w-10 h-10",
                      isDark
                        ? "bg-slate-900/90 border-orange-700 text-orange-300"
                        : "bg-orange-50 border-orange-200 text-orange-500",
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                  </span>
                  <button
                    type="button"
                    id="categoria-select"
                    onClick={() => {
                      if (isCategoriaDisabled) return
                      setCategoriaMenuAberto((prev) => !prev)
                    }}
                    disabled={isCategoriaDisabled}
                    className={clsx(
                      "relative w-full text-left pr-12 pl-14 py-3",
                      "rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      isDark
                        ? "text-slate-100 focus-visible:ring-orange-400/40 focus-visible:ring-offset-slate-900"
                        : "text-slate-700 focus-visible:ring-orange-400/40 focus-visible:ring-offset-white",
                    )}
                    aria-haspopup="listbox"
                    aria-expanded={categoriaMenuAberto && !isCategoriaDisabled}
                  >
                    <span className="block text-[13px] font-semibold truncate">
                      {categoriasSelecionadas.length > 0
                        ? `${categoriasSelecionadas.length} selecionada(s)`
                        : "Selecione"}
                    </span>
                    <span className={clsx("mt-1 block text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                      {categoriasSelecionadas.length > 0 ? categoriasSelecionadas.join(", ") : "Clique para ver as opções disponíveis"}
                    </span>
                  </button>
                  <ChevronDown
                    className={clsx(
                      "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-transform duration-300",
                      isDark ? "text-slate-500" : "text-slate-400",
                      categoriaMenuAberto && !isCategoriaDisabled && "rotate-180",
                    )}
                  />

                  {categoriaMenuAberto && !isCategoriaDisabled && (
                    <div
                      className={clsx(
                        "absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border shadow-2xl overflow-hidden",
                        isDark ? "border-slate-700 bg-slate-900/95" : "border-orange-200 bg-white",
                      )}
                      role="listbox"
                      aria-labelledby="categoria-select"
                    >
                      <ul className="max-h-56 overflow-y-auto py-2">
                        {categoriasDisponiveis.map((item) => {
                          const selecionada = categoriasSelecionadas.includes(item)
                          return (
                            <li key={item}>
                              <button
                                type="button"
                                onClick={() => handleCategoriaToggle(item)}
                                className={clsx(
                                  "w-full px-4 py-2 text-left transition-colors",
                                  selecionada
                                    ? isDark
                                      ? "bg-orange-500/20 text-orange-200"
                                      : "bg-orange-100 text-orange-700"
                                    : isDark
                                      ? "text-slate-200 hover:bg-slate-800"
                                      : "text-slate-600 hover:bg-orange-50",
                                )}
                                role="option"
                                aria-selected={selecionada}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <span className="text-[13px] font-semibold block">{shortenLabel(item, 72)}</span>
                                    <span
                                      className={clsx(
                                        "mt-0.5 block text-[11px]",
                                        isDark ? "text-slate-400" : "text-slate-500",
                                      )}
                                      title={item}
                                    >
                                      {item}
                                    </span>
                                  </div>
                                  {selecionada && (
                                    <CheckCircle
                                      className={clsx(
                                        "w-5 h-5 flex-shrink-0",
                                        isDark ? "text-orange-300" : "text-orange-300",
                                      )}
                                    />
                                  )}
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {categoriasSelecionadas.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 mt-3">
                    {categoriasSelecionadas.map((cat) => (
                      <span
                        key={cat}
                        className={clsx(
                          "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border",
                          isDark
                            ? "border-slate-700 bg-slate-900/60 text-slate-300"
                            : "border-orange-200 bg-orange-50 text-orange-700",
                        )}
                      >
                        {shortenLabel(cat, 20)}
                        <button
                          onClick={() => handleCategoriaToggle(cat)}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {loadingCategorias && (
                  <div className="flex items-center gap-2 text-xs opacity-70">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando...
                  </div>
                )}
              </div>

                {categoriasSelecionadas.length > 0 && (() => {
                  // Determinar tipo de risco baseado na primeira categoria selecionada
                  const categoriaAtual = categoriasSelecionadas[0]
                  const documentosCategoria = docsRequisitos.map((d) => d.titulo)
                  const tipoRisco = determinarTipoRisco(categoriaAtual, documentosCategoria)
                  const mostrarAltoRisco = tipoRisco === "alto"
                  const mostrarBaixoRisco = tipoRisco === "baixo"

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-medium text-sm">Requisitos Engeman</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {/* Código de Ética - Sempre fixo */}
                        <a
                          href="/docs/CÓDIGO DE ÉTICA ENGEMAN.pdf"
                          target="_blank"
                          className={clsx(
                            "group relative overflow-hidden flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                            getGradientClasses(),
                            isDark ? "hover:shadow-orange-400/30" : "hover:shadow-orange-400/30",
                          )}
                          rel="noreferrer"
                        >
                          <Download className="w-4 h-4 relative z-10" />
                          <span className="relative z-10">Código de Ética e Conduta</span>
                        </a>

                        {/* Questionário - Sempre fixo */}
                        <a
                          href="/docs/QUESTIONÁRIO.docx"
                          target="_blank"
                          className={clsx(
                            "group relative overflow-hidden flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                            getGradientClasses(),
                            isDark ? "hover:shadow-orange-400/30" : "hover:shadow-orange-400/30",
                          )}
                          rel="noreferrer"
                        >
                          <Download className="w-4 h-4 relative z-10" />
                          <span className="relative z-10">Questionário de Qualificação</span>
                        </a>

                        {/* Declaração Baixo Risco - Apenas se categoria for de baixo risco */}
                        {mostrarBaixoRisco && (
                          <a
                            href="/docs/DECLARAÇÃO PARA PARCEIROS - BAIXO RISCO.pdf"
                            target="_blank"
                            className={clsx(
                              "group relative overflow-hidden flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                              getGradientClasses(),
                              isDark ? "hover:shadow-orange-400/30" : "hover:shadow-orange-400/30",
                            )}
                            rel="noreferrer"
                          >
                            <Download className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">Declaração de Parceiros Baixo Risco</span>
                          </a>
                        )}

                        {/* Declaração Alto Risco - Apenas se categoria for de alto risco */}
                        {mostrarAltoRisco && (
                          <a
                            href="/docs/DECLARAÇÃO PARA PARCEIROS ALTO RISCO.pdf"
                            target="_blank"
                            className={clsx(
                              "group relative overflow-hidden flex items-center justify-center gap-2 text-white px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                              getGradientClasses(),
                              isDark ? "hover:shadow-orange-400/30" : "hover:shadow-orange-400/30",
                            )}
                            rel="noreferrer"
                          >
                            <Download className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">Declaração de Parceiros Alto Risco</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })()}
            </div>

            <div
              className={clsx(
                "border rounded-3xl p-6 transition-all duration-500 hover:shadow-2xl",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">CFE</h2>
                  <p className={clsx("text-xs", textSoft)}>Certificado Fornecedor Engeman</p>
                </div>
              </div>

              {resumo?.status === "APROVADO" ? (
                <div className="space-y-4">
                  <div
                    className={clsx(
                      "rounded-2xl border-2 p-6 text-center",
                      isDark ? "border-emerald-500/30 bg-emerald-500/10" : "border-emerald-500/50 bg-emerald-50",
                    )}
                  >
                    <div
                      className={clsx(
                        "w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center",
                        "bg-gradient-to-br from-emerald-400 to-emerald-500",
                      )}
                    >
                      <Award className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2 text-emerald-400">Certificado Disponível</h3>
                    <p className={clsx("text-xs mb-4", textSoft)}>Parabéns! Seu certificado foi emitido com sucesso</p>
                  </div>

                  <button
                    onClick={() => setShowCertificateModal(true)}
                    className={clsx(
                      "w-full flex items-center justify-center gap-2 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                      getGradientClasses(),
                    )}
                  >
                    <Award className="w-4 h-4" />
                    Ver Certificado
                  </button>
                </div>
              ) : (
                <div
                  className={clsx(
                    "rounded-2xl border-2 border-dashed p-8 text-center",
                    isDark ? "border-slate-700" : "border-orange-200",
                  )}
                >
                  <div
                    className={clsx(
                      "w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center",
                      getGradientClasses(),
                    )}
                  >
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Certificado em Analise</h3>
                  <p className={clsx("text-sm mb-4", textSoft)}>
                    Seu certificado esta sendo processado pela equipe de homologacao
                  </p>
                  <div
                    className={clsx(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold",
                      isDark ? "bg-slate-700 text-slate-300" : "bg-orange-100 text-orange-700",
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    Em processamento
                  </div>
                </div>
              )}

              <div className={clsx("mt-4 p-4 rounded-xl border text-sm", borderCard)}>
                <p className={clsx("text-xs mb-2", textSoft)}>
                  <strong>O que é o CFE?</strong>
                </p>
                <p className={clsx("text-xs", textSoft)}>
                  O Certificado Fornecedor Engeman é emitido após a aprovação de todos os requisitos de homologação,
                  validando sua empresa como fornecedor qualificado.
                </p>
              </div>
               <button className="font-semibold mb-2 text-orange-500 flex items-center py-2 cursor-pointer  leading-[1.2] underline decoration-2 space-xs p-2 rounded-sm transition-all duration-400 outline-none ease-in-out  hover: border-orange-300 hover:text-red-400 hover:translate-x-4 hover:underline">
                <Link href="/cfe">
                 SAIBA MAIS
                 </Link>
                 </button>
            </div>

            <div
              className={clsx(
                "border rounded-3xl p-6 transition-all duration-500 hover:shadow-2xl",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Requisitos Legais</h2>
                  <p className={clsx("text-xs", textSoft)}>Anexe e envie as documentações</p>
                </div>
              </div>

              {categoriasSelecionadas.length === 0 ? (
                <div
                  className={clsx(
                    "text-sm text-center py-8 rounded-xl border-2 border-dashed",
                    isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500",
                  )}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  Selecione categorias
                </div>
              ) : carregandoDocumentos ? (
                <div
                  className={clsx(
                    "text-sm text-center py-8 rounded-xl border-2 border-dashed",
                    isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500",
                  )}
                >
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Carregando...
                </div>
              ) : docsRequisitos.length === 0 ? (
                <div
                  className={clsx(
                    "text-sm text-center py-8 rounded-xl border-2 border-dashed",
                    isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500",
                  )}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  Nenhum documento adicional
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {docsRequisitos.map((doc) => (
                      <div
                        key={doc.id}
                        className={clsx(
                          "relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
                          isDark
                            ? "bg-slate-900/40 hover:bg-slate-900/65 border-slate-700"
                            : "bg-white hover:bg-orange-50/70 border-orange-100",
                        )}
                      >
                        <input
                          ref={(el) => (fileInputs.current[doc.id] = el)}
                          type="file"
                          className="hidden"
                          onChange={(e) => onDocFileChange(doc.id, e.target.files?.[0])}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv"
                        />

                        <div className="flex items-start gap-3">
                          <span
                            className={clsx(
                              "mt-1 flex h-8 w-8 items-center justify-center rounded-xl border flex-shrink-0",
                              isDark
                                ? "border-slate-700 bg-slate-900/90 text-orange-300"
                                : "border-orange-200 bg-orange-50 text-orange-500",
                            )}
                          >
                            <FileText className="w-4 h-4" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-semibold" title={doc.titulo}>
                                {shortenLabel(doc.titulo, 30)}
                              </span>
                              {doc.obrigatorio && (
                                <span className="text-[10px] font-semibold uppercase rounded-full border px-2 py-0.5 bg-red-500/10 text-red-500 border-red-200/60">
                                  Obrig.
                                </span>
                              )}
                            </div>

                            {doc.file && (
                              <div
                                className={clsx(
                                  "text-xs mb-2 p-2 rounded-lg border",
                                  isDark ? "bg-slate-900/60 border-slate-700" : "bg-slate-50 border-slate-200",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Paperclip className="w-3 h-3" />
                                  <span className="font-medium truncate text-[11px]">{doc.file.name}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onPickDocFile(doc.id)}
                                className={clsx(
                                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300",
                                  isDark
                                    ? "bg-slate-900/60 hover:bg-slate-900 text-slate-300"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                                )}
                              >
                                <Paperclip className="w-3 h-3" />
                                {doc.file ? "Alterar" : "Anexar"}
                              </button>

                              {doc.file && (
                                <button
                                  onClick={() => onDocFileChange(doc.id, undefined)}
                                  className={clsx(
                                    "px-2 py-1.5 rounded-lg text-xs transition-all duration-300",
                                    isDark
                                      ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                      : "bg-red-50 text-red-600 hover:bg-red-100",
                                  )}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={clsx(
                      "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                      isDark ? "border-slate-700 bg-slate-900/40" : "border-orange-100 bg-orange-50/50",
                    )}
                  >
                    <div className={clsx("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
                      {possuiDocsParaEnvio
                        ? `${totalDocsSelecionados} documento(s) anexado(s)`
                        : "Nenhum documento anexado"}
                    </div>
                    <button
                      onClick={prepararEnvioDocumentos}
                      disabled={!possuiDocsParaEnvio || enviandoDocumentos}
                      className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all duration-300",
                        getGradientClasses(),
                        (!possuiDocsParaEnvio || enviandoDocumentos) && "opacity-70 cursor-not-allowed",
                      )}
                    >
                      {enviandoDocumentos ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar documentos
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {resumo && showHistorico && (
            <div
              className={clsx(
                "border rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl animate-fade-in-up",
                borderCard,
                bgCard,
                isDark ? "hover:shadow-orange-400/10" : "hover:shadow-orange-400/20",
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Histórico de Envios</h2>
                  <p className={clsx("text-sm", textSoft)}>Últimos documentos enviados</p>
                </div>
              </div>

              {loadingHistorico ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Carregando historico...</span>
                </div>
              ) : historicoEnvios.length === 0 ? (
                <div className={clsx("text-center py-8 text-sm", textSoft)}>
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Nenhum envio encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {historicoEnvios.map((envio) => (
                    <div
                      key={envio.id}
                      className={clsx("border rounded-xl p-4 transition-all duration-300", borderCard)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={getSituacaoColor(envio.status)}>{getSituacaoIcon(envio.status)}</div>
                          <span className={`text-sm font-medium ${getSituacaoColor(envio.status)}`}>
                            {envio.status.replace("_", " ")}
                          </span>
                        </div>
                        <span className="text-xs opacity-70">{formatDateTime(envio.data)}</span>
                      </div>
                      <div className="text-sm mb-2">
                        <strong>Documentos:</strong> {envio.documentos.join(", ")}
                      </div>
                      {envio.observacoes && (
                        <div className={clsx("text-xs p-2 rounded border", borderCard)}>{envio.observacoes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {resumo && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowHistorico(!showHistorico)}
                className={clsx(
                  "flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5",
                  isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                )}
              >
                <History className="w-4 h-4" />
                {showHistorico ? "Ocultar Historico" : "Ver Historico de Envios"}
              </button>
            </div>
          )}
        </div>
      </main>

      <footer
        className={clsx(
          "py-12 text-center border-t",
          isDark ? "text-slate-400 border-slate-700 bg-slate-800" : "text-slate-600 border-slate-200 bg-slate-50",
        )}
      >
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className={``}>
              <img
              src={isDark ? "/logo-marca.png" : "/colorida.png"}
              alt="Logo Engeman"
              className="h-8 mx-auto mb-3 transition-transform duration-300 hover:scale-100"
            />
            <span className="font-semibold">Portal do Fornecedor Engeman</span>
            </div>
            
          </div>
          <p className="text-sm">© 1983 - {new Date().getFullYear()} Engeman – Sistema Integrado de Homologação</p>
        </div>
      </footer>

      <button
        onClick={toggleTheme}
        className={clsx(
          "fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50",
          getGradientClasses(),
          isDark ? "hover:shadow-orange-400/40" : "hover:shadow-orange-400/40",
        )}
        title="Alternar tema"
      >
        {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      {showCoteiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div
            className={clsx(
              "w-full max-w-md rounded-3xl p-8 transition-all duration-300 animate-fade-in-up",
              bgCard,
              borderCard,
              "border shadow-2xl",
            )}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getGradientClasses()}`}>
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Cadastre-se no Cotei</h2>
                <p className={clsx("text-sm", textSoft)}>Receba alertas de cotacoes</p>
              </div>
            </div>

            <div className={clsx("rounded-xl p-4 mb-6 border", borderCard)}>
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className={`w-4 h-4 mt-0.5 ${getAccentColor()}`} />
                <div className="text-sm">
                  <p className="font-medium mb-1">Como funciona:</p>
                  <ul className={clsx("text-xs space-y-1", textSoft)}>
                    <li>• Receba todas as cotacoes enviadas para voce por email</li>
                    <li>• Alertas instantaneos no WhatsApp com mapa de cotacao</li>
                    <li>• Responda rapidamente e nao perca oportunidades</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Email para receber cotacoes</label>
                <input
                  type="email"
                  value={coteiForm.email}
                  onChange={(e) => setCoteiForm({ ...coteiForm, email: e.target.value })}
                  placeholder="seu@email.com"
                  className={clsx(
                    "w-full px-4 py-3 rounded-xl outline-none border focus:ring-2 transition-all duration-300",
                    isDark
                      ? "bg-slate-900/60 border-slate-700 focus:ring-orange-400/40 focus:border-orange-400"
                      : "bg-white border-slate-300 focus:ring-orange-400/40 focus:border-orange-400",
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp para alertas</label>
                <input
                  type="tel"
                  value={coteiForm.whatsapp}
                  onChange={(e) => setCoteiForm({ ...coteiForm, whatsapp: e.target.value })}
                  placeholder="Digite seu Número de Whatsapp"
                  className={clsx(
                    "w-full px-4 py-3 rounded-xl outline-none border focus:ring-2 transition-all duration-300",
                    isDark
                      ? "bg-slate-900/60 border-slate-700 focus:ring-orange-400/40 focus:border-orange-400"
                      : "bg-white border-slate-300 focus:ring-orange-400/40 focus:border-orange-400",
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCoteiModal(false)}
                className={clsx(
                  "flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5",
                  isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleCoteiRegistration}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                  getGradientClasses(),
                  isDark ? "hover:shadow-orange-400/25" : "hover:shadow-orange-400/25",
                )}
              >
                <Bell className="w-4 h-4" />
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCertificateModal && resumo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-8">
            <div
              id="cfe-certificate"
              className={clsx(
                "relative mx-auto w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white text-slate-900",
                "shadow-[0_20px_65px_rgba(15,23,42,0.2)] transition-all duration-300 animate-fade-in-up",
              )}
              style={{ aspectRatio: "1038 / 642" }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(203,213,225,0.55)_1.4px,_transparent_1.4px)] [background-size:24px_24px]" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Image
                  src="/logo-marca.png"
                  alt="Marca d'água Engeman"
                  width={820}
                  height={240}
                  className="w-[560px] max-w-none -rotate-12 opacity-10 mix-blend-multiply"
                />
              </div>

              <div className="relative z-10 flex h-full flex-col gap-6 px-10 py-10">
                <header className="grid flex-1 gap-8 lg:grid-cols-[220px_1fr]">
                  <div className="flex flex-col justify-between gap-6">
                    <div className="space-y-5">
                      <Image src="/colorida.png" alt="Engeman" width={150} height={42} className="h-10 w-auto" />
                      <div>
                        <span className="block text-xs font-semibold uppercase text-orange-500">Informações do Fornecedor</span>
                        <p className="mt-3 text-xs text-slate-500">
                          Dados referentes ao cadastro homologado e as ultimas avaliações realizadas.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <h1 className="text-2xl font-semibold text-slate-900 lg:text-[24px] pr-18">
                        CFE - Certificado de Fornecedor Engeman
                      </h1>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      <div>
                        <span className="block text-xs uppercase text-slate-400">Número</span>
                        <span className="mt-1 block text-base font-semibold text-slate-900">{certificateNumber}</span>
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400">Data de Emissão</span>
                        <span className="mt-1 block text-base font-semibold text-slate-900">
                          {formatDate(emissaoCertificado)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400">Validade do CFE</span>
                        <span className="mt-1 block text-base font-semibold text-slate-900">
                          {formatDate(validadeCertificado)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-[1fr_2fr]">
                      <div>
                        <span className="block text-xs uppercase text-slate-400">CNPJ</span>
                        <span className="mt-1 block text-base font-semibold text-slate-900">{resumo.cnpj}</span>
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400">Razão Social</span>
                        <span className="mt-1 block text-base font-semibold text-slate-900">{resumo.nome}</span>
                      </div>
                    </div>
                  </div>
                </header>

               {/* Sessão header do CFE */} 
                <section className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-orange-500">Homologação Engeman</span>
                    </div>
                    <span className="flex justify-end pr-6 text-sm font-bold text-red-500 underline decoration-red-600  decoration-2">Este documento substitui todos os anteriores</span>
                    <div className="rounded-[24px] border border-slate-300 bg-white/85 p-5 text-sm leading-relaxed text-slate-700 shadow-inner md:p-7">
                      <p>
                        Certificamos que a empresa <span className="font-semibold text-slate-900">{resumo.nome}</span>, inscrita no CNPJ <span className="font-semibold text-slate-900">{resumo.cnpj}</span>, encontra-se homologada no Cadastro de Fornecedores Engeman e está autorizada a prestar serviços ou fornecer materiais conforme avaliação vigente, sendo assim com o final do status: <span className="font-semibold text-emerald-600">APROVADO</span>.
                      </p>
                      
                    </div>
                  </div>

                  {/* Sessão onde será mostrado a categoria no CFE */}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-slate-300 bg-white/90 p-4 shadow-sm flex flex-col min-h-[100px]">
                      <span className="text-xs font-semibold uppercase text-orange-500">Categoria</span>
                      {categoriasEnviadas.length > 0 ? (
                        <ul className="mt-3 space-y-1.5 text-sm font-semibold text-slate-900">
                          {categoriasEnviadas.map((cat, idx) => (
                            <li key={`${cat}-${idx}`} className="flex items-start gap-2">
                              <span className="mt-[7px] block h-1.5 w-1.5 rounded-full bg-orange-500" />
                              <span>{cat}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">Aguardando registro das categorias homologadas para exibicao.</p>
                      )}
                    </div>

                    <div className="rounded-[20px] border border-slate-300 bg-white/90 p-2 text-center shadow-sm flex flex-col items-center justify-center min-h-[100px]">
                      <span className="text-xs font-semibold uppercase text-orange-500">Média IQF</span>
                      <p className="mt-3 text-4xl font-bold text-slate-900">{fmt(resumo.mediaIQF)}%</p>
                    </div>

                    <div className="rounded-[20px] border border-slate-300 bg-white/90 p-2 text-center shadow-sm flex flex-col items-center justify-center min-h-[100px]">
                      <span className="text-xs font-semibold uppercase text-orange-500">Homologação</span>
                      <p className="mt-3 text-3xl font-bold text-slate-900">{fmt(resumo.mediaHomologacao)}%</p>
                    </div>
                  </div>
                </section>

              </div>
            </div>

            <style jsx global>{`
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 12mm;
                }
                body {
                  background: #fff;
                }
                #cfe-certificate {
                  width: 100% !important;
                  max-height: none !important;
                  aspect-ratio: auto !important;
                  box-shadow: none !important;
                }
              }
            `}</style>

            <div className="flex gap-4 mt-6 justify-center">
              <button
                onClick={() => setShowCertificateModal(false)}
                className={clsx(
                  "px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5",
                  isDark
                    ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700",
                )}
              >
                Fechar
              </button>
              <button
                onClick={downloadCertificate}
                className={clsx(
                  "flex items-center gap-2 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                  getGradientClasses(),
                )}
              >
                <Download className="w-4 h-4" />
                Baixar Certificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmação para envio de documentos */}
      <AlertDialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          setShowConfirmDialog(open)
          if (!open) {
            setDocsSelecionadosParaEnvio([])
          }
        }}
      >
        <AlertDialogContent className={isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Envio de Documentos</AlertDialogTitle>
            <AlertDialogDescription className={isDark ? "text-slate-300" : "text-slate-600"}>
              {docsSelecionadosParaEnvio.length > 0
                ? `Confirma o envio de ${docsSelecionadosParaEnvio.length} documento(s)${
                    categoriasSelecionadas[0] ? ` para a categoria "${categoriasSelecionadas[0]}"` : ""
                  }?`
                : "Selecione ao menos um documento para enviar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelarEnvio}
              className={isDark ? "border-slate-700 text-slate-200 hover:border-slate-500" : ""}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarEnvio}
              className="bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white"
            >
              Confirmar Envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notificação pop-up */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
          <div
            className={clsx(
              "rounded-2xl border p-4 shadow-2xl max-w-md",
              isDark
                ? "bg-slate-900 border-slate-700 text-white"
                : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-gradient-to-r from-orange-400 to-red-500">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Notificação</p>
                <p className={clsx("text-sm mt-1", isDark ? "text-slate-300" : "text-slate-600")}>
                  {notificationMessage}
                </p>
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className={clsx(
                  "rounded-lg p-1 transition-colors",
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-100",
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
