"use client"

{/* Bibliotecas utilizadas */}

import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  FileCheck,
  Award,
  TrendingUp,
  Shield,
  ChevronDown,
  Users2,
  ArchiveIcon,
  ArchiveRestore,
  Archive,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { useState } from "react"

export default function CFEPage() {
  const [openStep, setOpenStep] = useState<number | null>(null)

  const toggleStep = (step: number) => {
    setOpenStep(openStep === step ? null : step)
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-orange-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>
            <div className="w-px h-6 bg-slate-300"></div>
            <Image src="/colorida.png" alt="Engeman" width={120} height={36} className="object-contain" />
          </div>
        </div>
      </header>


      {/* Cabeçalho */}

      <section className="relative py-16 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-50 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto relative">
          <div className="flex flex-col lg:flex-row items-start gap-12">
            <div className="relative w-full lg:w-80 flex-shrink-0">
              <div className="absolute inset-0 border-4 border-orange-400 rounded-tl-[50px] rounded-br-[50px] transform translate-x-2 translate-y-2"></div>
              <div className="relative overflow-hidden rounded-tl-[50px] rounded-br-[50px] shadow-lg">
                <img src="/cfe fornecedores.png" alt="Cadastro de Fornecedores" className="w-full h-56 object-cover" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Cadastro de Fornecedores</h1>
              <div className="w-16 h-1 bg-orange-400 mb-6"></div>
              <p className="text-lg text-slate-700 leading-relaxed">
                Conheça as vantagens de estar no nosso Cadastro de Fornecedores e saiba como se cadastrar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explicação sobre o CFE (Certificado de fornecedor Engeman) */}

      <section className="py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Certificado de Fornecedor Engeman</h2>
          <div className="w-16 h-1 bg-orange-400 mb-8"></div>

          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              Emitimos o Certificado de Fornecedor Engeman (CFE) para os fornecedores que atingirem a média minima de
              Homologação (70) pontos. Esse certificado pode ser emitido após a aprovação de cadastro, envio dos
              documentos de acordo com a sua categorias. Os prestadores de serviço devem comprovar o atendimento aos
              requisitos de{" "}
              <span className="text-orange-500">
                Qualidade, Saúde, Segurança Ocupacional e Meio Ambiente para prestação de serviço.
              </span>
            </p>
            <p>
              A validade do certificado é de até um ano, sendo determinada a partir da emissão. A renovação dos critérios
              é atualizada anualmente, sendo assim a atualização da homologação será de acordo com o dia do seu{" "}
              <span className="text-orange-500">Cadastro</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Passo á passo para se tornar um fornecedor Engeman. Deixando tópicos detalhados */}

      <section className="py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Etapas do processo de cadastramento</h2>
          <div className="w-16 h-1 bg-orange-400 mb-8"></div>

          <div className="space-y-3">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleStep(1)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-900">1 - Crie seu cadastro como Fornecedor Engeman </span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 transition-transform ${openStep === 1 ? "rotate-180" : ""}`}
                />
              </button>
              {openStep === 1 && (
                <div className="px-6 pb-4 text-slate-600 space-y-3">
                  <p>Faça o seu cadastro com as informações básicas, CNPJ, e-mail, senha e o nome fantasia da sua empresa.</p>
                  <p className="text-sm text-slate-500">
                    Durante esse processo podemos entrar em contato para solicitar documentos
                    complementares.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleStep(2)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-900">
                  2 - Acompanhe e atualize os dados necessários para Homologação
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 transition-transform ${openStep === 2 ? "rotate-180" : ""}`}
                />
              </button>
              {openStep === 2 && (
                <div className="px-6 pb-4 text-slate-600 space-y-3">
                  <p>
                    Complete os dados cadastrais, categoria na qual fornece, documentações atualizadas.
                  </p>
                  <p className="text-sm text-slate-500">
                    Mantenha seus documentos atualizados para acelerar o processo de homologação.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleStep(3)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-900">3 - Envie e mantenha a Documentação necessária</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 transition-transform ${openStep === 3 ? "rotate-180" : ""}`}
                />
              </button>
              {openStep === 3 && (
                <div className="px-6 pb-4 text-slate-600 space-y-3">
                  <p>Envie pela sua página do portal de fornecedor e acompanhe seu processo de homologação.</p>
                  <p className="text-sm text-slate-500">
                    Documentos obrigatórios variam conforme a categoria do fornecedor e são revisados periodicamente.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleStep(4)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-900">4 - Acompanhe o status de Homologação</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 transition-transform ${openStep === 4 ? "rotate-180" : ""}`}
                />
              </button>
              {openStep === 4 && (
                <div className="px-6 pb-4 text-slate-600 space-y-3">
                  <p>
                    Consulte o status da sua homologação na plataforma, recebendo notificações sobre pendências e prazos
                    de renovação.
                  </p>
                  <p className="text-sm text-slate-500">
                    Ao ser aprovado, seu certificado CFE ficará disponível para download.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Segunda sessão que mostra o passo á passo */}

      <section className="py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Documentação completa</h3>
                  <p className="text-slate-600">
                    Reúna os documentos necessários para homologação de acordo com a sua categoria de fornecedor.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Processo guiado</h3>
                  <p className="text-slate-600">
                    Acompanhe cada etapa do cadastro, com orientações e suporte da equipe Engeman quando necessário.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Homologação</h3>
                  <p className="text-slate-600">
                    Após análise, receba o status atualizado do seu cadastro e o certificado CFE com validade anual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Tópicos necessários para homologação*/}
      <section className="py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <ArchiveIcon className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Cadastro de categorias</h3>
                  <p className="text-slate-600">
                    Informe todas as categorias de materiais ou serviços que você fornece para ampliar suas oportunidades
                    junto à Engeman.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <ArchiveRestore className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Atualização constante</h3>
                  <p className="text-slate-600">
                    Mantenha seus dados e documentos sempre atualizados para garantir a continuidade da homologação.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Archive className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Gestão de documentos</h3>
                  <p className="text-slate-600">
                    Organize e acompanhe a validade dos certificados, licenças e demais documentos exigidos.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Cumprimento de prazos</h3>
                  <p className="text-slate-600">
                    Demonstre a pontualidade nas entregas e fortaleça sua avaliação junto à Engeman.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tópicos necessários para se tornar fornecedor engeman */}

      <section className="py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Qualidade dos materiais</h3>
                  <p className="text-slate-600">
                    Garanta a excelência nos produtos ou serviços entregues, atendendo aos padrões exigidos.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Segurança e compliance</h3>
                  <p className="text-slate-600">
                    Comprove o atendimento às normas de saúde, segurança e meio ambiente em suas operações.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Conformidade</h3>
                  <p className="text-slate-600">
                    Atenda a todos os requisitos contratuais e normativos definidos pela Engeman.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Users2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">Suporte especializado</h3>
                  <p className="text-slate-600">
                    Conte com a equipe Engeman para orientações durante todo o processo de homologação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      

      {/* Sessão do IQF */}
      <section className="py-12 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">IQF - Índice de Qualificação de Fornecedor</h2>
          <div className="w-16 h-1 bg-orange-400 mb-8"></div>

          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              O Índice de Qualificação de Fornecedor (IQF) é uma métrica que avalia o desempenho dos fornecedores
              certificados ao longo do tempo. Este índice é calculado com base em diversos fatores relacionados à
              qualidade dos produtos/serviços, cumprimento de prazos, atendimento e conformidade com requisitos
              contratuais.
            </p>

            <p>
              O IQF é expresso em uma escala de 0 a 100 pontos e é atualizado periodicamente conforme as avaliações de
              desempenho.
              <p>Fornecedores com IQF superior a 70 pontos são considerados de alto desempenho.</p>
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Ética e Conduta</h2>
          <div className="w-16 h-1 bg-orange-400 mb-8"></div>

          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>
              A Engeman está comprometida em conduzir seu negócio de forma legal e ética, o que inclui a contratação de
              fornecedores comprometidos com o mesmo princípios. Exigimos que todos os fornecedores assinem o nosso Código
              de ética e Condunta para fornecedor buscando o cumprimento das normas determinadas.
            </p>
          </div>
        </div>
      </section>
      <footer className="py-8 px-6 bg-slate-900 text-slate-400 text-center">
        <Image src="/logo-marca.png" alt="Engeman" width={100} height={30} className="mx-auto mb-3 opacity-70" />
        <p className="text-sm">© 1983 - {new Date().getFullYear()} Engeman - Sistema Integrado de Homologação</p>
      </footer>
    </div>
  )
}
