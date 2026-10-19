from __future__ import annotations
from sqlalchemy import select
from app.db.session import Base, engine, SessionLocal
from app.models.entities import User
from app.core.config import settings
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)

def seed_users():
    with SessionLocal() as db:
        users_to_seed = [
            (
                "Sunil Sir (Director & Head Faculty)",
                settings.admin_email.lower(),
                settings.admin_password,
                "admin",
                "+91 98765 43210"
            ),
            (
                "Er. Amit Sharma (Senior Faculty - Physics & Maths)",
                settings.faculty_email.lower(),
                settings.faculty_password,
                "faculty",
                "+91 98765 43211"
            ),
            (
                "Rohan Verma (Class 10 Student)",
                settings.student_email.lower(),
                settings.student_password,
                "student",
                "+91 98765 43212"
            )
        ]
        
        for name, email, password, role, phone in users_to_seed:
            existing = db.scalar(select(User).where(User.email == email))
            if existing:
                print(f"[OK] {role.capitalize()} already exists: {email}")
            else:
                u = User(
                    full_name=name,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                    phone=phone,
                    is_active=True
                )
                db.add(u)
                db.commit()
                print(f"[CREATED] {role.capitalize()}: {email} (Password: {password})")

if __name__ == "__main__":
    seed_users()
