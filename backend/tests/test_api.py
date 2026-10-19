import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.session import Base, get_db
from app.models.entities import User, Board, Grade, AcademicYear, Subject, GradeBoardSubject
from app.core.security import hash_password

# Use an in-memory or dedicated SQLite database for testing
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    with TestingSessionLocal() as db:
        # Seed test admin, faculty, and student
        admin = User(
            full_name="Admin Test",
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_active=True
        )
        faculty = User(
            full_name="Faculty Test",
            email="faculty@test.com",
            password_hash=hash_password("FacultyPass123!"),
            role="faculty",
            is_active=True
        )
        student = User(
            full_name="Student Test",
            email="student@test.com",
            password_hash=hash_password("StudentPass123!"),
            role="student",
            is_active=True
        )
        db.add_all([admin, faculty, student])
        
        # Seed board, grade, year, subject
        board = Board(name="CBSE", code="CBSE", is_active=True)
        grade = Grade(grade_number=10, display_name="Class 10")
        year = AcademicYear(name="2026-27", is_active=True)
        subject = Subject(name="Science", code="SCI", is_active=True)
        db.add_all([board, grade, year, subject])
        db.flush()
        
        mapping = GradeBoardSubject(board_id=board.id, grade_id=grade.id, subject_id=subject.id)
        db.add(mapping)
        db.commit()
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def get_auth_token(email: str, password: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_programs():
    res = client.get("/api/v1/programs")
    assert res.status_code == 200
    assert "programs" in res.json()
    assert len(res.json()["programs"]) >= 2

def test_auth_and_registration():
    # Register new student
    res = client.post("/api/v1/auth/register", json={
        "full_name": "New Student",
        "email": "newstudent@test.com",
        "password": "Password123!",
        "phone": "+91 99999 88888"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == "newstudent@test.com"
    assert "access_token" in data

    # Login
    res_login = client.post("/api/v1/auth/login", json={
        "email": "newstudent@test.com",
        "password": "Password123!"
    })
    assert res_login.status_code == 200
    assert "access_token" in res_login.json()

def test_admission_enquiry_flow():
    # Public submits enquiry
    res = client.post("/api/v1/admissions/enquiries", json={
        "name": "Aarav Sharma",
        "phone": "+91 98765 00000",
        "email": "aarav@test.com",
        "board": "CBSE",
        "grade_number": 10,
        "message": "Need morning coaching batch"
    })
    assert res.status_code == 200
    enquiry_id = res.json()["id"]

    # Admin reads enquiry
    admin_token = get_auth_token("admin@test.com", "AdminPass123!")
    res_admin = client.get("/api/v1/admin/admissions", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    enquiries = res_admin.json()
    assert any(e["id"] == enquiry_id for e in enquiries)

    # Admin updates enquiry status
    res_patch = client.patch(
        f"/api/v1/admin/admissions/{enquiry_id}",
        json={"status": "contacted"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "contacted"

def test_batch_and_enrollment_flow():
    admin_token = get_auth_token("admin@test.com", "AdminPass123!")

    # Create batch
    res_batch = client.post("/api/v1/admin/batches", json={
        "name": "CBSE Class 10 Alpha Batch",
        "board_id": 1,
        "grade_id": 1,
        "academic_year_id": 1,
        "schedule_text": "Mon-Fri 8AM",
        "capacity": 30
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_batch.status_code == 200
    batch_id = res_batch.json()["id"]

    # Enroll student
    res_enroll = client.post("/api/v1/admin/enrollments", json={
        "student_id": 3,
        "batch_id": batch_id
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_enroll.status_code == 200
    assert res_enroll.json()["status"] == "active"

def test_materials_and_tests_flow():
    faculty_token = get_auth_token("faculty@test.com", "FacultyPass123!")
    student_token = get_auth_token("student@test.com", "StudentPass123!")

    # Faculty creates material
    res_mat = client.post("/api/v1/admin/materials", json={
        "title": "Science Chapter 1 Notes",
        "description": "Chemical reactions",
        "board_id": 1,
        "grade_id": 1,
        "subject_id": 1,
        "material_type": "notes",
        "file_url": "https://example.com/notes.pdf",
        "is_published": True
    }, headers={"Authorization": f"Bearer {faculty_token}"})
    assert res_mat.status_code == 200

    # Faculty creates test with explanation
    res_test = client.post("/api/v1/admin/tests", json={
        "title": "Science Chapter 1 Test",
        "description": "Chemical reactions quiz",
        "board_id": 1,
        "grade_id": 1,
        "subject_id": 1,
        "duration_minutes": 15,
        "is_published": True,
        "questions": [
            {
                "prompt": "What is the formula of water?",
                "options": ["H2O", "CO2", "NaCl", "O2"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "Water consists of 2 hydrogen and 1 oxygen atom."
            }
        ]
    }, headers={"Authorization": f"Bearer {faculty_token}"})
    assert res_test.status_code == 200
    test_id = res_test.json()["id"]

    # Student starts attempt
    res_start = client.post(f"/api/v1/tests/{test_id}/attempts", headers={"Authorization": f"Bearer {student_token}"})
    assert res_start.status_code == 200
    attempt_id = res_start.json()["attempt_id"]

    # Student submits answers
    res_submit = client.post(f"/api/v1/attempts/{attempt_id}/submit", json={
        "answers": {"0": 0}
    }, headers={"Authorization": f"Bearer {student_token}"})
    assert res_submit.status_code == 200
    data = res_submit.json()
    assert data["score"] == 2
    assert data["total_marks"] == 2

    # Student reviews attempt breakdown
    res_review = client.get(f"/api/v1/attempts/{attempt_id}", headers={"Authorization": f"Bearer {student_token}"})
    assert res_review.status_code == 200
    breakdown = res_review.json()["breakdown"]
    assert len(breakdown) == 1
    assert breakdown[0]["is_correct"] is True
    assert breakdown[0]["explanation"] == "Water consists of 2 hydrogen and 1 oxygen atom."

def test_doubts_flow():
    student_token = get_auth_token("student@test.com", "StudentPass123!")
    faculty_token = get_auth_token("faculty@test.com", "FacultyPass123!")

    # Student submits doubt
    res_doubt = client.post("/api/v1/doubts", json={
        "subject_id": 1,
        "title": "Why does iron rust?",
        "question_text": "Could you explain what causes iron to rust and how it can be prevented?"
    }, headers={"Authorization": f"Bearer {student_token}"})
    assert res_doubt.status_code == 200
    doubt_id = res_doubt.json()["id"]

    # Faculty lists doubts
    res_list = client.get("/api/v1/doubts", headers={"Authorization": f"Bearer {faculty_token}"})
    assert res_list.status_code == 200
    assert any(d["id"] == doubt_id for d in res_list.json())

    # Faculty answers doubt
    res_ans = client.patch(f"/api/v1/doubts/{doubt_id}/answer", json={
        "answer_text": "Iron reacts with oxygen and moisture to form hydrated ferric oxide. Paint or galvanize to prevent it.",
        "status": "answered"
    }, headers={"Authorization": f"Bearer {faculty_token}"})
    assert res_ans.status_code == 200
    assert res_ans.json()["status"] == "answered"
