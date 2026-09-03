/**
 * authService.ts — Autentificare Supabase
 * Folosit în: login.astro, signup.astro
 */
import { supabase } from '../supabase';

// ── Login ─────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.session;
}

// ── Signup ────────────────────────────────────────────────────
export async function signup(email: string, password: string, displayName: string) {
  const username = '@' + email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, username }
    }
  });
  if (error) throw new Error(error.message);
  return data.session;
}

// ── Logout ────────────────────────────────────────────────────
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ── Sesiunea curentă ──────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── Utilizatorul curent ───────────────────────────────────────
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
