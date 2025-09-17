import React from 'react';

const Privacy: React.FC = () => (
  <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px' }}>
    <h1>Datenschutzerklärung</h1>
    <p>Stand: {new Date().toLocaleDateString()}</p>
    <h2>Verantwortlicher</h2>
    <p>Roman Kuskowski, mail@romankuskowski.de</p>
    <h2>Verarbeitete Daten</h2>
    <ul>
      <li>Kontodaten: E‑Mail, Benutzername, Passwort‑Hash</li>
      <li>Nutzungsdaten: IP‑Adresse, Zeitstempel, Log‑Einträge</li>
      <li>Inhaltsdaten: Skripte, Kollaboration (Yjs‑Updates/Awareness)</li>
    </ul>
    <h2>Zwecke & Rechtsgrundlagen</h2>
    <ul>
      <li>Bereitstellung & Login: Vertragserfüllung (Art. 6 Abs.1 b DSGVO)</li>
      <li>Sicherheit/Logs: Berechtigtes Interesse (Art. 6 Abs.1 f DSGVO)</li>
      <li>Analytics (falls aktiv): Einwilligung (Art. 6 Abs.1 a DSGVO)</li>
    </ul>
    <h2>Empfänger / Dritte</h2>
    <p>Auftragsverarbeiter: Hetzner GmbH (Hosting). Dritte: Google Ireland Ltd. (Login per Google). Kein externer E‑Mail‑Dienst im Einsatz. Kein externes Analytics aktiv.</p>
    <h2>Login mit Google</h2>
    <p>Beim Login mit Google werden Ihre E‑Mail‑Adresse und ggf. Basis‑Profildaten verarbeitet. Google handelt hier als eigener Verantwortlicher (kein AV‑Vertrag erforderlich). Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs.1 b DSGVO) für das Nutzerkonto; soweit Google eigene Zwecke verfolgt, Einwilligung/Interessenabwägung bei Google. Hinweis: Durch Klick auf den Google‑Button können Daten an Google übermittelt werden.</p>
    <p>Mögliche Datenübermittlung in Drittländer (insb. USA). Schutz durch EU‑Standardvertragsklauseln. Details: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>.</p>
    <h2>Speicherdauer</h2>
    <ul>
      <li>Kontodaten und Inhalte: bis zur Kontolöschung durch Nutzer</li>
      <li>Yjs‑Zwischenupdates: bis zu 2 Stunden (technische Pufferung/Kompaktierung); kompaktierter Zustand bleibt bis zur Löschung des Inhalts</li>
      <li>Cookies: auth_token/csrf_token jeweils bis zu 7 Tage</li>
      <li>Sonstige Protokolle: nur soweit für Betrieb/Sicherheit erforderlich; anschließend Löschung</li>
    </ul>
    <h2>Betroffenenrechte</h2>
    <p>Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit, Widerruf erteilter Einwilligungen. Beschwerde bei der Aufsichtsbehörde möglich.</p>
    <h2>Cookies</h2>
    <p>Notwendige Cookies: auth_token (httpOnly, max. 7 Tage, SameSite je nach Umgebung, Secure bei HTTPS), csrf_token (max. 7 Tage). Keine Marketing‑Cookies.</p>
    <h2>Lokaler Speicher</h2>
    <p>localStorage/sessionStorage nur für notwendige Funktionen (z. B. Fehlerdiagnose, Sitzungs‑Kennung, Editor‑Einstellungen, optionales „Remember me“). Keine Marketing‑ oder Tracking‑Profile.</p>
    <h2>Sicherheit</h2>
    <p>TLS, httpOnly/Secure Cookies, Rate‑Limiting, CSP.</p>
    <h2>Kontolöschung & Datenexport</h2>
    <p>In der App über Menü „Daten exportieren“ / „Konto löschen“.</p>
  </div>
);

export default Privacy;

