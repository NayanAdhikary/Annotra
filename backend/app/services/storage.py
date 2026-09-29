import os
import shutil
from abc import ABC, abstractmethod
from typing import BinaryIO
import boto3
from botocore.config import Config


class StorageBackend(ABC):
    @abstractmethod
    async def write(self, key: str, data: bytes) -> str: ...

    @abstractmethod
    async def stream_write(self, key: str, fileobj: BinaryIO) -> str: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def public_url(self, key: str) -> str: ...


class LocalStorage(StorageBackend):
    def __init__(self, root: str):
        self.root = root
        os.makedirs(root, exist_ok=True)

    def _path(self, key: str) -> str:
        p = os.path.join(self.root, key)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        return p

    async def write(self, key: str, data: bytes) -> str:
        with open(self._path(key), "wb") as f:
            f.write(data)
        return self.public_url(key)

    async def stream_write(self, key: str, fileobj: BinaryIO) -> str:
        with open(self._path(key), "wb") as f:
            shutil.copyfileobj(fileobj, f, length=1024 * 1024)
        return self.public_url(key)

    async def delete(self, key: str) -> None:
        try: os.remove(self._path(key))
        except FileNotFoundError: pass

    def public_url(self, key: str) -> str:
        return f"/static/{key}"


class S3Storage(StorageBackend):
    def __init__(self, endpoint: str, bucket: str, access_key: str,
                 secret_key: str, region: str, public_url: str):
        self.bucket = bucket
        self.public_base = public_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint or None,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region or "auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
        )

    async def write(self, key: str, data: bytes) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)
        return self.public_url(key)

    async def stream_write(self, key: str, fileobj: BinaryIO) -> str:
        self.client.upload_fileobj(fileobj, self.bucket, key)
        return self.public_url(key)

    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def public_url(self, key: str) -> str:
        if self.public_base:
            return f"{self.public_base}/{key}"
        return f"https://{self.bucket}.s3.amazonaws.com/{key}"


def get_storage() -> StorageBackend:
    from app.config import settings
    if settings.STORAGE_BACKEND == "s3":
        return S3Storage(
            endpoint=settings.S3_ENDPOINT,
            bucket=settings.S3_BUCKET,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            region=settings.S3_REGION,
            public_url=settings.S3_PUBLIC_URL,
        )
    return LocalStorage("/data")


storage = get_storage()
