from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="student", index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Board(Base):
    __tablename__ = "boards"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Grade(Base):
    __tablename__ = "grade_levels"
    id: Mapped[int] = mapped_column(primary_key=True)
    grade_number: Mapped[int] = mapped_column(Integer, unique=True)
    display_name: Mapped[str] = mapped_column(String(30))

class AcademicYear(Base):
    __tablename__ = "academic_years"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class GradeBoardSubject(Base):
    __tablename__ = "grade_board_subjects"
    __table_args__ = (UniqueConstraint("board_id", "grade_id", "subject_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    grade_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))

class Batch(Base):
    __tablename__ = "batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    grade_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id"))
    academic_year_id: Mapped[int] = mapped_column(ForeignKey("academic_years.id"))
    mode: Mapped[str] = mapped_column(String(20), default="offline")
    schedule_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=40)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Enrollment(Base):
    __tablename__ = "student_enrollments"
    __table_args__ = (UniqueConstraint("student_id", "batch_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Enquiry(Base):
    __tablename__ = "admission_enquiries"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    board: Mapped[str] = mapped_column(String(30), default="CBSE")
    grade_number: Mapped[int] = mapped_column(Integer, default=10)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Material(Base):
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    grade_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    material_type: Mapped[str] = mapped_column(String(30), default="notes")
    file_url: Mapped[str] = mapped_column(String(1000))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Test(Base):
    __tablename__ = "tests"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id"))
    grade_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    total_marks: Mapped[int] = mapped_column(Integer, default=10)
    questions_json: Mapped[str] = mapped_column(Text, default="[]")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Attempt(Base):
    __tablename__ = "test_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Doubt(Base):
    __tablename__ = "doubts"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    title: Mapped[str] = mapped_column(String(200))
    question_text: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
