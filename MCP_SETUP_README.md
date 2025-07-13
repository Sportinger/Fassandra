# MCP (Model Context Protocol) Setup for Cursor

## ⚠️ IMPORTANT WARNING

**DO NOT USE `@just-every/mcp-deep-search`** - This package has a critical bug that causes it to spawn multiple processes that consume 100% CPU each, creating a CPU overload situation. We have removed this server from the configuration.

For web search capabilities, use the built-in `web_search` tool instead or wait for a more stable MCP web search server.

## Overview

This document provides a comprehensive guide for setting up MCP (Model Context Protocol) servers in Cursor. MCP allows Cursor to connect to external tools and services to extend its capabilities.

## 🚀 Installierte MCP Server

### 1. **Playwright MCP** (`@playwright/mcp@0.0.29`)
- **Funktionen**: Browser-Automatisierung mit Vision-Unterstützung
- **Verwendung**: UI-Testing und -Iteration
- **Konfiguration**: Zwei Modi verfügbar:
  - `playwright-vision`: Mit Screenshot-Analyse
  - `playwright-test`: Ohne Vision für präzise Tests

### 2. **Database MCP** (`@ahmetbarut/mcp-database-server`)
- **Funktionen**: **Direkter PostgreSQL-Datenbankzugriff**
- **Verbindung**: Pessoa PostgreSQL-Datenbank (`localhost:5432/pessoa_db`)
- **Verwendung**: SQL-Queries direkt ausführen, Daten verifizieren
- **Credentials**: Automatisch konfiguriert für Pessoa

### 3. **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`)
- **Funktionen**: Dateisystem-Zugriff
- **Berechtigung**: `/home/admins/projects/pessoa`
- **Verwendung**: Dateien lesen, schreiben, verwalten

### 4. **Puppeteer MCP** (`@hisma/server-puppeteer`)
- **Funktionen**: Browser-Automatisierung
- **Konfiguration**: Headless-Modus deaktiviert für bessere Sichtbarkeit
- **Verwendung**: Erweiterte Browser-Interaktionen

### 5. **Sequential Thinking MCP** (`@modelcontextprotocol/server-sequential-thinking`)
- **Funktionen**: Strukturiertes Denken und Problemlösung
- **Verwendung**: Komplexe Aufgaben in Schritte aufteilen

## 📋 Verfügbare Funktionen

### ✅ **Playwright Vision**
- Live Console Logs lesen
- Network Requests monitoren
- Screenshots für UI-Analyse
- Direkte Element-Selektion
- Automatisierte Tests

### ✅ **Database Integration** 🆕
- **Direkte SQL-Queries** auf PostgreSQL
- **Echtzeit-Datenverifikation**
- **Tabellen-Inspektion**
- **Daten-Monitoring**

### ✅ **Filesystem Access**
- Dateien lesen und schreiben
- Verzeichnisse durchsuchen
- Datei-Operationen

### ✅ **Browser Automation**
- Puppeteer für erweiterte Browser-Kontrolle
- WebSocket-Verbindungen testen
- Formular-Automatisierung

### ✅ **Sequential Thinking**
- Strukturierte Problemlösung
- Schritt-für-Schritt-Analyse
- Komplexe Aufgaben aufteilen

## 🔧 Konfiguration

### MCP Server Konfiguration (`mcp.json`)
```json
{
  "mcpServers": {
    "playwright-vision": {
      "command": "npx",
      "args": [
        "@playwright/mcp@0.0.29",
        "--config=playwright.config.js",
        "--vision"
      ]
    },
    "playwright-test": {
      "command": "npx",
      "args": [
        "@playwright/mcp@0.0.29",
        "--config=playwright.config.js"
      ]
    },
    "database": {
      "command": "npx",
      "args": ["-y", "@ahmetbarut/mcp-database-server"],
      "env": {
        "DB_TYPE": "postgres",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "pessoa_db",
        "DB_USER": "pessoa_user",
        "DB_PASSWORD": "dev_password_123"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_DIRECTORIES": "/home/admins/projects/pessoa"
      }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@hisma/server-puppeteer"],
      "env": {
        "PUPPETEER_HEADLESS": "false"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

## 🎯 **Database MCP Workflow** - Genau was Sie wollten! 

### **Kompletter Workflow mit Datenbank-Verifikation:**

1. **Playwright MCP**: Login → Script erstellen → Editor öffnen → Inhalt schreiben
2. **Database MCP**: Direkte Datenbank-Überprüfung mit SQL-Queries

### **Verwendung in Cursor:**
```
"Führe den kompletten Pessoa-Workflow aus: 
1. Nutze Playwright MCP für Login auf https://192.168.2.111:8443/
2. Erstelle ein neues Script
3. Schreibe etwas in den Editor
4. Nutze Database MCP um zu überprüfen, ob der Inhalt in der Datenbank angekommen ist"
```

### **Wichtige SQL-Queries für Database MCP:**

```sql
-- Prüfe neueste Scripts
SELECT id, title, created_at FROM scripts ORDER BY created_at DESC LIMIT 5;

-- Prüfe Script-Inhalte (Blocks)
SELECT script_id, content, created_at FROM blocks ORDER BY created_at DESC LIMIT 5;

-- Prüfe WebSocket-Aktivität (Yjs Updates)
SELECT script_id, user_id, created_at FROM yjs_document_updates ORDER BY created_at DESC LIMIT 10;

-- Prüfe Content-Snapshots
SELECT script_id, content_snapshot, last_snapshot_at FROM script_snapshots_meta ORDER BY last_snapshot_at DESC LIMIT 5;
```

### Playwright Konfiguration (`playwright.config.js`)
- **Ziel-URL**: `https://192.168.2.111:8443`
- **Viewport**: 700x900 (optimiert für Sichtbarkeit)
- **Anti-Bot-Maßnahmen**: Aktiviert
- **SSL**: Ignoriert (für lokale Entwicklung)

## 🧪 Testing

### Verfügbare Tests
```bash
# Vollständiger Workflow-Test
npx playwright test tests/pessoa-full-workflow.spec.js

# Database MCP Test (mit SQL-Queries)
npx playwright test tests/database-mcp-test.spec.js

# Alle Tests ausführen
npx playwright test

# Tests mit UI
npx playwright test --ui
```

### Test-Szenarien
1. **Application Load**: Prüft ob Pessoa lädt
2. **Login Flow**: Testet Anmeldung mit `a@b.c`
3. **Script Creation**: Erstellt neue Scripts
4. **Database Verification**: **Direkte SQL-Queries zur Datenbank**
5. **WebSocket Testing**: Testet Echtzeit-Kollaboration

## 🔍 Verwendung in Cursor

### **Für Database-Verifikation** 🆕
```
"Nutze Database MCP um zu überprüfen, ob neue Scripts in der Datenbank gespeichert wurden. Führe diese Query aus: SELECT * FROM scripts ORDER BY created_at DESC LIMIT 5;"
```

### Für UI-Iteration
```
"Bitte verwende Playwright MCP um die UI zu betrachten. Identifiziere Verbesserungsmöglichkeiten und iteriere bis die UI perfekt aussieht. Stelle sicher, dass die Browser-Breite in MCP auf 700px eingestellt ist."
```

### Für Automatisierte Tests
```
"Verwende Playwright MCP um die Anwendung zu testen. Teste zuerst die Anmeldung und dann ob Benutzer erfolgreich Todos hinzufügen und als erledigt markieren können."
```

### **Für Vollständigen Workflow** 🆕
```
"Führe den kompletten Pessoa-Test aus: Login, Script erstellen, Editor öffnen, Inhalt schreiben, und dann mit Database MCP überprüfen ob alles in der Datenbank angekommen ist."
```

## 📊 Monitoring und Debugging

### **Database Monitoring** 🆕
- **Direkte SQL-Queries** zur PostgreSQL-Datenbank
- **Echtzeit-Datenverifikation**
- **Tabellen-Inspektion**
- **Performance-Monitoring**

### Live Console Logs
- Playwright MCP kann Console-Logs der Anwendung lesen
- Netzwerk-Requests werden überwacht
- WebSocket-Verbindungen werden verfolgt

### Element-Inspektion
- Direkte Element-Selektion möglich
- CSS-Selektoren werden generiert
- Interaktive Debugging-Möglichkeiten

## 🚨 Troubleshooting

### **Database MCP Troubleshooting** 🆕

1. **Verbindungsfehler**
   - Prüfe ob PostgreSQL Container läuft: `docker compose ps`
   - Teste Verbindung: `psql -h localhost -p 5432 -U pessoa_user -d pessoa_db`

2. **Authentifizierung**
   - Credentials sind in `mcp.json` konfiguriert
   - Standard: `pessoa_user` / `dev_password_123`

3. **Tabellen nicht gefunden**
   - Prüfe Migrationen: `docker compose logs backend`
   - Verfügbare Tabellen: `\dt` in psql

### Häufige Probleme

1. **Node.js Version**
   - Einige Pakete benötigen Node.js 20+
   - Aktuelle Version: 18.19.1
   - Funktioniert trotzdem mit Warnungen

2. **SSL-Zertifikate**
   - Für lokale Entwicklung ignoriert
   - Konfiguration in `playwright.config.js`

3. **WebSocket-Verbindungen**
   - Prüfe Backend-Logs für WebSocket-Errors
   - Teste mit `docker compose logs backend`

### Logs prüfen
```bash
# Backend-Logs
docker compose logs backend --tail 20

# Frontend-Logs  
docker compose logs frontend --tail 20

# Database-Logs
docker compose logs db --tail 20

# MCP-Tests ausführen
npx playwright test --headed
```

## 🎯 Next Steps

1. **Aktiviere alle MCP Server in Cursor**
   - Verwende die `mcp.json` Konfiguration
   - Teste die verschiedenen Server

2. **Nutze Database MCP für Echtzeit-Verifikation**
   - Führe SQL-Queries direkt aus
   - Überwache Datenbank-Aktivität

3. **Erweitere Test-Suite**
   - Füge weitere Test-Szenarien hinzu
   - Teste spezifische Pessoa-Features

4. **Monitoring einrichten**
   - Verwende MCP für Live-Monitoring
   - Implementiere Error-Tracking

## 🎉 **Perfekte Lösung für Ihren Workflow!**

**Jetzt können Sie:**
- ✅ **Playwright MCP**: Vollständigen UI-Workflow durchführen
- ✅ **Database MCP**: Direkt in der Datenbank überprüfen
- ✅ **Echtzeit-Verifikation**: Sehen ob Daten ankommen
- ✅ **SQL-Queries**: Direkte Datenbankabfragen

**Genau was Sie wollten: Login → Script erstellen → Editor → Datenbank checken!** 🚀 