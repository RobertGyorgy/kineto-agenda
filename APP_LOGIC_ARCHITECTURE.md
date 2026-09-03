# 📖 Arhitectura & Logica Completă (Master Specification) - Kineto Dashboard

Acest document reprezintă **Sursa de Adevăr Absolut (Single Source of Truth)** pentru logica aplicației Kineto Dashboard. Sunt detaliate **toate** fluxurile, butoanele, comunicațiile și particularitățile tehnice construite în sistem.

---

## 1. 🗄️ BAZA DE DATE (Supabase PostgreSQL)

Aplicația se bazează pe o bază de date relațională cu securitate Row Level Security (RLS) configurată pe 4 tabele majore.

### 1.1 Tabela `pacienti` (Baza Pacienților)
- `id` (uuid, Primary Key)
- `nume` (text), `prenume` (text), `telefon` (text)
- `locatie` (text): Limitat la **'Belaqva'** sau **'Ghimbav'**. Determină schema de culori (Roz vs Galben) a cardurilor.
- `plan` (text): **'Subscription'** (abonament) sau **'One Time'** (o singură ședință).
- `cost` (numeric): Prețul stabilit pentru acel pacient (per ședință sau per pachet întreg).
- `sedinte_total` (int): Numărul de ședințe din pachet (ex. 10 pentru abonament, 1 pentru standard).
- `sedinte_folosite` (int): Contorul ședințelor finalizate efectiv de pacient din acest pachet.
- `status_abonament` (text): 
  - `'activ'` (pachet în derulare)
  - `'ultima_sedinta'` (când sedinte_folosite = sedinte_total - 1)
  - `'terminat'` (când sedinte_folosite >= sedinte_total)
- `achitat` (boolean): Flag general dacă întreg pachetul este plătit.

### 1.2 Tabela `programari` (Agenda & Ședințele)
- `id` (uuid, Primary Key)
- `pacient_id` (uuid, Foreign Key -> `pacienti.id`)
- `data` (date): Data calendaristică a ședinței (format local YYYY-MM-DD).
- `ora` (time): Ora începerii (ex. '09:00').
- `locatie` (text): Preia locația din pacient pentru raportări.
- `status` (text): 
  - `'programat'` (Urmează să aibă loc)
  - `'confirmat'` (Abonat pe drum - rar folosit în flux curent)
  - `'finalizat'` (Ședința a avut loc, închisă cu Wrap-Up)
  - `'absent'` (Pacientul nu a venit)
  - `'anulat'` (Anulat în avans)

### 1.3 Tabela `plati` (Istoricul Tranzacțiilor)
- `id` (uuid, Primary Key)
- `pacient_id` (uuid, Foreign Key -> `pacienti.id`)
- `suma` (numeric): Suma încasată real în acea tranzacție.
- `data_platii` (date): Când s-a încasat.

### 1.4 Tabela `settings` (Configurări Globale)
- `work_start` / `work_end`: Ora deschiderii/închiderii (ex. 08:00 - 18:00).
- `lunch_start` / `lunch_end`: Pauza de prânz (ex. 13:00 - 14:00).
- `session_duration` / `break_buffer`: Configurația de timp (50 min ședință + 10 minute pauză între pacienți).

---

## 2. ⚡ SISTEMUL DE EVENIMENTE ȘI RE-RANDARE (Event-Driven DOM)

Deoarece aplicația este bazată pe Astro cu manipulare Vanilla JS pe client, am creat un **Sistem de Evenimente (EventBus)** pe interfața `window`. Orice modificare a bazei de date declanșează un eveniment, iar componentele de pe ecran **ascultă și se re-randează** singure fără să necesite un refresh (`F5`) al paginii.

| Nume Eveniment | Când este emis (Cine îl strigă) | Cine ascultă și reacționează |
| :--- | :--- | :--- |
| **`patientsUpdated`** | Creare pacient nou, modificare detalii pacient, plată completă, resetare abonament. | Lista dreapta, Agendă, Carduri, Dashboard. |
| **`sessionsUpdated`** | Programare nouă creată, Confirmare (Wrap-Up), Mutare prin Drag&Drop. | Calendar (coloanele de zi), Agenda zilnică, Rapoarte, Bara verde de progres (sus). |
| **`paymentsUpdated`** | Adăugarea unei plăți parțiale sau integrale în portofel. | Cardurile de Agendă (indicator Achitat/Neachitat), PaymentSheet, Statistici Financiare. |
| **`calendarDateSelected`** | Dând click pe o zi în mini-calendarul din stânga. | Timeline, Agenda (se încarcă datele noii zile). |
| **`openAddSession`** | Click pe un spațiu liber de orar în Calendar. | Se deschide panoul lateral (Sheet) pentru adăugare pacient/programare. |
| **`openWrapUp`** | Click pe butonul 'CONFIRMĂ ȘEDINȚA'. | Se deschide Sheet-ul de finalizare (Wrap-Up) pentru închiderea ședinței. |

---

## 3. 🗓️ FLUXUL CALENDARULUI (Timeline și Generare Orare)

### 3.1. Calculul Blocului Orar
Calendarul rulează un algoritm care preia `work_start` (08:00) până la `work_end` (18:00).
Distanța dintre blocuri este calculată strict pe baza `session_duration` (50 minute) + `break_buffer` (10 minute) = un total de **60 de minute per slot**.
Asta creează linii perfect aliniate la oră fixă. 

### 3.2. Restricția de Prânz (Lunch Break)
Sistemul verifică matematic dacă un slot generat pică între `lunch_start` (13:00) și `lunch_end` (14:00). 
Dacă DA:
- Blochează interacțiunea de click.
- Afișează un banner roșu "PAUZĂ DE MASĂ" pe lățimea întregului calendar.
- Nu permite programarea pacienților în acest slot.

---

## 4. 📝 ADĂUGARE PROGRAMARE ȘI PACIENȚI (`AddSessionSheet.astro`)

Când un slot liber este apăsat, se deschide modalul lateral **Adaugă Programare**.
Acest panou este "inteligent" și permite un mod hibrid:

1. **Pacient Existent:** Terapeutul scrie primele 2-3 litere ale unui nume; apare dropdown-ul autocompletat.
   - *Logica specială:* Dacă terapeutul observă că pacientului îi mai trebuie 5 ședințe la pachet, schimbă numărul din "Pachet (ședințe)" direct în panou. 
   - *Acțiune backend:* API-ul face `UPDATE pacienti` setând noile ședințe **ÎNAINTE** de a crea programarea.
2. **Pacient Nou:** Completarea câmpurilor Nume, Prenume și Telefon fără selecție din listă instruiește backend-ul să facă întâi `INSERT INTO pacienti`, iar apoi cu ID-ul nou generat, să facă `INSERT INTO programari`.
3. **Stare Inițială:** Programarea primește garantat statusul **`programat`**.

---

## 5. ✅ FINALIZAREA ȘEDINȚEI ȘI CONTORIZAREA (`SessionWrapUpSheet.astro`)

Cel mai important flux operațional. Ședințele curente din Agendă au un buton evident: **"CONFIRMĂ ȘEDINȚA"**.
La apăsare, se deschide Wrap-Up Sheet cu următoarele reguli:

1. **Acțiunea 'Confirmare':**
   - Schimbă starea în baza de date pentru intrarea din `programari` din `'programat'` în `'finalizat'`.
   - Execută direct **Incrementul (+1) pe tabela `pacienti`** pentru coloana `sedinte_folosite`.
2. **Următorul Pas Automat (Next-Week Schedule):**
   - Modalul oferă un checkbox bifat default: *"Programează automat pacientul X la aceeași oră peste o săptămână"*.
   - Dacă e lăsat bifat, sistemul creează instant o nouă intrare în `programari` la +7 Zile cu status `'programat'`, ținând calendarul plin pentru retenția pacienților.

---

## 6. 🔄 REÎNNOIREA ABONAMENTULUI (Logica "0/N")

Problema clasică era că pacienții ajungeau la ședința 10/10, dar nu se putea începe un pachet nou fără un cont nou sau editări complicate.

**Soluția Curentă Implementată:**
- Când un pacient a consumat toate ședințele (`sedinte_folosite >= sedinte_total`), pe cardul său din UI textul de progres ("7/10 Ședințe") este înlocuit **complet** de un banner roz, apăsabil:  
  **`ABONAMENT TERMINAT — REÎNNOIEȘTE (0/X)`** (unde X este ultimul număr de ședințe avut în pachet).
- La click pe banner, se execută funcția globală `window.renewSubscription(patientId, newTotal)`:
  1. API-ul face update în Supabase `pacienti`: 
     - Setează `sedinte_folosite = 0`.
     - Setează `status_abonament = 'activ'`.
  2. Apelarea `window.dispatchEvent('patientsUpdated')` curăță instant vizual ecranul (dispare butonul roz și reapare progresul de la `0/10`). 
  - Noul pachet începe astfel imaculat.

---

## 7. 💳 FINANCIARUL ȘI LOGICA PER-ȘEDINȚĂ (Achitat vs Neachitat)

Problema corectată pe logică: *Când un pacient are mai multe ședințe viitoare, dar azi plătește o singură ședință, cum marcăm separat?*

- **Calcul Matematic Inteligent în `AgendaBlock.astro`**:
  - Aplicația trage toate tranzacțiile financiare din tabela `plati` a acelui pacient și le însumează (`sumaIncasata`).
  - Pentru **ședința analizată astăzi**, verificăm valoarea sa (`cost_sedinta = cost / sedinte_total`).
  - Dacă `sumaIncasata >= cost_sedinta`, ședința CURENTĂ (de azi) apare cu ecuson verde **ACHITAT**.
  - Pentru ședința viitoare (de mâine, din aceeași serie), algoritmul recalculează valoarea rămasă în portofel. Cum pacientul a plătit doar strictul necesar de azi, balanța rămasă e insuficientă pentru mâine. Deci, automat ședința de mâine capătă ecuson roșu **NEACHITAT**.
- **Payment Sheet:** Permite oricând adăugarea de noi intrări numerice în tabela `plati` (Plată Parțială / Plată Integrala), ceea ce cascadează recalculul matematic pentru toate ședințele acelui pacient.

---

## 8. 📊 RAPOARTE ȘI STATISTICI (Date Sigure & Erori 0)

Sectiunea `ReportsView` citește baza de date cu reguli extrem de stricte:
1. **Ședințe Efectuate / Confirmate:** Funcțiile de agregare numără **DOAR** înregistrările cu status `'finalizat'`. Cele programate, absente sau anulate sunt excluse strict din ecuație.
2. **Veniturile (RON):** Caută **întâi** tranzacții reale în tabela `plati`. Dacă nu există tranzacții în tabelă, cade înapoi pe "Costul ședințelor confirmate". Se folosește `Math.max(venitPlati, venitSedinte)` per perioadă pentru a preveni dubla numărare, asigurând corectitudinea datelor financiare pe grafic.
3. **Bara Verde de Progres (Dashboard Sus):** Calculează numărul de pacienți de astăzi cu statusul `'finalizat'` raportat la numărul total de programări (din ziua respectivă). Bara se umple spre 100% **doar** dând click pe confirmare la Wrap-Up.

---

## 9. 🛡️ PROTECȚII ȘI FIXURI CRITICE APLICATE (Defensive Programming)

1. **Bug Fus Orar (UTC Shift la miezul nopții):**
   - Modul nativ în care JS tratează `.toISOString()` pe date locale ducea ziua în spate (23:00 în ziua anterioară, din cauza fusului orar al României GMT+2/3).
   - Soluția: S-a creat `toLocalISOString(date)` care face offset matematic: `offsetMs = this.getTimezoneOffset() * 60000;`.
2. **Polyfill `Date.prototype.toLocalISOString`:** 
   - A fost adăugat un monkey-patch nativ pe obiectul JavaScript `Date` în fișierul de utilitare. Indiferent dacă un fișier încearcă să apeleze `date.toLocalISOString()` sau `toLocalISOString(date)`, metoda va funcționa garantat, anulând 100% posibilitatea erorilor de tip *"is not a function"*.
3. **Blocajul Astro ViewTransitions:** 
   - S-a descoperit că navigarea "lină" a lui Astro ținea scripturile vechi (fără Polyfill) în memorie. S-au adăugat instrucțiuni precise și handlere pentru eliberarea memoriei HMR (Hot Module Replacement) pentru a garanta re-execuția curată.

---

## 10. 🎨 DESIGN SYSTEM ȘI COMPONENTE UI

- **Tematizare Baza pe Locație (`isGhimbav` Boolean):**
  - Dacă locația ședinței este Ghimbav, UI-ul se resetează instant pe codul de culori **Yellow/Orange** (`bg-brand-primary`). Butoanele, hover-urile și progres bar-urile adoptă tematica galbenă de alert.
  - Dacă e Belaqva, folosește accent **Pink/Magenta** (`bg-brand-secondary`).
- **Sheet (Modaluri Laterale) Slide-Over:** Construite fără dependințe externe folosind TailwindCSS de tranziție (translate-x-full), declanșate de scripturi Vanilla JS din EventBus pentru performanță 0-latency (mai rapid decât React / Vue).
- **Blob Background:** Formele difuze de fundal sunt implementate prin componente Astro pure (`BlobBackground.astro`), poziționate absolut cu `bottom: -2rem, left: -3.5rem` pentru echilibru vizual premium în aplicație.
