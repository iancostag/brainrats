import csv
import io
import json
import uuid
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.challenge import Category, ChallengeMember
from app.models.checkin import CheckIn
from app.models.extras import StudyReviewLog
from app.models.user import User
from app.schemas.checkin import (
    BookShelfItem,
    DiaryChallengeEntry,
    DiaryHeatmapDay,
    DiaryHeatmapResponse,
    DiaryItem,
    DiaryResponse,
    ReviewActionRequest,
    ReviewSuggestionOut,
    WeeklyRecapResponse,
)
from app.services.checkins import hydrate_checkins

router = APIRouter(prefix="/diary", tags=["diary"])

REVIEW_INTERVALS: tuple[tuple[int, int, str], ...] = (
    (3, 5, "Revisão D+3"),
    (7, 10, "Revisão D+7"),
    (21, 28, "Revisão D+21"),
)


def _escape_like(raw: str) -> str:
    return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _compute_global_streaks(active_dates: set[date], today: date) -> tuple[int, int]:
    if not active_dates:
        return 0, 0
    cursor = today if today in active_dates else (today - timedelta(days=1))
    current = 0
    while cursor in active_dates:
        current += 1
        cursor -= timedelta(days=1)

    ordered = sorted(active_dates)
    longest = 1
    run = 1
    for idx in range(1, len(ordered)):
        if ordered[idx] == ordered[idx - 1] + timedelta(days=1):
            run += 1
            if run > longest:
                longest = run
        else:
            run = 1
    return current, longest


@router.get("", response_model=DiaryResponse)
async def search_diary(
    q: str | None = Query(default=None, max_length=120),
    category_slug: str | None = Query(default=None),
    challenge_id: uuid.UUID | None = Query(default=None),
    source: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiaryResponse:
    """Return the authenticated user's searchable study diary with FTS and cursor pagination."""
    query = (
        select(CheckIn)
        .where(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.created_at.desc())
    )

    if q and q.strip():
        cleaned_q = q.strip()
        if settings.resolved_database_url.startswith("postgresql"):
            ts_vec = func.to_tsvector(
                "portuguese",
                func.coalesce(CheckIn.title, "") + " " + func.coalesce(CheckIn.description, ""),
            )
            ts_query = func.plainto_tsquery("portuguese", cleaned_q)
            escaped = f"%{_escape_like(cleaned_q)}%"
            query = query.where(
                or_(
                    ts_vec.op("@@")(ts_query),
                    CheckIn.title.ilike(escaped, escape="\\"),
                    CheckIn.description.ilike(escaped, escape="\\"),
                )
            )
        else:
            escaped = f"%{_escape_like(cleaned_q)}%"
            query = query.where(
                or_(
                    CheckIn.title.ilike(escaped, escape="\\"),
                    CheckIn.description.ilike(escaped, escape="\\"),
                )
            )

    if category_slug:
        cat_id = await db.scalar(select(Category.id).where(Category.slug == category_slug))
        if cat_id is None:
            return DiaryResponse(items=[], total_entries=0, total_points=0, by_category={})
        query = query.where(CheckIn.category_id == cat_id)

    if challenge_id is not None:
        query = query.where(CheckIn.challenge_id == challenge_id)

    if source:
        query = query.where(CheckIn.source == source)

    if date_from is not None:
        query = query.where(CheckIn.study_date >= date_from)

    if date_to is not None:
        query = query.where(CheckIn.study_date <= date_to)

    if before is not None:
        query = query.where(CheckIn.created_at < before)

    raw_rows = list((await db.scalars(query.limit(limit + 1))).all())
    has_more = len(raw_rows) > limit
    checkins = raw_rows[:limit]
    next_cursor = checkins[-1].created_at if has_more and checkins else None

    admin_memberships = (
        await db.scalars(
            select(ChallengeMember.challenge_id).where(
                ChallengeMember.user_id == current_user.id,
                ChallengeMember.role == "admin",
            )
        )
    ).all()
    hydrated = await hydrate_checkins(db, checkins, current_user.id, set(admin_memberships))

    external_ids = {c.id: c.external_event_id for c in checkins}
    grouped: dict[tuple[str, str], DiaryItem] = {}
    items: list[DiaryItem] = []
    for checkin in hydrated:
        entry = DiaryChallengeEntry(
            checkin_id=checkin.id,
            challenge_id=checkin.challenge_id,
            challenge_title=checkin.challenge_title,
            points_awarded=checkin.points_awarded,
            status=checkin.status,
        )
        external_id = external_ids.get(checkin.id)
        key = (checkin.source, external_id) if external_id else None
        if key is not None and key in grouped:
            grouped[key].challenges.append(entry)
            continue
        diary_item = DiaryItem(**checkin.model_dump(), challenges=[entry])
        if key is not None:
            grouped[key] = diary_item
        items.append(diary_item)

    by_category: dict[str, int] = defaultdict(int)
    total_points = 0
    for item in items:
        by_category[item.category_slug] += 1
        total_points += max(
            (e.points_awarded for e in item.challenges if e.status == "valid"), default=0
        )

    return DiaryResponse(
        items=items,
        total_entries=len(items),
        total_points=total_points,
        by_category=dict(by_category),
        has_more=has_more,
        next_cursor=next_cursor,
    )


@router.get("/heatmap", response_model=DiaryHeatmapResponse)
async def get_diary_heatmap(
    days_back: int = Query(default=365, ge=30, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiaryHeatmapResponse:
    """Return daily study counts and global streaks for the consistency heatmap."""
    today = datetime.now(UTC).date()
    since = today - timedelta(days=days_back)
    rows = (
        await db.execute(
            select(CheckIn.study_date, Category.slug, CheckIn.source, CheckIn.external_event_id)
            .join(Category, Category.id == CheckIn.category_id)
            .where(
                CheckIn.user_id == current_user.id,
                CheckIn.status == "valid",
                CheckIn.study_date >= since,
            )
        )
    ).all()

    seen_keys: set[tuple[date, str, str]] = set()
    by_day: dict[date, Counter[str]] = defaultdict(Counter)
    for study_date, cat_slug, source, ext_id in rows:
        if ext_id:
            dedupe = (study_date, source, ext_id)
            if dedupe in seen_keys:
                continue
            seen_keys.add(dedupe)
        by_day[study_date][cat_slug] += 1

    day_items = [
        DiaryHeatmapDay(
            study_date=d,
            count=sum(counter.values()),
            top_category=counter.most_common(1)[0][0] if counter else None,
        )
        for d, counter in sorted(by_day.items())
    ]
    current_streak, longest_streak = _compute_global_streaks(set(by_day.keys()), today)
    return DiaryHeatmapResponse(
        days=day_items,
        total_active_days=len(by_day),
        current_global_streak=current_streak,
        longest_global_streak=longest_streak,
    )


@router.get("/books", response_model=list[BookShelfItem])
async def get_diary_bookshelf(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BookShelfItem]:
    """Aggregate reading sessions and pages per book from the user's diary."""
    rows = (
        await db.execute(
            select(
                CheckIn.title,
                CheckIn.study_date,
                CheckIn.metadata_json,
                CheckIn.source,
                CheckIn.external_event_id,
            )
            .join(Category, Category.id == CheckIn.category_id)
            .where(
                CheckIn.user_id == current_user.id,
                CheckIn.status == "valid",
                Category.slug == "books",
            )
            .order_by(CheckIn.study_date.desc())
        )
    ).all()

    seen_ext: set[tuple[str, str]] = set()
    books: dict[str, dict] = {}
    for title, study_date, meta, source, ext_id in rows:
        if ext_id:
            key = (source, ext_id)
            if key in seen_ext:
                continue
            seen_ext.add(key)
        book_name = str((meta or {}).get("book_title") or title).strip()
        if not book_name:
            continue
        norm = book_name.lower()
        pages_raw = (meta or {}).get("pages_read")
        pages = int(pages_raw) if isinstance(pages_raw, int | float) and pages_raw > 0 else 0
        if norm not in books:
            books[norm] = {
                "book_title": book_name,
                "total_pages": 0,
                "sessions_count": 0,
                "last_read_date": study_date,
            }
        books[norm]["total_pages"] += pages
        books[norm]["sessions_count"] += 1
        if study_date > books[norm]["last_read_date"]:
            books[norm]["last_read_date"] = study_date

    ordered = sorted(books.values(), key=lambda b: b["last_read_date"], reverse=True)
    return [BookShelfItem(**item) for item in ordered]


@router.get("/reviews", response_model=list[ReviewSuggestionOut])
async def get_spaced_repetition_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReviewSuggestionOut]:
    """Suggest past studies due for spaced-repetition review (D+3, D+7, D+21)."""
    today = datetime.now(UTC).date()
    oldest = today - timedelta(days=30)
    newest = today - timedelta(days=3)

    rows = (
        await db.execute(
            select(CheckIn, Category)
            .join(Category, Category.id == CheckIn.category_id)
            .where(
                CheckIn.user_id == current_user.id,
                CheckIn.status == "valid",
                CheckIn.study_date >= oldest,
                CheckIn.study_date <= newest,
                Category.slug.in_(["leetcode", "books", "esw", "data"]),
            )
            .order_by(CheckIn.study_date.desc())
        )
    ).all()
    if not rows:
        return []

    checkin_ids = [c.id for c, _ in rows]
    recent_logs = (
        await db.scalars(
            select(StudyReviewLog).where(
                StudyReviewLog.user_id == current_user.id,
                StudyReviewLog.checkin_id.in_(checkin_ids),
            )
        )
    ).all()
    reviewed_ids = {log.checkin_id for log in recent_logs}

    suggestions: list[ReviewSuggestionOut] = []
    seen_titles: set[str] = set()
    for checkin, cat in rows:
        if checkin.id in reviewed_ids:
            continue
        title_key = checkin.title.strip().lower()
        if title_key in seen_titles:
            continue
        days_ago = (today - checkin.study_date).days
        label = next(
            (lbl for lo, hi, lbl in REVIEW_INTERVALS if lo <= days_ago <= hi),
            None,
        )
        if label is None:
            continue
        seen_titles.add(title_key)
        suggestions.append(
            ReviewSuggestionOut(
                checkin_id=checkin.id,
                title=checkin.title,
                category_slug=cat.slug,
                category_name=cat.name,
                study_date=checkin.study_date,
                days_ago=days_ago,
                interval_label=label,
                evidence_url=checkin.evidence_url,
            )
        )
        if len(suggestions) >= 6:
            break
    return suggestions


@router.post("/reviews/{checkin_id}", status_code=status.HTTP_201_CREATED)
async def record_review_action(
    checkin_id: uuid.UUID,
    payload: ReviewActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark a spaced-repetition review suggestion as reviewed or dismissed."""
    checkin = await db.scalar(
        select(CheckIn).where(CheckIn.id == checkin_id, CheckIn.user_id == current_user.id)
    )
    if checkin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Estudo não encontrado.")
    db.add(
        StudyReviewLog(
            checkin_id=checkin.id,
            user_id=current_user.id,
            action=payload.action,
        )
    )
    await db.commit()
    return {
        "detail": (
            "Revisão registrada no histórico!"
            if payload.action == "reviewed"
            else "Sugestão ocultada."
        )
    }


@router.get("/weekly-recap", response_model=WeeklyRecapResponse)
async def get_weekly_recap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeeklyRecapResponse:
    """Compile the last 7 days of studies into a shareable Markdown Dev Log."""
    end_date = datetime.now(UTC).date()
    start_date = end_date - timedelta(days=6)
    rows = (
        await db.execute(
            select(CheckIn, Category)
            .join(Category, Category.id == CheckIn.category_id)
            .where(
                CheckIn.user_id == current_user.id,
                CheckIn.status == "valid",
                CheckIn.study_date >= start_date,
                CheckIn.study_date <= end_date,
            )
            .order_by(CheckIn.study_date.asc(), CheckIn.created_at.asc())
        )
    ).all()

    seen_ext: set[tuple[str, str]] = set()
    by_category: dict[str, int] = defaultdict(int)
    grouped_lines: dict[str, list[str]] = defaultdict(list)
    total = 0

    for checkin, cat in rows:
        if checkin.external_event_id:
            key = (checkin.source, checkin.external_event_id)
            if key in seen_ext:
                continue
            seen_ext.add(key)
        total += 1
        by_category[cat.slug] += 1
        line = f"- **{checkin.study_date.isoformat()}** — {checkin.title}"
        if checkin.description:
            snippet = checkin.description.splitlines()[0][:140]
            line += f": {snippet}"
        grouped_lines[cat.name].append(line)

    md_parts = [
        f"# Dev Log Semanal — @{current_user.username}",
        f"_Período: {start_date.isoformat()} a {end_date.isoformat()} · {total} estudo(s)_",
        "",
    ]
    if total == 0:
        md_parts.append("Nenhum estudo registrado nos últimos 7 dias.")
    else:
        for cat_name, lines in grouped_lines.items():
            md_parts.append(f"## {cat_name} ({len(lines)})")
            md_parts.extend(lines)
            md_parts.append("")

    return WeeklyRecapResponse(
        start_date=start_date,
        end_date=end_date,
        total_studies=total,
        by_category=dict(by_category),
        markdown="\n".join(md_parts).strip(),
    )


@router.get("/export")
async def export_diary(
    format: Literal["markdown", "json", "csv"] = Query(default="markdown"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export the user's deduplicated study diary in Markdown, JSON, or CSV (portfolio & LGPD)."""
    rows = (
        await db.execute(
            select(CheckIn, Category)
            .join(Category, Category.id == CheckIn.category_id)
            .where(CheckIn.user_id == current_user.id)
            .order_by(CheckIn.study_date.desc(), CheckIn.created_at.desc())
        )
    ).all()

    seen_ext: set[tuple[str, str]] = set()
    records: list[dict] = []
    for checkin, cat in rows:
        if checkin.external_event_id:
            key = (checkin.source, checkin.external_event_id)
            if key in seen_ext:
                continue
            seen_ext.add(key)
        records.append(
            {
                "study_date": checkin.study_date.isoformat(),
                "category": cat.name,
                "category_slug": cat.slug,
                "source": checkin.source,
                "title": checkin.title,
                "description": checkin.description or "",
                "evidence_url": checkin.evidence_url or "",
                "status": checkin.status,
            }
        )

    if format == "json":
        content = json.dumps(records, ensure_ascii=False, indent=2)
        return Response(
            content=content,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="brainrats-diario.json"'},
        )

    if format == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(
            buf,
            fieldnames=[
                "study_date",
                "category",
                "category_slug",
                "source",
                "title",
                "description",
                "evidence_url",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(records)
        return Response(
            content=buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="brainrats-diario.csv"'},
        )

    lines = [f"# Diário de Estudos — {current_user.display_name} (@{current_user.username})", ""]
    for rec in records:
        lines.append(f"## {rec['study_date']} · [{rec['category']}] {rec['title']}")
        if rec["description"]:
            lines.append(rec["description"])
        if rec["evidence_url"]:
            lines.append(f"Evidência: {rec['evidence_url']}")
        lines.append("")
    return Response(
        content="\n".join(lines),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="brainrats-diario.md"'},
    )
