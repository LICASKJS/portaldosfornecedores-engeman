/**
 * API Route - Upload de Documentos
 * 
 * Este endpoint processa o upload de documentos enviados pelos fornecedores.
 * 
 * Funcionalidades:
 * - Recebe múltiplos arquivos via FormData
 * - Valida CNPJ e categoria
 * - Processa upload de documentos
 * 
 * Parâmetros (FormData):
 * - cnpj: CNPJ do fornecedor
 * - categoria: Categoria do material/serviço
 * - file1, file2, file3, file4: Arquivos a serem enviados
 * 
 * Retorna:
 * - JSON com status do upload e nomes dos arquivos processados
 * 
 * TODO: Implementar gravação em S3/SharePoint, salvamento em disco ou banco de dados
 * 
 * @route POST /api/uploads
 * @module app/api/uploads/route
 * @author Sistema Engeman
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const cnpj = form.get("cnpj") as string;
  const categoria = form.get("categoria") as string;

  const files: File[] = [];
  for (let i = 1; i <= 4; i++) {
    const f = form.get(`file${i}`);
    if (f && f instanceof File) files.push(f);
  }
  // Validação simples
  if (!cnpj || !categoria) return NextResponse.json({ ok: false, error: "CNPJ e categoria são obrigatórios." }, { status: 400 });

  // Aqui você pode:
  // - Gravar em S3/SharePoint
  // - Salvar no disco (dev): await fs.writeFile(…)
  // - Registrar no banco (metadados)
  // Exemplo: só ecoando nomes
  const nomes = files.map(f => f.name);

  return NextResponse.json({ ok: true, cnpj, categoria, arquivos: nomes });
}
