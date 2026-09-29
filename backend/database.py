from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

# Base de datos: PostgreSQL si se define DATABASE_URL (ej. en Render), o SQLite local por defecto
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./medstats.db")
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
except Exception as e:
    print(f"⚠️ Error inicializando engine con {SQLALCHEMY_DATABASE_URL}: {e}. Usando SQLite.")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./medstats.db"
    connect_args = {"check_same_thread": False}
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    global engine, SessionLocal
    try:
        with engine.connect() as conn:
            pass
        Base.metadata.create_all(bind=engine)
        print("✅ Base de datos conectada e inicializada correctamente.")
    except Exception as e:
        print(f"⚠️ Advertencia: No se pudo conectar a la base de datos principal ({e})")
        if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
            print("🔄 Iniciando con SQLite local de respaldo (sqlite:///./medstats.db)...")
            engine = create_engine("sqlite:///./medstats.db", connect_args={"check_same_thread": False})
            SessionLocal.configure(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("✅ Base de datos SQLite de respaldo inicializada con éxito.")


# Dependencia para inyectar la sesión en los endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()