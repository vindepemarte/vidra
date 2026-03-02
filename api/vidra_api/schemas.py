from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    tier: str


class PersonaCreate(BaseModel):
    name: str
    handle: str
    age: int = Field(ge=18, le=100)
    city: str
    niche: str
    vibe: str
    template: str = "fashion"


class PersonaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    handle: str
    age: int
    city: str
    niche: str
    vibe: str
    template: str


class GenerateCalendarRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2025, le=2100)


class PostOut(BaseModel):
    post_number: int
    time: str
    scene_type: str
    caption: str
    prompt: str
    hashtags: str


class DayOut(BaseModel):
    day: int
    date: date
    theme: str
    mood: str
    posts: list[PostOut]


class MonthOut(BaseModel):
    persona_id: UUID
    month: int
    year: int
    mode: str
    days: list[DayOut]
