# Taskuri în așteptare

> ⚠️ ȘTERGE Acest fișier după ce toate taskurile de mai jos sunt finalizate și verificate.

## 1. Aplicare migrații Supabase
Rulează în Supabase SQL Editor, în ordine:

1. `supabase/migrations/20240819_sync_payments_view.sql`
2. `supabase/migrations/20240819_decrement_on_session_delete.sql`

## 2. Verificare status plată în lista de pacienți
După ce rulăm migrațiile, testează din nou:
- deschide un pacient
- apasă **Achitat integral**
- verifică că badge-ul din lista de pacienți se updatează la **Achitat** fără refresh manual

## 3. Configurare Supabase MCP (de făcut de utilizator)
- pornește o sesiune nouă în Kimi Code
- rulează `/mcp-config` pentru OAuth login
- verifică statusul cu `/mcp`

## 4. Verificare bază de date prin MCP
După autentificare, cere-mi să interoghez baza pentru a confirma:
- tabela `plati` există
- `pacienti_view` are coloana `suma_incasata`
- triggerul `trg_incrementeaza_sedinte` reacționează și la `DELETE`

---

**Când toate cele de mai sus sunt gata, șterge acest fișier.**
