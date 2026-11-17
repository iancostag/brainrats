import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import (
    Category,
    Challenge,
    ChallengeCategoryConfig,
    ChallengeMember,
)
from app.models.checkin import CheckIn
from app.models.user import User
from app.services.scoring import DEFAULT_CATEGORIES, compute_study_date

DEFAULT_WEIGHTS_BY_SLUG: dict[str, dict] = {
    "leetcode": {"Easy": 10, "Medium": 20, "Hard": 35},
    "project": {"session": 15},
    "books": {"per_page": 1, "min_pages": 5},
    "esw": {"per_30min": 15},
    "data": {"per_30min": 15},
}


async def ensure_default_categories(db: AsyncSession) -> dict[str, Category]:
    """Ensure the 5 default categories exist and return them keyed by slug."""
    existing = (await db.scalars(select(Category))).all()
    by_slug = {cat.slug: cat for cat in existing}

    for item in DEFAULT_CATEGORIES:
        if item["slug"] not in by_slug:
            cat = Category(
                slug=item["slug"],
                name=item["name"],
                description=item["description"],
            )
            db.add(cat)
            by_slug[item["slug"]] = cat

    await db.flush()
    return by_slug


async def attach_default_category_configs(
    db: AsyncSession,
    challenge_id: uuid.UUID,
    categories_by_slug: dict[str, Category],
    overrides: dict[str, dict] | None = None,
) -> None:
    """Create ChallengeCategoryConfig rows for a challenge using defaults + optional overrides."""
    overrides = overrides or {}
    for item in DEFAULT_CATEGORIES:
        slug = item["slug"]
        cat = categories_by_slug[slug]
        override = overrides.get(slug, {})
        db.add(
            ChallengeCategoryConfig(
                challenge_id=challenge_id,
                category_id=cat.id,
                is_enabled=override.get("is_enabled", True),
                base_points=override.get("base_points", item["default_base_points"]),
                daily_cap=override.get("daily_cap", item["default_daily_cap"]),
                weights_json=override.get("weights_json", DEFAULT_WEIGHTS_BY_SLUG.get(slug, {})),
            )
        )


async def seed_initial_data(db: AsyncSession) -> None:
    """Seed categories, demo bot user, and initial public challenges idempotently."""
    categories_by_slug = await ensure_default_categories(db)

    existing_challenge = await db.scalar(select(Challenge.id).limit(1))
    if existing_challenge is not None:
        await db.commit()
        return

    bot_user = await db.scalar(select(User).where(User.username == "brainrats_bot"))
    if bot_user is None:
        bot_user = User(
            username="brainrats_bot",
            display_name="BrainRats Bot",
            bio="Conta oficial com exemplos iniciais para explorar os desafios.",
        )
        db.add(bot_user)
        await db.flush()

    tz = "America/Sao_Paulo"
    today = compute_study_date(datetime.now(UTC), tz)

    points_challenge = Challenge(
        slug="desafio-30-dias-pontuacao",
        title="Desafio 30 Dias de Código (Modo Pontuação)",
        description=(
            "Grupo aberto no Modo Pontuação com pesos por categoria (LeetCode, Projeto, "
            "Livros, ESW e Dados) e teto diário de 100 pts."
        ),
        visibility="public",
        invite_code="CODERATS",
        scoring_mode="points",
        timezone=tz,
        start_date=today,
        end_date=today + timedelta(days=30),
        rest_days_per_week=1,
        daily_points_cap=100,
        created_by=bot_user.id,
    )
    checkin_challenge = Challenge(
        slug="constancia-diaria-checkin",
        title="Constância Diária Dev (Modo Check-in)",
        description=(
            "Grupo aberto no Modo Check-in clássico: 1 estudo válido no dia = 1 ponto. "
            "Foco total em manter a ofensiva!"
        ),
        visibility="public",
        invite_code="DAILYDEV",
        scoring_mode="checkin",
        timezone=tz,
        start_date=today,
        end_date=today + timedelta(days=30),
        rest_days_per_week=2,
        daily_points_cap=1,
        created_by=bot_user.id,
    )
    db.add_all([points_challenge, checkin_challenge])
    await db.flush()

    for ch in (points_challenge, checkin_challenge):
        db.add(ChallengeMember(challenge_id=ch.id, user_id=bot_user.id, role="admin"))
        await attach_default_category_configs(db, ch.id, categories_by_slug)

    sample_checkins = [
        CheckIn(
            challenge_id=points_challenge.id,
            user_id=bot_user.id,
            category_id=categories_by_slug["leetcode"].id,
            title="Two Sum & Sliding Window",
            description="Revisei hash map em O(n) e padrões de janela deslizante.",
            study_date=today,
            source="leetcode",
            metadata_json={"difficulty": "Medium", "language": "Python"},
            points_awarded=20,
            status="valid",
        ),
        CheckIn(
            challenge_id=points_challenge.id,
            user_id=bot_user.id,
            category_id=categories_by_slug["esw"].id,
            title="Leitura sobre Idempotência e Filas",
            description="Anotações de System Design sobre deduplicação de eventos em workers.",
            study_date=today,
            source="manual",
            metadata_json={"topic": "System Design", "duration_minutes": 45},
            points_awarded=15,
            status="valid",
        ),
    ]
    db.add_all(sample_checkins)
    await db.commit()
