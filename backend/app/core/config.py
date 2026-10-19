from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Sunil Sir Classes API"
    database_url: str = "sqlite:///./sunil_classes.db"
    secret_key: str = "development-only-change-me-sunil-sir-classes-super-secret"
    access_token_minutes: int = 1440  # 24 hours for comfortable session
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    admin_email: str = "admin@sunilsirclasses.example"
    admin_password: str = "SunilAdmin123!"
    faculty_email: str = "faculty@sunilsirclasses.example"
    faculty_password: str = "SunilFaculty123!"
    student_email: str = "student@sunilsirclasses.example"
    student_password: str = "SunilStudent123!"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
