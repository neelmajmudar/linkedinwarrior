from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    APIFY_API_TOKEN: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    UNIPILE_DSN: str = "https://api1.unipile.com:13111"
    UNIPILE_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    REDIS_URL: str = "redis://localhost:6379/0"
    UNIPILE_WEBHOOK_SECRET: str = ""

    model_config = {"env_file": ("backend/.env", ".env"), "extra": "ignore"}


settings = Settings()
