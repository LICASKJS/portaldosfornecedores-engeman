import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utilitário para combinar classes CSS
 * 
 * Esta função combina classes CSS usando clsx e tailwind-merge,
 * garantindo que classes conflitantes do Tailwind sejam mescladas corretamente.
 * 
 * @param inputs - Classes CSS a serem combinadas (strings, objetos, arrays, etc.)
 * @returns String com classes CSS combinadas e mescladas
 * 
 * @example
 * cn("px-2 py-1", "bg-red-500", { "text-white": true })
 * // Retorna: "px-2 py-1 bg-red-500 text-white"
 * 
 * @module lib/utils
 * @author Sistema Engeman
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

