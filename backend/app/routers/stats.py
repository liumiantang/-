"""Gamification stats: tier, XP, check-in, streak records."""
from __future__ import annotations
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.quiz import QuizSession, QuizAnswer

router = APIRouter()

# Tier thresholds: (min_answers, min_accuracy, name, icon, color)
TIERS = [
    (0,     0,   '青铜', '🟤', '#cd7f32'),
    (50,   0.6, '白银', '🥈', '#a8b8c0'),
    (200,  0.7, '黄金', '🥇', '#f0c040'),
    (500,  0.8, '钻石', '💎', '#5b9bd5'),
    (1000, 0.9, '王者', '👑', '#ff6b6b'),
]

# Star-tier names for 王者+ (每200XP=1星)
STAR_TIERS = [
    (0,   '王者'),
    (10,  '非凡王者'),
    (20,  '无双王者'),
    (30,  '绝世王者'),
    (40,  '至圣王者'),
    (50,  '荣耀王者'),
    (100, '传奇王者'),
]

# XP needed to reach 王者 base tier (1000 answers * 90% accuracy * 10 XP)
KING_BASE_XP = 9000


def compute_tier(total: int, accuracy: float):
    tier = TIERS[0]
    for t in TIERS:
        if total >= t[0] and accuracy >= t[1]:
            tier = t
    return tier


def compute_star_info(xp: int, tier_name: str):
    """计算王者段位的星级和称号"""
    if tier_name != '王者':
        return None
    stars = max(0, (xp - KING_BASE_XP) // 200)
    star_tier = STAR_TIERS[0]
    for st in STAR_TIERS:
        if stars >= st[0]:
            star_tier = st
    return {
        'stars': stars,
        'star_tier_name': star_tier[1],
    }


@router.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    # Total answers & correct count
    total_answers = db.query(QuizAnswer).count()
    correct_answers = (
        db.query(QuizAnswer)
        .filter(QuizAnswer.is_correct == True)  # noqa: E712
        .count()
    )
    accuracy = round(correct_answers / total_answers, 3) if total_answers > 0 else 0

    # Current streak from last session
    current_streak = 0
    max_streak = 0
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.is_finished == True)  # noqa: E712
        .order_by(QuizSession.finished_at.asc())
        .all()
    )

    # Compute max consecutive correct streak across all answers
    all_answers = (
        db.query(QuizAnswer, QuizSession)
        .join(QuizSession, QuizAnswer.session_id == QuizSession.id)
        .filter(QuizSession.is_finished == True)  # noqa: E712
        .order_by(QuizAnswer.answered_at.asc())
        .all()
    )

    best = 0
    run = 0
    for ans, _sess in all_answers:
        if ans.is_correct:
            run += 1
            if run > best:
                best = run
        else:
            run = 0
    max_streak = best

    # Total study days (distinct dates with sessions)
    study_dates = set()
    for s in sessions:
        if s.finished_at:
            study_dates.add(s.finished_at.date().isoformat())

    total_study_days = len(study_dates)

    # Today's stats
    today = date.today()
    today_sessions = sum(1 for d in study_dates if d == today.isoformat())
    checked_in_today = today_sessions > 0

    # Consecutive study days
    consecutive_days = 0
    d = today
    while d.isoformat() in study_dates:
        consecutive_days += 1
        d = d - timedelta(days=1)

    # Tier
    tier = compute_tier(total_answers, accuracy)

    # XP: 10 per correct answer
    xp = correct_answers * 10
    xp_level = xp // 500 + 1
    xp_current = xp % 500
    xp_next = 500

    # Star system for 王者 tier
    star_info = compute_star_info(xp, tier[2])

    return {
        'total_answers': total_answers,
        'correct_answers': correct_answers,
        'accuracy': accuracy,
        'max_streak': max_streak,
        'total_study_days': total_study_days,
        'consecutive_days': consecutive_days,
        'checked_in_today': checked_in_today,
        'today_sessions': today_sessions,
        'study_dates': sorted(study_dates)[-60:],  # last 60 days
        'tier': {
            'name': tier[2],
            'icon': tier[3],
            'color': tier[4],
            'stars': star_info['stars'] if star_info else 0,
            'star_tier_name': star_info['star_tier_name'] if star_info else tier[2],
        },
        'xp': xp,
        'xp_level': xp_level,
        'xp_current': xp_current,
        'xp_next': xp_next,
    }
