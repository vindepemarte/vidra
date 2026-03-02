from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from vidra_api.config import settings


def _build_fernet_key() -> bytes:
    if settings.app_encryption_key:
        key = settings.app_encryption_key.strip().encode("utf-8")
        try:
            Fernet(key)
            return key
        except Exception:
            pass

    digest = hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    return Fernet(_build_fernet_key())


def encrypt_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def mask_secret(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]}"
