import { supabase } from '../supabase';
import type { PricingPackage, PricingPackageInsert } from '../database.types';

export async function getPricingPackages(): Promise<PricingPackage[]> {
  const { data, error } = await supabase
    .from('pricing_packages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Eroare la preluarea pachetelor de preț:', error);
    return [];
  }
  return data || [];
}

export async function createPricingPackage(pkg: PricingPackageInsert): Promise<PricingPackage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Trebuie să fii autentificat pentru a crea un pachet.');

  const { data, error } = await supabase
    .from('pricing_packages')
    .insert({ ...pkg, user_id: user.id } as any)
    .select()
    .single();

  if (error) {
    console.error('Eroare la crearea pachetului:', error);
    throw error;
  }
  return data;
}

export async function deletePricingPackage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('pricing_packages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Eroare la ștergerea pachetului:', error);
    throw error;
  }
  return true;
}
