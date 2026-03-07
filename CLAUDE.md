# SSH Server Access

SSH-Verbindung zu fassandra.de ist verfügbar und funktioniert.

```bash
ssh fassandra.de        # als admin
```

## Server Stack (Stand: 2025-12-09)

| Komponente | Version |
|------------|---------|
| Ubuntu | 24.04.3 LTS |
| Docker | 29.1.2 |
| Docker Compose | 5.0.0 |
| PostgreSQL | 17.7 |
| Node.js | 22.21.0 |
| Rust | 1.83.0 |
| Claude Code | 2.0.62 |

## Local Development (ohne Docker)

Der Benutzer führt Fassandra lokal ohne Docker aus, um Speicher zu sparen (~6GB).

**Backend starten:**
```bash
cd backend && ./run-local.sh
```
- Rust app auf Port 3000
- Verbindet zu lokalem PostgreSQL: `localhost:5432/fassandra_db`

**Frontend starten:**
```bash
cd frontend && ./run-local.sh
```
- Vite dev server zeigt auf `http://localhost:3000`

**Voraussetzung:** Lokale PostgreSQL-Installation mit `fassandra_db` Datenbank.
