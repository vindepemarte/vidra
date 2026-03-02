import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vidra_api.database import get_db
from vidra_api.deps import get_current_user
from vidra_api.models import OnboardingState, User
from vidra_api.schemas import OnboardingCompleteOut, OnboardingStateOut, OnboardingStepRequest

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


async def _get_or_create_state(db: AsyncSession, user: User) -> OnboardingState:
    q = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user.id))
    state = q.scalar_one_or_none()
    if state is None:
        state = OnboardingState(user_id=user.id, current_step=0, completed=False)
        db.add(state)
        await db.flush()
    return state


@router.get("/state", response_model=OnboardingStateOut)
async def get_onboarding_state(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateOut:
    state = await _get_or_create_state(db, user)
    await db.commit()
    return OnboardingStateOut(current_step=state.current_step, goal=state.goal, completed=state.completed)


@router.post("/step", response_model=OnboardingStateOut)
async def save_onboarding_step(
    payload: OnboardingStepRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateOut:
    state = await _get_or_create_state(db, user)

    state.current_step = max(state.current_step, payload.step)
    if payload.goal is not None and payload.goal.strip():
        state.goal = payload.goal.strip()
    if payload.step >= 4:
        state.completed = True
    state.updated_at = dt.datetime.utcnow()

    await db.commit()
    return OnboardingStateOut(current_step=state.current_step, goal=state.goal, completed=state.completed)


@router.post("/complete", response_model=OnboardingCompleteOut)
async def complete_onboarding(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingCompleteOut:
    state = await _get_or_create_state(db, user)
    state.current_step = max(state.current_step, 4)
    state.completed = True
    state.updated_at = dt.datetime.utcnow()
    await db.commit()
    return OnboardingCompleteOut(completed=True)
