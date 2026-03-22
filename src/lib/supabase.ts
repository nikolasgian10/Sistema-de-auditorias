import { createClient } from '@supabase/supabase-js';

// Valores diretos para desenvolvimento - substitua quando for para produção
const supabaseUrl = 'https://zmxnzqplkocseyiecoks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteG56cXBsa29jc2V5aWVjb2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjQ2MDYsImV4cCI6MjA4OTcwMDYwNn0.hza8SdTGpGg7BGa68vOC9YoaHBsOsd_WCEq_wphaj9o';

console.log('[supabase.ts] URL usada:', supabaseUrl);
console.log('[supabase.ts] Key usado (prefix):', supabaseKey?.slice(0, 10));

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] Variáveis de ambiente ausentes');
  throw new Error('Supabase not configured.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);