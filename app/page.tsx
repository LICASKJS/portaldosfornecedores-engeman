"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Moon, Sun, Shield, Users, FileText, ArrowRight, CheckCircle } from "lucide-react"


export default function HomePage() {
  const [isDarkMode, setIsDarkMode] = useState(false)

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
    return isDarkMode ? "bg-gradient-to-r from-orange-400 to-emerald-500" : "bg-gradient-to-r from-orange-400 to-red-500"
  }

  const getAccentColor = () => {
    return isDarkMode ? "text-orange-400" : "text-orange-500"
  }

  return (
    <div
      className={`min-h-screen transition-all duration-300 overflow-x-hidden ${
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
        <div
          className={`absolute w-48 h-48 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full ${
            isDarkMode
              ? "bg-gradient-to-br from-orange-400 to-red-500 opacity-5"
              : "bg-gradient-to-br from-orange-400 to-red-500 opacity-10"
          } animate-pulse delay-2000`}
        ></div>
      </div>

      <header
        className={`fixed top-0 left-0 right-0 backdrop-blur-xl border-b z-50 transition-all duration-300 ${
          isDarkMode ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            {isDarkMode ? (
              <img
                src="/logo.png"
                alt="Logo Engeman"
                className="h-12 transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <img
                src="/logo-branca.png"
                alt="Logo Engeman"
                className="h-12 transition-transform duration-300 hover:scale-105"
              />
            )}
          </div>

            {/* Menu de Navegação */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#"
              className={`relative inline-block font-medium text-sm text-gray-800 after:absolute after:left-0 after:bottom-[-3px] after:h-[3px] after:w-0 after:bg-orange-500 after:transition-all after:duration-500 hover:after:w-full ${
                isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Início
              <span
                className={`absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-500 group-hover:w-full ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              ></span>
            </Link>
            <Link
              href="/cadastro"
              className={`relative inline-block font-medium text-sm text-gray-800 after:absolute after:left-0 after:bottom-[-3px] after:h-[3px] after:w-0 after:bg-orange-500 after:transition-all after:duration-500 hover:after:w-full ${
                isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cadastro
              <span
                className={`absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-500 group-hover:w-full ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              ></span>
            </Link>
            <Link
              href="/procedimento"
              className={`relative inline-block font-medium text-sm text-gray-800 after:absolute after:left-0 after:bottom-[-3px] after:h-[3px] after:w-0 after:bg-orange-500 after:transition-all after:duration-500 hover:after:w-full  ${
                isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Procedimentos
              <span
                className={`absolute bottom-0 left-0 w-0 h-0.5 transition-all ease-in-out group-hover:w-full ${
                  isDarkMode
                    ? "bg-gradient-to-r  from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              ></span>
            </Link>
            <Link
              href="/contato"
              className={`relative inline-block font-medium text-sm text-gray-800 after:absolute after:left-0 after:bottom-[-3px] after:h-[3px] after:w-0 after:bg-orange-500 after:transition-all after:duration-500 hover:after:w-full ${
                isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Contato
              <span
                className={`absolute bottom-0 left-0 w-0 h-0.5 transition-all ease-in-out group-hover:w-full ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              ></span>
            </Link>
              {/* Página do Certificado de Fornecedor Engeman*/}
            <Link
              href="/cfe"
              className={`relative inline-block font-medium text-sm text-gray-800 after:absolute after:left-0 after:bottom-[-3px] after:h-[3px] after:w-0 after:bg-orange-500 after:transition-all after:duration-500 hover:after:w-full ${
                isDarkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              CFE
              <span
                className={`absolute bottom-0 left-0 w-0 h-0.5 transition-all duration-800  ease-in-out group-hover:w-full   ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              ></span>
            </Link>
            {/* Botão de Entrar para o Portal de Fornecedores */}
            <Link
              href="/entrar"
              className={`flex items-center gap-2 text-white px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                isDarkMode
                  ? "bg-gradient-to-r  from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
              }`}
            >
              ENTRAR
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </nav>
        </div>
      </header>
       {/* Sessão principal*/}       
      <section className="min-h-screen flex items-center justify-center text-center px-8 pt-32 pb-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div
            className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm mb-8 animate-fade-in-up ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-slate-300"
                : "bg-slate-100 border-slate-300 text-slate-600"
            }`}
          >
            <Shield className={`w-4 h-4 ${getAccentColor()}`} />
            <span>Portal Seguro e Confiável</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 animate-fade-in-up animation-delay-200">
            Bem-vindo ao Portal de{" "}
            <span
              className={`bg-clip-text text-transparent ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            >
              Fornecedores Engeman
            </span>
          </h1>
          <p
            className={`text-xl mb-12 leading-relaxed animate-fade-in-up animation-delay-400 ${
              isDarkMode ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Cadastre-se ou acesse para acompanhar o status de homologação, seus feedbacks e documentos necessários para
            seu cadastro conosco.
          </p>
          <div className="flex justify-center items-center gap-8 animate-fade-in-up animation-delay-600">
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getAccentColor()}`}>500+</div>
              <div className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Fornecedores Ativos</div>
            </div>
            <div className={`w-px h-10 ${isDarkMode ? "bg-slate-700" : "bg-slate-300"}`}></div>
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getAccentColor()}`}>97,5%</div>
              <div className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Média Anual de Homologação
              </div>
            </div>
            <div className={`w-px h-10 ${isDarkMode ? "bg-slate-700" : "bg-slate-300"}`}></div>
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getAccentColor()}`}>48h</div>
              <div className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Tempo Médio</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sessão de opões de Login, Cadastro e Acompanhamento*/}

      <section className="py-24 px-8 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Como Podemos Ajudar</h2>
          <p className={`text-xl max-w-2xl mx-auto ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            Escolha a opção que melhor atende às suas necessidades
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <div
            className={`group relative border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer overflow-hidden ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 hover:shadow-orange-400/20 hover:border-orange-400"
                : "bg-white border-slate-200 hover:shadow-orange-400/30 shadow-lg hover:border-orange-400"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1 transform scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex justify-between items-start mb-6">
              <div
                className={`w-15 h-15 rounded-2xl flex items-center justify-center ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              >
                <Users className="w-8 h-8 text-white" />
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                }`}
              >
                Novo
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-6">CADASTRO</h3>
            <ul className="space-y-4 mb-8">
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Cadastre sua empresa</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Envie documentos obrigatórios</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Acompanhe os passos iniciais</span>
              </li>
            </ul>
            <button
              className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
              }`}
            >
              <Link rel="stylesheet" 
              href="/cadastro">
              <span>COMEÇAR AGORA</span>
              </Link>
            </button>
          </div>
          

          <div
            className={`group relative border-2 rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer overflow-hidden transform scale-105 ${
              isDarkMode
                ? "bg-slate-700 border-orange-400 hover:shadow-orange-400/40 shadow-xl"
                : "bg-slate-50 border-orange-400 hover:shadow-orange-400/40 shadow-xl"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1 ${
                isDarkMode
                  ? "bg-gradient-to-r  from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex justify-between items-start mb-6">
              <div
                className={`w-15 h-15 rounded-2xl flex items-center justify-center ${
                  isDarkMode
                    ? "bg-gradient-to-r  from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              >
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div
                className={`text-white px-3 py-1 rounded-full text-xs font-medium ${
                  isDarkMode
                    ? "bg-gradient-to-r  from-orange-400 to-red-500"
                    : "bg-gradient-to-r  from-orange-400 to-red-500"
                }`}
              >
                Popular
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-6">LOGIN</h3>
            <ul className="space-y-4 mb-8">
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Acesse com seu E-MAIL</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Gerencie suas informações</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Veja documentos enviados</span>
              </li>
            </ul>
            <button
              className={`w-full flex items-center justify-center gap-2 text-white py-4 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                isDarkMode
                  ? "bg-gradient-to-r  from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
              }`}
            >
              <Link rel="stylesheet" 
              href="/entrar">
              <span>ACESSAR PORTAL</span>
              </Link>
            </button>
          </div>

          <div
            className={`group relative border rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer overflow-hidden ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 hover:shadow-orange-400/20 hover:border-orange-400"
                : "bg-white border-slate-200 hover:shadow-orange-400/30 shadow-lg hover:border-orange-400"
            }`}
          >
            <div
              className={`absolute top-0 left-0 right-0 h-1 transform scale-x-0 transition-transform duration-500 group-hover:scale-x-100 ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex justify-between items-start mb-6">
              <div
                className={`w-15 h-15 rounded-2xl flex items-center justify-center ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
              >
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                }`}
              >
                Status
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-6">ACOMPANHAMENTO</h3>
            <ul className="space-y-4 mb-8">
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Veja sua situação atual</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Entenda os próximos passos</span>
              </li>
              <li className={`flex items-center gap-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <CheckCircle className={`w-5 h-5 ${getAccentColor()}`} />
                <span>Receba atualizações cadastrais</span>
              </li>
            </ul>
            <button
              className={`w-full flex items-center justify-center gap-2 text-white py-4 rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                  : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
              }`}
            >
              <Link rel="stylesheet" 
              href="/entrar">
              <span>VERIFICAR STATUS</span>
              </Link>
            </button>
          </div>
        </div>
      </section>
              {/* Sessão dos processos Engeman*/}

      <section className={`py-24 ${isDarkMode ? "bg-slate-800" : "bg-slate-50"}`}>
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Processo Simplificado</h2>
            <p className={`text-xl max-w-2xl mx-auto ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Siga estes passos para se tornar nosso parceiro
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between relative">
            <div className="flex flex-col items-center text-center flex-1 relative">
              <div
                className={`w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-lg ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                    : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                }`}
              >
                1
              </div>
              <h4 className="text-xl font-semibold mb-2">Cadastro Inicial</h4>
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Preencha os dados básicos da sua empresa
              </p>
            </div>
            <div
              className={`hidden md:block flex-1 h-0.5 mx-4 -mt-8 ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex flex-col items-center text-center flex-1 relative">
              <div
                className={`w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-lg ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                    : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                }`}
              >
                2
              </div>
              <h4 className="text-xl font-semibold mb-2">Documentação</h4>
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Envie os documentos necessários
              </p>
            </div>
            <div
              className={`hidden md:block flex-1 h-0.5 mx-4 -mt-8 ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex flex-col items-center text-center flex-1 relative">
              <div
                className={`w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-lg ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                    : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                }`}
              >
                3
              </div>
              <h4 className="text-xl font-semibold mb-2">Análise</h4>
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Nossa equipe avalia sua solicitação
              </p>
            </div>
            <div
              className={`hidden md:block flex-1 h-0.5 mx-4 -mt-8 ${
                isDarkMode
                  ? "bg-gradient-to-r from-orange-400 to-red-5000"
                  : "bg-gradient-to-r from-orange-400 to-red-500"
              }`}
            ></div>
            <div className="flex flex-col items-center text-center flex-1 relative">
              <div
                className={`w-15 h-15 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 shadow-lg ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                    : "bg-gradient-to-r from-orange-400 to-red-500 shadow-orange-400/25"
                }`}
              >
                4
              </div>
              <h4 className="text-xl font-semibold mb-2">Aprovação</h4>
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                Receba a confirmação e estará homologado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé principal*/}          
      <footer
        className={`border-t py-16 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
      >
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className={`text-lg font-bold mb-6 ${getAccentColor()}`}>SERVIÇOS INDUSTRIAIS</h3>
              <ul className="space-y-3 mb-8">
                <li className={`text-sm relative pl-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <span className={`absolute left-0 ${getAccentColor()}`}>▶</span>
                  Manutenção Industrial
                </li>
                <li className={`text-sm relative pl-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <span className={`absolute left-0 ${getAccentColor()}`}>▶</span>
                  Caldeiraria Industrial
                </li>
                <li className={`text-sm relative pl-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <span className={`absolute left-0 ${getAccentColor()}`}>▶</span>
                  Serviços Especializados
                </li>
                <li className={`text-sm relative pl-4 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <span className={`absolute left-0 ${getAccentColor()}`}>▶</span>
                  Apoio à Operação e Produção
                </li>
              </ul>
              <button
                className={`text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                  isDarkMode
                    ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                    : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                }`}
              >
                <Link href="https://talentosengeman.rhgestor.com.br/vagas" target="_blank">
                CONHEÇA NOSSAS VAGAS
                </Link>
              </button>
            </div>

            <div>
              <h3 className={`text-lg font-bold mb-6 ${getAccentColor()}`}>ENDEREÇOS NO BRASIL</h3>
              <div className="space-y-6">
                <div>
                  <strong className={`block font-semibold mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    Recife - PE
                  </strong>
                  <p className={`text-sm leading-relaxed mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Rua Padre Carapuceiro, 706
                    <br />
                    7º andar • Recife – PE
                    <br />
                    CEP: 51020-280
                  </p>
                  <a
                    href="https://www.google.com/maps/place/ENGEMAN/@-8.1169277,-34.9037559,17z/data=!3m1!4b1!4m6!3m5!1s0x7ab1ee4be2f2419:0xa871ff4c1318ca69!8m2!3d-8.116933!4d-34.901181!16s%2Fg%2F1vn9p963?entry=tts&shorturl=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                      isDarkMode
                        ? "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                        : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                    }`}
                  >
                    Como chegar
                  </a>
                </div>
                <div>
                  <strong className={`block font-semibold mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    Macaé - RJ
                  </strong>
                  <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                    Rua Cosme Velho, 98
                    <br />
                    Polo Industrial Cabiunas
                    <br />
                    CEP: 27977-315
                  </p>
                </div>
              </div>
            </div>
               {/* Redes Sociais Engeman*/}     
            <div>
              <h3 className={`text-lg font-bold mb-6 ${getAccentColor()}`}>SIGA-NOS</h3>
              <div className="flex gap-4 mb-8">
                <a
                  href="https://www.instagram.com/engemanbr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-11 h-11 border rounded-xl flex items-center justify-center transition-all duration-500 hover:text-white hover:-translate-y-1 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>

                <a
                  href="https://www.linkedin.com/company/engeman"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-11 h-11 border rounded-xl flex items-center justify-center transition-all duration-500 hover:text-white hover:-translate-y-1 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>

                <a
                  href="https://www.facebook.com/engemanindustria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-11 h-11 border rounded-xl flex items-center justify-center transition-all duration-500 hover:text-white hover:-translate-y-1 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                <a
                  href="https://www.youtube.com/@engemanbr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-11 h-11 border rounded-xl flex items-center justify-center transition-all duration-500 hover:text-white hover:-translate-y-1 hover:shadow-lg ${
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-gradient-to-r hover:from-orange-400 hover:to-red-500 hover:shadow-orange-400/25"
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>

                {/* Catalogo de Apresentação em PT-BR*/} 

              <div className="space-y-4">
                <div className="text-center">
                  <img
                    src="/engeman-br.png"
                    alt="Apresentação Engeman PT-BR"
                    className="w-32 h-auto rounded-lg mb-2 transition-transform duration-300 hover:scale-105"
                  />
                  <a
                    href="https://engeman.net/wp-content/uploads/2024/11/APRESENTACAO-COMERCIAL-ENGEMAN-1.9.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block text-white px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                      isDarkMode
                        ? "bg-gradient-to-r  from-orange-400 to-red-500 hover:shadow-orange-400/25"
                        : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                    }`}
                  >
                    BAIXAR | PT-BR
                  </a>
                </div>

                {/* Catalogo de Apresentação em EN*/} 

                <div className="text-center">
                  <img
                    src="/engeman-en.png"
                    alt="Presentation Engeman EN"
                    className="w-32 h-auto rounded-lg mb-2 transition-transform duration-300 hover:scale-105"
                  />
                  <a
                    href="https://engeman.net/wp-content/uploads/2024/10/COMMERCIAL-PRESENTATION-ENGEMAN-1.8.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block text-white px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                      isDarkMode
                        ? "bg-gradient-to-r  from-orange-400 to-red-500 hover:shadow-orange-400/25"
                        : "bg-gradient-to-r from-orange-400 to-red-500 hover:shadow-orange-400/25"
                    }`}
                  >
                    DOWNLOAD | EN
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`border-t mt-12 pt-8 text-center text-sm ${
              isDarkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"
            }`}
          >
            Contato Nacional: <strong>4003-4023</strong> |
            <a href="mailto:comercial@engeman.net" className={`hover:underline ml-2 ${getAccentColor()}`}>
              comercial@engeman.net
            </a>{" "}
            |
            <a href="mailto:suprimentos.matriz@engeman.net" className={`hover:underline ml-2 ${getAccentColor()}`}>
              suprimentos.matriz@engeman.net
            </a>
          </div>
        </div>
      </footer>

      <button
        onClick={toggleTheme}
        className={`fixed bottom-8 right-8 w-15 h-15 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50 btn-theme-toggle ${
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
