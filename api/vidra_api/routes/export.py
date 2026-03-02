from io import StringIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import CalendarDay, CalendarMonth, Persona, User

router = APIRouter(prefix="/export", tags=["export"])


async def _load_month(db: AsyncSession, user_id: UUID, persona_id: UUID, year: int, month: int) -> CalendarMonth | None:
    query = await db.execute(
        select(CalendarMonth)
        .join(Persona, Persona.id == CalendarMonth.persona_id)
        .options(selectinload(CalendarMonth.days).selectinload(CalendarDay.posts))
        .where(
            Persona.user_id == user_id,
            CalendarMonth.persona_id == persona_id,
            CalendarMonth.year == year,
            CalendarMonth.month == month,
        )
    )
    return query.scalar_one_or_none()


@router.get("/{persona_id}/{year}/{month}/markdown")
async def export_markdown(
    persona_id: UUID,
    year: int,
    month: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    month_obj = await _load_month(db, user.id, persona_id, year, month)
    if month_obj is None:
        raise HTTPException(status_code=404, detail="Calendar not found")

    out = StringIO()
    out.write(f"# Vidra Calendar {year}-{month:02d}\n\n")

    for day in sorted(month_obj.days, key=lambda d: d.day):
        out.write(f"## Day {day.day} - {day.theme} ({day.mood})\n")
        for post in sorted(day.posts, key=lambda p: p.post_number):
            out.write(f"- [{post.time}] Post {post.post_number} ({post.scene_type})\n")
            out.write(f"  - Caption: {post.caption}\n")
            out.write(f"  - Prompt: {post.prompt}\n")
        out.write("\n")

    filename = f"calendar_{year}_{month:02d}.md"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return PlainTextResponse(content=out.getvalue(), media_type="text/markdown", headers=headers)


@router.get("/{persona_id}/{year}/{month}/json")
async def export_json(
    persona_id: UUID,
    year: int,
    month: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    month_obj = await _load_month(db, user.id, persona_id, year, month)
    if month_obj is None:
        raise HTTPException(status_code=404, detail="Calendar not found")

    payload = {
        "persona_id": str(persona_id),
        "year": year,
        "month": month,
        "days": [
            {
                "day": day.day,
                "date": day.date.isoformat(),
                "theme": day.theme,
                "mood": day.mood,
                "posts": [
                    {
                        "post_number": post.post_number,
                        "time": post.time,
                        "scene_type": post.scene_type,
                        "caption": post.caption,
                        "prompt": post.prompt,
                        "hashtags": post.hashtags,
                    }
                    for post in sorted(day.posts, key=lambda p: p.post_number)
                ],
            }
            for day in sorted(month_obj.days, key=lambda d: d.day)
        ],
    }

    filename = f"calendar_{year}_{month:02d}.json"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return JSONResponse(content=payload, headers=headers)
