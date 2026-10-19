# Sunil Sir Classes — Coaching Management & Academic Portal

A full-stack, production-grade coaching institute web application tailored for CBSE and UP Board students of Classes 9th, 10th, 11th, and 12th.

---

## 🌟 Key Features

### 1. 🎓 Public Portal & Admissions
- **Interactive Course Catalogue:** Class 9 to 12 curriculum for CBSE and UPMSP (UP Board).
- **Online Admission Enquiry:** Validated enquiry form with status tracking pipeline (`New`, `Contacted`, `Admitted`, `Closed`).
- **One-Click Demo Switcher:** Switch between Student, Faculty, and Admin roles directly from the interface.

### 2. 📚 Student Learning Experience
- **Study Materials Library:** Subject-wise categorized notes, formula sheets, worksheets, and NCERT revision guides.
- **Filter & Search:** Filter by Class (9–12), Board (CBSE / UP Board), Subject, or search by title.
- **Interactive Timed MCQ Engine:**
  - Live countdown timer with automatic submission on expiration.
  - Question navigation palette showing answered vs unanswered questions.
  - Custom option cards with single-click selection.
- **Detailed Test Review & Performance Analytics:**
  - Comprehensive question-by-question breakdown showing student choice vs correct answer.
  - Marks calculation and conceptual explanations for every question.
  - Complete history of past attempts with score percentages.
- **Doubts Clearing Hub:**
  - Ask doubts tagged to specific subjects (Maths, Science, etc.).
  - Track doubt status (`Open` vs `Answered`) and review faculty explanations.

### 3. 👨‍🏫 Faculty Workspace
- **Multi-Question Assessment Creator:** Dynamic question builder to create quizzes with custom options, marks, correct answer selector, and explanations.
- **Resource Publishing:** Upload and manage study notes, formula sheets, and worksheets.
- **Student Doubt Resolution:** Review open student questions and publish detailed answers.
- **Publication Management:** Toggle publish/draft state or delete materials and assessments.

### 4. 🛡️ Administrator Operations
- **Overview Dashboard:** Real-time analytics on total users, enrolled students, batches, enquiries, and doubts.
- **Admission Enquiries Pipeline:** Filter and update enquiry statuses in one click.
- **Batch Management:**
  - Create batches with custom schedules, academic years, and seat capacities.
  - Visual seat capacity progress bars (e.g. `12 / 40 seats filled`).
  - Enroll students into batches and manage active rosters.
- **User Account Management:** Add new student, faculty, or admin accounts; toggle active status; manage credentials.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT, Argon2 password hashing.
- **Database:** Automatic SQLite support (zero configuration needed) with seamless PostgreSQL compatibility.
- **Frontend:** React 19, TypeScript, Vite, Vanilla CSS design system (Plus Jakarta Sans & Manrope), Lucide React icons.

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create initial database and seed accounts:
python -m app.seed_admin
python -m app.seed_catalogue

# Start FastAPI development server:
uvicorn app.main:app --reload
```
API Documentation will be live at: **http://127.0.0.1:8000/docs**

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 🔑 Default Test Accounts

| Role | Email | Password |
|---|---|---|
| **Administrator (Sunil Sir)** | `admin@sunilsirclasses.example` | `SunilAdmin123!` |
| **Faculty (Er. Amit Sharma)** | `faculty@sunilsirclasses.example` | `SunilFaculty123!` |
| **Student (Rohan Verma)** | `student@sunilsirclasses.example` | `SunilStudent123!` |

*(Note: You can also click the quick demo buttons on the top bar or login page for instant 1-click access without typing passwords).*

---

## 🧪 Running Automated Tests

Run the comprehensive integration test suite:

```bash
cd backend
pytest -v tests/test_api.py
```
This tests authentication, admissions pipeline, batch management, student test engine, scoring, and doubts resolution.

---

## ⚙️ Database Configuration

By default, the backend runs out-of-the-box on local SQLite (`sunil_classes.db`).

To use PostgreSQL in production, update `backend/.env`:
```env
DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/sunil_classes
```
If PostgreSQL is unreachable, the engine gracefully falls back to SQLite so your development is never interrupted.
