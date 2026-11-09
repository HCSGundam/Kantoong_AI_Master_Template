// Import Supabase Client dari CDN resmi (untuk web statis / vanilla JS)
// Versi DIKUNCI (bukan 'terbaru'): paket yang disusupi di internet tidak otomatis ikut termuat.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

// Masukkan URL dan Publishable Key dari dashboard Supabase kamu
const SUPABASE_URL = 'https://bkhsmyabckdpxmboopar.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ji7xZwTFB-llGC533Xe4Mg_pqhPCn8t'; 

// Inisialisasi koneksi Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);