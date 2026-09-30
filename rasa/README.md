# Barangay Natumolan — Rasa AI Assistant

The website's floating chat icon (bottom-right) talks to this Rasa assistant.
It answers questions about certificates, fees, requirements, office hours,
appointments, the resident portal, VAWC, Lupon, and health services — in
English and Filipino.

**Fallback built in:** when this Rasa server is NOT running, the widget
automatically answers using the system's built-in service-guide assistant,
so the chat icon always works. Start Rasa and the widget upgrades to the AI
assistant automatically — no frontend changes needed.

## One-time setup

Python 3.11 and the `rasa/.venv` virtual environment are already prepared.
If you ever need to redo it:

```powershell
cd "c:\xampp\htdocs\Barangay Natumolan\rasa"
py -3.11 -m venv .venv          # Rasa needs Python 3.10–3.12 (not 3.13)
.venv\Scripts\pip install rasa-pro
```

## Add your license key

Create a file named `license.txt` in this folder containing ONLY your
**Rasa Developer Edition license key** (one line). Keep it private — do not
commit or share it. The start script loads it into the `RASA_LICENSE`
environment variable (the name rasa-pro 3.18 expects).

## Train + run

```powershell
cd "c:\xampp\htdocs\Barangay Natumolan\rasa"
powershell -ExecutionPolicy Bypass -File start-rasa.ps1
```

The script loads your license, trains the model (only when the data
changed), and serves the bot at **http://localhost:5005** with CORS open
for the website. Leave the window running; the chat icon now uses Rasa.

Quick test without the website:

```powershell
curl -X POST http://localhost:5005/webhooks/rest/webhook `
  -H "Content-Type: application/json" `
  -d '{"sender":"test","message":"How much is a barangay clearance?"}'
```

## Changing what the bot knows

| What | Where |
|---|---|
| Answers (fees, hours, contact…) | `domain.yml` → `responses:` |
| Understanding (example questions) | `data/nlu.yml` |
| Which question triggers which answer | `data/rules.yml` |

After editing, run `start-rasa.ps1` again — it retrains automatically.
Keep the fee amounts in `utter_certificates`/`utter_fees` in sync with
`backend/app/Services/Service/CertificateCatalogue.php` (the fee schedule).

## Pointing the widget elsewhere

The widget defaults to `http://localhost:5005`. For production, set
`VITE_RASA_URL=https://your-rasa-host` in `frontend/.env` and rebuild.

## The knowledge base — where the chatbot's answers come from

**Edit `knowledge/faq/*.yml`, never `data/nlu.yml`, `data/rules.yml` or
`domain.yml` directly.** Those three are generated, and so is
`backend/resources/chatbot/faq.json` — the copy the website's built-in
assistant answers from when Rasa is not running. One source, so the chatbot
says the same thing either way.

Each intent in `knowledge/faq/*.yml` has:

| Field | What it is |
|---|---|
| `id` | the Rasa intent |
| `label` | the button's words when another answer offers this question |
| `answer` | what the chatbot says — facts from the system or the law only |
| `related` | the 2–4 questions offered under this answer (these are the buttons, and they change with every question) |
| `en` / `tl` / `ceb` | ways of asking it in English, Tagalog and Bisaya |
| `framed` | question frames × subjects — see `knowledge/frames.yml` |
| `test` | questions kept **out** of training, to measure the chatbot honestly |

After editing:

```powershell
cd "c:\xampp\htdocs\Barangay Natumolan\rasa"
python knowledge\generate.py                              # writes the Rasa files and faq.json
powershell -ExecutionPolicy Bypass -File start-rasa.ps1   # retrains, then serves
php ..\backend\tests\check_faq_matcher.php                # the PHP copy still agrees
```

`generate.py` refuses a knowledge base with a hole in it (a missing answer, a
related question that does not exist) and removes any example that ended up
in two intents. It also prints how the built-in assistant does on the `test`
questions.

**Fees must match `backend/app/Services/Service/CertificateCatalogue.php`**
— the ordinance as the counter charges it. Change one, change both.

**No telephone number is given anywhere** — the one on the website is a
placeholder. When the barangay has a real number, add it to `ask_contact`.
