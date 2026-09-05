# PostgreSQL Setup Plan

PostgreSQL is not required to run the current offline frontend. Set it up on the personal laptop before backend sync work begins.

## Personal Mac Setup

```bash
brew install postgresql@16
brew services start postgresql@16
createdb smkg_inventory
psql -d smkg_inventory
```

Verify inside `psql`:

```sql
SELECT current_database();
```

Exit with `\q`. Use `brew services list` to verify PostgreSQL is running.

## Connection Configuration

The future backend should have an uncommitted `backend/.env` file:

```env
DATABASE_URL=postgresql+psycopg://YOUR_MAC_USERNAME@localhost:5432/smkg_inventory
```

Use `whoami` on the personal laptop to find `YOUR_MAC_USERNAME`. Commit only `backend/.env.example`, never `.env` or credentials.

## Operational Model

The personal laptop must be powered on and FastAPI/PostgreSQL must be running only when syncing. The PWA continues product and sales work offline while it is unavailable.
