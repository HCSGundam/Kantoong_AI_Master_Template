// Supabase Client DIBUNDEL ke web kita sendiri (paket npm, versi dikunci di package.json).
// Dulu dimuat dari CDN luar saat halaman dibuka: bila CDN itu dibobol, penyerang ikut masuk.
// Sekarang tidak ada skrip pihak ketiga untuk database (lebih aman + CSP lebih ketat).
import { createClient } from '@supabase/supabase-js';

// Masukkan URL dan Publishable Key dari dashboard Supabase kamu
const SUPABASE_URL = 'https://bkhsmyabckdpxmboopar.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ji7xZwTFB-llGC533Xe4Mg_pqhPCn8t'; 

// Inisialisasi koneksi Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);