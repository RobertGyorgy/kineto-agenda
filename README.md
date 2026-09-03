# 📋 KinetoAgenda

**Aplicația completă de management pentru cabinetul de kinetoterapie.**

KinetoAgenda este o aplicație web modernă (PWA) care funcționează direct pe telefon, tabletă sau calculator — fără a fi nevoie să o descarci din App Store sau Google Play. Se instalează pe ecranul principal și arată și se comportă exact ca o aplicație nativă.

---

## 🎯 Pentru cine este?

KinetoAgenda este creată special pentru **kinetoterapeutul care lucrează cu pacienți pe bază de abonament** (pachete de ședințe) sau ședințe unice. Este ideală pentru cabinete mici și medii, unde un singur terapeut sau o echipă restrânsă are nevoie de control total asupra programărilor, pacienților și încasărilor — totul de pe telefon.

---

## ✨ Ce face aplicația?

### 📅 Calendar & Programări
- **Calendar săptămânal și lunar** cu navigare fluidă prin swipe (la fel ca pe iPhone)
- **Timeline zilnic** — vezi toate ședințele din zi, ordonate cronologic, cu ora, pacientul și statusul fiecăreia
- **Creare rapidă de programări** — alegi pacientul, ziua, ora și locația dintr-un singur ecran
- **Drag & drop** — muți o programare la altă oră prin apăsare lungă (long-press) direct pe card
- **Status inteligent al ședinței** — fiecare programare poate fi: *Programat*, *Confirmat*, *Finalizat*, *Anulat* sau *Absent*
- **Numărătoare automată** — când finalizezi o ședință, aplicația scade automat din pachetul pacientului

### 👥 Managementul Pacienților
- **Fișă completă** cu: nume, telefon, locație, tip plan (Abonament / Ședință unică), preț per ședință, număr total de ședințe, cost total calculat automat
- **Căutare instantanee** — găsești orice pacient în timp real, pe măsură ce tastezi
- **Filtrare pe categorii** — vezi doar pacienții activi, cei cu abonament terminat, cei neachitați, sau pe toți
- **Editare rapidă** — modifici datele pacientului din aceeași interfață cu care l-ai adăugat
- **Link dosar/Drive** — poți atașa un link către dosarul medical din Google Drive
- **Reînnoire abonament** — când un pacient termină pachetul de ședințe, primești o alertă și poți reînnoi instant cu un nou număr de ședințe, preț și status de plată

### 💰 Plăți & Financiar
- **3 statusuri de plată**: Neachitat, Parțial, Achitat — setate la înregistrarea pacientului sau la reînnoire
- **Plată parțială** — poți introduce exact cât a achitat pacientul acum; restul rămâne evidențiat ca restanță
- **Panou de plăți per pacient** — vezi istoricul complet al încasărilor, cu sumă, dată și tip (plată parțială / achitat integral)
- **Marcaj rapid** — buton de „Achitat integral" care completează automat diferența rămasă
- **Resetare plăți** — în cazuri speciale, poți reseta tot istoricul financiar al unui pacient

### 📊 Rapoarte & Statistici
- **Panou zilnic** cu: ședințe efectuate / total, absențe, venit încasat azi
- **Selector de dată** — vezi raportul pentru orice zi din trecut sau viitor
- **Sumar financiar** — venit zilnic calculat pe baza ședințelor finalizate
- **Istoric săptămânal** — arhivare automată a datelor din fiecare săptămână: total programări, finalizate, absențe, procent prezență, venit

### 🔔 Notificări & Alerte
- **Alerte abonament terminat** — aplicația detectează automat pacienții care au terminat pachetul și îți afișează un banner pe pagina principală
- **Alerte plată în așteptare** — pacienții neachitați sunt evidențiați vizual
- **Notificări push** (opționale) — primești notificări pe telefon pentru programările zilei

### ⚙️ Setări Configurabile
- **Profil personal** — nume și avatar (inițiale generate automat)
- **Program de lucru** — setezi ora de start și de final a zilei de lucru
- **Pauza de masă** — interval configurabil care blochează automat programările în acea perioadă
- **Durata ședinței & buffer** — setezi durata standard a unei ședințe și pauza minimă între programări (aplicația previne automat suprapunerile)
- **Pachete predefinite** — configurezi prețul per ședință și numărul de ședințe implicit, pentru a nu le mai introduce manual de fiecare dată
- **Categorii pacienți** — creezi categorii personalizate cu emoji-uri pentru organizarea pacienților
- **Reminder & mesaj personalizat** — configurezi un mesaj text (de tip WhatsApp) care poate fi trimis pacienților ca reminder
- **Backup** — export și import al bazei de date pentru siguranță
- **Jurnal erori** — diagnosticarea automată a erorilor din aplicație (util pentru suport tehnic)

---

## 📱 Cum funcționează pe telefon?

KinetoAgenda este o **Progressive Web App (PWA)**. Asta înseamnă că:

1. **Deschizi link-ul** aplicației în Safari (iPhone) sau Chrome (Android)
2. **Adaugi pe ecranul principal** — apare ca o aplicație normală cu iconiță și tot
3. **Funcționează offline** — datele sunt salvate și sincronizate automat
4. **Nu ocupă spațiu** — nu trebuie descărcată din App Store sau Play Store
5. **Se actualizează singură** — de fiecare dată când deschizi aplicația, primești automat ultima versiune

### Navigare
Aplicația are un **dock de navigare** fix în partea de jos a ecranului (ca pe iPhone), cu 5 secțiuni:

| Iconiță | Secțiune | Ce găsești |
|---------|----------|------------|
| 📅 | **Calendar** | Calendarul săptămânal/lunar + timeline-ul zilnic cu programări |
| 📦 | **Pacienți** | Lista completă de pacienți cu căutare, filtrare și acțiuni |
| 🏠 | **Acasă** | Dashboard cu progresul zilnic, ședințele de azi și alertele importante |
| 📊 | **Rapoarte** | Statistici zilnice, financiare și istoric |
| 👤 | **Setări** | Toate configurările aplicației |

---

## 🏗️ Tehnologii Utilizate

| Componentă | Tehnologie |
|-----------|------------|
| **Frontend** | [Astro](https://astro.build) — framework rapid de web, cu tranziții native între pagini |
| **Styling** | [TailwindCSS](https://tailwindcss.com) — design responsiv, modern |
| **Baza de date** | [Supabase](https://supabase.com) (PostgreSQL) — bază de date cloud cu autentificare și sincronizare în timp real |
| **Autentificare** | Supabase Auth — cont securizat cu email și parolă |
| **Hosting** | [Vercel](https://vercel.com) — deployment automat la fiecare actualizare de cod |
| **Push Notifications** | Web Push API — notificări native pe telefon |
| **Animații** | [GSAP](https://gsap.com) — animații fluide și profesionale |

---

## 🔒 Securitate

- **Autentificare obligatorie** — fără cont nu poți accesa nicio pagină din aplicație
- **Row Level Security (RLS)** — la nivel de bază de date, fiecare utilizator are acces doar la datele proprii
- **Conexiune securizată** — toate datele circulă prin HTTPS
- **Datele sunt în cloud** — stocate în Supabase (servere UE), cu backup-uri automate

---

## 📋 Structura Datelor

Aplicația gestionează automat următoarele categorii de informații:

- **Pacienți** — date personale, abonament, plăți, status
- **Programări** — calendar cu validare automată anti-suprapunere
- **Plăți** — istoric complet al încasărilor per pacient
- **Notificări** — alerte generate automat pentru abonamente și plăți
- **Setări** — configurare personalizată a cabinetului
- **Istoric săptămânal** — arhivă automată pentru rapoarte
- **Jurnal erori** — diagnosticare tehnică automată

---

## 🚀 Instalare pe Telefon

### iPhone (Safari)
1. Deschide aplicația în **Safari**
2. Apasă pe butonul de **Share** (↑) din bara de jos
3. Alege **„Adaugă pe ecranul principal"**
4. Gata! Aplicația apare pe ecranul tău ca orice altă aplicație

### Android (Chrome)
1. Deschide aplicația în **Chrome**
2. Apasă pe cele **3 puncte** (⋮) din dreapta sus
3. Alege **„Adaugă pe ecranul de pornire"**
4. Gata! Poți deschide aplicația direct de acolo

---

*Dezvoltat cu ❤️ pentru profesioniștii din kinetoterapie.*
