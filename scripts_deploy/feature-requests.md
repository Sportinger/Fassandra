# Feature Requests & Improvements - Fassandra Theater Editor

**Datum**: 2025-10-13
**Status**: Zu implementieren

---

## 1. Cue-Typ Auswahl beibehalten

**Priorität**: Hoch
**Bereich**: Cue-Verwaltung

### Problem
Die letzte Auswahl des Cue-Typs (z.B. "Licht") wird nicht beibehalten. Bei jeder neuen Cue-Eingabe muss der Typ erneut ausgewählt werden.

### Anforderung
- Letzte Cue-Typ-Auswahl merken und als Vorauswahl beibehalten
- **Alternative**: Separate Buttons für jeden Cue-Typ anbieten (schnellerer Zugriff)

### Begründung
In 99% der Fälle werden Lichtcues eingefügt. Wiederholte Auswahl ist umständlich und in der Probe muss es schnell gehen.

---

## 2. Neue Cue-Typen & Symbole

**Priorität**: Mittel
**Bereich**: Cue-Typen

### 2a. Technikcues fehlen
- **Symbol-Vorschlag**: Hammer 🔨
- **Verwendung**: Schnürboden-Anweisungen, Umbauten, technische Abläufe

### 2b. Einruf-Cues für Inspizienten
- **Symbol-Vorschlag**: Megaphon 📢
- **Verwendung**: Einrufe für Verfolgerfahrer und andere Crew-Mitglieder

---

## 3. Cue-Nummerierung umbenennen

**Priorität**: Hoch
**Bereich**: Cue-Verwaltung

### Problem
- Die Umbenennung der Cue-Nummerierung ging zwischendurch, funktioniert jetzt nicht mehr
- Das Namensfeld ist sehr klein

### Anforderung
- Umbenennung wieder funktionsfähig machen
- **Namensfeld verbreitern**, damit mehr als ein Wort in der Kurzansicht lesbar ist

---

## 4. Ausgeklapptes Cue-Textfeld optimieren

**Priorität**: Mittel
**Bereich**: UI/UX

### Problem
Im ausgeklappten Textfeld werden Typ, Nummer und Name nochmal wiederholt (sind bereits in oberster Zeile sichtbar).

### Anforderung
- Wiederholungen entfernen
- Mehr Platz für **Stichwort + Zusatzangaben** zum Cue
- Fokus auf relevante Informationen auf den ersten Blick

---

## 5. Mehrere Worte als Stichwort markieren

**Priorität**: Hoch
**Bereich**: Stichwort-Markierung

### Problem
Derzeit kann nur ein einzelnes Wort als Stichwort markiert werden (z.B. nur "Die" statt "Die Marquise von O.").

### Anforderung
- **Multi-Word-Selektion** für Stichworte ermöglichen
- Beispiel: "Die Marquise von O." komplett markieren

### Begründung
- Auffälliger Rahmen wird größer und besser sichtbar
- Markantes Stichwort wird markiert, nicht nur der Artikel

---

## 6. Befehle mit ESC abbrechen

**Priorität**: Hoch
**Bereich**: Keyboard Shortcuts / UX

### Problem
- Wenn man doch kein Cue einfügen will, kommt man nicht mehr raus
- Aktuell: Man muss ein Wort markieren und den Cue direkt wieder löschen (umständlich)
- Beim Szenenunterteiler-Befehl: Unklar, wie man den Befehl abbricht oder rückgängig macht

### Anforderung
- **ESC-Taste** zum Abbrechen von Befehlen implementieren
- Gilt für: Cue-Erstellung, Szenenunterteiler, etc.

---

## 7. Symbol-Konflikt: Szenenunterteiler vs. Video-Cues

**Priorität**: Mittel
**Bereich**: Icons/Symbole

### Problem
Szenenunterteiler und Video-Cues haben das gleiche Symbol → verwirrend

### Lösung
- **Video-Symbol ändern** zu Kamera-Symbol 🎥
- Szenenunterteiler behält aktuelles Symbol

---

## 8. Szenenauswahl immer sichtbar

**Priorität**: Hoch
**Bereich**: Navigation / UI

### Problem
Wechsel zwischen Szenenauswahl und Cue-Ansicht ist lästig

### Anforderung
- **Szenenauswahl permanent sichtbar** machen (z.B. als Sidebar oder Dropdown)
- Schnelles Springen zwischen Szenen in Proben
- Auf einen Blick sehen, in welchem Cue gesprungen werden muss

### Begründung
In Proben wird häufig hin und her gesprungen. Schnelle Navigation ist essentiell.

---

## 9. Cues gehen bei Textaktualisierung verloren

**Priorität**: **KRITISCH** 🔴
**Bereich**: Daten-Persistenz / Yjs Sync

### Problem
Nach der Probe wurde der Text aktualisiert und alle eingetragenen Cues waren weg.

### Status
Aktuell kein Problem (erste Erprobungsphase), aber **darf später nicht passieren**.

### Anforderung
- **Cue-Daten persistent speichern** unabhängig von Textänderungen
- Beim Textupdate: Cues mit ihren Stichwort-Positionen erhalten
- **Konflikt-Strategie** entwickeln:
  - Was passiert, wenn Stichwort gelöscht wird?
  - Cue an anderer Position verankern oder Warnung anzeigen?

### Technische Überlegungen
- Yjs-Dokument-Struktur prüfen
- Cues als separate Annotations/Marks speichern?
- Referenzierung über Textpositionen vs. Stichwort-IDs

---

## Zusammenfassung nach Priorität

### 🔴 Kritisch
- [ ] **#9**: Cues gehen bei Textaktualisierung verloren

### 🟠 Hoch
- [ ] **#1**: Cue-Typ Auswahl beibehalten
- [ ] **#3**: Cue-Nummerierung umbenennen + Namensfeld verbreitern
- [ ] **#5**: Mehrere Worte als Stichwort markieren
- [ ] **#6**: Befehle mit ESC abbrechen
- [ ] **#8**: Szenenauswahl immer sichtbar

### 🟡 Mittel
- [ ] **#2**: Neue Cue-Typen & Symbole (Technik, Einrufe)
- [ ] **#4**: Ausgeklapptes Cue-Textfeld optimieren
- [ ] **#7**: Symbol-Konflikt: Szenenunterteiler vs. Video-Cues

---

## Nächste Schritte

1. Kritisches Issue #9 sofort angehen (Daten-Persistenz)
2. Hohe Priorität: UX-Verbesserungen für Probe-Situation (#1, #6, #8)
3. Mittlere Priorität: Neue Features und Symbol-Verbesserungen

---

**Notizen für Entwicklung:**
- Frontend: `/home/admin/Desktop/Fassandra/frontend/src/components/`
- Cue-Logik vermutlich in Editor-Komponente
- Yjs-Persistenz: Backend `/home/admin/Desktop/Fassandra/backend/src/services/`
