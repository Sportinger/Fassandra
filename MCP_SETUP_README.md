# MCP Server Setup für Pessoa

## 🚀 Installierte MCP Server

### 1. **Playwright MCP** (`@playwright/mcp@0.0.29`)
- **Funktionen**: Browser-Automatisierung mit Vision-Unterstützung
- **Verwendung**: UI-Testing und -Iteration
- **Konfiguration**: Zwei Modi verfügbar:
  - `playwright-vision`: Mit Screenshot-Analyse
  - `playwright-test`: Ohne Vision für präzise Tests

### 2. **Filesystem MCP** (`@modelcontextprotocol/server-filesystem`)
- **Funktionen**: Dateisystem-Zugriff
- **Berechtigung**: `/home/admins/projects/pessoa`
- **Verwendung**: Dateien lesen, schreiben, verwalten

### 3. **Puppeteer MCP** (`@hisma/server-puppeteer`)
- **Funktionen**: Browser-Automatisierung
- **Konfiguration**: Headless-Modus deaktiviert für bessere Sichtbarkeit
- **Verwendung**: Erweiterte Browser-Interaktionen

### 4. **Sequential Thinking MCP** (`@modelcontextprotocol/server-sequential-thinking`)
- **Funktionen**: Strukturiertes Denken und Problemlösung
- **Verwendung**: Komplexe Aufgaben in Schritte aufteilen

## 📋 Verfügbare Funktionen

### ✅ **Playwright Vision**
- Live Console Logs lesen
- Network Requests monitoren
- Screenshots für UI-Analyse
- Direkte Element-Selektion
- Automatisierte Tests

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

### Playwright Konfiguration (`playwright.config.js`)
- **Ziel-URL**: `https://192.168.2.111:8443`
- **Viewport**: 700x900 (optimiert für Sichtbarkeit)
- **Anti-Bot-Maßnahmen**: Aktiviert
- **SSL**: Ignoriert (für lokale Entwicklung)

## 🧪 Testing

### Verfügbare Tests
```bash
# Einzelnen Test ausführen
npx playwright test tests/mcp-test.spec.js

# Alle Tests ausführen
npx playwright test

# Tests mit UI
npx playwright test --ui
```

### Test-Szenarien
1. **Application Load**: Prüft ob Pessoa lädt
2. **Login Flow**: Testet Anmeldung mit `a@b.c`
3. **Script Creation**: Erstellt neue Scripts
4. **WebSocket Testing**: Testet Echtzeit-Kollaboration

## 🔍 Verwendung in Cursor

### Für UI-Iteration
```
"Bitte verwende Playwright MCP um die UI zu betrachten. Identifiziere Verbesserungsmöglichkeiten und iteriere bis die UI perfekt aussieht. Stelle sicher, dass die Browser-Breite in MCP auf 700px eingestellt ist."
```

### Für Automatisierte Tests
```
"Verwende Playwright MCP um die Anwendung zu testen. Teste zuerst die Anmeldung und dann ob Benutzer erfolgreich Todos hinzufügen und als erledigt markieren können."
```

### Für Dateisystem-Operationen
```
"Verwende das Filesystem MCP um die Projektdateien zu analysieren und Änderungen vorzunehmen."
```

## 📊 Monitoring und Debugging

### Live Console Logs
- Playwright MCP kann Console-Logs der Anwendung lesen
- Netzwerk-Requests werden überwacht
- WebSocket-Verbindungen werden verfolgt

### Element-Inspektion
- Direkte Element-Selektion möglich
- CSS-Selektoren werden generiert
- Interaktive Debugging-Möglichkeiten

## 🚨 Troubleshooting

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

# MCP-Tests ausführen
npx playwright test --headed
```

## 🎯 Next Steps

1. **Aktiviere MCP Server in Cursor**
   - Verwende die `mcp.json` Konfiguration
   - Teste die verschiedenen Server

2. **Erweitere Test-Suite**
   - Füge weitere Test-Szenarien hinzu
   - Teste spezifische Pessoa-Features

3. **Monitoring einrichten**
   - Verwende MCP für Live-Monitoring
   - Implementiere Error-Tracking

Die MCP-Server sind jetzt bereit für die Verwendung! 🎉 