import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    invite_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    scoring_mode: Mapped[str] = mapped_column(String(20), default="points", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="America/Sao_Paulo", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rest_days_per_week: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    daily_points_cap: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    members: Mapped[list["ChallengeMember"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )
    category_configs: Mapped[list["ChallengeCategoryConfig"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )


class ChallengeMember(Base):
    __tablename__ = "challenge_members"
    __table_args__ = (UniqueConstraint("challenge_id", "user_id", name="uq_challenge_member"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # admin | member
    role: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    challenge: Mapped["Challenge"] = relationship(back_populates="members")


class ChallengeCategoryConfig(Base):
    __tablename__ = "challenge_category_configs"
    __table_args__ = (
        UniqueConstraint("challenge_id", "category_id", name="uq_challenge_category_config"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    base_points: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    daily_cap: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    weights_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    challenge: Mapped["Challenge"] = relationship(back_populates="category_configs")


class RestDay(Base):
    __tablename__ = "rest_days"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", "rest_date", name="uq_challenge_rest_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rest_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
