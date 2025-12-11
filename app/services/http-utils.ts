/**
 * Utilitários HTTP
 * 
 * Este módulo fornece funções auxiliares para processamento de respostas HTTP,
 * incluindo parsing seguro de JSON e extração de mensagens de erro.
 * 
 * Funções:
 * - parseJsonSafe: Faz parse seguro de resposta JSON, retornando objeto e texto
 * - extractMessage: Extrai mensagem de erro de resposta JSON ou retorna fallback
 * 
 * @module app/services/http-utils
 * @author Sistema Engeman
 */

export type JsonRecord = Record<string, unknown> | null

export async function parseJsonSafe(response: Response): Promise<{
  json: JsonRecord
  text: string
}> {
  const text = await response.text()

  if (!text) {
    return { json: null, text: "" }
  }

  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        json: parsed as Record<string, unknown>,
        text,
      }
    }

    return { json: null, text }
  } catch {
    return { json: null, text }
  }
}

export function extractMessage(json: JsonRecord, fallback: string): string {
  if (json && typeof json.message === "string") {
    const message = json.message.trim()
    if (message) {
      return message
    }
  }

  const trimmed = fallback.trim()
  return trimmed || "Resposta inesperada do servidor."
}
