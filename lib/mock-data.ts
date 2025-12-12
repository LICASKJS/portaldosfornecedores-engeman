export interface Fornecedor {
  id: string
  nome: string
  cnpj: string
  categoria: string
  mediaIQF: number
  mediaHomologacao: number
  totalAvaliacoes: number
  ultimaAvaliacao: string
  feedback: string
  status: "APROVADO" | "EM_ANALISE" | "PENDENTE" | "REPROVADO"
  proximaReavaliacao: string
  responsavel: string
  telefone: string
  email: string
}

export interface DocRequisito {
  id: string
  titulo: string
  descricao?: string
  obrigatorio: boolean
  categoria: string
}

export interface HistoricoEnvio {
  id: string
  data: string
  documentos: string[]
  status: "APROVADO" | "EM_ANALISE" | "REJEITADO"
  observacoes?: string
}

export const mockFornecedores: Fornecedor[] = [
  {
    id: "1",
    nome: "TRANSPORTES SILVA LTDA",
    cnpj: "12.345.678/0001-90",
    categoria: "TRANSPORTADORA",
    mediaIQF: 87.5,
    mediaHomologacao: 92.3,
    totalAvaliacoes: 15,
    ultimaAvaliacao: "2024-12-15",
    feedback:
      "Fornecedor com excelente histórico de entregas pontuais e documentação sempre em dia. Recomendado para contratos de longo prazo.",
    status: "APROVADO",
    proximaReavaliacao: "2025-06-15",
    responsavel: "João Silva",
    telefone: "(11) 99999-9999",
    email: "contato@transportessilva.com.br",
  },
  {
    id: "2",
    nome: "CONSTRUÇÕES SANTOS E CIA",
    cnpj: "98.765.432/0001-10",
    categoria: "CONSTRUÇÃO CIVIL",
    mediaIQF: 78.2,
    mediaHomologacao: 81.7,
    totalAvaliacoes: 8,
    ultimaAvaliacao: "2024-11-20",
    feedback:
      "Empresa em processo de adequação aos novos padrões de qualidade. Apresentou melhorias significativas nos últimos meses.",
    status: "EM_ANALISE",
    proximaReavaliacao: "2025-03-20",
    responsavel: "Maria Santos",
    telefone: "(11) 88888-8888",
    email: "maria@construcoessantos.com.br",
  },
  {
    id: "3",
    nome: "TECNOLOGIA AVANÇADA SISTEMAS",
    cnpj: "11.222.333/0001-44",
    categoria: "TECNOLOGIA",
    mediaIQF: 94.8,
    mediaHomologacao: 96.1,
    totalAvaliacoes: 22,
    ultimaAvaliacao: "2024-12-10",
    feedback:
      "Fornecedor de excelência com soluções inovadoras e suporte técnico excepcional. Parceiro estratégico recomendado.",
    status: "APROVADO",
    proximaReavaliacao: "2025-12-10",
    responsavel: "Carlos Tech",
    telefone: "(11) 77777-7777",
    email: "carlos@tecavancada.com.br",
  },
]

export const mockDocumentosRequisitos: Record<string, DocRequisito[]> = {
  TRANSPORTADORA: [
    {
      id: "1",
      titulo: "Licença ANTT",
      descricao: "Registro Nacional de Transportadores Rodoviários de Cargas",
      obrigatorio: true,
      categoria: "TRANSPORTADORA",
    },
    {
      id: "2",
      titulo: "Seguro de Responsabilidade Civil",
      descricao: "Cobertura mínima de R$ 200.000",
      obrigatorio: true,
      categoria: "TRANSPORTADORA",
    },
    {
      id: "3",
      titulo: "Certificado de Vistoria Veicular",
      descricao: "Para todos os veículos da frota",
      obrigatorio: true,
      categoria: "TRANSPORTADORA",
    },
    {
      id: "4",
      titulo: "Comprovante de Regularidade Fiscal",
      descricao: "CND Federal, Estadual e Municipal",
      obrigatorio: false,
      categoria: "TRANSPORTADORA",
    },
  ],
  "CONSTRUÇÃO CIVIL": [
    {
      id: "5",
      titulo: "CREA - Registro no Conselho",
      descricao: "Registro ativo no Conselho Regional de Engenharia",
      obrigatorio: true,
      categoria: "CONSTRUÇÃO CIVIL",
    },
    {
      id: "6",
      titulo: "Certificado de Qualidade ISO 9001",
      descricao: "Certificação de qualidade em construção",
      obrigatorio: false,
      categoria: "CONSTRUÇÃO CIVIL",
    },
    {
      id: "7",
      titulo: "ART - Anotação de Responsabilidade Técnica",
      descricao: "Para projetos específicos",
      obrigatorio: true,
      categoria: "CONSTRUÇÃO CIVIL",
    },
  ],
  TECNOLOGIA: [
    {
      id: "8",
      titulo: "Certificação ISO 27001",
      descricao: "Segurança da Informação",
      obrigatorio: true,
      categoria: "TECNOLOGIA",
    },
    {
      id: "9",
      titulo: "Termo de Confidencialidade",
      descricao: "Acordo de não divulgação de informações",
      obrigatorio: true,
      categoria: "TECNOLOGIA",
    },
    {
      id: "10",
      titulo: "Certificado LGPD",
      descricao: "Conformidade com Lei Geral de Proteção de Dados",
      obrigatorio: false,
      categoria: "TECNOLOGIA",
    },
  ],
}

export const mockHistoricoEnvios: HistoricoEnvio[] = [
  {
    id: "1",
    data: "2024-12-15",
    documentos: ["Licença ANTT", "Seguro RCV"],
    status: "APROVADO",
    observacoes: "Documentos aprovados sem ressalvas",
  },
  {
    id: "2",
    data: "2024-11-20",
    documentos: ["Certificado ISO", "Termo Confidencialidade"],
    status: "EM_ANALISE",
    observacoes: "Aguardando validação do setor jurídico",
  },
  {
    id: "3",
    data: "2024-10-10",
    documentos: ["CREA", "ART"],
    status: "REJEITADO",
    observacoes: "ART com data vencida, necessário reenvio",
  },
]

export const buscarFornecedorPorNome = async (nome: string): Promise<Fornecedor | null> => {
  await new Promise((resolve) => setTimeout(resolve, 800))

  const fornecedor = mockFornecedores.find((f) => f.nome.toLowerCase().includes(nome.toLowerCase()))

  return fornecedor || null
}

export const buscarDocumentosNecessarios = async (categoria: string): Promise<DocRequisito[]> => {
  await new Promise((resolve) => setTimeout(resolve, 300))

  return mockDocumentosRequisitos[categoria.toUpperCase()] || []
}

export const enviarDocumentos = async (
  fornecedorId: string,
  categoria: string,
  arquivos: File[],
): Promise<{ success: boolean; message: string; enviados: string[] }> => {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const success = Math.random() > 0.1

  if (success) {
    return {
      success: true,
      message: "Documentos enviados com sucesso",
      enviados: arquivos.map((f) => f.name),
    }
  } else {
    return {
      success: false,
      message: "Erro no servidor, tente novamente",
      enviados: [],
    }
  }
}

export const buscarHistoricoEnvios = async (fornecedorId: string): Promise<HistoricoEnvio[]> => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  return mockHistoricoEnvios
}