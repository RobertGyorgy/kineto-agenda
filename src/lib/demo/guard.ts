import { supabase } from '../supabase';
import { isDemoUserId } from './config';

/** true dacă sesiunea curentă aparține contului demo */
export async function isDemoSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return isDemoUserId(session?.user?.id);
  } catch {
    return false;
  }
}
