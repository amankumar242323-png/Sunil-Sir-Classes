from __future__ import annotations
import json
from sqlalchemy import select
from app.db.session import Base, engine, SessionLocal
from app.models.entities import (
    Board, Grade, AcademicYear, Subject, GradeBoardSubject,
    Batch, Enrollment, Enquiry, Material, Test, Doubt, User
)
from app.seed_admin import seed_users

Base.metadata.create_all(bind=engine)

def seed():
    # Ensure admin, faculty, and student exist first to satisfy all foreign keys
    seed_users()

    with SessionLocal() as db:
        print("Seeding academic catalogue...")
        
        # 1. Boards
        cbse = db.scalar(select(Board).where(Board.code == "CBSE"))
        if not cbse:
            cbse = Board(name="Central Board of Secondary Education (CBSE)", code="CBSE", is_active=True)
            db.add(cbse)
            db.flush()
            
        up = db.scalar(select(Board).where(Board.code == "UPMSP"))
        if not up:
            up = Board(name="UP Board (Madhyamik Shiksha Parishad)", code="UPMSP", is_active=True)
            db.add(up)
            db.flush()

        # 2. Grades (9, 10, 11, 12)
        grades_map = {}
        for g_num in [9, 10, 11, 12]:
            grade = db.scalar(select(Grade).where(Grade.grade_number == g_num))
            if not grade:
                grade = Grade(grade_number=g_num, display_name=f"Class {g_num}")
                db.add(grade)
                db.flush()
            grades_map[g_num] = grade

        # 3. Academic Year
        year = db.scalar(select(AcademicYear).where(AcademicYear.name == "2026-27"))
        if not year:
            year = AcademicYear(name="2026-27", is_active=True)
            db.add(year)
            db.flush()

        # 4. Subjects
        subjects_data = [
            ("Mathematics", "MATH"),
            ("Science", "SCI"),
            ("Social Science", "SST"),
            ("English Language & Literature", "ENG-LIT"),
            ("Hindi Course-A", "HIN-A"),
            ("Physics", "PHY"),
            ("Chemistry", "CHEM"),
            ("Biology", "BIO"),
        ]
        subj_map = {}
        for name, code in subjects_data:
            s = db.scalar(select(Subject).where(Subject.code == code))
            if not s:
                s = Subject(name=name, code=code, is_active=True)
                db.add(s)
                db.flush()
            subj_map[code] = s

        # 5. Map subjects to grades & boards
        # Class 9 & 10
        for b in [cbse, up]:
            for g_num in [9, 10]:
                for code in ["MATH", "SCI", "SST", "ENG-LIT", "HIN-A"]:
                    s = subj_map[code]
                    exists = db.scalar(select(GradeBoardSubject).where(
                        GradeBoardSubject.board_id == b.id,
                        GradeBoardSubject.grade_id == grades_map[g_num].id,
                        GradeBoardSubject.subject_id == s.id
                    ))
                    if not exists:
                        db.add(GradeBoardSubject(
                            board_id=b.id,
                            grade_id=grades_map[g_num].id,
                            subject_id=s.id
                        ))
                        
        # Class 11 & 12
        for b in [cbse, up]:
            for g_num in [11, 12]:
                for code in ["PHY", "CHEM", "MATH", "BIO", "ENG-LIT"]:
                    s = subj_map[code]
                    exists = db.scalar(select(GradeBoardSubject).where(
                        GradeBoardSubject.board_id == b.id,
                        GradeBoardSubject.grade_id == grades_map[g_num].id,
                        GradeBoardSubject.subject_id == s.id
                    ))
                    if not exists:
                        db.add(GradeBoardSubject(
                            board_id=b.id,
                            grade_id=grades_map[g_num].id,
                            subject_id=s.id
                        ))
        db.flush()

        # Find admin/faculty users
        admin_user = db.scalar(select(User).where(User.role == "admin"))
        faculty_user = db.scalar(select(User).where(User.role == "faculty")) or admin_user
        student_user = db.scalar(select(User).where(User.role == "student"))

        creator_id = admin_user.id if admin_user else 1

        # 6. Batches
        batch_10_morn = db.scalar(select(Batch).where(Batch.name == "CBSE Class 10 Board Achievers (Morning)"))
        if not batch_10_morn:
            batch_10_morn = Batch(
                name="CBSE Class 10 Board Achievers (Morning)",
                board_id=cbse.id,
                grade_id=grades_map[10].id,
                academic_year_id=year.id,
                mode="offline",
                schedule_text="Mon-Sat · 07:00 AM - 09:00 AM",
                capacity=40,
                is_active=True
            )
            db.add(batch_10_morn)
            db.flush()

        batch_10_eve = db.scalar(select(Batch).where(Batch.name == "CBSE Class 10 Board Achievers (Evening)"))
        if not batch_10_eve:
            batch_10_eve = Batch(
                name="CBSE Class 10 Board Achievers (Evening)",
                board_id=cbse.id,
                grade_id=grades_map[10].id,
                academic_year_id=year.id,
                mode="offline",
                schedule_text="Mon-Sat · 04:30 PM - 06:30 PM",
                capacity=40,
                is_active=True
            )
            db.add(batch_10_eve)
            db.flush()

        batch_12_sci = db.scalar(select(Batch).where(Batch.name == "CBSE Class 12 Science Super 30"))
        if not batch_12_sci:
            batch_12_sci = Batch(
                name="CBSE Class 12 Science Super 30",
                board_id=cbse.id,
                grade_id=grades_map[12].id,
                academic_year_id=year.id,
                mode="offline",
                schedule_text="Daily · 05:00 PM - 08:00 PM (PCM/PCB)",
                capacity=30,
                is_active=True
            )
            db.add(batch_12_sci)
            db.flush()

        # 7. Student enrollment
        if student_user and batch_10_morn:
            already_enrolled = db.scalar(
                select(Enrollment).where(
                    Enrollment.student_id == student_user.id,
                    Enrollment.batch_id == batch_10_morn.id
                )
            )
            if not already_enrolled:
                db.add(Enrollment(student_id=student_user.id, batch_id=batch_10_morn.id, status="active"))
                db.flush()

        # 8. Study Materials
        materials_seed = [
            {
                "title": "Class 10 Science: Chemical Reactions & Equations Concept Notes",
                "description": "Comprehensive summary covering balancing equations, oxidation-reduction, corrosion, and NCERT in-text questions.",
                "board_id": cbse.id,
                "grade_id": grades_map[10].id,
                "subject_id": subj_map["SCI"].id,
                "material_type": "notes",
                "file_url": "https://ncert.nic.in/textbook/pdf/jesc101.pdf",
                "is_published": True
            },
            {
                "title": "Class 10 Mathematics: Real Numbers & Polynomials Formula Sheet",
                "description": "Essential theorems, zeroes of quadratic & cubic polynomials, division algorithm shortcuts.",
                "board_id": cbse.id,
                "grade_id": grades_map[10].id,
                "subject_id": subj_map["MATH"].id,
                "material_type": "formula_sheet",
                "file_url": "https://ncert.nic.in/textbook/pdf/jemh101.pdf",
                "is_published": True
            },
            {
                "title": "Class 10 Science: Acids, Bases & Salts Practice Worksheet",
                "description": "High-yield practice problems, pH value charts, and preparation of bleaching powder & plaster of Paris.",
                "board_id": cbse.id,
                "grade_id": grades_map[10].id,
                "subject_id": subj_map["SCI"].id,
                "material_type": "worksheet",
                "file_url": "https://ncert.nic.in/textbook/pdf/jesc102.pdf",
                "is_published": True
            },
            {
                "title": "Class 12 Physics: Electrostatics & Potential Derivation Guide",
                "description": "Gauss's law applications, electric dipole in uniform field, and parallel plate capacitor formulas.",
                "board_id": cbse.id,
                "grade_id": grades_map[12].id,
                "subject_id": subj_map["PHY"].id,
                "material_type": "notes",
                "file_url": "https://ncert.nic.in/textbook/pdf/leph101.pdf",
                "is_published": True
            }
        ]
        for m in materials_seed:
            existing_m = db.scalar(select(Material).where(Material.title == m["title"]))
            if not existing_m:
                db.add(Material(**m, uploaded_by=creator_id))
        db.flush()

        # 9. Practice Tests
        test_questions_sci = [
            {
                "prompt": "Which of the following chemical reactions is a displacement reaction?",
                "options": [
                    "Fe(s) + CuSO4(aq) → FeSO4(aq) + Cu(s)",
                    "CaO(s) + H2O(l) → Ca(OH)2(aq)",
                    "2H2(g) + O2(g) → 2H2O(l)",
                    "CaCO3(s) → CaO(s) + CO2(g)"
                ],
                "correct_index": 0,
                "marks": 2,
                "explanation": "Iron is more reactive than copper and displaces it from copper sulphate solution."
            },
            {
                "prompt": "What is the characteristic color of Ferrous Sulphate (FeSO4·7H2O) crystals?",
                "options": ["Pale Green", "Dark Blue", "Pure White", "Reddish Brown"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "Hydrated ferrous sulphate crystals are pale green in color."
            },
            {
                "prompt": "The respiration process occurring in human cells is classified as:",
                "options": ["Endothermic reaction", "Exothermic reaction", "Precipitation reaction", "Decomposition only"],
                "correct_index": 1,
                "marks": 2,
                "explanation": "Respiration breaks down glucose and releases energy, so it is an exothermic process."
            },
            {
                "prompt": "Rusting of iron in moist air is an example of which phenomenon?",
                "options": ["Corrosion & Redox Reaction", "Only Reduction", "Combustion", "Physical change"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "Iron reacts with oxygen and water to form hydrated ferric oxide (rust) via a redox process."
            },
            {
                "prompt": "When lead nitrate powder is heated in a dry test tube, the brown gas evolved is:",
                "options": ["NO (Nitric Oxide)", "NO2 (Nitrogen Dioxide)", "N2O (Nitrous Oxide)", "N2 (Nitrogen)"],
                "correct_index": 1,
                "marks": 2,
                "explanation": "Thermal decomposition of lead nitrate produces brown fumes of NO2 gas: 2Pb(NO3)2 → 2PbO + 4NO2 + O2."
            }
        ]

        test_questions_math = [
            {
                "prompt": "Find a quadratic polynomial whose zeroes are -3 and 4:",
                "options": ["x² - x - 12", "x² + x - 12", "x² - 7x + 12", "x² + 7x - 12"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "Sum of zeroes = -3 + 4 = 1. Product = (-3)(4) = -12. Polynomial = x² - (sum)x + product = x² - x - 12."
            },
            {
                "prompt": "What is the discriminant of the quadratic equation: 2x² - 4x + 3 = 0?",
                "options": ["-8", "8", "-16", "24"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "D = b² - 4ac = (-4)² - 4(2)(3) = 16 - 24 = -8. Since D < 0, roots are non-real."
            },
            {
                "prompt": "If the discriminant D > 0 and is NOT a perfect square, the roots are:",
                "options": ["Real, irrational and unequal", "Real and equal", "Rational and equal", "Purely imaginary"],
                "correct_index": 0,
                "marks": 2,
                "explanation": "When D > 0 is non-square, √D is irrational, hence roots are real, distinct and irrational."
            },
            {
                "prompt": "What is the degree of the zero polynomial P(x) = 0?",
                "options": ["0", "1", "Not defined", "Any real number"],
                "correct_index": 2,
                "marks": 2,
                "explanation": "By mathematical definition, the degree of the zero polynomial is undefined."
            }
        ]

        existing_sci_test = db.scalar(select(Test).where(Test.title.like("%Chemical Reactions%")))
        if not existing_sci_test:
            sci_test = Test(
                title="Class 10 Science: Chemical Reactions & Equations Mock Assessment",
                description="Timed board-level practice quiz covering key reaction types, balancing, and observations.",
                board_id=cbse.id,
                grade_id=grades_map[10].id,
                subject_id=subj_map["SCI"].id,
                duration_minutes=20,
                total_marks=sum(q["marks"] for q in test_questions_sci),
                questions_json=json.dumps(test_questions_sci),
                is_published=True,
                created_by=creator_id
            )
            db.add(sci_test)

        existing_math_test = db.scalar(select(Test).where(Test.title.like("%Real Numbers%")))
        if not existing_math_test:
            math_test = Test(
                title="Class 10 Mathematics: Polynomials & Quadratic Equations Quiz",
                description="Chapter-wise assessment on zeroes, discriminant, and nature of roots.",
                board_id=cbse.id,
                grade_id=grades_map[10].id,
                subject_id=subj_map["MATH"].id,
                duration_minutes=15,
                total_marks=sum(q["marks"] for q in test_questions_math),
                questions_json=json.dumps(test_questions_math),
                is_published=True,
                created_by=creator_id
            )
            db.add(math_test)

        # 10. Sample Doubt
        if student_user:
            existing_doubt = db.scalar(select(Doubt).where(Doubt.student_id == student_user.id))
            if not existing_doubt:
                d = Doubt(
                    student_id=student_user.id,
                    subject_id=subj_map["SCI"].id,
                    title="How to distinguish combination from decomposition reactions?",
                    question_text="Sir, could you explain how to easily identify whether a reaction is combination or decomposition with real-life examples?",
                    answer_text="In a combination reaction, 2 or more reactants unite into a single compound (e.g. C + O2 -> CO2). In decomposition, 1 single compound breaks into 2 or more products (e.g. heating CaCO3 -> CaO + CO2). They are exact inverses of each other!",
                    status="answered"
                )
                db.add(d)

        # 11. Sample Enquiries
        sample_enquiries = [
            ("Priya Sharma", "+91 98111 22334", "priya.s@example.com", "CBSE", 10, "Interested in joining the morning batch for Maths & Science board prep.", "new"),
            ("Aarav Patel", "+91 98222 33445", "aarav.p@example.com", "CBSE", 12, "Looking for Class 12 Physics & Chemistry coaching for board exams.", "contacted"),
            ("Vikas Kumar", "+91 98333 44556", "vikas.k@example.com", "UP Board", 10, "Seeking admission in UPMSP Class 10 Medhavi Batch.", "admitted")
        ]
        for name, phone, email, board_code, gr, msg, st in sample_enquiries:
            if not db.scalar(select(Enquiry).where(Enquiry.name == name)):
                db.add(Enquiry(
                    name=name,
                    phone=phone,
                    email=email,
                    board=board_code,
                    grade_number=gr,
                    message=msg,
                    status=st
                ))

        db.commit()
        print("[SUCCESS] Comprehensive academic catalogue, batches, materials, tests, and doubts seeded successfully!")

if __name__ == "__main__":
    seed()
