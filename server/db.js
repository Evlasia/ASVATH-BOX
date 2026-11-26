import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseSecret);
const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function requireSupabase() {
  if (!supabase) throw Object.assign(new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no arquivo .env.'), { status: 503 });
}

function throwDatabaseError(error) {
  if (!error) return;
  const status = error.code === '23505' ? 409 : error.code === '23503' || error.code === '23514' ? 400 : 500;
  throw Object.assign(new Error(error.message || 'Falha ao acessar o Supabase.'), { status });
}

export async function listAssets({ q = '', categoria = '' } = {}) {
  requireSupabase();
  // O Supabase limita cada consulta a 1000 linhas por padrão; lemos em páginas para não ocultar nenhum bem.
  const pageSize = 1000;
  const data = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('bens').select('*').is('deleted_at', null).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + pageSize - 1);
    if (categoria) query = query.eq('categoria', categoria);
    const { data: page, error } = await query;
    throwDatabaseError(error);
    data.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  const search = String(q).trim().toLocaleLowerCase('pt-BR');
  return data.filter((asset) => !search || [asset.codigo, asset.nome, asset.categoria, asset.variacoes_tipo].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(search)));
}

export async function createAsset(input) {
  requireSupabase();
  const record = {
    nome: String(input.nome).trim(),
    categoria: input.categoria ? String(input.categoria).trim() || null : null,
    variacoes_tipo: input.variacoes_tipo || null,
    variacoes_campos: input.variacoes_campos || [],
    variacoes: input.variacoes || [],
    quantidade: input.quantidade ?? 0
  };
  const { data, error } = await supabase.from('bens').insert(record).select('*').single();
  throwDatabaseError(error);
  return data;
}

export async function updateAsset(id, input) {
  requireSupabase();
  const record = {
    nome: String(input.nome).trim(),
    categoria: input.categoria ? String(input.categoria).trim() || null : null,
    variacoes_tipo: input.variacoes_tipo || null,
    variacoes_campos: input.variacoes_campos || [],
    variacoes: input.variacoes || []
  };
  if (input.quantidade !== undefined) record.quantidade = input.quantidade;
  const { data, error } = await supabase.from('bens').update(record).eq('id', id).is('deleted_at', null).select('*').maybeSingle();
  throwDatabaseError(error);
  if (!data) throw Object.assign(new Error('O bem não foi encontrado ou já foi removido.'), { status: 404 });
  return data;
}

export async function addAssetQuantity(id, amount) {
  requireSupabase();
  const { data, error } = await supabase.rpc('asvath_add_quantity', { p_id: Number(id), p_amount: amount });
  throwDatabaseError(error);
  if (!data || data.id == null) throw Object.assign(new Error('O bem não foi encontrado ou já foi removido.'), { status: 404 });
  return data;
}

export async function deleteAsset(id) {
  requireSupabase();
  const { data, error } = await supabase.from('bens').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
  throwDatabaseError(error);
  if (!data) throw Object.assign(new Error('O bem não foi encontrado ou já foi removido.'), { status: 404 });
}
