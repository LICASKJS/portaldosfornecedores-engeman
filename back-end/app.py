from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt
from flask_mail import Mail, Message
from config import Config
from models import db, Fornecedor, Documento, Homologacao, NotaFornecedor
from werkzeug.security import generate_password_hash, check_password_hash
import io
import random
import base64
import os
import shutil
import mimetypes
import pandas as pd
import math
import unicodedata
import re
from flask_cors import CORS
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from flask_migrate import Migrate
from sqlalchemy import or_, inspect, text

# ============================================================================
# CONFIGURAÇÃO INICIAL DA APLICAÇÃO
# ============================================================================

# Instância do Flask-Mail para envio de e-mails
mail = Mail()

# Instância principal da aplicação Flask
app = Flask(__name__)

# Diretório padrão para armazenamento de arquivos enviados pelos fornecedores
# Os arquivos são organizados em subpastas por fornecedor (ID do fornecedor)
UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')

# Extensões de arquivo permitidas para upload
# Formatos aceitos: PDF, imagens (PNG, JPG, JPEG), documentos (DOCX) e planilhas (XLSX)
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'}

# Configura o diretório de upload na aplicação Flask
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


def _normalizar_nome_documento(nome):
    """
    Normaliza o nome do documento removendo caracteres especiais.
    
    Remove todos os caracteres não alfanuméricos e converte para minúsculas,
    permitindo comparações mais tolerantes entre nomes de arquivos.
    
    Args:
        nome: Nome do documento a ser normalizado
        
    Returns:
        String normalizada contendo apenas caracteres alfanuméricos em minúsculas
    """
    if not nome:
        return ''
    return ''.join(ch.lower() for ch in str(nome) if ch.isalnum())


def _nomes_documento_candidatos(nome):
    """
    Gera variações possíveis do nome do documento para busca no sistema de arquivos.
    
    Cria uma lista de variações do nome do arquivo (com underscores, hífens, espaços, etc.)
    para aumentar as chances de encontrar o arquivo mesmo que tenha sido renomeado
    ou salvo com formato diferente.
    
    Args:
        nome: Nome original do documento
        
    Returns:
        Lista de strings com variações possíveis do nome do arquivo
    """
    candidatos = []

    def _adicionar(valor):
        valor = (valor or '').strip()
        if valor and valor not in candidatos:
            candidatos.append(valor)

    base = (nome or '').strip()
    if base:
        _adicionar(base)
        _adicionar(secure_filename(base))
        _adicionar(base.replace('_', ' '))
        _adicionar(base.replace('_', '-'))
        _adicionar(base.replace('-', ' '))

    return candidatos


def _diretorios_documento_candidatos(fornecedor_id):
    """
    Lista todos os diretórios possíveis onde os documentos podem estar armazenados.
    
    Gera uma lista completa de caminhos onde o sistema deve procurar arquivos,
    incluindo diretórios padrão de uploads, pastas de fornecedores específicos,
    e diretórios alternativos para garantir que arquivos sejam encontrados mesmo
    após mudanças na estrutura do projeto.
    
    Args:
        fornecedor_id: ID do fornecedor para buscar em pastas específicas
        
    Returns:
        Lista de caminhos absolutos onde os documentos podem estar localizados
    """
    diretorios = []
    vistos = set()

    def _adicionar(caminho):
        if not caminho:
            return
        caminho_abs = os.path.abspath(caminho)
        if caminho_abs in vistos:
            return
        vistos.add(caminho_abs)
        diretorios.append(caminho_abs)

    fornecedor_segmento = str(fornecedor_id) if fornecedor_id is not None else None
    raiz_app = os.path.abspath(app.root_path)
    raiz_pai = os.path.abspath(os.path.dirname(raiz_app))

    primarios = [
        UPLOAD_FOLDER,
        app.config.get('UPLOAD_FOLDER'),
        os.path.join(raiz_app, 'uploads'),
        os.path.join(raiz_app, 'instance', 'uploads'),
        os.path.join(raiz_pai, 'uploads'),
        os.path.join(raiz_pai, 'instance', 'uploads'),
        os.path.join(raiz_app, 'static'),
        os.path.join(raiz_pai, 'static'),
    ]

    for base in primarios:
        _adicionar(base)
        if fornecedor_segmento:
            _adicionar(os.path.join(base, fornecedor_segmento))
        _adicionar(os.path.join(base, 'static'))
        _adicionar(os.path.join(base, 'uploads'))

    return diretorios


def _carregar_documento_de_fontes(documento):
    """
    Procura e carrega o conteúdo de um documento em diferentes locais do sistema.
    
    Busca o arquivo do documento em múltiplos diretórios e com variações de nome,
    garantindo que documentos sejam encontrados mesmo após mudanças na estrutura
    de pastas ou renomeação de arquivos. Primeiro tenta encontrar por nome exato,
    depois por normalização de caracteres.
    
    Args:
        documento: Objeto Documento do banco de dados
        
    Returns:
        Tupla (caminho_arquivo, dados_bytes) ou (None, None) se não encontrado
    """
    nomes_candidatos = _nomes_documento_candidatos(documento.nome_documento)
    diretorios = _diretorios_documento_candidatos(documento.fornecedor_id)
    caminhos_vistos = set()

    for diretorio in diretorios:
        for nome in nomes_candidatos:
            caminho = os.path.abspath(os.path.join(diretorio, nome))
            if caminho in caminhos_vistos:
                continue
            caminhos_vistos.add(caminho)
            if not os.path.isfile(caminho):
                continue
            try:
                with open(caminho, 'rb') as arquivo:
                    dados = arquivo.read()
            except OSError as exc:
                print(f'Falha ao ler arquivo alternativo {caminho} para documento {documento.id}: {exc}')
                continue
            if dados:
                return caminho, dados

    alvo_normalizado = _normalizar_nome_documento(documento.nome_documento)
    if not alvo_normalizado:
        return None, None

    for diretorio in diretorios:
        if not os.path.isdir(diretorio):
            continue
        try:
            entradas = os.listdir(diretorio)
        except OSError as exc:
            print(f'Falha ao listar {diretorio}: {exc}')
            continue
        for entrada in entradas:
            caminho = os.path.abspath(os.path.join(diretorio, entrada))
            if caminho in caminhos_vistos or not os.path.isfile(caminho):
                continue
            if _normalizar_nome_documento(entrada) != alvo_normalizado:
                continue
            try:
                with open(caminho, 'rb') as arquivo:
                    dados = arquivo.read()
            except OSError as exc:
                print(f'Falha ao ler arquivo normalizado {caminho} para documento {documento.id}: {exc}')
                continue
            if dados:
                return caminho, dados
    return None, None


def _armazenar_documento_no_disco(documento, conteudo):
    """
    Salva o conteúdo do documento no sistema de arquivos.
    
    Cria o diretório do fornecedor se necessário e salva o arquivo no local padrão
    de uploads, garantindo que haja uma cópia física do documento no disco.
    
    Args:
        documento: Objeto Documento do banco de dados
        conteudo: Bytes do conteúdo do arquivo a ser salvo
        
    Returns:
        Caminho absoluto do arquivo salvo ou None em caso de erro
    """
    if not conteudo or documento is None or documento.fornecedor_id is None:
        return None
    destino_dir = os.path.join(UPLOAD_FOLDER, str(documento.fornecedor_id))
    try:
        os.makedirs(destino_dir, exist_ok=True)
        destino_caminho = os.path.join(destino_dir, documento.nome_documento)
        with open(destino_caminho, 'wb') as destino:
            destino.write(conteudo)
        return destino_caminho
    except OSError as exc:
        print(f'Falha ao salvar documento {documento.id} no disco: {exc}')
        return None


def _resolver_logo_path(nome_arquivo='colorida.png'):
    """
    Localiza o arquivo de logo da empresa em diferentes diretórios do projeto.
    
    Busca o logo em vários locais possíveis (static, raiz do projeto, etc.)
    para garantir que seja encontrado independente da estrutura de pastas.
    Usado principalmente para anexar o logo em e-mails enviados pelo sistema.
    
    Args:
        nome_arquivo: Nome do arquivo de logo (padrão: 'colorida.png')
        
    Returns:
        Caminho absoluto do logo se encontrado, None caso contrário
    """
    candidatos = [
        os.path.join(app.root_path, 'static', nome_arquivo),
        os.path.join(os.path.dirname(app.root_path), 'static', nome_arquivo),
        os.path.join(app.root_path, nome_arquivo),
        os.path.join(os.path.dirname(app.root_path), nome_arquivo),
    ]
    vistos = set()
    for caminho in candidatos:
        caminho_abs = os.path.abspath(caminho)
        if caminho_abs in vistos:
            continue
        vistos.add(caminho_abs)
        if os.path.exists(caminho_abs):
            return caminho_abs
    return None

# ============================================================================
# CONFIGURAÇÕES DE SEGURANÇA E AUTENTICAÇÃO
# ============================================================================

# Lista de e-mails autorizados para acesso à área administrativa
# Apenas usuários com e-mails nesta lista podem fazer login como administradores
ADMIN_ALLOWED_EMAILS = {
    'pedro.vilaca@engeman.net',
    'sofia.beltrao@engeman.net',
    'lucas.mateus@engeman.net'
}

# Senha padrão para acesso administrativo
# IMPORTANTE: Em produção, esta senha deve ser alterada e armazenada de forma segura
ADMIN_PASSWORD = 'admin123'

# ============================================================================
# CONFIGURAÇÃO DE CORS (Cross-Origin Resource Sharing)
# ============================================================================

# Lista de origens permitidas para requisições cross-origin
# CORS permite que o frontend (hosted em Vercel) faça requisições para o backend (hosted em Render)
# Inclui domínios de desenvolvimento (localhost) e produção (Vercel, Render)
ALLOWED_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://portalengeman-front.vercel.app",
    "https://portalengeman.vercel.app",
    "https://portalengeman-front.onrender.com",
    "https://portalengeman.onrender.com",
]

# Permite qualquer origem do Render ou Vercel em produção
# Essas variáveis de ambiente são definidas automaticamente pelas plataformas de hospedagem
RENDER_DOMAIN = os.environ.get('RENDER_EXTERNAL_URL', '')
VERCEL_DOMAIN = os.environ.get('VERCEL_URL', '')

# Adiciona dinamicamente os domínios das plataformas de hospedagem à lista de origens permitidas
if RENDER_DOMAIN:
    ALLOWED_CORS_ORIGINS.append(RENDER_DOMAIN)
if VERCEL_DOMAIN:
    ALLOWED_CORS_ORIGINS.append(f"https://{VERCEL_DOMAIN}")

# Configura o Flask-CORS para permitir requisições cross-origin
# Esta configuração aplica-se a todas as rotas que começam com /api/*
# Suporta métodos HTTP: GET, POST, PUT, PATCH, DELETE, OPTIONS
# Permite credenciais (cookies, headers de autenticação) nas requisições
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ALLOWED_CORS_ORIGINS,
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "Accept",
                "Origin",
                "Access-Control-Request-Method",
                "Access-Control-Request-Headers"
            ],
            "expose_headers": ["Content-Disposition", "Content-Type"],
            "supports_credentials": True,
            "max_age": 3600
        }
    },
    supports_credentials=True,
    allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    expose_headers=['Content-Disposition', 'Content-Type'],
    methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
)
# ============================================================================
# INICIALIZAÇÃO DE EXTENSÕES FLASK
# ============================================================================

# Carrega configurações do arquivo config.py (banco de dados, e-mail, JWT, etc.)
app.config.from_object(Config)

# Inicializa SQLAlchemy para gerenciamento do banco de dados
db.init_app(app)

# Inicializa JWT Manager para autenticação baseada em tokens
jwt = JWTManager(app)

# Inicializa Flask-Mail para envio de e-mails
mail.init_app(app)

# Inicializa Flask-Migrate para gerenciamento de migrações do banco de dados
migrate = Migrate(app, db)


def _adicionar_headers_cors(response):
    """
    Adiciona headers CORS necessários em uma resposta.
    
    Verifica a origem da requisição e adiciona headers CORS apropriados,
    permitindo domínios do Render, Vercel e localhost.
    
    Args:
        response: Objeto Response do Flask
        
    Returns:
        Response com headers CORS adicionados
    """
    origin = request.headers.get('Origin')
    
    # Se já tem o header, não adiciona novamente (evita duplicação)
    if 'Access-Control-Allow-Origin' in response.headers:
        return response
    
    # Verifica se a origem está na lista permitida
    if origin:
        if origin in ALLOWED_CORS_ORIGINS:
            response.headers.add('Access-Control-Allow-Origin', origin)
        elif '.onrender.com' in origin or '.vercel.app' in origin:
            # Permite domínios do Render e Vercel dinamicamente
            response.headers.add('Access-Control-Allow-Origin', origin)
        elif 'localhost' in origin or '127.0.0.1' in origin:
            # Permite localhost em desenvolvimento
            response.headers.add('Access-Control-Allow-Origin', origin)
    
    # Adiciona outros headers CORS necessários
    if 'Access-Control-Allow-Credentials' not in response.headers:
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    if 'Access-Control-Allow-Methods' not in response.headers:
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    if 'Access-Control-Allow-Headers' not in response.headers:
        response.headers.add('Access-Control-Allow-Headers', 
                            'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    if 'Access-Control-Expose-Headers' not in response.headers:
        response.headers.add('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type')
    
    return response


def _ensure_nota_fornecedor_schema():
    """
    Garante que a tabela notas_fornecedores tenha todas as colunas necessárias.
    
    Inspeciona o schema do banco de dados e adiciona colunas faltantes na tabela
    notas_fornecedores, como status_decisao, observacao_admin, nota_referencia,
    email_enviado e decisao_atualizada_em. Esta função permite atualizações
    incrementais do schema sem precisar de migrações complexas.
    """
    try:
        inspector = inspect(db.engine)
    except Exception as exc:
        print(f'Não foi possivel inspecionar o banco para atualizar as notas dos fornecedores: {exc}')
        return
    if 'notas_fornecedores' not in inspector.get_table_names():
        return
    existing_columns = {col['name'] for col in inspector.get_columns('notas_fornecedores')}
    alter_statements = []

    def schedule(column_name, ddl):
        if column_name not in existing_columns:
            alter_statements.append((column_name, ddl))

    schedule('status_decisao', 'VARCHAR(20)')
    schedule('observacao_admin', 'TEXT')
    schedule('nota_referencia', 'FLOAT')
    schedule('email_enviado', 'INTEGER DEFAULT 0')
    schedule('decisao_atualizada_em', 'DATETIME')

    if not alter_statements:
        return

    try:
        with db.engine.begin() as connection:
            for column_name, ddl in alter_statements:
                connection.execute(text(f'ALTER TABLE notas_fornecedores ADD COLUMN {column_name} {ddl}'))
                print(f'Coluna {column_name} adicionada a notas_fornecedores')
    except Exception as exc:
        print(f'Erro ao ajustar schema de notas_fornecedores: {exc}')


def _ensure_documento_schema():
    """
    Garante que a tabela documentos tenha todas as colunas necessárias.
    
    Verifica e adiciona colunas faltantes na tabela documentos, como mime_type
    (tipo MIME do arquivo) e dados_arquivo (conteúdo binário). O tipo de dados
    para dados_arquivo varia conforme o banco de dados (PostgreSQL, MySQL, etc.).
    """
    try:
        inspector = inspect(db.engine)
    except Exception as exc:
        print(f'Não foi possivel inspecionar o banco para atualizar os documentos: {exc}')
        return
    if 'documentos' not in inspector.get_table_names():
        return
    existing_columns = {col['name'] for col in inspector.get_columns('documentos')}
    alter_statements = []
    if 'mime_type' not in existing_columns:
        alter_statements.append(('mime_type', 'VARCHAR(255)'))
    if 'dados_arquivo' not in existing_columns:
        dialect = db.engine.dialect.name if db.engine else ''
        if dialect == 'postgresql':
            blob_type = 'BYTEA'
        elif dialect in {'mysql', 'mariadb'}:
            blob_type = 'LONGBLOB'
        else:
            blob_type = 'BLOB'
        alter_statements.append(('dados_arquivo', blob_type))
    if not alter_statements:
        return
    try:
        with db.engine.begin() as connection:
            for column_name, ddl in alter_statements:
                connection.execute(text(f'ALTER TABLE documentos ADD COLUMN {column_name} {ddl}'))
                print(f'Coluna {column_name} adicionada a documentos')
    except Exception as exc:
        print(f'Erro ao ajustar schema de documentos: {exc}')


def _backfill_documento_conteudo():
    """
    Recupera o conteúdo de documentos que estão no banco sem dados binários.
    
    Busca documentos que existem no banco de dados mas não têm o conteúdo armazenado
    (dados_arquivo vazio ou None). Tenta recuperar esses arquivos do disco usando
    a função _carregar_documento_de_fontes e atualiza o banco de dados com o conteúdo
    encontrado. Também define o mime_type se não estiver definido.
    """
    try:
        documentos_sem_conteudo = Documento.query.filter(
            or_(Documento.dados_arquivo.is_(None), Documento.dados_arquivo == b'')
        ).all()
    except Exception as exc:
        print(f'Falha ao carregar documentos para complementar conteudo: {exc}')
        return
    atualizados = 0
    for documento in documentos_sem_conteudo:
        caminho, dados = _carregar_documento_de_fontes(documento)
        if not dados:
            continue
        if caminho:
            print(f'Conteudo recuperado para documento {documento.id} a partir de {caminho}')
        documento.dados_arquivo = dados
        if not documento.mime_type:
            documento.mime_type = mimetypes.guess_type(documento.nome_documento)[0] or 'application/octet-stream'
        _armazenar_documento_no_disco(documento, dados)
        atualizados += 1
    if not atualizados:
        return
    try:
        db.session.commit()
        print(f'Conteudo de {atualizados} documentos atualizado a partir do disco.')
    except Exception as exc:
        db.session.rollback()
        print(f'Falha ao persistir conteudo dos documentos: {exc}')


# ============================================================================
# INICIALIZAÇÃO DO BANCO DE DADOS
# ============================================================================

# Executa inicializações do banco de dados dentro do contexto da aplicação
# Isso garante que todas as tabelas sejam criadas e atualizadas antes da aplicação iniciar
with app.app_context():
    # Cria todas as tabelas definidas nos modelos (Fornecedor, Documento, Homologacao, etc.)
    db.create_all()
    
    # Garante que a tabela notas_fornecedores tenha todas as colunas necessárias
    # Adiciona colunas faltantes sem precisar de migrações manuais
    _ensure_nota_fornecedor_schema()
    
    # Garante que a tabela documentos tenha todas as colunas necessárias
    # Adiciona colunas como mime_type e dados_arquivo se não existirem
    _ensure_documento_schema()
    
    # Recupera conteúdo de documentos que estão no banco sem dados binários
    # Tenta encontrar os arquivos no disco e atualizar o banco de dados
    _backfill_documento_conteudo()

    
@app.after_request
def after_request(response):
    """
    Adiciona headers CORS a todas as respostas automaticamente.
    
    Este decorator garante que todas as respostas tenham os headers CORS
    necessários, permitindo requisições cross-origin do frontend.
    """
    return _adicionar_headers_cors(response)


@app.route('/')
def home():
    """
    Endpoint raiz da aplicação.
    
    Retorna uma mensagem de boas-vindas simples para verificar se a API está funcionando.
    
    Returns:
        String de boas-vindas
    """
    return "Bem-vindo ao Portal de Fornecedores!"



@app.route('/api/cadastro', methods=['POST'])
def cadastrar_fornecedor():
    """
    Endpoint para cadastro de novos fornecedores no sistema.
    
    Recebe dados de cadastro de um novo fornecedor e cria o registro no banco de dados.
    A senha fornecida é criptografada usando PBKDF2 com SHA-256 antes de ser armazenada,
    garantindo segurança mesmo se o banco de dados for comprometido.
    
    Request Body (JSON):
        - nome (str, obrigatório): Nome completo ou razão social do fornecedor
        - cnpj (str, obrigatório): CNPJ do fornecedor (formato livre)
        - email (str, obrigatório): E-mail de contato do fornecedor
        - senha (str, obrigatório): Senha para acesso ao portal (será criptografada)
    
    Returns:
        - 201 (Created): Fornecedor cadastrado com sucesso
            {"message": "Fornecedor cadastrado com sucesso"}
        - 400 (Bad Request): Dados incompletos ou inválidos
            {"message": "Dados incompletos, verifique os campos."}
        - 500 (Internal Server Error): Erro ao processar o cadastro
            {"message": "Erro ao cadastrar fornecedor: <detalhes do erro>"}
    
    Exemplo de requisição:
        POST /api/cadastro
        {
            "nome": "Empresa ABC Ltda",
            "cnpj": "12.345.678/0001-90",
            "email": "contato@empresaabc.com.br",
            "senha": "senhaSegura123"
        }
    """
    try:
        data = request.get_json() or {}
        print(data)
        if not all(key in data for key in ('email', 'cnpj', 'nome', 'senha')):
            return jsonify(message="Dados incompletos, verifique os campos."), 400
        hashed_password = generate_password_hash(data['senha'], method='pbkdf2:sha256')
        fornecedor = Fornecedor(
            nome=data['nome'],
            email=data['email'],
            cnpj=data['cnpj'],
            senha=hashed_password
        )
        db.session.add(fornecedor)
        db.session.commit()
        return jsonify(message="Fornecedor cadastrado com sucesso"), 201
    except Exception as e:
        print(str(e))
        return jsonify(message="Erro ao cadastrar fornecedor: " + str(e)), 500
    

@app.route('/api/login', methods=['POST'])
def login():
    """
    Endpoint de autenticação de fornecedores.
    
    Valida as credenciais (e-mail e senha) do fornecedor e retorna um token JWT
    (JSON Web Token) de acesso se as credenciais forem válidas. O token JWT contém
    o ID do fornecedor e é usado para autenticar requisições subsequentes.
    A validação da senha é feita comparando o hash armazenado no banco com o hash
    da senha fornecida, garantindo que a senha original nunca seja armazenada.
    
    Request Body (JSON):
        - email (str, obrigatório): E-mail do fornecedor cadastrado
        - senha (str, obrigatório): Senha do fornecedor
    
    Returns:
        - 200 (OK): Autenticação bem-sucedida
            {"access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."}
        - 400 (Bad Request): E-mail ou senha não fornecidos
            {"message": "Email e senha são obrigatórios."}
        - 401 (Unauthorized): Credenciais inválidas (e-mail não encontrado ou senha incorreta)
            {"message": "Credenciais inválidas"}
        - 500 (Internal Server Error): Erro ao processar a autenticação
            {"message": "Erro ao autenticar, tente novamente mais tarde."}
    
    Exemplo de requisição:
        POST /api/login
        {
            "email": "contato@empresaabc.com.br",
            "senha": "senhaSegura123"
        }
    
    Nota:
        O token JWT gerado tem validade limitada (definida em Config.JWT_ACCESS_TOKEN_EXPIRES).
        Após expirar, o fornecedor precisa fazer login novamente.
    """
    try:
        data = request.get_json() or {}
        email = data.get("email")
        senha = data.get("senha")
        if not email or not senha:
            app.logger.error(f"Login falhou, email ou senha não fornecidos: {data}")
            return jsonify(message="Email e senha são obrigatórios."), 400

        fornecedor = Fornecedor.query.filter(Fornecedor.email.ilike(email)).first()
        if not fornecedor:
            app.logger.error(f"Fornecedor não encontrado: {email}")
            return jsonify(message="Credenciais inválidas"), 401

        if not check_password_hash(fornecedor.senha, senha):
            app.logger.error(f"Senha incorreta para o fornecedor: {fornecedor.email}")
            return jsonify(message="Credenciais inválidas"), 401

        access_token = create_access_token(identity=str(fornecedor.id))
        app.logger.info(f"Token gerado para o fornecedor {fornecedor.email}")
        return jsonify(access_token=access_token), 200
    except Exception as e:
        app.logger.error(f"Erro no login: {str(e)}")
        return jsonify(message="Erro ao autenticar, tente novamente mais tarde."), 500
    


@app.route('/api/recuperar-senha', methods=['POST'])
def recuperar_senha():
    """
    Endpoint para solicitar recuperação de senha.
    
    Gera um token numérico de 6 dígitos, armazena no banco de dados associado ao
    fornecedor com validade de 10 minutos e envia por e-mail ao fornecedor em um
    template HTML formatado. O token pode ser usado posteriormente para redefinir
    a senha através do endpoint /api/redefinir-senha.
    
    O e-mail enviado contém:
    - Logo da empresa (se disponível)
    - Token de 6 dígitos destacado
    - Instruções de uso
    - Aviso sobre expiração em 10 minutos
    
    Request Body (JSON):
        - email (str, obrigatório): E-mail do fornecedor cadastrado
    
    Returns:
        - 200 (OK): Token gerado e e-mail enviado com sucesso
            {"message": "Token de recuperação enviado por e-mail"}
        - 404 (Not Found): Fornecedor não encontrado com o e-mail fornecido
            {"message": "Fornecedor não encontrado"}
        - 500 (Internal Server Error): Erro ao gerar token ou enviar e-mail
            {"message": "Erro ao recuperar senha: <detalhes do erro>"}
    
    Exemplo de requisição:
        POST /api/recuperar-senha
        {
            "email": "contato@empresaabc.com.br"
        }
    
    Nota:
        Se o fornecedor solicitar múltiplos tokens, apenas o último será válido,
        pois cada nova solicitação sobrescreve o token anterior.
    """
    try:
        data = request.get_json()
        fornecedor = Fornecedor.query.filter_by(email=data['email']).first()
        if not fornecedor:
            return jsonify(message="Fornecedor não encontrado"), 404
        token = str(random.randint(100000, 999999))
        fornecedor.token_recuperacao = token
        fornecedor.token_expira = datetime.utcnow() + timedelta(minutes=10)
        db.session.commit()
        corpo_email = f"""
  <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Recuperação de Senha - Engeman</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: white; border-radius: 12px; padding: 40px 30px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); margin-bottom: 20px;">
                    <img src="cid:engeman_logo" alt="Engeman Logo" style="max-width: 200px; height: auto; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #f97316;">
                        RECUPERAÇÃO DE SENHA</h1><br>
                    <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #696969;">
                        Olá, {fornecedor.nome}!
                    </h2>
                    <p style="margin: 0 0 30px 0; color: #64748b; font-size: 16px; line-height: 1.6;">
                        Recebemos uma solicitação para redefinir a senha da sua conta. Use o token abaixo para criar uma nova senha:
                    </p>
                    <div style="background: #fef3c7; border: 2px solid #f97316; border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                        <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #92400e;">
                            Seu Token de Recuperação:
                        </p>
                        <div style="font-size: 32px; font-weight: 600; color: #f97316; letter-spacing: 4px; font-family: 'Courier New', monospace; margin: 15px 0;">
                            {token}
                        </div>
                        <p style="margin: 15px 0 0 0; color: #92400e; font-size: 14px;">
                            Este token expira em 10 minutos
                        </p>
                    </div>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h4 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
                            Como usar:
                        </h4>
                        <ol style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                            <li>Acesse a página de recuperação de senha</li>
                            <li>Digite o token no campo solicitado</li>
                            <li>Defina sua nova senha</li>
                        </ol>
                    </div>
                    <p style="margin: 30px 0 0 0; color: #94a3b8; font-size: 14px; text-align: center;">
                        Se você não solicitou esta recuperação, ignore este e-mail.
                    </p>
                    <!-- Simplified footer -->
                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 30px;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                            © 2025 Engeman - Portal de Fornecedores
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        imagem_path = _resolver_logo_path()
        enviar_email(fornecedor.email, "Recuperação de Senha", corpo_email, imagem_path)
        return jsonify(message="Token de recuperação enviado por e-mail"), 200
    except Exception as e:
        return jsonify(message="Erro ao recuperar senha: " + str(e)), 500
    

@app.route("/api/validar-token", methods=["POST"])
def validar_token():
    """
    Endpoint para validar token de recuperação de senha.
    
    Verifica se o token fornecido existe no banco de dados associado a um fornecedor
    e se ainda não expirou (validade de 10 minutos a partir da geração). Este endpoint
    é usado pelo frontend antes de permitir que o usuário redefina a senha, garantindo
    que apenas tokens válidos e não expirados possam ser usados.
    
    Request Body (JSON):
        - token (str, obrigatório): Token de 6 dígitos recebido por e-mail
    
    Returns:
        - 200 (OK): Token válido e não expirado
            {"message": "Token válido"}
        - 400 (Bad Request): Token não fornecido ou token expirado
            {"message": "Token é obrigatório"} ou {"message": "Token expirado"}
        - 404 (Not Found): Token não encontrado no banco de dados
            {"message": "Token inválido ou fornecedor não encontrado"}
        - 500 (Internal Server Error): Erro ao processar a validação
            {"message": "Erro ao validar token"}
    
    Exemplo de requisição:
        POST /api/validar-token
        {
            "token": "456789"
        }
    
    Nota:
        Após validar o token, o usuário pode prosseguir para redefinir a senha
        usando o endpoint /api/redefinir-senha com o mesmo token.
    """
    try:
        data = request.get_json()
        token = data.get("token")
        if not token:
            return jsonify(message="Token é obrigatório"), 400
        fornecedor = Fornecedor.query.filter_by(token_recuperacao=token).first()
        if not fornecedor:
            return jsonify(message="Token inválido ou fornecedor não encontrado"), 404
        if fornecedor.token_expira < datetime.utcnow():
            return jsonify(message="Token expirado"), 400
        return jsonify(message="Token válido"), 200
    except Exception as e:
        print(f"Erro ao validar token: {e}")
        return jsonify(message="Erro ao validar token"), 500
    
@app.route("/api/redefinir-senha", methods=["POST"])
def redefinir_senha():
    """
    Endpoint para redefinir a senha do fornecedor.
    
    Valida o token de recuperação fornecido e, se válido e não expirado, atualiza
    a senha do fornecedor no banco de dados. A nova senha é criptografada usando
    PBKDF2 com SHA-256 antes de ser armazenada. Após a redefinição bem-sucedida,
    o token é invalidado (removido do banco de dados) para evitar reutilização.
    
    Request Body (JSON):
        - token (str, obrigatório): Token de 6 dígitos recebido por e-mail
        - nova_senha (str, obrigatório): Nova senha escolhida pelo fornecedor
    
    Returns:
        - 200 (OK): Senha redefinida com sucesso
            {"message": "Senha redefinida com sucesso"}
        - 400 (Bad Request): Token ou nova senha não fornecidos, ou token expirado
            {"message": "Token e nova senha são obrigatórios"} ou {"message": "Token expirado"}
        - 404 (Not Found): Token não encontrado no banco de dados
            {"message": "Token inválido ou fornecedor não encontrado"}
    
    Exemplo de requisição:
        POST /api/redefinir-senha
        {
            "token": "456789",
            "nova_senha": "novaSenhaSegura456"
        }
    
    Nota:
        Após redefinir a senha, o fornecedor deve fazer login novamente usando
        o e-mail e a nova senha através do endpoint /api/login.
    """
    data = request.get_json()
    token = data.get("token")
    nova_senha = data.get("nova_senha")
    if not token or not nova_senha:
        return jsonify(message="Token e nova senha são obrigatórios"), 400
    fornecedor = Fornecedor.query.filter_by(token_recuperacao=token).first()
    if not fornecedor:
        return jsonify(message="Token inválido ou fornecedor não encontrado"), 404
    if fornecedor.token_expira < datetime.utcnow():
        return jsonify(message="Token expirado"), 400
    fornecedor.senha = generate_password_hash(nova_senha, method="pbkdf2:sha256")
    fornecedor.token_recuperacao = None
    fornecedor.token_expira = None
    db.session.commit()
    return jsonify(message="Senha redefinida com sucesso"), 200


@app.route('/api/contato', methods=['POST', 'OPTIONS'])
def contato():
    """
    Endpoint para envio de mensagens de contato.
    
    Recebe dados de contato (nome, e-mail, assunto, mensagem) e envia um e-mail
    formatado para a equipe administrativa (lucas.mateus@engeman.net) com as
    informações do fornecedor que está entrando em contato.
    
    Returns:
        JSON com mensagem de sucesso (200) ou erro (400/500)
    """
    # Tratamento de requisições OPTIONS (preflight CORS)
    if request.method == 'OPTIONS':
        response = jsonify({})
        return _adicionar_headers_cors(response), 200
    
    try:
        data = request.get_json()
        nome = data.get("nome")
        email = data.get("email")
        assunto = data.get("assunto")
        mensagem = data.get("mensagem")
        if not nome or not email or not assunto or not mensagem:
            return jsonify(message="Todos os campos são obrigatórios."), 400
        corpo_email = f"""
<!DOCTYPE html>

<html lang="pt-BR">

<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MENSAGEM DO PORTAL DE FORNECEDORES</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }}
        .header {{
            background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }}
        .header::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
        }}
        .logo {{
            width: 150px;
            height: auto;
            margin-bottom: 20px;
            position: relative;
            z-index: 1;
        }}
        .header-title {{
            color: #f97316;
            font-size: 24px;
            font-weight: 700;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 1;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .message-card {{
            background: #f8fafc;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            border-left: 4px solid #f97316;
        }}
        .field {{
            margin-bottom: 20px;
        }}
        .field-label {{
            display: inline-flex;
            align-items: center;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
            font-size: 14px;
        }}
        .field-icon {{
            width: 16px;
            height: 16px;
            margin-right: 8px;
            color: #f97316;
        }}
        .field-value {{
            color: #475569;
            font-size: 15px;
            line-height: 1.6;
            background: #ffffff;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }}
        .message-text {{
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        .footer {{
            background: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }}
        .footer-text {{
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
        }}
        .badge {{
            display: inline-flex;
            align-items: center;
            background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
            color: #000000;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 21px;
            font-weight: 600;
            margin-bottom: 16px;
        }}
        @media (max-width: 600px) {{
            .container {{
                margin: 10px;
                border-radius: 12px;
            }}
            .header, .content, .footer {{
                padding-left: 20px;
                padding-right: 20px;
            }}
            .header-title {{
                font-size: 20px;
            }}
        }}
    </style>
</head>

<body>

    <div class="container">
        <div class="header">
            <img src="cid:engeman_logo" alt="Engeman Logo" class="logo">
            <h1 class="header-title">PORTAL DE FORNECEDORES</h1>
            <p>Abaixo tem algumas dúvidas do fornecedor, favor analise o quanto antes</p>
        </div>
        <div class="content">
            <div class="badge">
                📧 Nova Mensagem Recebida
            </div>
            <div class="message-card">
                <div class="field">
                    <div class="field-label">
                        <svg class="field-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                        </svg>
                        Nome do Remetente
                    </div>
                    <div class="field-value">{nome}</div>
                </div>
                <div class="field">
                    <div class="field-label">
                        <svg class="field-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                        </svg>
                        E-mail de Contato
                    </div>
                    <div class="field-value">{email}</div>
                </div>
                <div class="field">
                    <div class="field-label">
                        <svg class="field-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 101 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                        </svg>
                        Assunto
                    </div>
                    <div class="field-value">{assunto}</div>
                </div>
                <div class="field">
                    <div class="field-label">
                        <svg class="field-icon" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd"/>
                        </svg>
                        Mensagem
                    </div>
                    <div class="field-value message-text">{mensagem}</div>
                </div>
            </div>
        </div>
        <div class="footer">
            <p class="footer-text">
                <strong>Portal de Fornecedores</strong><br>
                Este é um e-mail automático gerado pelo sistema. Por favor, não responda diretamente a esta mensagem.
            </p>
        </div>
    </div>
</body>

</html>

"""

        imagem_path = _resolver_logo_path()
        enviar_email(
            destinatario="lucas.mateus@engeman.net",
            assunto=f"MENSAGEM DO PORTAL: {assunto}",
            corpo=corpo_email,
            imagem_path=imagem_path
        )
        response = jsonify(message="Mensagem enviada com sucesso!")
        return _adicionar_headers_cors(response), 200
    except Exception as e:
        print(f"Erro ao enviar mensagem: {e}")
        response = jsonify(message="Erro ao enviar a mensagem.")
        return _adicionar_headers_cors(response), 500
    
def allowed_file(filename):
    """
    Verifica se o arquivo possui uma extensão permitida pelo sistema.
    
    Valida se o nome do arquivo termina com uma das extensões aceitas:
    PDF, DOC, DOCX, JPG, JPEG, PNG, XLSX, CSV. Usado para validar uploads
    de documentos antes de processá-los.
    
    Args:
        filename: Nome do arquivo a ser validado
        
    Returns:
        True se a extensão for permitida, False caso contrário
    """
    allowed_extensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xlsx', 'csv']
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def _obter_caminho_claf():
    """
    Localiza o arquivo CLAF.xlsx em diferentes diretórios do projeto.
    
    Busca a planilha CLAF (Classificação de Materiais/Serviços) em vários
    locais possíveis. Esta planilha contém informações sobre categorias de
    materiais e documentos necessários para cada categoria.
    
    Returns:
        Caminho absoluto do arquivo CLAF.xlsx
        
    Raises:
        FileNotFoundError: Se o arquivo não for encontrado em nenhum local
    """
    candidatos = [
        os.path.join(app.root_path, 'uploads', 'CLAF.xlsx'),
        os.path.join(app.root_path, '..', 'uploads', 'CLAF.xlsx'),
        os.path.join(app.root_path, '..', 'static', 'CLAF.xlsx'),
        os.path.join(app.root_path, '..', 'public', 'docs', 'CLAF.xlsx'),
        os.path.join(app.root_path, 'static', 'CLAF.xlsx'),
    ]
    for caminho in candidatos:
        caminho_abs = os.path.abspath(caminho)
        if os.path.exists(caminho_abs):
            return caminho_abs
    raise FileNotFoundError('Planilha CLAF.xlsx nao encontrada.')


def _resolver_planilha(nome_arquivo):
    """
    Localiza uma planilha Excel em diferentes diretórios do projeto.
    
    Busca um arquivo de planilha (geralmente .xlsx) em vários locais possíveis,
    permitindo flexibilidade na organização dos arquivos do projeto.
    
    Args:
        nome_arquivo: Nome do arquivo de planilha a ser localizado
        
    Returns:
        Caminho absoluto do arquivo se encontrado, None caso contrário
    """
    candidatos = [
        os.path.join(app.root_path, 'uploads', nome_arquivo),
        os.path.join(app.root_path, '..', 'static', nome_arquivo),
        os.path.join(app.root_path, '..', 'uploads', nome_arquivo),
        os.path.join(app.root_path, '..', 'public', 'docs', nome_arquivo),
        os.path.join(app.root_path, 'static', nome_arquivo),
    ]
    for caminho in candidatos:
        caminho_abs = os.path.abspath(caminho)
        if os.path.exists(caminho_abs):
            return caminho_abs
    return None


def _normalizar_texto(valor):
    """
    Normaliza um texto removendo acentos e caracteres especiais.
    
    Remove acentos, caracteres combinantes Unicode, normaliza espaços em branco
    e converte para maiúsculas. Usado para comparações de texto que devem ser
    tolerantes a diferenças de acentuação e formatação.
    
    Args:
        valor: Valor a ser normalizado (pode ser string, número, NaN, etc.)
        
    Returns:
        String normalizada em maiúsculas, sem acentos e com espaços normalizados
    """
    if valor is None:
        return ''
    if isinstance(valor, str):
        texto = valor
    else:
        try:
            if pd.isna(valor):
                return ''
        except Exception:
            pass
        texto = str(valor)
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(ch for ch in texto if not unicodedata.combining(ch))
    texto = ' '.join(texto.split())
    return texto.upper().strip()


def _normalizar_chave(valor):
    """
    Cria uma chave normalizada a partir de um valor, removendo tudo exceto alfanuméricos.
    
    Normaliza o texto e remove todos os caracteres que não sejam letras ou números,
    criando uma chave simples para comparações e indexação.
    
    Args:
        valor: Valor a ser convertido em chave
        
    Returns:
        String contendo apenas caracteres alfanuméricos em maiúsculas
    """
    texto = _normalizar_texto(valor)
    return ''.join(ch for ch in texto if ch.isalnum())


def _contar_valores_textuais(serie):
    """
    Conta quantos valores não vazios existem em uma série do pandas.
    
    Ignora valores NaN e strings vazias, contando apenas valores que tenham
    conteúdo textual real. Usado para determinar qual coluna de uma planilha
    tem mais dados úteis.
    
    Args:
        serie: Série do pandas a ser analisada
        
    Returns:
        Número inteiro representando a quantidade de valores não vazios
    """
    contador = 0
    for valor in serie.dropna():
        if isinstance(valor, str) and valor.strip():
            contador += 1
        elif not isinstance(valor, str):
            texto = str(valor).strip()
            if texto:
                contador += 1
    return contador


def _colunas_por_candidatos(df, candidatos, fallback_indices=None, max_count=None):
    """
    Encontra colunas em um DataFrame que correspondem a nomes de candidatos.
    
    Busca colunas na planilha que correspondem aos nomes fornecidos (normalizados),
    com fallback para índices específicos se nenhuma correspondência for encontrada.
    Se ainda assim não encontrar, retorna a coluna com mais conteúdo textual.
    Usado para localizar colunas em planilhas mesmo quando os nomes variam.
    
    Args:
        df: DataFrame do pandas a ser analisado
        candidatos: Lista de nomes de colunas desejados
        fallback_indices: Lista de índices de colunas como fallback
        max_count: Número máximo de colunas a retornar
        
    Returns:
        Lista de nomes de colunas encontradas
    """
    encontrados = []
    mapa = {}
    for idx, coluna in enumerate(df.columns):
        chave = _normalizar_chave(coluna)
        if chave and chave not in mapa:
            mapa[chave] = coluna
    for candidato in candidatos:
        chave_candidato = _normalizar_chave(candidato)
        coluna = mapa.get(chave_candidato)
        if coluna and coluna not in encontrados:
            encontrados.append(coluna)
            if max_count and len(encontrados) >= max_count:
                return encontrados
    if fallback_indices:
        for indice in fallback_indices:
            if 0 <= indice < len(df.columns):
                coluna = df.columns[indice]
                if coluna not in encontrados:
                    conteudo = _contar_valores_textuais(df[coluna])
                    if conteudo == 0:
                        continue
                    encontrados.append(coluna)
                    if max_count and len(encontrados) >= max_count:
                        return encontrados
    if not encontrados:
        melhor_coluna = None
        melhor_contagem = 0
        for coluna in df.columns:
            contagem = _contar_valores_textuais(df[coluna])
            if contagem > melhor_contagem:
                melhor_coluna = coluna
                melhor_contagem = contagem
        if melhor_coluna is not None:
            encontrados.append(melhor_coluna)
    if max_count:
        return encontrados[:max_count]
    return encontrados


# ============================================================================
# CONSTANTES PARA PROCESSAMENTO DE PLANILHAS
# ============================================================================

# Valores que devem ser ignorados ao processar a planilha CLAF
# Esses são cabeçalhos ou rótulos genéricos que não representam documentos específicos
# Usado para filtrar resultados ao buscar documentos necessários para uma categoria
CLAF_VALORES_IGNORADOS = {
    'MATERIAL / SERVICO',
    'MATERIAL/SERVICO',
    'MATERIAIS',
    'CATEGORIA',
    'GRUPO',
    'FAMILIA',
    'REQUISITOS LEGAIS',
    'REQUISITOS ESTABELECIDOS PELA ENGEMAN',
    'CRITERIOS DE QUALIFICACAO',
    'GRAUS DE RISCO COMPLIANCE',
}


@app.route('/api/envio-documento', methods=['POST', 'OPTIONS'])
def enviar_documento():
    """
    Endpoint para upload de documentos pelos fornecedores.
    
    Permite que fornecedores autenticados enviem um ou mais documentos para o sistema.
    Cada arquivo é validado quanto à extensão permitida, salvo no disco em uma pasta
    específica do fornecedor, armazenado no banco de dados com metadados (nome, categoria,
    tipo MIME) e o conteúdo binário. Após o upload bem-sucedido os documentos ficam
    imediatamente disponíveis no painel administrativo para análise, sem envio de e-mail.
    
    Request (multipart/form-data):
        - fornecedor_id (str, obrigatório): ID do fornecedor que está enviando os documentos
        - categoria (str, obrigatório): Categoria do documento (ex: "Material", "Serviço")
        - arquivos (File[], obrigatório): Um ou mais arquivos para upload
            Extensões permitidas: PDF, PNG, JPG, JPEG, DOCX, XLSX
    
    Returns:
        - 200 (OK): Documentos enviados com sucesso
            {
                "message": "Documentos enviados com sucesso",
                "enviados": ["documento1.pdf", "documento2.jpg", ...]
            }
        - 400 (Bad Request): Dados inválidos ou extensão não permitida
            {"message": "Categoria ou arquivos não fornecidos"}
            {"message": "Extensão do arquivo não permitida: <nome_arquivo>"}
            {"message": "Arquivo vazio ou corrompido: <nome_arquivo>"}
        - 404 (Not Found): Fornecedor não encontrado
            {"message": "Fornecedor não encontrado"}
        - 500 (Internal Server Error): Erro ao processar upload
            {"message": "Erro ao enviar documentos: <detalhes do erro>"}
    
    Exemplo de requisição:
        POST /api/envio-documento
        Content-Type: multipart/form-data
        
        fornecedor_id: "1"
        categoria: "Material"
        arquivos: [arquivo1.pdf, arquivo2.jpg]
    
    Nota:
        - Os arquivos são salvos em: uploads/<fornecedor_id>/<nome_arquivo>
        - O conteúdo binário também é armazenado no banco de dados para backup
        - Os administradores visualizam os anexos diretamente no painel administrativo
    """
    # Tratamento de requisições OPTIONS (preflight CORS)
    if request.method == 'OPTIONS':
        response = jsonify({})
        return _adicionar_headers_cors(response), 200
    
    try:
        fornecedor_id = request.form.get('fornecedor_id')
        categoria = request.form.get('categoria')
        arquivos = request.files.getlist('arquivos')
        fornecedor = Fornecedor.query.get(fornecedor_id)
        if not fornecedor:
            return jsonify(message="Fornecedor não encontrado"), 404
        if not categoria or not arquivos:
            return jsonify(message="Categoria ou arquivos não fornecidos"), 400
        lista_arquivos = []
        pasta_fornecedor = os.path.join(UPLOAD_FOLDER, str(fornecedor_id))
        os.makedirs(pasta_fornecedor, exist_ok=True)
        for arquivo in arquivos:
            nome_original = arquivo.filename or ''
            if not allowed_file(nome_original):
                return jsonify(message=f"Extensão do arquivo não permitida: {nome_original}"), 400
            filename = secure_filename(nome_original)
            if not filename:
                return jsonify(message="Nome de arquivo inválido."), 400
            caminho_arquivo = os.path.join(pasta_fornecedor, filename)
            try:
                arquivo.stream.seek(0)
            except Exception:
                pass
            conteudo_bytes = arquivo.read()
            if not conteudo_bytes:
                return jsonify(message=f"Arquivo vazio ou corrompido: {nome_original}"), 400
            try:
                with open(caminho_arquivo, 'wb') as destino:
                    destino.write(conteudo_bytes)
            except OSError as exc:
                return jsonify(message=f"Não foi possivel salvar o arquivo {filename}: {exc}"), 500
            mime_type = arquivo.mimetype or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            documento = Documento(
                nome_documento=filename,
                categoria=categoria,
                fornecedor_id=fornecedor.id,
                mime_type=mime_type,
                dados_arquivo=conteudo_bytes
            )
            db.session.add(documento)
            lista_arquivos.append(filename)
        db.session.commit()
        response = jsonify(message="Documentos enviados com sucesso", enviados=lista_arquivos)
        return _adicionar_headers_cors(response), 200
    except Exception as e:
        response = jsonify(message="Erro ao enviar documentos: " + str(e))
        return _adicionar_headers_cors(response), 500
    

@app.route('/api/documentos-necessarios', methods=['POST'])
def documentos_necessarios():
    """
    Endpoint que retorna a lista de documentos necessários para uma categoria.
    
    Consulta a planilha CLAF (Classificação de Materiais/Serviços) para encontrar
    quais documentos são exigidos para a categoria de material/serviço informada
    pelo fornecedor. A busca é feita de forma tolerante, normalizando o texto da
    categoria para encontrar correspondências mesmo com variações de acentuação
    e formatação. Filtra valores genéricos que não representam documentos específicos.
    
    Request Body (JSON):
        - categoria (str, obrigatório): Nome da categoria de material/serviço
          Exemplos: "Material Elétrico", "Serviços de Manutenção", etc.
    
    Returns:
        - 200 (OK): Lista de documentos necessários encontrados
            {
                "documentos": [
                    "Certificado de Regularidade do FGTS",
                    "Alvará de Funcionamento",
                    "Certificado de Aprovação (CA)",
                    ...
                ]
            }
        - 400 (Bad Request): Categoria não fornecida
            {"message": "Categoria não fornecida"}
        - 500 (Internal Server Error): Erro ao processar a planilha
            {"message": "Coluna de materiais nao encontrada na planilha"}
            {"message": "Colunas de documentos nao encontradas na planilha"}
            {"message": "Erro ao consultar documentos: <detalhes do erro>"}
    
    Exemplo de requisição:
        POST /api/documentos-necessarios
        {
            "categoria": "Material Elétrico"
        }
    
    Nota:
        - A planilha CLAF.xlsx deve estar localizada em um dos diretórios padrão
        - A busca é case-insensitive e tolerante a acentuação
        - Valores genéricos como "MATERIAL/SERVICO" são filtrados automaticamente
    """
    try:
        data = request.get_json() or {}
        categoria = (data.get('categoria') or '').strip()
        if not categoria:
            return jsonify(message="Categoria não fornecida"), 400
        claf_path = _obter_caminho_claf()
        df = pd.read_excel(claf_path, header=0)
        df.columns = [str(col).strip() for col in df.columns]
        coluna_material_lista = _colunas_por_candidatos(
            df,
            ('material', 'materiais', 'material/servico', 'categoria', 'grupo', 'familia'),
            fallback_indices=[0],
            max_count=1,
        )
        if not coluna_material_lista:
            return jsonify(message="Coluna de materiais nao encontrada na planilha"), 500
        coluna_material = coluna_material_lista[0]
        colunas_documentos = _colunas_por_candidatos(
            df,
            (
                'requisitos legais',
                'requisitos_estabelecidos_pela_engeman',
                'requisitos estabelecidos pela engeman',
                'criterios de qualificacao',
            ),
            fallback_indices=[1, 2],
        )
        if not colunas_documentos:
            return jsonify(message="Colunas de documentos nao encontradas na planilha"), 500
        categoria_normalizada = _normalizar_texto(categoria)
        serie_categorias = df[coluna_material].apply(_normalizar_texto)
        mask = serie_categorias.apply(
            lambda valor: bool(valor) and (
                categoria_normalizada in valor or valor in categoria_normalizada
            )
        )
        df_filtrado = df[mask]
        documentos = []
        vistos = set()
        for _, row in df_filtrado.iterrows():
            for coluna_doc in colunas_documentos:
                valor = row.get(coluna_doc)
                if pd.isna(valor):
                    continue
                texto = str(valor).strip()
                if not texto:
                    continue
                texto_normalizado = _normalizar_texto(texto)
                if not texto_normalizado or texto_normalizado in CLAF_VALORES_IGNORADOS:
                    continue
                if texto_normalizado in vistos:
                    continue
                vistos.add(texto_normalizado)
                documentos.append(texto)
        return jsonify(documentos=documentos), 200
    except FileNotFoundError as exc:
        return jsonify(message=str(exc)), 500
    except Exception as e:
        return jsonify(message="Erro ao consultar documentos: " + str(e)), 500
    
@app.route('/api/categorias', methods=['GET'])
def listar_categorias():
    """
    Endpoint que lista todas as categorias disponíveis na planilha CLAF.
    
    Lê a planilha CLAF (Classificação de Materiais/Serviços), extrai todas as
    categorias de materiais/serviços únicas, remove valores genéricos (como
    cabeçalhos e rótulos) e retorna uma lista ordenada alfabeticamente para
    seleção no frontend. Útil para popular dropdowns e listas de seleção.
    
    Returns:
        - 200 (OK): Lista de categorias disponíveis
            {
                "materiais": [
                    "Material Elétrico",
                    "Material Hidráulico",
                    "Serviços de Manutenção",
                    ...
                ],
                "total": 25
            }
        - 500 (Internal Server Error): Erro ao processar a planilha
            {"message": "Coluna de materiais nao encontrada na planilha"}
            {"message": "Erro ao listar categorias: <detalhes do erro>"}
    
    Exemplo de requisição:
        GET /api/categorias
    
    Nota:
        - A planilha CLAF.xlsx deve estar localizada em um dos diretórios padrão
        - Valores duplicados são removidos (comparação normalizada)
        - Valores genéricos como "MATERIAL/SERVICO" são filtrados
        - A lista é ordenada alfabeticamente para facilitar a busca
    """
    try:
        claf_path = _obter_caminho_claf()
        df = pd.read_excel(claf_path, header=0)
        df.columns = [str(col).strip() for col in df.columns]
        coluna_material_lista = _colunas_por_candidatos(
            df,
            ('material', 'materiais', 'material/servico', 'categoria', 'grupo', 'familia'),
            fallback_indices=[0],
            max_count=1,
        )
        if not coluna_material_lista:
            return jsonify(message="Coluna de materiais nao encontrada na planilha"), 500
        coluna_material = coluna_material_lista[0]
        serie = df[coluna_material]
        vistos = set()
        materiais = []
        for valor in serie:
            if pd.isna(valor):
                continue
            nome = str(valor).strip()
            if not nome:
                continue
            chave = _normalizar_texto(nome)
            if not chave or chave in CLAF_VALORES_IGNORADOS:
                continue
            if chave in vistos:
                continue
            vistos.add(chave)
            materiais.append(nome)
        materiais.sort(key=_normalizar_texto)
        return jsonify(materiais=materiais, total=len(materiais)), 200
    except FileNotFoundError as exc:
        return jsonify(message=str(exc)), 500
    except Exception as exc:
        return jsonify(message="Erro ao listar categorias: " + str(exc)), 500

@app.route('/api/dados-homologacao', methods=['GET'])
def consultar_dados_homologacao():
    """
    Endpoint que consulta dados de homologação de um fornecedor.
    
    Busca informações de homologação nas planilhas Excel do sistema:
    - fornecedores_homologados.xlsx: Contém dados de homologação, notas e status de aprovação
    - atendimento controle_qualidade.xlsx: Contém notas IQF mensais e observações
    
    Calcula a média IQF baseada nas notas do controle de qualidade, determina o status
    final (APROVADO, REPROVADO, EM_ANALISE) baseado em múltiplos critérios e consolida
    todas as informações em um único objeto JSON.
    
    Query Params:
        fornecedor_nome (str, obrigatório): Nome do fornecedor a ser consultado
            A busca é case-insensitive e parcial (usa contains)
        
    Returns:
        - 200 (OK): Dados de homologação encontrados
            {
                "id": 123,
                "nome": "Empresa ABC Ltda",
                "iqf": 85.5,
                "status": "APROVADO",
                "homologacao": 90.0,
                "aprovado": "S",
                "ocorrencias": ["Observação 1", "Observação 2"],
                "observacao": "Observação 1; Observação 2",
                "iqf_homologados": 82.0,
                "total_notas_iqf": 12
            }
        - 400 (Bad Request): Nome do fornecedor não fornecido
            {"message": "Parâmetro 'fornecedor_nome' é obrigatório."}
        - 404 (Not Found): Fornecedor não encontrado nas planilhas
            {"message": "Fornecedor não encontrado na planilha de homologados."}
        - 500 (Internal Server Error): Erro ao processar as planilhas
            {"message": "Um ou mais arquivos de planilha não foram encontrados..."}
            {"message": "Erro ao consultar dados de homologação", "error_details": "..."}
    
    Exemplo de requisição:
        GET /api/dados-homologacao?fornecedor_nome=Empresa ABC
    
    Nota:
        - Status final é determinado por: qualquer nota < 70 = REPROVADO,
          aprovado='N' = REPROVADO, aprovado='S' = APROVADO, caso contrário = EM_ANALISE
        - IQF final usa a média do controle de qualidade se disponível, senão usa IQF da planilha
    """
    try:
        fornecedor_nome = request.args.get('fornecedor_nome', type=str)

        print(f"Buscando dados para o fornecedor com nome: {fornecedor_nome}")

        if not fornecedor_nome:

            return jsonify(message="Parâmetro 'fornecedor_nome' é obrigatório."), 400
        
        path_homologados = os.path.abspath(
            os.path.join(app.root_path, '..', 'uploads', 'fornecedores_homologados.xlsx')
        )
        path_controle = os.path.abspath(
            os.path.join(app.root_path, '..', 'uploads', 'atendimento controle_qualidade.xlsx')
        )
        print(f"Caminho do arquivo de homologados: {path_homologados}")

        print(f"Caminho do arquivo de controle de qualidade: {path_controle}")

        if not os.path.exists(path_homologados) or not os.path.exists(path_controle):
            return jsonify(
                message="Um ou mais arquivos de planilha não foram encontrados. Verifique os caminhos dos arquivos."
            ), 500
        df_homologacao = pd.read_excel(path_homologados)

        df_controle_qualidade = pd.read_excel(path_controle)

        df_homologacao.columns = (
            df_homologacao.columns.str.strip().str.lower().str.replace(" ", "_")
        )

        df_controle_qualidade.columns = (
            df_controle_qualidade.columns.str.strip().str.lower().str.replace(" ", "_")
        )
        filtro_homologados = df_homologacao[
            df_homologacao['agente'].str.contains(fornecedor_nome, case=False, na=False)
        ]
        if filtro_homologados.empty:
            return jsonify(message="Fornecedor não encontrado na planilha de homologados."), 404
        
        fornecedor_h = filtro_homologados.iloc[0]

        print(f"Fornecedor encontrado: {fornecedor_h}")

        fornecedor_id_raw = fornecedor_h.get('codigo')
        fornecedor_id = int(fornecedor_id_raw) if pd.notna(fornecedor_id_raw) else None
        nota_homologacao_raw = fornecedor_h.get('nota_homologacao')
        nota_homologacao = float(nota_homologacao_raw) if nota_homologacao_raw is not None and not pd.isna(nota_homologacao_raw) else None
        iqf_raw = fornecedor_h.get('iqf')
        iqf = float(iqf_raw) if iqf_raw is not None and not pd.isna(iqf_raw) else None
        aprovado_raw = fornecedor_h.get('aprovado')
        aprovado_valor = ''

        if aprovado_raw is not None and not pd.isna(aprovado_raw):

            aprovado_valor = str(aprovado_raw).strip()
        status_homologacao = 'APROVADO' if aprovado_valor.upper() == 'S' else 'EM_ANALISE'
        filtro_ocorrencias = df_controle_qualidade[
            df_controle_qualidade['nome_agente'].str.strip().str.lower()
            == fornecedor_h['agente'].strip().lower()
        ] if 'nome_agente' in df_controle_qualidade.columns else df_controle_qualidade.iloc[0:0]

        if filtro_ocorrencias.empty and 'nome_agente' in df_controle_qualidade.columns and fornecedor_nome:
            filtro_ocorrencias = df_controle_qualidade[
                df_controle_qualidade['nome_agente'].str.contains(fornecedor_nome, case=False, na=False)
            ]
        media_iqf_controle = None
        total_notas_controle = 0
        if not filtro_ocorrencias.empty and 'nota' in filtro_ocorrencias.columns:
            notas_validas = pd.to_numeric(filtro_ocorrencias['nota'], errors='coerce').dropna()
            total_notas_controle = len(notas_validas)
            if total_notas_controle:
                media_iqf_controle = float(notas_validas.mean())
                print(f"Total de notas encontradas no controle de qualidade: {total_notas_controle}")
                print(f"IQF calculada a partir do controle de qualidade: {media_iqf_controle}")
        observacoes_lista = []
        observacao_resumo = ''
        if 'observacao' in filtro_ocorrencias.columns:
            observacoes_series = (
                filtro_ocorrencias['observacao']
                .fillna('')
                .astype(str)
                .str.strip()
            )
            observacoes_filtradas = []
            for obs in observacoes_series.tolist():
                obs_limpo = obs.strip()
                if not obs_limpo:
                    continue
                obs_normalizado = ''.join(
                    ch for ch in unicodedata.normalize('NFD', obs_limpo.lower())
                    if unicodedata.category(ch) != 'Mn'
                )
                obs_normalizado = ''.join(ch for ch in obs_normalizado if ch.isalnum() or ch.isspace())
                obs_normalizado = ' '.join(obs_normalizado.split())
                if obs_normalizado == 'sem comentarios':
                    continue
                observacoes_filtradas.append(obs_limpo)
            observacoes_lista = observacoes_filtradas
            if observacoes_filtradas:
                observacao_resumo = '; '.join(observacoes_filtradas)
        iqf_final = media_iqf_controle if media_iqf_controle is not None else iqf
        status_homologacao = _determinar_status_final(aprovado_valor, nota_homologacao, iqf_final, iqf)
        return jsonify(
            id=fornecedor_id,
            nome=str(fornecedor_h.get('agente', '')),
            iqf=iqf_final,
            status=status_homologacao,
            homologacao=nota_homologacao,
            aprovado=aprovado_valor,
            ocorrencias=observacoes_lista,
            observacao=observacao_resumo,
            iqf_homologados=iqf,
            total_notas_iqf=total_notas_controle
        ), 200
    except FileNotFoundError as fnf:
        return jsonify(message=f"Arquivo de planilha não encontrado: {str(fnf)}"), 500
    except Exception as e:
        print(f"Erro inesperado ao consultar dados de homologação: {str(e)}")
        return jsonify(message="Erro ao consultar dados de homologação", error_details=str(e)), 500


@app.route('/api/portal/resumo', methods=['GET'])
@jwt_required()
def portal_resumo():
    """
    Endpoint que retorna resumo completo do fornecedor autenticado.
    
    Retorna um resumo consolidado com todas as informações relevantes do fornecedor:
    status de homologação, notas IQF, observações, documentos enviados, etc.
    Requer autenticação JWT válida.
    
    Returns:
        JSON com objeto resumo completo (200) ou erro (400/404/500)
    """
    identidade = get_jwt_identity()
    try:
        fornecedor_id = int(identidade)
    except (TypeError, ValueError):
        return jsonify(message="Identidade do fornecedor inválida."), 400
    fornecedor = Fornecedor.query.get(fornecedor_id)
    if fornecedor is None:
        return jsonify(message="Fornecedor não encontrado."), 404
    df_homologados = None
    df_controle = None
    try:
        df_homologados, df_controle = _carregar_planilhas_homologacao()
    except FileNotFoundError as exc:
        print(f'Planilhas de homologação não encontradas para resumo do portal: {exc}')
    except Exception as exc:
        print(f'Erro ao carregar planilhas para resumo do portal: {exc}')
    resumo = _montar_resumo_portal(fornecedor, df_homologados, df_controle)
    return jsonify(resumo=resumo), 200

def _normalize_text(value):
    """
    Normaliza um texto para comparação, removendo acentos e caracteres especiais.
    
    Versão alternativa de normalização que converte para minúsculas e remove
    apenas caracteres de marcação (Mn), mantendo espaços. Usada para comparações
    de nomes de fornecedores entre planilhas e banco de dados.
    
    Args:
        value: Valor a ser normalizado
        
    Returns:
        String normalizada em minúsculas, sem acentos, apenas com alfanuméricos e espaços
    """
    if value is None:
        return ''
    normalized = ''.join(
        ch for ch in unicodedata.normalize('NFD', str(value).lower())
        if unicodedata.category(ch) != 'Mn'
    )
    normalized = ''.join(ch for ch in normalized if ch.isalnum() or ch.isspace())
    return ' '.join(normalized.split())

def _carregar_planilhas_homologacao():
    """
    Carrega as planilhas de homologação e controle de qualidade.
    
    Localiza e carrega duas planilhas essenciais: fornecedores_homologados.xlsx
    (com dados de homologação) e atendimento controle_qualidade.xlsx (com notas IQF).
    Normaliza os nomes das colunas para facilitar o acesso aos dados.
    
    Returns:
        Tupla (df_homologados, df_controle) ou (None, None) se não encontradas
    """
    path_homologados = _resolver_planilha('fornecedores_homologados.xlsx')
    path_controle = _resolver_planilha('atendimento controle_qualidade.xlsx')
    if not path_homologados or not path_controle:
        print('Planilhas de homologação não encontradas. Continuando sem dados de planilha.')
        return None, None
    try:
        df_homologados = pd.read_excel(path_homologados)
        df_controle = pd.read_excel(path_controle)
        df_homologados.columns = (
            df_homologados.columns.str.strip().str.lower().str.replace(' ', '_')
        )
        df_controle.columns = (
            df_controle.columns.str.strip().str.lower().str.replace(' ', '_')
        )
        return df_homologados, df_controle
    except Exception as exc:
        print(f'Erro ao carregar planilhas de homologação: {exc}')
        return None, None

def _to_float(value):
    """
    Converte um valor para float de forma segura.
    
    Tenta converter o valor para float, aceitando valores que vêm como string
    com vírgula ou separadores de milhares. Retorna None se não for possível
    converter ou se o valor não for numérico finito.
    """
    if value in (None, '', 'nan'):
        return None
    try:
        if isinstance(value, str):
            texto = value.strip()
            if not texto:
                return None
            apenas_numeros = re.sub(r'[^\d,.\-]', '', texto)
            if not apenas_numeros:
                return None
            last_comma = apenas_numeros.rfind(',')
            last_dot = apenas_numeros.rfind('.')
            normalizado = apenas_numeros
            if last_comma > -1 and last_dot > -1:
                if last_comma > last_dot:
                    normalizado = apenas_numeros.replace('.', '').replace(',', '.')
                else:
                    normalizado = apenas_numeros.replace(',', '')
            elif last_comma > -1:
                normalizado = apenas_numeros.replace('.', '').replace(',', '.')
            elif last_dot > -1:
                partes = apenas_numeros.split('.')
                if len(partes) > 2:
                    decimal = partes.pop()
                    normalizado = ''.join(partes) + '.' + decimal
            value = normalizado
        valor = float(value)
        if not math.isfinite(valor):
            return None
        return valor
    except (TypeError, ValueError):
        return None
    
def _calcular_media_iqf_controle(fornecedor_nome_planilha, fornecedor_nome_busca, df_controle):
    """
    Calcula a média das notas IQF de um fornecedor na planilha de controle de qualidade.
    
    Busca todas as ocorrências do fornecedor na planilha de controle, calcula a média
    das notas válidas e retorna também o total de notas e observações associadas.
    
    Args:
        fornecedor_nome_planilha: Nome do fornecedor como aparece na planilha
        fornecedor_nome_busca: Nome alternativo para busca (fallback)
        df_controle: DataFrame da planilha de controle de qualidade
        
    Returns:
        Tupla (media_iqf, total_notas, observacoes) ou (None, 0, []) se não encontrado
    """
    if df_controle is None or df_controle.empty:
        return None, 0, []
    if 'nome_agente' not in df_controle.columns:
        return None, 0, []
    nomes_series = df_controle['nome_agente'].astype(str)
    normalizados = nomes_series.apply(_normalize_text).astype(str)
    alvo_normalizado = _normalize_text(fornecedor_nome_planilha or fornecedor_nome_busca)
    mask = normalizados == alvo_normalizado
    if not mask.any():
        mask = normalizados.str.contains(_normalize_text(fornecedor_nome_busca), regex=False)
    subset = df_controle[mask]
    if subset.empty:
        return None, 0, []
    notas_validas = pd.to_numeric(subset.get('nota'), errors='coerce').dropna()
    total = len(notas_validas)
    media = float(notas_validas.mean()) if total else None
    observacoes = []
    if 'observacao' in subset.columns:
        observacoes = subset['observacao'].dropna().astype(str).tolist()
    return media, total, observacoes

def _determinar_status_final(aprovado_valor, nota_homologacao, iqf_calculada, nota_iqf_planilha):
    """
    Determina o status final de homologação baseado em múltiplos critérios.
    
    Analisa as notas e o valor de aprovação para determinar se o fornecedor está
    APROVADO, REPROVADO ou EM_ANALISE. Qualquer nota abaixo de 70 resulta em reprovação.
    
    Args:
        aprovado_valor: Valor 'S' ou 'N' da planilha de homologados
        nota_homologacao: Nota de homologação do fornecedor
        iqf_calculada: Média IQF calculada a partir do controle de qualidade
        nota_iqf_planilha: Nota IQF da planilha de homologados
        
    Returns:
        String com o status: 'APROVADO', 'REPROVADO' ou 'EM_ANALISE'
    """
    for valor in (iqf_calculada, nota_iqf_planilha, nota_homologacao):
        valor_float = _to_float(valor)
        if valor_float is not None and valor_float < 70:
            return 'REPROVADO'
    aprovado_valor = (aprovado_valor or '').strip().upper()
    if aprovado_valor == 'N':
        return 'REPROVADO'
    if aprovado_valor == 'S':
        return 'APROVADO'
    return 'EM_ANALISE'



def _montar_registro_admin(fornecedor, df_homologados, df_controle):
    """
    Monta um registro completo de fornecedor para a área administrativa.
    
    Consolida informações do banco de dados, planilhas de homologação e controle
    de qualidade, incluindo notas manuais do admin, status, documentos e datas.
    Usado para exibir dados detalhados na interface administrativa.
    
    Args:
        fornecedor: Objeto Fornecedor do banco de dados
        df_homologados: DataFrame da planilha de fornecedores homologados
        df_controle: DataFrame da planilha de controle de qualidade
        
    Returns:
        Dicionário com todas as informações consolidadas do fornecedor
    """
    nota_homologacao = None
    nota_manual = getattr(fornecedor, 'nota_admin', None)
    status_manual = None
    observacao_admin = None
    decisao_atualizada_em = None
    nota_referencia_manual = None
    if nota_manual:
        if nota_manual.nota_homologacao is not None:
            try:
                nota_homologacao = float(nota_manual.nota_homologacao)
            except (TypeError, ValueError):
                nota_homologacao = None
        status_manual_raw = (nota_manual.status_decisao or '').strip().upper() if nota_manual.status_decisao else ''
        if status_manual_raw in {'APROVADO', 'REPROVADO', 'EM_ANALISE'}:
            status_manual = status_manual_raw
        observacao_admin = nota_manual.observacao_admin
        nota_referencia_manual = nota_manual.nota_referencia
        decisao_atualizada_em = nota_manual.decisao_atualizada_em
    nota_iqf_planilha = None
    fornecedor_nome_planilha = fornecedor.nome
    aprovado_valor = ''
    registros_compativeis = pd.DataFrame()
    if df_homologados is not None and not df_homologados.empty:
        candidatos = []
        for coluna in ['agente', 'nome_fantasia']:
            if coluna in df_homologados.columns:
                candidatos.append(
                    df_homologados[coluna].apply(_normalize_text) == _normalize_text(fornecedor.nome)
                )
        if candidatos:
            mask = candidatos[0]
            for extra in candidatos[1:]:
                mask = mask | extra
            registros_compativeis = df_homologados[mask]
        if registros_compativeis.empty and 'cnpj' in df_homologados.columns:
            registros_compativeis = df_homologados[
                df_homologados['cnpj'].astype(str)
                .str.replace('\r', '')
                .str.replace('\n', '')
                .str.strip()
                == fornecedor.cnpj.strip()
            ]
    if not registros_compativeis.empty:
        registro = registros_compativeis.iloc[0]
        fornecedor_nome_planilha = str(registro.get('agente', fornecedor.nome))
        aprovado_valor = str(registro.get('aprovado', '')).strip().upper()
        if nota_homologacao is None:
            nota_homologacao = _to_float(registro.get('nota_homologacao'))
        nota_iqf_planilha = _to_float(registro.get('iqf'))
    media_iqf_controle, total_notas_controle, observacoes_lista = _calcular_media_iqf_controle(
        fornecedor_nome_planilha, fornecedor.nome, df_controle
    )
    iqf_final = media_iqf_controle if media_iqf_controle is not None else nota_iqf_planilha
    if iqf_final is None and nota_referencia_manual is not None:
        try:
            iqf_final = float(nota_referencia_manual)
        except (TypeError, ValueError):
            iqf_final = None
    status_final = _determinar_status_final(aprovado_valor, nota_homologacao, iqf_final, nota_iqf_planilha)
    sem_notas_disponiveis = (
        (total_notas_controle or 0) <= 0
        and _to_float(nota_homologacao) is None
        and _to_float(nota_iqf_planilha) is None
        and _to_float(nota_referencia_manual) is None
    )
    if status_final == 'EM_ANALISE' and sem_notas_disponiveis:
        status_final = 'A CADASTRAR'
    if status_manual:
        status_final = status_manual
    documentos_ordenados = sorted(
        fornecedor.documentos,
        key=lambda doc: doc.data_upload or datetime.min,
        reverse=True
    )
    documentos = [
        {
            'id': doc.id,
            'nome': doc.nome_documento,
            'categoria': doc.categoria,
            'data_upload': doc.data_upload.isoformat() if doc.data_upload else None
        }
        for doc in documentos_ordenados
    ]
    ultima_doc = max(
        [doc.data_upload for doc in documentos_ordenados if doc.data_upload],
        default=None
    )
    ultima_atividade = max(
        [valor for valor in [fornecedor.data_cadastro, ultima_doc] if valor],
        default=None
    )
    return {
        'id': fornecedor.id,
        'nome': fornecedor.nome,
        'email': fornecedor.email,
        'cnpj': fornecedor.cnpj,
        'categoria': fornecedor.categoria,
        'status': status_final,
        'aprovado': status_final == 'APROVADO',
        'nota_homologacao': nota_homologacao,
        'nota_iqf': iqf_final,
        'nota_iqf_planilha': nota_iqf_planilha,
        'nota_iqf_media': media_iqf_controle,
        'total_notas_iqf': total_notas_controle,
        'observacoes': observacoes_lista,
        'observacao_admin': observacao_admin,
        'nota_referencia_admin': nota_referencia_manual,
        'decisao_atualizada_em': decisao_atualizada_em.isoformat() if decisao_atualizada_em else None,
        'documentos': documentos,
        'total_documentos': len(documentos),
        'ultima_atividade': ultima_atividade.isoformat() if ultima_atividade else None,
        'data_cadastro': fornecedor.data_cadastro.isoformat() if fornecedor.data_cadastro else None
    }

def _montar_resumo_portal(fornecedor, df_homologados, df_controle):
    """
    Monta um resumo simplificado do fornecedor para o portal do fornecedor.
    
    Cria um resumo formatado com as informações mais relevantes para o fornecedor
    visualizar no seu portal: status, notas, feedback, próxima reavaliação, etc.
    Formata os dados de forma amigável para exibição no frontend.
    
    Args:
        fornecedor: Objeto Fornecedor do banco de dados
        df_homologados: DataFrame da planilha de fornecedores homologados
        df_controle: DataFrame da planilha de controle de qualidade
        
    Returns:
        Dicionário com resumo formatado para o portal do fornecedor
    """
    info_admin = _montar_registro_admin(fornecedor, df_homologados, df_controle)
    ocorrencias = [
        str(item).strip()
        for item in info_admin.get('observacoes', []) or []
        if str(item).strip()
    ]
    ultima_atividade = info_admin.get('ultima_atividade')
    if not ultima_atividade and fornecedor.data_cadastro:
        ultima_atividade = fornecedor.data_cadastro.isoformat()
    proxima_reavaliacao = None
    if ultima_atividade:
        try:
            data_base = datetime.fromisoformat(ultima_atividade)
            proxima_reavaliacao = (data_base + timedelta(days=365)).isoformat()
        except ValueError:
            proxima_reavaliacao = None
    nota_homologacao = info_admin.get('nota_homologacao')
    fontes_nota_iqf = [
        info_admin.get('nota_iqf'),
        info_admin.get('nota_iqf_media'),
        info_admin.get('nota_iqf_planilha')
    ]
    primeira_nota_disponivel = next(
        (valor for valor in fontes_nota_iqf if valor not in (None, '')),
        None
    )
    media_iqf = _to_float(primeira_nota_disponivel) or 0.0
    total_notas_float = _to_float(info_admin.get('total_notas_iqf'))
    total_avaliacoes_brutas = int(total_notas_float) if total_notas_float is not None else 0
    sem_avaliacoes_registradas = total_avaliacoes_brutas <= 0
    total_avaliacoes = total_avaliacoes_brutas if total_avaliacoes_brutas > 0 else 1
    status = (info_admin.get('status') or 'EM_ANALISE').strip().upper()
    valores_para_status = fontes_nota_iqf + [nota_homologacao, info_admin.get('nota_referencia_admin')]
    possui_notas_validas = any(_to_float(valor) is not None for valor in valores_para_status)
    if status == 'EM_ANALISE' and sem_avaliacoes_registradas and not possui_notas_validas:
        status = 'A CADASTRAR'
    status_legivel = status.replace('_', ' ').title()
    feedback = '; '.join(ocorrencias) if ocorrencias else 'Aguardando analise dos documentos enviados.'
    nota_homologacao_texto = ''
    if isinstance(nota_homologacao, (int, float)):
        nota_homologacao_texto = f'{nota_homologacao:.2f}'.replace('.', ',')
    resumo = {
        'id': fornecedor.id,
        'nome': fornecedor.nome,
        'email': fornecedor.email,
        'cnpj': fornecedor.cnpj,
        'telefone': getattr(fornecedor, 'telefone', None),
        'categoria': fornecedor.categoria,
        'status': status,
        'statusLegivel': status_legivel,
        'mediaIQF': media_iqf,
        'media_iqf': media_iqf,
        'notaIQF': media_iqf,
        'nota_iqf': media_iqf,
        'mediaHomologacao': nota_homologacao or 0,
        'nota_homologacao': nota_homologacao or 0,
        'totalAvaliacoes': total_avaliacoes,
        'total_notas_iqf': total_avaliacoes,
        'ocorrencias': ocorrencias,
        'feedback': feedback,
        'observacao': feedback,
        'ultimaAtualizacao': ultima_atividade,
        'ultimaAvaliacao': ultima_atividade,
        'proximaReavaliacao': proxima_reavaliacao,
        'notaHomologacaoTexto': nota_homologacao_texto,
    }
    return resumo

def _admin_usuario_autorizado():
    """
    Verifica se o usuário autenticado tem permissões de administrador.
    
    Valida se o e-mail do usuário está na lista de e-mails permitidos (ADMIN_ALLOWED_EMAILS)
    e se o token JWT contém a role 'admin'. Usado para proteger endpoints administrativos.
    
    Returns:
        True se o usuário é admin autorizado, False caso contrário
    """
    identidade = get_jwt_identity()
    claims = get_jwt()
    if identidade is None:
        return False
    email = (identidade or '').strip().lower()
    if email not in ADMIN_ALLOWED_EMAILS:
        return False
    role = claims.get('role') if isinstance(claims, dict) else None
    if role is not None and role != 'admin':
        return False
    return True


@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """
    Endpoint de login para administradores do sistema.
    
    Autentica administradores usando e-mail e senha. O e-mail deve estar na lista
    de e-mails permitidos (ADMIN_ALLOWED_EMAILS) e a senha deve corresponder à senha
    administrativa (ADMIN_PASSWORD). Retorna um token JWT com role 'admin' que é
    necessário para acessar todos os endpoints administrativos do sistema.
    
    Request Body (JSON):
        - email (str, obrigatório): E-mail do administrador (deve estar em ADMIN_ALLOWED_EMAILS)
        - senha (str, obrigatório): Senha administrativa (deve corresponder a ADMIN_PASSWORD)
    
    Returns:
        - 200 (OK): Autenticação bem-sucedida
            {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                "email": "lucas.mateus@engeman.net"
            }
        - 401 (Unauthorized): Credenciais inválidas
            {"message": "Credenciais inválidas"}
        - 500 (Internal Server Error): Erro ao processar a autenticação
            {"message": "Erro ao autenticar administrador"}
    
    Exemplo de requisição:
        POST /api/admin/login
        {
            "email": "lucas.mateus@engeman.net",
            "senha": "admin123"
        }
    
    Nota:
        - O token JWT gerado contém a claim 'role': 'admin' para identificação
        - Apenas e-mails em ADMIN_ALLOWED_EMAILS podem fazer login como admin
        - Em produção, a senha deve ser alterada e armazenada de forma segura
    """
    try:
        data = request.get_json() or {}
        email = (data.get('email') or '').strip().lower()
        senha = data.get('senha') or ''
        if email in ADMIN_ALLOWED_EMAILS and senha == ADMIN_PASSWORD:
            token = create_access_token(identity=email, additional_claims={'role': 'admin'})
            return jsonify(access_token=token, email=email), 200
        return jsonify(message='Credenciais inválidas'), 401
    except Exception as exc:
        print(f'Erro no login admin: {exc}')
        return jsonify(message='Erro ao autenticar administrador'), 500
    
@app.route('/api/admin/dashboard', methods=['GET'])
@jwt_required()
def painel_admin_dashboard():
    """
    Endpoint que retorna estatísticas gerais para o dashboard administrativo.
    
    Calcula e retorna estatísticas consolidadas do sistema para exibição no painel
    administrativo. Inclui totais de fornecedores cadastrados, documentos enviados
    e distribuição de status (aprovados, reprovados, em análise). Os status são
    calculados consultando as planilhas de homologação e notas manuais dos admins.
    
    Headers:
        Authorization (obrigatório): Bearer token JWT com role 'admin'
    
    Returns:
        - 200 (OK): Estatísticas do dashboard
            {
                "total_cadastrados": 150,
                "total_aprovados": 85,
                "total_em_analise": 45,
                "total_reprovados": 20,
                "total_documentos": 450
            }
        - 403 (Forbidden): Acesso não autorizado (token inválido ou sem role admin)
            {"message": "Acesso nao autorizado."}
        - 500 (Internal Server Error): Erro ao processar as estatísticas
            {"message": "Erro ao gerar dashboard administrativo"}
    
    Exemplo de requisição:
        GET /api/admin/dashboard
        Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
    
    Nota:
        - Requer autenticação JWT válida com role 'admin'
        - Os status são calculados dinamicamente consultando planilhas e banco de dados
        - Se as planilhas não estiverem disponíveis, os status podem ser incompletos
    """
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso nao autorizado.'), 403
    try:
        fornecedores_db = Fornecedor.query.all()
        total_cadastrados = len(fornecedores_db)
        total_documentos = Documento.query.count()
        df_homologados, df_controle = _carregar_planilhas_homologacao()
        status_counts = {'APROVADO': 0, 'REPROVADO': 0, 'EM_ANALISE': 0}
        for fornecedor in fornecedores_db:
            info = _montar_registro_admin(fornecedor, df_homologados, df_controle)
            status_counts[info['status']] = status_counts.get(info['status'], 0) + 1
        return jsonify(
            total_cadastrados=total_cadastrados,
            total_aprovados=status_counts.get('APROVADO', 0),
            total_em_analise=status_counts.get('EM_ANALISE', 0) + status_counts.get('A CADASTRAR', 0),
            total_reprovados=status_counts.get('REPROVADO', 0),
            total_documentos=total_documentos
        ), 200
    except FileNotFoundError as e:
        return jsonify(message=str(e)), 500
    except Exception as exc:
        print(f'Erro no dashboard admin: {exc}')
        return jsonify(message='Erro ao gerar dashboard administrativo'), 500
    
@app.route('/api/admin/fornecedores', methods=['GET'])
@jwt_required()
def painel_admin_fornecedores():
    """
    Endpoint que lista todos os fornecedores com informações completas.
    
    Retorna lista completa de todos os fornecedores cadastrados no sistema, com opção
    de busca por nome ou CNPJ. Cada fornecedor inclui dados consolidados de homologação
    (status, notas IQF, nota de homologação), documentos enviados, observações e datas
    relevantes. Os dados são consolidados a partir do banco de dados e das planilhas
    de homologação e controle de qualidade.
    
    Headers:
        Authorization (obrigatório): Bearer token JWT com role 'admin'
    
    Query Params:
        search (str, opcional): Termo para buscar por nome ou CNPJ (busca parcial, case-insensitive)
            Se fornecido, filtra fornecedores cujo nome ou CNPJ contenham o termo
    
    Returns:
        - 200 (OK): Lista de fornecedores com informações completas
            [
                {
                    "id": 1,
                    "nome": "Empresa ABC Ltda",
                    "email": "contato@empresaabc.com.br",
                    "cnpj": "12.345.678/0001-90",
                    "categoria": "Material Elétrico",
                    "status": "APROVADO",
                    "aprovado": true,
                    "nota_homologacao": 90.0,
                    "nota_iqf": 85.5,
                    "nota_iqf_planilha": 82.0,
                    "nota_iqf_media": 85.5,
                    "total_notas_iqf": 12,
                    "observacoes": ["Observação 1", "Observação 2"],
                    "observacao_admin": "Fornecedor aprovado com sucesso",
                    "nota_referencia_admin": 90.0,
                    "decisao_atualizada_em": "2025-01-15T10:30:00",
                    "documentos": [...],
                    "total_documentos": 5,
                    "ultima_atividade": "2025-01-15T10:30:00",
                    "data_cadastro": "2024-12-01T08:00:00"
                },
                ...
            ]
        - 403 (Forbidden): Acesso não autorizado
            {"message": "Acesso não autorizado."}
        - 500 (Internal Server Error): Erro ao processar a lista
            {"message": "Erro ao listar fornecedores"}
    
    Exemplo de requisição:
        GET /api/admin/fornecedores?search=ABC
        Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
    
    Nota:
        - A lista é ordenada alfabeticamente por nome do fornecedor
        - Se a busca não retornar resultados, retorna lista vazia []
        - Dados são consolidados em tempo real a partir de múltiplas fontes
    """
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso não autorizado.'), 403
    try:
        search_term = request.args.get('search', '', type=str).strip()
        query = Fornecedor.query
        if search_term:
            like_term = f"%{search_term}%"
            query = query.filter(
                or_(
                    Fornecedor.nome.ilike(like_term),
                    Fornecedor.cnpj.ilike(like_term)
                )
            )
        fornecedores = query.order_by(Fornecedor.nome.asc()).all()
        df_homologados, df_controle = _carregar_planilhas_homologacao()
        resultados = [
            _montar_registro_admin(fornecedor, df_homologados, df_controle)
            for fornecedor in fornecedores
        ]
        return jsonify(resultados), 200
    except FileNotFoundError as e:
        return jsonify(message=str(e)), 500
    except Exception as exc:
        print(f'Erro ao listar fornecedores admin: {exc}')
        return jsonify(message='Erro ao listar fornecedores'), 500


@app.route('/api/admin/fornecedores/<int:fornecedor_id>/notas', methods=['PATCH', 'POST', 'OPTIONS'])
@jwt_required(optional=True)
def atualizar_nota_fornecedor(fornecedor_id):
    """
    Endpoint para atualizar a nota de homologação de um fornecedor.
    
    Permite que administradores atualizem manualmente a nota de homologação de um
    fornecedor. A nota é armazenada na tabela notas_fornecedores e sobrescreve
    valores da planilha. Requer autenticação de admin.
    
    Args:
        fornecedor_id: ID do fornecedor a ter a nota atualizada
        
    Returns:
        JSON com mensagem de sucesso e dados atualizados (200) ou erro (400/403/404/500)
    """
    if request.method == 'OPTIONS':
        return '', 204
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso não autorizado.'), 403

    fornecedor = Fornecedor.query.get(fornecedor_id)
    if fornecedor is None:
        return jsonify(message='Fornecedor não encontrado.'), 404

    payload = request.get_json() or {}
    nota_valor = payload.get('notaHomologacao')
    if nota_valor is None:
        nota_valor = payload.get('nota_homologacao')
    if nota_valor is None:
        return jsonify(message='O campo notaHomologacao é obrigatório.'), 400
    try:
        nota_float = float(str(nota_valor).replace(',', '.'))
    except (TypeError, ValueError):
        return jsonify(message='Nota de homologação inválida.'), 400
    if not math.isfinite(nota_float):
        return jsonify(message='Nota de homologção inválida.'), 400

    try:
        registro_manual = NotaFornecedor.query.filter_by(fornecedor_id=fornecedor.id).first()
        if registro_manual is None:
            registro_manual = NotaFornecedor(fornecedor_id=fornecedor.id)
            db.session.add(registro_manual)
        registro_manual.nota_homologacao = nota_float
        registro_manual.atualizado_em = datetime.utcnow()
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        print(f'Erro ao atualizar nota de homologação: {exc}')
        return jsonify(message='Erro ao atualizar nota de homologação.'), 500

    df_homologados = None
    df_controle = None
    try:
        df_homologados, df_controle = _carregar_planilhas_homologacao()
    except FileNotFoundError:
        df_homologados = None
        df_controle = None
    except Exception as exc:
        print(f'Erro ao carregar planilhas apos atualizar nota: {exc}')
        df_homologados = None
        df_controle = None

    fornecedor_payload = _montar_registro_admin(fornecedor, df_homologados, df_controle)
    fornecedor_payload['nota_homologacao'] = nota_float
    return jsonify(
        message='Nota de homologação atualizada com sucesso.',
        fornecedor=fornecedor_payload
    ), 200


@app.route('/api/admin/fornecedores/<int:fornecedor_id>/decisao', methods=['POST', 'OPTIONS'])
@app.route('/api/admin/fornecedores/<int:fornecedor_id>/decis\u00e3o', methods=['POST', 'OPTIONS'])
@jwt_required(optional=True)
def registrar_decisao_fornecedor(fornecedor_id):
    """
    Endpoint para registrar decisão final sobre homologação de um fornecedor.
    
    Permite que administradores registrem a decisão final (APROVADO, REPROVADO, EM_ANALISE),
    adicionem observações e uma nota de referência. Opcionalmente pode enviar e-mail
    ao fornecedor notificando sobre a decisão. Requer autenticação de admin.
    
    Args:
        fornecedor_id: ID do fornecedor sobre o qual registrar a decisão
        
    Returns:
        JSON com mensagem de sucesso e dados atualizados (200) ou erro (400/403/404/500)
    """
    if request.method == 'OPTIONS':
        return '', 204
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso nao autorizado.'), 403

    fornecedor = Fornecedor.query.get(fornecedor_id)
    if fornecedor is None:
        return jsonify(message='Fornecedor nao encontrado.'), 404

    payload = request.get_json() or {}
    status_informado = (payload.get('status') or '').strip().upper()
    status_validos = {'APROVADO', 'REPROVADO', 'EM_ANALISE'}
    if status_informado not in status_validos:
        return jsonify(message='Status informado inválido.'), 400

    observacao = (payload.get('observacao') or '').strip()
    nota_referencia_valor = payload.get('notaReferencia')
    nota_referencia = None
    if nota_referencia_valor is not None:
        try:
            nota_referencia = float(str(nota_referencia_valor).replace(',', '.'))
        except (TypeError, ValueError):
            nota_referencia = None

    enviar_email_flag = bool(payload.get('enviarEmail'))

    registro_manual = NotaFornecedor.query.filter_by(fornecedor_id=fornecedor.id).first()
    if registro_manual is None:
        registro_manual = NotaFornecedor(fornecedor_id=fornecedor.id)
        db.session.add(registro_manual)

    registro_manual.status_decisao = status_informado
    registro_manual.observacao_admin = observacao or None
    registro_manual.nota_referencia = nota_referencia
    registro_manual.decisao_atualizada_em = datetime.utcnow()

    email_enviado = False
    if enviar_email_flag:
        email_enviado = _enviar_email_decisao(fornecedor, status_informado, observacao)
    registro_manual.email_enviado = email_enviado

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        print(f'Erro ao registrar decisao: {exc}')
        return jsonify(message='Erro ao registrar decisão do fornecedor.'), 500

    df_homologados = None
    df_controle = None
    try:
        df_homologados, df_controle = _carregar_planilhas_homologacao()
    except FileNotFoundError:
        pass
    except Exception as exc:
        print(f'Erro ao carregar planilhas apos decisao: {exc}')

    fornecedor_payload = _montar_registro_admin(fornecedor, df_homologados, df_controle)
    return jsonify(
        message='Decisao registrada com sucesso.',
        emailEnviado=email_enviado,
        fornecedor=fornecedor_payload
    ), 200


@app.route('/api/admin/fornecedores/<int:fornecedor_id>', methods=['DELETE'])
@jwt_required()
def excluir_fornecedor(fornecedor_id):
    """
    Endpoint para excluir um fornecedor do sistema.
    
    Remove o fornecedor do banco de dados e também exclui a pasta de arquivos
    associada no sistema de arquivos. Requer autenticação de admin.
    
    Args:
        fornecedor_id: ID do fornecedor a ser excluído
        
    Returns:
        JSON com mensagem de sucesso (200) ou erro (403/404/500)
    """
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso nao autorizado.'), 403

    fornecedor = Fornecedor.query.get(fornecedor_id)
    if fornecedor is None:
        return jsonify(message='Fornecedor nao encontrado.'), 404

    try:
        db.session.delete(fornecedor)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        print(f'Erro ao excluir fornecedor {fornecedor_id}: {exc}')
        return jsonify(message='Erro ao excluir fornecedor.'), 500

    pasta_fornecedor = os.path.join(UPLOAD_FOLDER, str(fornecedor.id))
    if os.path.isdir(pasta_fornecedor):
        try:
            shutil.rmtree(pasta_fornecedor)
        except OSError as exc:
            print(f'Falha ao remover arquivos do fornecedor {fornecedor.id}: {exc}')

    return jsonify(message='Fornecedor excluido com sucesso.'), 200


@app.route('/api/admin/documentos/<int:documento_id>/download', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def baixar_documento_admin(documento_id):
    """
    Endpoint para download de documentos pela área administrativa.
    
    Permite que administradores baixem documentos enviados por fornecedores.
    Primeiro tenta buscar o arquivo no disco, se não encontrar, busca no banco
    de dados (dados_arquivo) e tenta recuperar de fontes alternativas.
    Requer autenticação de admin.
    
    Args:
        documento_id: ID do documento a ser baixado
        
    Returns:
        Arquivo para download (200) ou erro (403/404/500)
    """
    if request.method == 'OPTIONS':
        return '', 204
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso nao autorizado.'), 403

    documento = Documento.query.get(documento_id)
    if documento is None:
        return jsonify(message='Documento nao encontrado.'), 404

    caminho_arquivo = os.path.join(
        UPLOAD_FOLDER,
        str(documento.fornecedor_id),
        documento.nome_documento
    )
    if os.path.isfile(caminho_arquivo):
        try:
            return send_file(
                caminho_arquivo,
                as_attachment=True,
                download_name=documento.nome_documento,
                mimetype=documento.mime_type or mimetypes.guess_type(documento.nome_documento)[0] or 'application/octet-stream'
            )
        except Exception as exc:
            print(f'Erro ao enviar documento {documento_id}: {exc}')
            return jsonify(message='Erro ao baixar documento.'), 500

    conteudo_memoria = documento.dados_arquivo
    if not conteudo_memoria:
        caminho_fallback, dados_recuperados = _carregar_documento_de_fontes(documento)
        if dados_recuperados:
            documento.dados_arquivo = dados_recuperados
            if not documento.mime_type:
                documento.mime_type = mimetypes.guess_type(documento.nome_documento)[0] or 'application/octet-stream'
            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                print(f'Falha ao atualizar dados em memoria para documento {documento_id}: {exc}')
            _armazenar_documento_no_disco(documento, dados_recuperados)
            conteudo_memoria = dados_recuperados

    if conteudo_memoria:
        try:
            buffer = io.BytesIO(bytes(conteudo_memoria))
            buffer.seek(0)
            return send_file(
                buffer,
                as_attachment=True,
                download_name=documento.nome_documento,
                mimetype=documento.mime_type or mimetypes.guess_type(documento.nome_documento)[0] or 'application/octet-stream'
            )
        except Exception as exc:
            print(f'Erro ao enviar conteudo em memoria para o documento {documento_id}: {exc}')
            return jsonify(message='Erro ao baixar documento.'), 500

    return jsonify(message='Arquivo do documento nao encontrado.'), 404


@app.route('/api/admin/notificacoes', methods=['GET'])
@jwt_required()
def painel_admin_notificacoes():
    """
    Endpoint que retorna notificações recentes para o painel administrativo.
    
    Compila eventos recentes do sistema: novos cadastros de fornecedores e
    envios de documentos. Ordena por data e retorna os mais recentes.
    Requer autenticação de admin.
    
    Query Params:
        limit: Número máximo de notificações a retornar (padrão: 20)
        
    Returns:
        JSON com lista de eventos/notificações (200) ou erro (403/500)
    """
    if not _admin_usuario_autorizado():
        return jsonify(message='Acesso não autorizado.'), 403
    try:
        limite = request.args.get('limit', 20, type=int)
        eventos = []
        fornecedores = Fornecedor.query.order_by(Fornecedor.data_cadastro.desc()).limit(limite).all()
        for fornecedor in fornecedores:
            if not fornecedor.data_cadastro:
                continue
            eventos.append({
                'id': f"cadastro-{fornecedor.id}",
                'tipo': 'cadastro',
                'titulo': 'Novo fornecedor cadastrado',
                'descricao': fornecedor.nome,
                'timestamp': fornecedor.data_cadastro.isoformat(),
                'detalhes': {
                    'email': fornecedor.email,
                    'cnpj': fornecedor.cnpj
                }
            })
        documentos = Documento.query.order_by(Documento.data_upload.desc()).limit(limite).all()
        for doc in documentos:
            fornecedor = doc.fornecedor
            if not doc.data_upload or not fornecedor:
                continue
            eventos.append({
                'id': f"documento-{doc.id}",
                'tipo': 'documento',
                'titulo': 'Documento enviado',
                'descricao': f"{fornecedor.nome} anexou {doc.nome_documento}",
                'timestamp': doc.data_upload.isoformat(),
                'detalhes': {
                    'fornecedor': fornecedor.nome,
                    'documento': doc.nome_documento,
                    'categoria': doc.categoria
                }
            })
        eventos.sort(key=lambda item: item['timestamp'], reverse=True)
        eventos = eventos[:limite]
        return jsonify(eventos), 200
    except Exception as exc:
        print(f'Erro ao obter notificações admin: {exc}')
        return jsonify(message='Erro ao listar notificações'), 500
    

@app.route('/api/fornecedores', methods=['GET'])
def listar_fornecedores():
    """
    Endpoint público para listar fornecedores (com busca opcional).
    
    Retorna uma lista simplificada de fornecedores cadastrados no sistema,
    com opção de filtrar por nome usando busca parcial (case-insensitive).
    Este endpoint é público e não requer autenticação, sendo útil para
    validações e seleções no frontend.
    
    Query Params:
        nome: (opcional) Nome ou parte do nome do fornecedor para filtrar a busca.
              Se não fornecido, retorna todos os fornecedores cadastrados.
        
    Returns:
        JSON com lista de objetos fornecedor, cada um contendo:
        - id: Identificador único do fornecedor
        - nome: Nome completo ou razão social do fornecedor
        - email: E-mail de contato do fornecedor
        - cnpj: CNPJ do fornecedor
        
    Exemplo de resposta:
        [
            {
                "id": 1,
                "nome": "Empresa ABC Ltda",
                "email": "contato@empresaabc.com.br",
                "cnpj": "12.345.678/0001-90"
            },
            ...
        ]
    """
    nome = request.args.get('nome', '')
    print(f"Buscando fornecedores com nome: {nome}")
    if nome:
        fornecedores = Fornecedor.query.filter(Fornecedor.nome.ilike(f'%{nome}%')).all()
    else:
        fornecedores = Fornecedor.query.all()
    print(f"Fornecedores encontrados: {len(fornecedores)}")
    lista = [{"id": f.id, "nome": f.nome, "email": f.email, "cnpj": f.cnpj} for f in fornecedores]
    return jsonify(lista)
def enviar_email_documento(fornecedor_nome, documento_nome, categoria, destinatario, link_documento, arquivos_paths=None):
    """
    Envia e-mail notificando sobre novos documentos enviados por um fornecedor.
    
    Cria e envia um e-mail HTML formatado e responsivo para notificar a equipe
    administrativa quando um fornecedor envia documentos ao sistema. O e-mail
    inclui informações detalhadas sobre o fornecedor, nome do(s) documento(s),
    categoria e pode anexar os arquivos enviados. O template do e-mail é estilizado
    com cores da marca Engeman e é compatível com clientes de e-mail modernos.
    
    Args:
        fornecedor_nome (str): Nome completo ou razão social do fornecedor que enviou o documento
        documento_nome (str): Nome do(s) documento(s) enviado(s) (pode ser uma lista separada por vírgulas)
        categoria (str): Categoria do documento (ex: "Material Elétrico", "Serviços de Manutenção")
        destinatario (str): Endereço de e-mail do destinatário (geralmente lucas.mateus@engeman.net)
        link_documento (str): Link(s) para acesso ao(s) documento(s) no sistema
        arquivos_paths (list[str], opcional): Lista de caminhos absolutos dos arquivos para anexar ao e-mail
            Se fornecido, os arquivos serão anexados como attachments ao e-mail
        
    Returns:
        None: A função não retorna valor, mas imprime mensagens de erro no console em caso de falha
    
    Exemplo de uso:
        enviar_email_documento(
            fornecedor_nome="Empresa ABC Ltda",
            documento_nome="Certificado FGTS, Alvará de Funcionamento",
            categoria="Material Elétrico",
            destinatario="lucas.mateus@engeman.net",
            link_documento="/uploads/1/certificado.pdf, /uploads/1/alvara.pdf",
            arquivos_paths=["/path/to/certificado.pdf", "/path/to/alvara.pdf"]
        )
    
    Nota:
        - O e-mail é enviado usando Flask-Mail configurado na aplicação
        - O template HTML é responsivo e compatível com dispositivos móveis
        - Se houver erro no envio, uma mensagem é impressa no console mas não interrompe o fluxo
    """
    corpo = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MENSAGEM DO PORTAL DE FORNECEDORES</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
                min-height: 100vh;
                padding: 20px;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }}
            .header {{
                background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
                padding: 40px 30px;
                text-align: center;
                position: relative;
            }}
            .header::before {{
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            }}
            .logo {{
                width: 150px;
                height: auto;
                margin-bottom: 20px;
                position: relative;
                z-index: 1;
                filter: brightness(0) invert(1);
            }}
            .header-title {{
                color: #f97316;
                font-size: 24px;
                font-weight: 700;
                margin: 0;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                position: relative;
                z-index: 1;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .badge {{
                display: inline-flex;
                align-items: center;
                background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
                color: #000000;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 16px;
            }}
            .message-card {{
                background: #f8fafc;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                border-left: 4px solid #f97316;
            }}
            .message-title {{
                font-size: 20px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 16px;
            }}
            .message-text {{
                color: #475569;
                font-size: 15px;
                line-height: 1.6;
                margin-bottom: 20px;
            }}
            .field {{
                margin-bottom: 20px;
            }}
            .field-label {{
                display: inline-flex;
                align-items: center;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 8px;
                font-size: 14px;
            }}
            .field-icon {{
                width: 16px;
                height: 16px;
                margin-right: 8px;
                color: #f97316;
            }}
            .field-value {{
                color: #475569;
                font-size: 15px;
                line-height: 1.6;
                background: #ffffff;
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                font-weight: 500;
            }}
            .cta-section {{
                text-align: center;
                margin: 32px 0;
                padding: 24px;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-radius: 12px;
                border: 1px solid #f59e0b;
            }}
            .cta-text {{
                font-size: 16px;
                color: #92400e;
                margin-bottom: 16px;
                font-weight: 500;
            }}
            .cta-button {{
                display: inline-flex;
                align-items: center;
                background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
                color: #ffffff;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                font-size: 15px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
            }}
            .cta-button:hover {{
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4);
            }}
            .footer {{
                background: #f1f5f9;
                padding: 24px 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
            }}
            .footer-text {{
                color: #64748b;
                font-size: 13px;
                line-height: 1.5;
                margin-bottom: 8px;
            }}
            .company-info {{
                color: #94a3b8;
                font-size: 12px;
                font-weight: 500;
                margin-top: 16px;
            }}
            /* Dark mode support for better readability */
            @media (prefers-color-scheme: dark) {{
                .container {{
                    background: #1e293b;
                    color: #f1f5f9;
                }}
                .message-card {{
                    background: #334155;
                    border-left-color: #f97316;
                }}
                .message-title {{
                    color: #f1f5f9;
                }}
                .message-text {{
                    color: #cbd5e1;
                }}
                .field-label {{
                    color: #f1f5f9;
                }}
                .field-value {{
                    background: #475569;
                    color: #f1f5f9;
                    border-color: #64748b;
                }}
                .footer {{
                    background: #334155;
                    border-top-color: #475569;
                }}
                .footer-text {{
                    color: #94a3b8;
                }}
                .company-info {{
                    color: #64748b;
                }}
            }}
            @media (max-width: 600px) {{
                .container {{
                    margin: 10px;
                    border-radius: 12px;
                }}
                .header, .content, .footer {{
                    padding-left: 20px;
                    padding-right: 20px;
                }}
                .header-title {{
                    font-size: 20px;
                }}
                .cta-section {{
                    padding: 20px;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 class="header-title"> DOCUMENTAÇÕES DO FORNECEDOR </h1>
            </div>
            <div class="content">
                <div class="badge">
                    📄 Novas Documentações Recebidas
                </div>
                <div class="message-card">
                    <h2 class="message-title">Documentação de Fornecedor</h2>
                    <p class="message-text">
                        O fornecedor <strong>{fornecedor_nome}</strong> enviou os documentos necessários para cadastro e homologação no sistema.
                    </p>
                    <div class="field">
                        <div class="field-label">
                            <span class="field-icon">📋</span>
                            DOCUMENTO
                        </div>
                        <div class="field-value">{documento_nome}</div>
                    </div>
                    <div class="field">
                        <div class="field-label">
                            <span class="field-icon">🏷️</span>
                            CATEGORIA
                        </div>
                        <div class="field-value">{categoria}</div>
                    </div>
                </div>
                <div class="cta-section">
                    <p class="cta-text">
                        <strong>⚠️ Ação Necessária:</strong> <br> Caso tenha documentos vencidos, alertar ao fornecedor.
                    </p>
                </div>
            </div>
            <div class="footer">
                <p class="footer-text">
                    Se você não esperava por este e-mail, favor desconsiderar esta mensagem.
                </p>
                <p class="company-info">
                    Sistema Engeman - Gestão de Fornecedores<br>
                    Este é um e-mail automático, não responda.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    try:
        msg = Message(
            f'DOCUMENTAÇÕES RECEBIDAS - {fornecedor_nome}',
            recipients=[destinatario],
            html=corpo,
            sender=app.config['MAIL_DEFAULT_SENDER']
        )
        if arquivos_paths:
            for arquivo_path in arquivos_paths:
                with app.open_resource(arquivo_path) as fp:
                    msg.attach(arquivo_path, "application/octet-stream", fp.read())
        mail.send(msg)
        print(f'E-mail enviado para {destinatario}')
    except Exception as e:
        print(f"Erro ao enviar e-mail para {destinatario}: {e}")
        return None


def _enviar_email_decisao(fornecedor, status_informado, observacao):
    """
    Envia e-mail ao fornecedor informando sobre a decisão de homologação.
    
    Envia um e-mail HTML formatado e responsivo ao fornecedor notificando sobre
    a decisão final do processo de homologação (aprovado ou reprovado). O e-mail
    inclui o nome do fornecedor, o status da decisão e observações opcionais do
    administrador. O assunto do e-mail varia conforme o status (aprovado/reprovado).
    
    Args:
        fornecedor (Fornecedor): Objeto Fornecedor do banco de dados contendo informações do fornecedor
            Deve ter pelo menos o atributo 'nome' e 'email'
        status_informado (str): Status da decisão, deve ser 'APROVADO' ou 'REPROVADO'
            Outros valores podem causar comportamento inesperado
        observacao (str, opcional): Observações do administrador sobre a decisão
            Se vazio ou None, o e-mail não incluirá seção de observações
        
    Returns:
        bool: True se o e-mail foi enviado com sucesso, False caso contrário
            Retorna False em caso de qualquer erro no processo de envio
        
    Exemplo de uso:
        sucesso = _enviar_email_decisao(
            fornecedor=fornecedor_obj,
            status_informado="APROVADO",
            observacao="Fornecedor aprovado com excelente desempenho."
        )
        if sucesso:
            print("E-mail enviado com sucesso")
    
    Nota:
        - O e-mail é enviado para o endereço armazenado em fornecedor.email
        - O assunto varia: "Portal Engeman - Homologacao aprovada" ou "Portal Engeman - Homologacao reprovada"
        - Se houver erro, uma mensagem é impressa no console e a função retorna False
    """
    try:
        assunto = (
            "Portal Engeman - Homologacao aprovada"
            if status_informado == 'APROVADO'
            else "Portal Engeman - Homologacao reprovada"
        )
        status_legivel = "aprovado" if status_informado == 'APROVADO' else "reprovado"
        corpo = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultado da Homologacao</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
        <tr>
            <td align="center" style="padding:32px;">
                <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
                    <tr>
                        <td style="text-align:center;padding-bottom:16px;">
                            <h1 style="margin:0;font-size:22px;color:oklch(0.646 0.222 41.116);">Decisão sobre sua homologação</h1>
                            <p style="margin:8px 0 0;color:#475569;font-size:14px;">Fornecedor: <strong>{fornecedor.nome}</strong></p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;color:#0f172a;">
                            Informamos que o processo foi <strong>{status_legivel}</strong>.
                            {f"<p style='margin-top:12px;color:#475569;'>Observação: {observacao}</p>" if observacao else ""}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-top:20px;color:#475569;font-size:13px;">
                            Em caso de dúvidas, nossa equipe está a disposição pelo Portal Engeman.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        imagem_path = _resolver_logo_path()
        enviar_email(fornecedor.email, assunto, corpo, imagem_path)
        return True
    except Exception as exc:
        print(f'Erro ao enviar e-mail de decisao: {exc}')
        return False
def enviar_email(destinatario, assunto, corpo, imagem_path=None):
    """
    Função genérica para envio de e-mails HTML com logo embutido.
    
    Envia um e-mail HTML usando Flask-Mail configurado na aplicação. Incorpora o
    logo da empresa como imagem base64 diretamente no HTML, substituindo o placeholder
    'cid:engeman_logo' encontrado no corpo do e-mail. Se o logo não for encontrado
    no caminho especificado (ou padrão), o e-mail é enviado sem a imagem, mas com
    uma mensagem de aviso no console.
    
    Args:
        destinatario (str): Endereço de e-mail do destinatário
            Pode ser uma string única ou lista de strings para múltiplos destinatários
        assunto (str): Assunto do e-mail que aparecerá na caixa de entrada
        corpo (str): Corpo do e-mail em formato HTML
            Pode conter o placeholder 'cid:engeman_logo' que será substituído pela imagem base64
        imagem_path (str, opcional): Caminho absoluto para o arquivo de logo
            Se None, usa a função _resolver_logo_path() para encontrar o logo padrão (colorida.png)
        
    Raises:
        Exception: Se houver erro ao enviar o e-mail (erro de conexão, configuração, etc.)
            A exceção é capturada e uma mensagem de erro é impressa no console antes de relançar
    
    Exemplo de uso:
        corpo_html = "<html><body><img src='cid:engeman_logo'><h1>Bem-vindo!</h1></body></html>"
        enviar_email("usuario@exemplo.com", "E-mail de Teste", corpo_html, "/path/to/logo.png")
    
    Nota:
        - O logo é convertido para base64 e incorporado diretamente no HTML
        - Isso evita problemas com imagens externas bloqueadas por clientes de e-mail
        - O remetente padrão é definido em app.config['MAIL_DEFAULT_SENDER']
        - Se o envio falhar, uma exceção é lançada e deve ser tratada pelo chamador
    """
    try:
        msg = Message(
            assunto,
            recipients=[destinatario],
            html=corpo,
            sender=app.config.get('MAIL_DEFAULT_SENDER'),
        )
        caminho_logo = imagem_path or _resolver_logo_path()
        if caminho_logo and os.path.exists(caminho_logo):
            with open(caminho_logo, "rb") as img:
                img_data = img.read()
                encoded_img = base64.b64encode(img_data).decode('utf-8')
            msg.html = corpo.replace("cid:engeman_logo", f"data:image/png;base64,{encoded_img}")
        else:
            print(f"Aviso: logo padrão não encontrado em {caminho_logo or 'nenhum caminho'}")
            msg.html = corpo
        mail.send(msg)
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")
        raise e
def gerar_token_recuperacao():
    """
    Gera um token numérico de 6 dígitos para recuperação de senha.
    
    Gera um número aleatório entre 100000 e 999999 (inclusive) para ser usado
    como token de recuperação de senha. Este token é enviado por e-mail ao
    fornecedor e tem validade de 10 minutos. O token é armazenado no banco
    de dados associado ao fornecedor para validação posterior.
    
    Returns:
        int: Número inteiro de 6 dígitos (entre 100000 e 999999) representando o token
        
    Exemplo:
        >>> token = gerar_token_recuperacao()
        >>> print(token)
        456789
    """
    return random.randint(100000, 999999)
# ============================================================================
# PONTO DE ENTRADA DA APLICAÇÃO
# ============================================================================

if __name__ == '__main__':
    # Executa a aplicação Flask em modo de desenvolvimento
    # debug=True habilita o modo debug, que mostra erros detalhados e recarrega
    # automaticamente quando o código é alterado
    # Em produção, esta linha não deve ser executada - use um servidor WSGI (gunicorn, uwsgi, etc.)
    app.run(debug=True)
