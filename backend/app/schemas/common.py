from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Literal

class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=30)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreateIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    role: Literal["student", "faculty", "admin"] = "student"

class EnquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=30)
    email: EmailStr | None = None
    board: Literal["CBSE", "UPMSP"] = "CBSE"
    grade_number: int = Field(ge=9, le=12)
    message: str | None = Field(default=None, max_length=2000)

class EnquiryStatusIn(BaseModel):
    status: Literal["new", "contacted", "admitted", "closed"]

class BatchIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    board_id: int
    grade_id: int
    academic_year_id: int
    schedule_text: str | None = None
    capacity: int = Field(default=40, ge=1, le=300)

class EnrollmentIn(BaseModel):
    student_id: int
    batch_id: int

class MaterialIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    board_id: int
    grade_id: int
    subject_id: int
    material_type: Literal["notes", "worksheet", "homework", "revision", "recording", "formula_sheet"] = "notes"
    file_url: str = Field(min_length=1, max_length=1000)
    batch_id: int | None = None
    is_published: bool = True

class Question(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    marks: int = Field(default=1, ge=1, le=20)
    explanation: str | None = None

class TestIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    board_id: int
    grade_id: int
    subject_id: int
    batch_id: int | None = None
    duration_minutes: int = Field(default=30, ge=1, le=300)
    questions: list[Question] = Field(min_length=1, max_length=100)
    is_published: bool = True

class AnswerIn(BaseModel):
    answers: dict[str, int]

class DoubtIn(BaseModel):
    subject_id: int
    title: str = Field(min_length=2, max_length=200)
    question_text: str = Field(min_length=5, max_length=5000)

class DoubtAnswerIn(BaseModel):
    answer_text: str = Field(min_length=2, max_length=5000)
    status: Literal["answered", "closed"] = "answered"
