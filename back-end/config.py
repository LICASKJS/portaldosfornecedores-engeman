class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'secret-key-here')

    _database_url = os.environ.get('DATABASE_URL', 'sqlite:///fornecedores.db')

    if _database_url.startswith('postgres://'):
        _database_url = _database_url.replace(
            'postgres://', 'postgresql+psycopg2://', 1
        )

    if _database_url.startswith('postgresql'):
        parsed_url = urlparse(_database_url)
        query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))

        query_params.setdefault('sslmode', 'require')

        parsed_url = parsed_url._replace(
            query=urlencode(query_params)
        )
        _database_url = urlunparse(parsed_url)

    SQLALCHEMY_DATABASE_URI = _database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _pool_recycle = int(os.environ.get('SQLALCHEMY_POOL_RECYCLE', 280))

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': _pool_recycle,
        'pool_size': 5,
        'max_overflow': 2,
    }
