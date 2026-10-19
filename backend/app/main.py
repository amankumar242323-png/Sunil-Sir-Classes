from __future__ import annotations
import json
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, Body, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, current_user, require_roles
from app.db.session import Base, engine, get_db
from app.models.entities import (
    User, Board, Grade, AcademicYear, Subject, GradeBoardSubject,
    Batch, Enrollment, Enquiry, Material, Test, Attempt, Doubt
)
from app.schemas.common import (
    RegisterIn, LoginIn, UserCreateIn, EnquiryIn, EnquiryStatusIn,
    BatchIn, EnrollmentIn, MaterialIn, TestIn, AnswerIn, DoubtIn, DoubtAnswerIn
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    description="Comprehensive API for Sunil Sir Classes coaching management application."
)

# Robust CORS middleware configuration (allow all origins, including any Vercel preview or production domain)
origins = [x.strip() for x in settings.frontend_origins.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_populate():
    try:
        from app.seed_catalogue import seed
        seed()
    except Exception as e:
        import logging
        logging.getLogger("sunil_classes").warning(f"Auto-seed notification: {e}")


def user_out(u: User):
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

def subject_out(s: Subject):
    return {
        "id": s.id,
        "name": s.name,
        "code": s.code,
        "is_active": s.is_active
    }

# --- SYSTEM & HEALTH ---

@app.get("/", tags=["System"])
def root():
    return {
        "app": settings.app_name,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "version": "1.1.0"
    }

@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# --- AUTHENTICATION ---

@app.post("/api/v1/auth/register", tags=["Auth"])
def register(data: RegisterIn, db: Session = Depends(get_db)):
    clean_email = data.email.strip().lower()
    if db.scalar(select(User).where(User.email == clean_email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    
    user = User(
        full_name=data.full_name.strip(),
        email=clean_email,
        password_hash=hash_password(data.password),
        phone=data.phone.strip() if data.phone else None,
        role="student",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "user": user_out(user),
        "access_token": create_access_token(user),
        "token_type": "bearer"
    }

@app.post("/api/v1/auth/login", tags=["Auth"])
def login(data: LoginIn, db: Session = Depends(get_db)):
    clean_email = data.email.strip().lower()
    user = db.scalar(select(User).where(User.email == clean_email))
    if not user or not verify_password(data.password, user.password_hash) or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    
    return {
        "user": user_out(user),
        "access_token": create_access_token(user),
        "token_type": "bearer"
    }

@app.post("/api/v1/auth/swagger-token", include_in_schema=False)
def swagger_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    clean_email = form_data.username.strip().lower()
    user = db.scalar(select(User).where(User.email == clean_email))
    if not user or not verify_password(form_data.password, user.password_hash) or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer"
    }

@app.get("/api/v1/auth/me", tags=["Auth"])
def me(user: User = Depends(current_user)):
    return user_out(user)

# --- ACADEMIC CATALOGUE ---

@app.get("/api/v1/boards", tags=["Academics"])
def get_boards(db: Session = Depends(get_db)):
    rows = db.scalars(select(Board).where(Board.is_active == True).order_by(Board.id)).all()
    return [{"id": b.id, "name": b.name, "code": b.code} for b in rows]

@app.get("/api/v1/grades", tags=["Academics"])
def get_grades(db: Session = Depends(get_db)):
    rows = db.scalars(select(Grade).order_by(Grade.grade_number)).all()
    return [{"id": g.id, "grade_number": g.grade_number, "display_name": g.display_name} for g in rows]

@app.get("/api/v1/academic-years", tags=["Academics"])
def get_academic_years(db: Session = Depends(get_db)):
    rows = db.scalars(select(AcademicYear).order_by(AcademicYear.id.desc())).all()
    return [{"id": y.id, "name": y.name, "is_active": y.is_active} for y in rows]

@app.get("/api/v1/subjects", tags=["Academics"])
def get_subjects(
    board: str | None = None,
    grade: int | None = None,
    db: Session = Depends(get_db)
):
    query = select(Subject).where(Subject.is_active == True)
    if board and grade:
        b = db.scalar(select(Board).where(Board.code == board.upper()))
        g = db.scalar(select(Grade).where(Grade.grade_number == grade))
        if not b or not g:
            return []
        query = (
            select(Subject)
            .join(GradeBoardSubject, GradeBoardSubject.subject_id == Subject.id)
            .where(
                GradeBoardSubject.board_id == b.id,
                GradeBoardSubject.grade_id == g.id,
                Subject.is_active == True
            )
        )
    rows = db.scalars(query.order_by(Subject.name)).all()
    return [subject_out(s) for s in rows]

@app.get("/api/v1/programs", tags=["Academics"])
def get_programs():
    return {
        "institute": "Sunil Sir Classes",
        "tagline": "Personal Guidance · Rigorous Practice · Guaranteed Concept Clarity",
        "programs": [
            {
                "board": "CBSE",
                "grade": 9,
                "title": "CBSE Class 9 Foundation",
                "mode": "Offline Classroom + Online Resources",
                "description": "Comprehensive foundation in Mathematics and Science for high school success."
            },
            {
                "board": "CBSE",
                "grade": 10,
                "title": "CBSE Class 10 Board Excellence",
                "mode": "Offline Classroom + Online Resources",
                "description": "Intensive board-exam preparation, question banks, and regular mock assessments."
            },
            {
                "board": "CBSE",
                "grade": 11,
                "title": "CBSE Class 11 Science & Commerce",
                "mode": "Offline Classroom + Online Resources",
                "description": "Core concepts for competitive exam readiness (JEE, NEET, CUET) and school curriculum."
            },
            {
                "board": "CBSE",
                "grade": 12,
                "title": "CBSE Class 12 Board & Target",
                "mode": "Offline Classroom + Online Resources",
                "description": "Targeted revision, sample papers, derivations, and board exam answer-writing mastery."
            },
            {
                "board": "UP Board",
                "grade": 10,
                "title": "UP Board High School Super 40",
                "mode": "Offline Classroom + Hindi/English Notes",
                "description": "NCERT and UPMSP syllabus mastery with special doubt classes."
            },
            {
                "board": "UP Board",
                "grade": 12,
                "title": "UP Board Intermediate Target Batch",
                "mode": "Offline Classroom + Hindi/English Notes",
                "description": "In-depth Physics, Chemistry, and Mathematics preparation for UPMSP exams."
            }
        ]
    }

# --- ADMISSION ENQUIRIES ---

@app.post("/api/v1/admissions/enquiries", tags=["Admissions"])
def create_enquiry(data: EnquiryIn, db: Session = Depends(get_db)):
    board_name = "CBSE" if data.board == "CBSE" else "UP Board"
    enquiry = Enquiry(
        name=data.name.strip(),
        phone=data.phone.strip(),
        email=str(data.email).strip().lower() if data.email else None,
        board=board_name,
        grade_number=data.grade_number,
        message=data.message.strip() if data.message else None,
        status="new"
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return {
        "id": enquiry.id,
        "status": enquiry.status,
        "message": f"Thank you, {enquiry.name}! Your enquiry for Class {enquiry.grade_number} ({enquiry.board}) has been received. Our team will contact you soon."
    }

@app.get("/api/v1/admin/admissions", tags=["Admin Admissions"])
def list_enquiries(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    query = select(Enquiry)
    if status_filter:
        query = query.where(Enquiry.status == status_filter.lower())
    rows = db.scalars(query.order_by(Enquiry.created_at.desc())).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "phone": e.phone,
            "email": e.email,
            "board": e.board,
            "grade_number": e.grade_number,
            "message": e.message,
            "status": e.status,
            "created_at": e.created_at.isoformat() if e.created_at else None
        }
        for e in rows
    ]

@app.patch("/api/v1/admin/admissions/{enquiry_id}", tags=["Admin Admissions"])
def update_enquiry_status(
    enquiry_id: int,
    status_update: EnquiryStatusIn | None = Body(None),
    status_param: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    new_status = status_update.status if status_update else status_param
    if not new_status or new_status not in {"new", "contacted", "admitted", "closed"}:
        raise HTTPException(400, "Valid status must be: new, contacted, admitted, or closed")
    
    e = db.get(Enquiry, enquiry_id)
    if not e:
        raise HTTPException(404, "Enquiry not found")
    e.status = new_status
    db.commit()
    return {"id": e.id, "status": e.status, "message": f"Enquiry status updated to {e.status}"}

@app.delete("/api/v1/admin/admissions/{enquiry_id}", tags=["Admin Admissions"])
def delete_enquiry(
    enquiry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    e = db.get(Enquiry, enquiry_id)
    if not e:
        raise HTTPException(404, "Enquiry not found")
    db.delete(e)
    db.commit()
    return {"message": "Enquiry deleted successfully"}

# --- USER MANAGEMENT ---

@app.get("/api/v1/admin/users", tags=["Admin Users"])
def list_users(
    role: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    query = select(User)
    if role:
        query = query.where(User.role == role.lower())
    rows = db.scalars(query.order_by(User.created_at.desc())).all()
    return [user_out(u) for u in rows]

@app.post("/api/v1/admin/users", tags=["Admin Users"])
def create_user_by_admin(
    data: UserCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    clean_email = data.email.strip().lower()
    if db.scalar(select(User).where(User.email == clean_email)):
        raise HTTPException(409, "User email already registered")
    
    u = User(
        full_name=data.full_name.strip(),
        email=clean_email,
        password_hash=hash_password(data.password),
        phone=data.phone.strip() if data.phone else None,
        role=data.role,
        is_active=True
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return user_out(u)

@app.patch("/api/v1/admin/users/{user_id}/status", tags=["Admin Users"])
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    if user_id == user.id:
        raise HTTPException(400, "Cannot deactivate your own administrator account")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.is_active = not target.is_active
    db.commit()
    return {"id": target.id, "is_active": target.is_active}

@app.delete("/api/v1/admin/users/{user_id}", tags=["Admin Users"])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    if user_id == user.id:
        raise HTTPException(400, "Cannot delete your own administrator account")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    db.delete(target)
    db.commit()
    return {"message": f"User {target.full_name} deleted successfully"}

# --- BATCHES & ENROLLMENTS ---

@app.get("/api/v1/batches", tags=["Batches"])
def list_batches(
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    batches = db.scalars(select(Batch).order_by(Batch.id.desc())).all()
    result = []
    for b in batches:
        enrolled_count = db.scalar(
            select(func.count()).select_from(Enrollment).where(
                Enrollment.batch_id == b.id,
                Enrollment.status == "active"
            )
        ) or 0
        board = db.get(Board, b.board_id)
        grade = db.get(Grade, b.grade_id)
        year = db.get(AcademicYear, b.academic_year_id)
        result.append({
            "id": b.id,
            "name": b.name,
            "board_id": b.board_id,
            "board_name": board.name if board else "Unknown",
            "grade_id": b.grade_id,
            "grade_display": grade.display_name if grade else f"Class {b.grade_id}",
            "academic_year_id": b.academic_year_id,
            "academic_year": year.name if year else "",
            "mode": b.mode,
            "schedule_text": b.schedule_text,
            "capacity": b.capacity,
            "enrolled_count": enrolled_count,
            "is_active": b.is_active
        })
    return result

@app.post("/api/v1/admin/batches", tags=["Admin Batches"])
def create_batch(
    data: BatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    batch = Batch(
        name=data.name.strip(),
        board_id=data.board_id,
        grade_id=data.grade_id,
        academic_year_id=data.academic_year_id,
        mode="offline",
        schedule_text=data.schedule_text.strip() if data.schedule_text else None,
        capacity=data.capacity,
        is_active=True
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"id": batch.id, "name": batch.name, "capacity": batch.capacity}

@app.delete("/api/v1/admin/batches/{batch_id}", tags=["Admin Batches"])
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    batch.is_active = False
    db.commit()
    return {"message": "Batch deactivated successfully"}

@app.get("/api/v1/admin/batches/{batch_id}/students", tags=["Admin Batches"])
def get_batch_students(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    
    enrollments = db.scalars(
        select(Enrollment).where(Enrollment.batch_id == batch_id, Enrollment.status == "active")
    ).all()
    students = []
    for en in enrollments:
        s = db.get(User, en.student_id)
        if s:
            students.append({
                "enrollment_id": en.id,
                "student_id": s.id,
                "full_name": s.full_name,
                "email": s.email,
                "phone": s.phone,
                "joined_at": en.joined_at.isoformat() if en.joined_at else None
            })
    return {"batch": batch.name, "students": students}

@app.post("/api/v1/admin/enrollments", tags=["Admin Batches"])
def enroll_student(
    data: EnrollmentIn | None = Body(None),
    student_id: int | None = Query(None),
    batch_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    s_id = data.student_id if data else student_id
    b_id = data.batch_id if data else batch_id
    if not s_id or not b_id:
        raise HTTPException(400, "student_id and batch_id are required")
        
    student = db.get(User, s_id)
    batch = db.get(Batch, b_id)
    if not student or student.role != "student":
        raise HTTPException(404, "Student not found or user is not a student")
    if not batch or not batch.is_active:
        raise HTTPException(404, "Active batch not found")
        
    existing = db.scalar(
        select(Enrollment).where(Enrollment.student_id == s_id, Enrollment.batch_id == b_id)
    )
    if existing:
        if existing.status == "active":
            raise HTTPException(409, "Student is already enrolled in this batch")
        existing.status = "active"
        db.commit()
        return {"id": existing.id, "student_id": s_id, "batch_id": b_id, "status": "active"}
        
    count = db.scalar(
        select(func.count()).select_from(Enrollment).where(
            Enrollment.batch_id == b_id,
            Enrollment.status == "active"
        )
    ) or 0
    if count >= batch.capacity:
        raise HTTPException(409, f"Batch is full (capacity: {batch.capacity})")
        
    en = Enrollment(student_id=s_id, batch_id=b_id, status="active")
    db.add(en)
    db.commit()
    db.refresh(en)
    return {"id": en.id, "student_id": s_id, "batch_id": b_id, "status": en.status}

@app.delete("/api/v1/admin/enrollments/{enrollment_id}", tags=["Admin Batches"])
def unenroll_student(
    enrollment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    en = db.get(Enrollment, enrollment_id)
    if not en:
        raise HTTPException(404, "Enrollment not found")
    en.status = "inactive"
    db.commit()
    return {"message": "Student unenrolled successfully"}

# --- STUDY MATERIALS ---

@app.get("/api/v1/materials", tags=["Materials"])
def list_materials(
    board: str | None = None,
    grade: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    query = select(Material)
    if user.role == "student":
        query = query.where(Material.is_published == True)
        
    if board:
        b = db.scalar(select(Board).where(Board.code == board.upper()))
        if b:
            query = query.where(Material.board_id == b.id)
    if grade:
        g = db.scalar(select(Grade).where(Grade.grade_number == grade))
        if g:
            query = query.where(Material.grade_id == g.id)
    if subject_id:
        query = query.where(Material.subject_id == subject_id)
        
    rows = db.scalars(query.order_by(Material.created_at.desc())).all()
    
    if user.role == "student":
        enrolled = {
            e.batch_id for e in db.scalars(
                select(Enrollment).where(
                    Enrollment.student_id == user.id,
                    Enrollment.status == "active"
                )
            ).all()
        }
        rows = [m for m in rows if m.batch_id is None or m.batch_id in enrolled]
        
    result = []
    for m in rows:
        subj = db.get(Subject, m.subject_id)
        board_obj = db.get(Board, m.board_id)
        grade_obj = db.get(Grade, m.grade_id)
        result.append({
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "subject_id": m.subject_id,
            "subject_name": subj.name if subj else "General",
            "board_code": board_obj.code if board_obj else "CBSE",
            "grade_number": grade_obj.grade_number if grade_obj else 10,
            "material_type": m.material_type,
            "file_url": m.file_url,
            "batch_id": m.batch_id,
            "is_published": m.is_published,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return result

@app.post("/api/v1/admin/materials", tags=["Admin Materials"])
def create_material(
    data: MaterialIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    m = Material(**data.model_dump(), uploaded_by=user.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "title": m.title, "is_published": m.is_published}

@app.patch("/api/v1/admin/materials/{material_id}/toggle-publish", tags=["Admin Materials"])
def toggle_material_publish(
    material_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    m = db.get(Material, material_id)
    if not m:
        raise HTTPException(404, "Material not found")
    m.is_published = not m.is_published
    db.commit()
    return {"id": m.id, "is_published": m.is_published}

@app.delete("/api/v1/admin/materials/{material_id}", tags=["Admin Materials"])
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    m = db.get(Material, material_id)
    if not m:
        raise HTTPException(404, "Material not found")
    db.delete(m)
    db.commit()
    return {"message": "Material deleted successfully"}

# --- TESTS & ASSESSMENTS ---

@app.get("/api/v1/tests", tags=["Tests"])
def list_tests(
    board: str | None = None,
    grade: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    query = select(Test)
    if user.role == "student":
        query = query.where(Test.is_published == True)
        
    if board:
        b = db.scalar(select(Board).where(Board.code == board.upper()))
        if b:
            query = query.where(Test.board_id == b.id)
    if grade:
        g = db.scalar(select(Grade).where(Grade.grade_number == grade))
        if g:
            query = query.where(Test.grade_id == g.id)
    if subject_id:
        query = query.where(Test.subject_id == subject_id)
        
    rows = db.scalars(query.order_by(Test.created_at.desc())).all()
    
    if user.role == "student":
        enrolled = {
            e.batch_id for e in db.scalars(
                select(Enrollment).where(
                    Enrollment.student_id == user.id,
                    Enrollment.status == "active"
                )
            ).all()
        }
        rows = [t for t in rows if t.batch_id is None or t.batch_id in enrolled]
        
    result = []
    for t in rows:
        subj = db.get(Subject, t.subject_id)
        board_obj = db.get(Board, t.board_id)
        grade_obj = db.get(Grade, t.grade_id)
        try:
            questions = json.loads(t.questions_json)
        except Exception:
            questions = []
        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "subject_id": t.subject_id,
            "subject_name": subj.name if subj else "General",
            "board_code": board_obj.code if board_obj else "CBSE",
            "grade_number": grade_obj.grade_number if grade_obj else 10,
            "duration_minutes": t.duration_minutes,
            "total_marks": t.total_marks,
            "questions_count": len(questions),
            "is_published": t.is_published,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "questions": [
                {
                    "prompt": q["prompt"],
                    "options": q["options"],
                    "marks": q.get("marks", 1)
                }
                for q in questions
            ]
        })
    return result

@app.get("/api/v1/tests/{test_id}", tags=["Tests"])
def get_test_details(
    test_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    t = db.get(Test, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    questions = json.loads(t.questions_json)
    # Hide correct answers from students before attempting
    sanitized_questions = [
        {
            "prompt": q["prompt"],
            "options": q["options"],
            "marks": q.get("marks", 1)
        }
        for q in questions
    ] if user.role == "student" else questions

    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "duration_minutes": t.duration_minutes,
        "total_marks": t.total_marks,
        "is_published": t.is_published,
        "questions": sanitized_questions
    }

@app.post("/api/v1/admin/tests", tags=["Admin Tests"])
def create_test(
    data: TestIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    for idx, q in enumerate(data.questions):
        if q.correct_index >= len(q.options):
            raise HTTPException(422, f"Question {idx+1}: correct_index must refer to an existing option index")
            
    total = sum(q.marks for q in data.questions)
    t = Test(
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        board_id=data.board_id,
        grade_id=data.grade_id,
        subject_id=data.subject_id,
        batch_id=data.batch_id,
        duration_minutes=data.duration_minutes,
        total_marks=total,
        questions_json=json.dumps([q.model_dump() for q in data.questions]),
        is_published=data.is_published,
        created_by=user.id
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "title": t.title, "total_marks": t.total_marks, "is_published": t.is_published}

@app.patch("/api/v1/admin/tests/{test_id}/toggle-publish", tags=["Admin Tests"])
def toggle_test_publish(
    test_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    t = db.get(Test, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    t.is_published = not t.is_published
    db.commit()
    return {"id": t.id, "is_published": t.is_published}

@app.delete("/api/v1/admin/tests/{test_id}", tags=["Admin Tests"])
def delete_test(
    test_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "faculty"))
):
    t = db.get(Test, test_id)
    if not t:
        raise HTTPException(404, "Test not found")
    db.delete(t)
    db.commit()
    return {"message": "Test deleted successfully"}

# --- TEST ATTEMPTS & EVALUATION ---

@app.post("/api/v1/tests/{test_id}/attempts", tags=["Tests"])
def start_attempt(
    test_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student"))
):
    t = db.get(Test, test_id)
    if not t or not t.is_published:
        raise HTTPException(404, "Test not found or not published")
        
    if t.batch_id is not None:
        is_enrolled = db.scalar(
            select(Enrollment).where(
                Enrollment.student_id == user.id,
                Enrollment.batch_id == t.batch_id,
                Enrollment.status == "active"
            )
        )
        if not is_enrolled:
            raise HTTPException(403, "You are not enrolled in the batch assigned to this test")
            
    a = Attempt(test_id=test_id, student_id=user.id, status="in_progress")
    db.add(a)
    db.commit()
    db.refresh(a)
    
    questions = json.loads(t.questions_json)
    return {
        "attempt_id": a.id,
        "test": {
            "id": t.id,
            "title": t.title,
            "duration_minutes": t.duration_minutes,
            "total_marks": t.total_marks,
            "questions": [
                {
                    "prompt": q["prompt"],
                    "options": q["options"],
                    "marks": q.get("marks", 1)
                }
                for q in questions
            ]
        }
    }

@app.post("/api/v1/attempts/{attempt_id}/submit", tags=["Tests"])
def submit_attempt(
    attempt_id: int,
    data: AnswerIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student"))
):
    a = db.get(Attempt, attempt_id)
    if not a or a.student_id != user.id:
        raise HTTPException(404, "Attempt not found")
    if a.status == "submitted":
        raise HTTPException(409, "Attempt already submitted")
        
    t = db.get(Test, a.test_id)
    if not t:
        raise HTTPException(404, "Test not found")
        
    questions = json.loads(t.questions_json)
    score = 0
    valid_answers = {}
    
    for qid, answer in data.answers.items():
        try:
            idx = int(qid)
        except ValueError:
            raise HTTPException(422, "Question indexes must be integers")
        if idx < 0 or idx >= len(questions):
            raise HTTPException(422, f"Invalid question index: {idx}")
        if answer < 0 or answer >= len(questions[idx]["options"]):
            raise HTTPException(422, f"Invalid option index for question {idx}")
        valid_answers[str(idx)] = answer
        
    for idx, q in enumerate(questions):
        chosen = valid_answers.get(str(idx))
        if chosen is not None and chosen == q["correct_index"]:
            score += q.get("marks", 1)
            
    a.answers_json = json.dumps(valid_answers)
    a.score = score
    a.status = "submitted"
    a.submitted_at = datetime.now(timezone.utc)
    db.commit()
    
    percentage = round((score / t.total_marks) * 100, 1) if t.total_marks else 0
    return {
        "attempt_id": a.id,
        "score": score,
        "total_marks": t.total_marks,
        "percentage": percentage,
        "status": "submitted"
    }

@app.get("/api/v1/attempts/{attempt_id}", tags=["Tests"])
def get_attempt_review(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    a = db.get(Attempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt not found")
    if user.role == "student" and a.student_id != user.id:
        raise HTTPException(403, "You can only view your own attempts")
        
    t = db.get(Test, a.test_id)
    title = t.title if t else "Completed Test"
    questions = json.loads(t.questions_json) if t else []
    student_answers = json.loads(a.answers_json or "{}")
    
    breakdown = []
    for idx, q in enumerate(questions):
        user_choice = student_answers.get(str(idx))
        is_correct = (user_choice == q["correct_index"]) if user_choice is not None else False
        breakdown.append({
            "index": idx,
            "prompt": q["prompt"],
            "options": q["options"],
            "selected_option": user_choice,
            "correct_option": q["correct_index"],
            "is_correct": is_correct,
            "marks": q.get("marks", 1),
            "explanation": q.get("explanation")
        })
        
    return {
        "attempt_id": a.id,
        "test_id": a.test_id,
        "title": title,
        "score": a.score,
        "total_marks": t.total_marks if t else a.score,
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "breakdown": breakdown
    }

@app.get("/api/v1/students/me/results", tags=["Tests"])
def my_results(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student"))
):
    rows = db.scalars(
        select(Attempt).where(
            Attempt.student_id == user.id,
            Attempt.status == "submitted"
        ).order_by(Attempt.submitted_at.desc())
    ).all()
    
    result = []
    for a in rows:
        t = db.get(Test, a.test_id)
        result.append({
            "attempt_id": a.id,
            "test_id": t.id if t else None,
            "title": t.title if t else "Completed Test",
            "score": a.score,
            "total_marks": t.total_marks if t else a.score,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None
        })
    return result

# --- DOUBTS SYSTEM ---

@app.post("/api/v1/doubts", tags=["Doubts"])
def create_doubt(
    data: DoubtIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student"))
):
    subject = db.get(Subject, data.subject_id)
    if not subject:
        raise HTTPException(404, "Selected subject not found")
        
    d = Doubt(
        student_id=user.id,
        subject_id=data.subject_id,
        title=data.title.strip(),
        question_text=data.question_text.strip(),
        status="open"
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return {
        "id": d.id,
        "title": d.title,
        "status": d.status,
        "message": "Your doubt has been submitted. Faculty will review and respond soon!"
    }

@app.get("/api/v1/doubts", tags=["Doubts"])
def list_doubts(
    status_filter: str | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user)
):
    query = select(Doubt)
    if user.role == "student":
        query = query.where(Doubt.student_id == user.id)
    if status_filter:
        query = query.where(Doubt.status == status_filter.lower())
    if subject_id:
        query = query.where(Doubt.subject_id == subject_id)
        
    rows = db.scalars(query.order_by(Doubt.created_at.desc())).all()
    result = []
    for d in rows:
        subj = db.get(Subject, d.subject_id)
        student = db.get(User, d.student_id)
        result.append({
            "id": d.id,
            "student_id": d.student_id,
            "student_name": student.full_name if student else "Student",
            "student_email": student.email if student else "",
            "subject_id": d.subject_id,
            "subject_name": subj.name if subj else "General",
            "title": d.title,
            "question_text": d.question_text,
            "answer_text": d.answer_text,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })
    return result

@app.patch("/api/v1/doubts/{doubt_id}/answer", tags=["Doubts"])
def answer_doubt(
    doubt_id: int,
    data: DoubtAnswerIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("faculty", "admin"))
):
    d = db.get(Doubt, doubt_id)
    if not d:
        raise HTTPException(404, "Doubt not found")
    d.answer_text = data.answer_text.strip()
    d.status = data.status
    db.commit()
    return {
        "id": d.id,
        "status": d.status,
        "answer_text": d.answer_text,
        "message": "Answer saved and published to student."
    }

# --- DASHBOARDS ---

@app.get("/api/v1/students/me/dashboard", tags=["Dashboards"])
def student_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student"))
):
    enrollments = db.scalars(
        select(Enrollment).where(
            Enrollment.student_id == user.id,
            Enrollment.status == "active"
        )
    ).all()
    batch_ids = [e.batch_id for e in enrollments]
    batches = db.scalars(select(Batch).where(Batch.id.in_(batch_ids))).all() if batch_ids else []
    
    materials_count = db.scalar(
        select(func.count()).select_from(Material).where(Material.is_published == True)
    ) or 0
    
    available_tests_count = db.scalar(
        select(func.count()).select_from(Test).where(Test.is_published == True)
    ) or 0
    
    attempts = db.scalars(
        select(Attempt).where(
            Attempt.student_id == user.id,
            Attempt.status == "submitted"
        )
    ).all()
    
    avg_score = round(sum(a.score or 0 for a in attempts) / len(attempts), 1) if attempts else None
    open_doubts = db.scalar(
        select(func.count()).select_from(Doubt).where(
            Doubt.student_id == user.id,
            Doubt.status == "open"
        )
    ) or 0
    
    return {
        "student": user.full_name,
        "enrolled_batches": [
            {
                "id": b.id,
                "name": b.name,
                "schedule_text": b.schedule_text or "Standard Schedule",
                "mode": b.mode
            }
            for b in batches
        ],
        "completed_tests": len(attempts),
        "average_raw_score": avg_score,
        "available_materials_count": materials_count,
        "available_tests_count": available_tests_count,
        "open_doubts_count": open_doubts
    }

@app.get("/api/v1/faculty/dashboard", tags=["Dashboards"])
def faculty_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("faculty", "admin"))
):
    materials_count = db.scalar(select(func.count()).select_from(Material)) or 0
    tests_count = db.scalar(select(func.count()).select_from(Test)) or 0
    pending_doubts = db.scalar(
        select(func.count()).select_from(Doubt).where(Doubt.status == "open")
    ) or 0
    batches_count = db.scalar(select(func.count()).select_from(Batch).where(Batch.is_active == True)) or 0
    
    return {
        "faculty": user.full_name,
        "materials_count": materials_count,
        "tests_count": tests_count,
        "pending_doubts": pending_doubts,
        "active_batches": batches_count
    }

@app.get("/api/v1/admin/dashboard", tags=["Dashboards"])
def admin_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin"))
):
    return {
        "users": db.scalar(select(func.count()).select_from(User)) or 0,
        "students": db.scalar(select(func.count()).select_from(User).where(User.role == "student")) or 0,
        "faculty": db.scalar(select(func.count()).select_from(User).where(User.role == "faculty")) or 0,
        "enquiries": db.scalar(select(func.count()).select_from(Enquiry)) or 0,
        "batches": db.scalar(select(func.count()).select_from(Batch).where(Batch.is_active == True)) or 0,
        "materials": db.scalar(select(func.count()).select_from(Material)) or 0,
        "tests": db.scalar(select(func.count()).select_from(Test)) or 0,
        "doubts": db.scalar(select(func.count()).select_from(Doubt)) or 0
    }
