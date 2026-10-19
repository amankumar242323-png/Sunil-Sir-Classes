import os
import logging
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

logger = logging.getLogger("sunil_classes.db")

class Base(DeclarativeBase):
    pass

def resolve_db_url(url: str) -> str:
    # Convert Render / Heroku postgres:// or plain postgresql:// to postgresql+psycopg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    # If on Vercel serverless environment, local filesystem is read-only except /tmp
    if os.environ.get("VERCEL") and url.startswith("sqlite"):
        return "sqlite:////tmp/sunil_classes.db"

    # If SQLite URL has a relative path (e.g. sqlite:///./sunil_classes.db),
    # resolve it relative to the backend directory so that running from any folder
    # always opens the same database file.
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////") and ":memory:" not in url:
        rel_path = url.replace("sqlite:///", "")
        p = Path(rel_path)
        if p.is_absolute():
            return url
        backend_dir = Path(__file__).resolve().parent.parent.parent
        abs_db_path = (backend_dir / rel_path).resolve()
        return f"sqlite:///{abs_db_path.as_posix()}"
    return url

def init_engine(db_url: str):
    final_url = resolve_db_url(db_url)
    is_sqlite = final_url.startswith("sqlite")
    connect_args = {"check_same_thread": False} if is_sqlite else {}
    
    eng = create_engine(
        final_url,
        connect_args=connect_args,
        pool_pre_ping=not is_sqlite,
    )
    
    if is_sqlite:
        @event.listens_for(eng, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
            
    return eng

# Try initializing configured database; gracefully fallback to SQLite if PostgreSQL is unreachable
try:
    engine = init_engine(settings.database_url)
    # Test connection
    with engine.connect() as conn:
        pass
except Exception as e:
    if not settings.database_url.startswith("sqlite"):
        logger.warning(
            f"Could not connect to configured database ({settings.database_url}): {e}. "
            "Falling back to local SQLite database in backend directory."
        )
        engine = init_engine("sqlite:///./sunil_classes.db")
    else:
        raise e

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
