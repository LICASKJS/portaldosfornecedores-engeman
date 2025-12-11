/**
 * API Route - Consulta de Documentos Necessários (CLAF)
 * 
 * Este endpoint consulta a planilha CLAF (Classificação de Materiais/Serviços)
 * para retornar os documentos necessários para uma categoria específica.
 * 
 * Funcionalidades:
 * - Busca a planilha CLAF.xlsx em vários locais possíveis
 * - Normaliza e compara categorias de forma tolerante (sem acentos, case-insensitive)
 * - Retorna lista de documentos necessários para a categoria informada
 * 
 * Parâmetros:
 * - categoria (query string): Nome da categoria de material/serviço
 * 
 * Retorna:
 * - JSON com categoria e array de documentos necessários
 * 
 * @route GET /api/claf
 * @module app/api/claf/route
 * @author Sistema Engeman
 */

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

const DOCUMENT_COLUMN_CANDIDATES = [
  "REQUISITOS LEGAIS",
  "REQUISITOS_ESTABELECIDOS_PELA_ENGEMAN",
  "REQUISITOS ESTABELECIDOS PELA ENGEMAN",
];

const CATEGORY_COLUMN_CANDIDATES = ["MATERIAL", "CATEGORIA"];

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const candidatePaths = (): string[] => {
  const fromEnv =
    process.env.CLAF_PATH ||
    process.env.CLAF_FILE ||
    process.env.CLAFFILE ||
    process.env.CLAFFILE_PATH;
  const root = process.cwd();
  const list: string[] = [];
  if (fromEnv) {
    list.push(path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv));
  }
  list.push(
    path.join(root, "public", "CLAF.xlsx"),
    path.join(root, "static", "CLAF.xlsx"),
    path.join(root, "back-end", "static", "CLAF.xlsx"),
  );
  return list;
};

const resolveClafFile = (): string | null => {
  for (const candidate of candidatePaths()) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const extractField = (row: Record<string, unknown>, candidates: string[]) => {
  for (const candidate of candidates) {
    if (candidate in row && row[candidate] !== undefined) {
      return row[candidate];
    }
    const normalizedKey = normalize(candidate).replace(/\s+/g, "_");
    for (const [rawKey, rawValue] of Object.entries(row)) {
      const keyNormalized = normalize(rawKey).replace(/\s+/g, "_");
      if (keyNormalized === normalizedKey) {
        return rawValue;
      }
    }
  }
  return "";
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoriaRaw = searchParams.get("categoria") || "";
    const categoriaNormalizada = normalize(categoriaRaw);
    if (!categoriaNormalizada) {
      return NextResponse.json({ categoria: categoriaRaw, documentos: [] });
    }

    const filePath = resolveClafFile();
    if (!filePath) {
      return NextResponse.json(
        {
          categoria: categoriaRaw,
          documentos: [],
          message: "Planilha CLAF não encontrada no projeto.",
        },
        { status: 404 },
      );
    }

    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
    });

    const documentos: string[] = [];
    for (const row of rows) {
      const categoriaLinha = normalize(extractField(row, CATEGORY_COLUMN_CANDIDATES));
      if (!categoriaLinha) continue;
      const match =
        categoriaLinha.includes(categoriaNormalizada) ||
        categoriaNormalizada.includes(categoriaLinha);
      if (!match) continue;

      const documentoValor = extractField(row, DOCUMENT_COLUMN_CANDIDATES);
      const documentoTexto = String(documentoValor ?? "").replace(/\s+/g, " ").trim();
      if (!documentoTexto) continue;
      documentos.push(documentoTexto);
    }

    return NextResponse.json({ categoria: categoriaRaw, documentos });
  } catch (error) {
    console.error("Erro ao processar CLAF.xlsx:", error);
    return NextResponse.json(
      {
        categoria: null,
        documentos: [],
        message: "Erro ao processar a planilha CLAF.",
      },
      { status: 500 },
    );
  }
}
