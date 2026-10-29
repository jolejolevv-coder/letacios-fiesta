# Discord Bot für das Update Log anlegen

Einmalig, etwa zehn Minuten. Hintergrund in `specs/features/update-log.md`. Der Update Kanal
von OPBounty ist bereits per „Folgen“ in deinen Server umgeleitet.

## 1. Anwendung anlegen

1. https://discord.com/developers/applications öffnen und mit deinem Discord Konto anmelden.
2. Oben rechts „New Application“, Name zum Beispiel `Fiesta Update Log`, Bedingungen
   bestätigen, „Create“.

## 2. Bot einstellen

1. Links „Bot“ wählen.
2. „Public Bot“ ausschalten, damit niemand sonst ihn einladen kann.
3. Unter „Privileged Gateway Intents“ den Schalter „Message Content Intent“ einschalten und
   speichern. Ohne ihn liefert Discord die Nachrichten mit leerem Text.
4. „Reset Token“, bestätigen, Token kopieren. Discord zeigt ihn nur einmal. Nirgends
   hineinkopieren außer in Schritt 5, auch nicht in den Chat mit Claude.

## 3. Bot in deinen Server einladen

1. Links „OAuth2“, dann „URL Generator“.
2. Bei „Scopes“ nur `bot` anhaken.
3. Bei „Bot Permissions“ nur „View Channels“ und „Read Message History“ anhaken.
4. Die erzeugte URL unten kopieren, im Browser öffnen, deinen Server wählen, „Autorisieren“.
5. Optional: Bot nur den einen Kanal sehen lassen. Im Server unter Servereinstellungen, Rollen,
   die Rolle des Bots ohne „Kanäle ansehen“ lassen und nur im Update Kanal unter
   Kanaleinstellungen, Berechtigungen, dem Bot „Kanal ansehen“ und „Nachrichtenverlauf lesen“
   erlauben.

## 4. Kanal ID holen

1. In Discord: Benutzereinstellungen, „Erweitert“, „Entwicklermodus“ einschalten.
2. Rechtsklick auf den umgeleiteten Update Kanal, „Kanal ID kopieren“.

## 5. Secrets im Repo eintragen

Im Browser: https://github.com/jolejolevv-coder/letacios-fiesta/settings/secrets/actions,
„New repository secret“, zweimal:

- Name `DISCORD_BOT_TOKEN`, Wert: der Token aus Schritt 2.
- Name `DISCORD_KANAL_ID`, Wert: die Kanal ID aus Schritt 4.

Oder im Terminal, das fragt den Wert ab, ohne dass er in der Shell History landet:

```bash
gh secret set DISCORD_BOT_TOKEN -R jolejolevv-coder/letacios-fiesta
```

```bash
gh secret set DISCORD_KANAL_ID -R jolejolevv-coder/letacios-fiesta
```

## 6. Prüfen

Unter Actions „Veroeffentlichen“ mit „Run workflow“ starten. Im Schritt „Update Log aus
Discord“ steht dann `update_log.json: N Meldungen`. Beim ersten Lauf werden die Meldungen
nur abgelegt, ohne Warnung; ab dem zweiten Lauf erscheint jede neue wichtige Meldung als
Warnung.

Häufige Fehler: `HTTP Error 401` heißt falscher Token, `403` heißt der Bot sieht den Kanal
nicht, `404` heißt falsche Kanal ID. Leerer Text in `update_log.json` heißt, der Message
Content Intent ist aus.
