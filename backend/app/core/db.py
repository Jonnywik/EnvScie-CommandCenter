from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()
engine = None
SessionLocal = None

# Demo mode intentionally avoids constructing a live SQLAlchemy engine. This keeps
# the demo API and its tests independent of whichever database driver is installed
# in the sandbox while preserving the same session path for live deployments.
if not settings.demo_mode:
    engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_timeout=5,
    )
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession | None]:
    if settings.demo_mode:
        yield None
        return
    if SessionLocal is None:
        raise RuntimeError("database session factory is not configured")
    async with SessionLocal() as session:
        yield session
