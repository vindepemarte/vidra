from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import Persona, User
from vidra_api.schemas import PersonaCreate, PersonaOut

router = APIRouter(prefix="/personas", tags=["personas"])


@router.get("", response_model=list[PersonaOut])
async def list_personas(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[PersonaOut]:
    result = await db.execute(select(Persona).where(Persona.user_id == user.id).order_by(Persona.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=PersonaOut)
async def create_persona(
    payload: PersonaCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaOut:
    persona = Persona(user_id=user.id, **payload.model_dump())
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return persona


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(
    persona_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    await db.delete(persona)
    await db.commit()


@router.put("/{persona_id}", response_model=PersonaOut)
async def update_persona(
    persona_id: UUID,
    payload: PersonaCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonaOut:
    result = await db.execute(select(Persona).where(Persona.id == persona_id, Persona.user_id == user.id))
    persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

    for key, value in payload.model_dump().items():
        setattr(persona, key, value)
    persona.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(persona)
    return persona
