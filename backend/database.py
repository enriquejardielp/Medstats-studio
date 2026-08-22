from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

# Base de datos: PostgreSQL si se define DATABASE_URL (ej. en Render), o SQLite local por defecto
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./medstats.db")
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para inyectar la sesión en los endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()