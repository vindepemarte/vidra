# Alembic Migrations

Generate a new migration:

```bash
cd api
alembic revision --autogenerate -m "your message"
```

Apply migrations:

```bash
cd api
alembic upgrade head
```

Production recommendation:
- Set `AUTO_CREATE_TABLES=false` after the first Alembic baseline migration is deployed.
