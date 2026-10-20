import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ILO_HOST: str = "192.168.8.53"
    ILO_USER: str = "Administrator"
    ILO_PASSWORD: str = ""
    ILO_SSL_VERIFY: bool = False
    ILO_TIMEOUT: int = 15
    SERVER_PORT: int = 8000
    SERVER_HOST: str = "0.0.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
