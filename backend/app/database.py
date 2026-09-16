from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from .models import bank, question, quiz, review  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # ``create_all`` does not add columns to an existing SQLite database.
    # Keep the lightweight app startup migration-safe for fields introduced
    # by the AI essay-grading feature.
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(quiz_answers)"))
            }
            migrations = {
                "ai_score": "FLOAT",
                "ai_feedback": "TEXT",
            }
            for column, sql_type in migrations.items():
                if column not in columns:
                    conn.execute(text(f'ALTER TABLE quiz_answers ADD COLUMN "{column}" {sql_type}'))
