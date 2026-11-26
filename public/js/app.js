import { offlineStore } from './store.js';

const $ = (selector, root = document) => root.querySelector(selector);
const state = { bens: [], online: false };
const presets = {
  vinil: {
    name: 'Vinil', fields: [
      { key: 'identificacao', rotulo: 'Tamanho / versão', tipo: 'texto', unidade: '' },
      { key: 'largura', rotulo: 'Largura', tipo: 'medida', unidade: 'cm' },
      { key: 'altura', rotulo: 'Altura', tipo: 'medida', unidade: 'cm' },
      { key: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', unidade: 'un.' }
    ]
  },
  camiseta: {
    name: 'Camisetas / T-shirts', fields: [
      { key: 'tamanho', rotulo: 'Tamanho', tipo: 'texto', unidade: '' },
      { key: 'peito', rotulo: 'Largura do peito', tipo: 'medida', unidade: 'cm' },
      { key: 'comprimento', rotulo: 'Comprimento', tipo: 'medida', unidade: 'cm' },
      { key: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', unidade: 'un.' }
    ]
  }
};
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Falha ao carregar dados (${response.status}).`), { status: response.status });
  }
  return response.json();
}

function setConnection(online, label) {
  state.online = online;
  $('#connection-dot').classList.toggle('online', online);
  $('#connection-label').textContent = label;
}

function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show', 'error'), 3500);
}

function quantityOf(asset) {
  const value = Number(asset.quantidade);
  return Number.isFinite(value) ? value : 0;
}

function variationSummary(asset) {
  const variations = Array.isArray(asset.variacoes) ? asset.variacoes : [];
  const fields = Array.isArray(asset.variacoes_campos) ? asset.variacoes_campos : [];
  if (!variations.length) return '—';
  if (fields.length) return variations.map((variation) => fields.map((field) => {
    const value = variation.valores?.[field.key];
    if (value == null || value === '') return '';
    return `${field.rotulo}: ${value}${field.unidade ? ` ${field.unidade}` : ''}`;
  }).filter(Boolean).join(' · ')).filter(Boolean).join(' | ') || '—';
  return variations.map((item) => [item.nome, item.largura_cm != null || item.altura_cm != null ? `${item.largura_cm ?? '—'} × ${item.altura_cm ?? '—'} cm` : '', item.quantidade != null ? `${item.quantidade} un.` : ''].filter(Boolean).join(' ')).join(' | ') || '—';
}

function categoryOptions() {
  const current = $('#filter-category').value;
  const categories = [...new Set(state.bens.map((asset) => String(asset.categoria || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#filter-category').innerHTML = `<option value="">Todas as categorias</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
  $('#filter-category').value = categories.includes(current) ? current : '';
}

function render() {
  const search = $('#search-input').value.trim().toLocaleLowerCase('pt-BR');
  const category = $('#filter-category').value;
  const rows = state.bens.filter((asset) => {
    const searchable = [asset.codigo, asset.nome, asset.categoria, asset.variacoes_tipo, variationSummary(asset)].join(' ').toLocaleLowerCase('pt-BR');
    return (!search || searchable.includes(search)) && (!category || String(asset.categoria || '').trim() === category);
  });
  $('#asset-count').textContent = `${rows.length} ${rows.length === 1 ? 'bem' : 'bens'}`;
  $('#nav-count').textContent = String(state.bens.length);
  $('#asset-rows').innerHTML = rows.map((asset) => {
    const actions = asset.pending
      ? '<span class="pending-actions">Aguardando sincronização</span>'
      : `<div class="row-actions"><button class="icon-action qty-action" type="button" data-action="add-qty" data-id="${escapeHtml(asset.id)}" aria-label="Adicionar quantidade a ${escapeHtml(asset.nome)}" title="Adicionar quantidade">＋</button><button class="icon-action" type="button" data-action="edit" data-id="${escapeHtml(asset.id)}" aria-label="Editar ${escapeHtml(asset.nome)}" title="Editar">✎</button><button class="icon-action danger" type="button" data-action="delete" data-id="${escapeHtml(asset.id)}" aria-label="Remover ${escapeHtml(asset.nome)}" title="Remover">×</button></div>`;
    const createdAt = asset.created_at ? new Date(asset.created_at).toLocaleDateString('pt-BR') : '—';
    return `<tr><td><div class="table-asset"><span class="asset-icon">▦</span><div><div class="asset-name">${escapeHtml(asset.nome || 'Bem sem nome')}</div><div class="asset-code">${escapeHtml(asset.codigo || 'Pendente de sincronização')}</div></div></div></td><td class="table-category">${escapeHtml(asset.categoria || '—')}</td><td>${escapeHtml(asset.variacoes_tipo || '—')}</td><td class="variation-cell" title="${escapeHtml(variationSummary(asset))}">${escapeHtml(variationSummary(asset))}</td><td class="qty-cell"><strong>${quantityOf(asset)}</strong><span class="qty-unit"> un.</span></td><td>${escapeHtml(createdAt)}</td><td>${actions}</td></tr>`;
  }).join('');
  const empty = rows.length === 0;
  $('.table-scroll').classList.toggle('hidden', empty);
  $('#assets-empty').classList.toggle('hidden', !empty);
  $('#empty-title').textContent = state.bens.length === 0 ? 'Nenhum bem cadastrado' : 'Nenhum resultado encontrado';
  $('#empty-description').textContent = state.bens.length === 0 ? 'Adicione um bem para começar o inventário.' : 'Tente alterar a busca ou a categoria.';
}

const variationSection = document.createElement('section');
variationSection.className = 'variation-config';
variationSection.innerHTML = `<button type="button" class="variation-toggle" id="variation-toggle" aria-expanded="false">＋ Configurar medidas e tamanhos</button><div class="variation-panel" id="variation-panel" hidden><p class="variation-help">Opcional. Use um modelo pronto ou configure um tipo de medida adicional.</p><label class="form-field">Modelo de medidas<select id="variation-type"><option value="">Selecione</option><option value="vinil">Vinil</option><option value="camiseta">Camisetas / T-shirts</option></select></label><button type="button" class="add-custom-type-button" id="add-custom-type">＋ Adicionar outro tipo de medida</button><div id="custom-type-config" hidden><label class="form-field">Nome do novo tipo <em>*</em><input id="custom-type-name" maxlength="80" placeholder="Ex.: Bonés, canecas, placas"></label><div class="custom-fields-heading"><span>Campos de medida ou detalhe</span><button type="button" class="add-field-button" id="add-field">＋ Adicionar campo</button></div><div id="custom-fields"></div></div><div id="variation-rows"></div><button type="button" class="add-variation-button" id="add-variation" hidden>＋ Adicionar tamanho / medida</button></div>`;
$('#asset-form').querySelector('.dialog-actions').before(variationSection);

function customFieldDefinitions() {
  return [...$('#custom-fields').querySelectorAll('.custom-field-row')].map((row) => ({
    key: row.dataset.key,
    rotulo: $('.custom-field-label', row).value.trim(),
    tipo: $('.custom-field-kind', row).value,
    unidade: $('.custom-field-unit', row).value.trim()
  })).filter((field) => field.rotulo);
}

function currentVariationConfig() {
  const selection = $('#variation-type').value;
  if (selection === 'vinil' || selection === 'camiseta') return { name: presets[selection].name, fields: presets[selection].fields };
  if (selection === 'outro') return { name: $('#custom-type-name').value.trim(), fields: customFieldDefinitions() };
  return { name: '', fields: [] };
}

function createCustomFieldRow(field = {}) {
  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.dataset.key = field.key || `campo-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  row.innerHTML = `<label>Nome do campo<input class="custom-field-label" maxlength="40" placeholder="Ex.: Circunferência" value="${escapeHtml(field.rotulo || '')}"></label><label>Tipo de valor<select class="custom-field-kind"><option value="medida">Medida</option><option value="texto">Texto</option><option value="numero">Número</option><option value="quantidade">Quantidade</option></select></label><label>Unidade<input class="custom-field-unit" maxlength="12" placeholder="cm, mm, un." value="${escapeHtml(field.unidade || '')}"></label><button type="button" class="remove-field-button" aria-label="Remover campo">×</button>`;
  $('.custom-field-kind', row).value = field.tipo || 'medida';
  $('#custom-fields').append(row);
}

function renderVariationRows(previousRows = []) {
  const config = currentVariationConfig();
  const oldValues = previousRows.length ? previousRows : [...$('#variation-rows').querySelectorAll('.variation-row')].map((row) => Object.fromEntries([...row.querySelectorAll('[data-field-key]')].map((input) => [input.dataset.fieldKey, input.value])));
  $('#variation-rows').replaceChildren();
  if (!config.fields.length) { $('#add-variation').hidden = true; return; }
  $('#add-variation').hidden = false;
  oldValues.forEach((values) => appendVariationRow(config.fields, values));
}

function appendVariationRow(fields, values = {}) {
  const row = document.createElement('div');
  row.className = 'variation-row';
  row.style.setProperty('--field-count', String(fields.length));
  const controls = fields.map((field) => {
    const numeric = ['medida', 'numero', 'quantidade'].includes(field.tipo);
    const step = field.tipo === 'quantidade' ? '1' : '0.1';
    const value = values[field.key] ?? '';
    return `<label>${escapeHtml(field.rotulo)}${field.unidade ? ` (${escapeHtml(field.unidade)})` : ''}<input data-field-key="${escapeHtml(field.key)}" data-field-type="${escapeHtml(field.tipo)}" type="${numeric ? 'number' : 'text'}" ${numeric ? `min="0" step="${step}"` : 'maxlength="120"'} value="${escapeHtml(value)}" placeholder="${numeric ? escapeHtml(field.unidade || '0') : 'Informar'}"></label>`;
  }).join('');
  row.innerHTML = `${controls}<button type="button" class="remove-variation" aria-label="Remover variação" title="Remover">×</button>`;
  $('#variation-rows').append(row);
}

function addVariationRow() {
  const config = currentVariationConfig();
  if (!config.name || !config.fields.length) {
    toast($('#variation-type').value === 'outro' ? 'Informe o tipo e adicione pelo menos um campo.' : 'Escolha um tipo para configurar as medidas.', true);
    return;
  }
  if (config.fields.some((field) => !field.rotulo)) { toast('Preencha o nome de cada campo personalizado.', true); return; }
  appendVariationRow(config.fields);
}

$('#asset-form').addEventListener('reset', () => {
  $('#variation-panel').hidden = true;
  $('#variation-toggle').setAttribute('aria-expanded', 'false');
  $('#variation-toggle').textContent = '＋ Configurar medidas e tamanhos';
  $('#variation-type').value = '';
  $('#custom-type-name').value = '';
  $('#custom-type-config').hidden = true;
  $('#custom-fields').replaceChildren();
  $('#variation-rows').replaceChildren();
  $('#add-variation').hidden = true;
  $('#asset-id').value = '';
  $('.dialog-heading h2', $('#asset-dialog')).textContent = 'Adicionar bem';
  $('.dialog-heading p', $('#asset-dialog')).textContent = 'Informe o nome; a categoria é opcional.';
  $('#save-asset').textContent = 'Salvar bem';
});
$('#variation-toggle').addEventListener('click', () => {
  const open = $('#variation-panel').hidden;
  $('#variation-panel').hidden = !open;
  $('#variation-toggle').setAttribute('aria-expanded', String(open));
  $('#variation-toggle').textContent = open ? '− Ocultar medidas e tamanhos' : '＋ Configurar medidas e tamanhos';
});
$('#variation-type').addEventListener('change', () => {
  $('#custom-fields').replaceChildren();
  $('#custom-type-name').value = '';
  $('#custom-type-config').hidden = true;
  const config = currentVariationConfig();
  $('#variation-rows').replaceChildren();
  if (config.fields.length) appendVariationRow(config.fields);
  $('#add-variation').hidden = !config.fields.length;
});
$('#add-custom-type').addEventListener('click', () => {
  $('#variation-type').value = 'outro';
  $('#variation-rows').replaceChildren();
  $('#add-variation').hidden = true;
  $('#custom-type-config').hidden = false;
  $('#custom-type-name').focus();
});
$('#add-field').addEventListener('click', () => { createCustomFieldRow(); renderVariationRows(); });
$('#custom-fields').addEventListener('input', () => renderVariationRows());
$('#custom-fields').addEventListener('change', () => renderVariationRows());
$('#custom-fields').addEventListener('click', (event) => {
  if (event.target.closest('.remove-field-button')) { event.target.closest('.custom-field-row').remove(); renderVariationRows(); }
});
$('#add-variation').addEventListener('click', addVariationRow);
$('#variation-rows').addEventListener('click', (event) => {
  if (event.target.closest('.remove-variation')) event.target.closest('.variation-row').remove();
});

function variationPayload() {
  const config = currentVariationConfig();
  if (!config.name && !config.fields.length) return {};
  if (!config.name || !config.fields.length) throw new Error('Complete o tipo e configure pelo menos um campo.');
  if (config.fields.some((field) => !field.rotulo)) throw new Error('Preencha o nome de cada campo personalizado.');
  const variations = [...$('#variation-rows').querySelectorAll('.variation-row')].map((row) => ({
    valores: Object.fromEntries([...row.querySelectorAll('[data-field-key]')].filter((input) => input.value !== '').map((input) => [input.dataset.fieldKey, input.value]))
  })).filter((variation) => Object.keys(variation.valores).length);
  return { variacoes_tipo: config.name, variacoes_campos: config.fields, variacoes: variations };
}

function openNewAsset() {
  $('#asset-form').reset();
  $('#asset-dialog').showModal();
}

function openEditAsset(asset) {
  const form = $('#asset-form');
  form.reset();
  $('#asset-id').value = asset.id;
  form.elements.namedItem('nome').value = asset.nome || '';
  form.elements.namedItem('categoria').value = asset.categoria || '';
  form.elements.namedItem('quantidade').value = quantityOf(asset);
  $('.dialog-heading h2', $('#asset-dialog')).textContent = 'Editar bem';
  $('.dialog-heading p', $('#asset-dialog')).textContent = 'Atualize o nome, a categoria ou as medidas.';
  $('#save-asset').textContent = 'Salvar alterações';

  const type = String(asset.variacoes_tipo || '').toLocaleLowerCase('pt-BR');
  const savedFields = Array.isArray(asset.variacoes_campos) ? asset.variacoes_campos : [];
  const savedRows = (Array.isArray(asset.variacoes) ? asset.variacoes : []).map((row) => row.valores || {});
  if (type.includes('vinil')) {
    $('#variation-type').value = 'vinil';
    $('#variation-type').dispatchEvent(new Event('change'));
  } else if (type.includes('camiseta') || type.includes('t-shirt') || type.includes('tshirt')) {
    $('#variation-type').value = 'camiseta';
    $('#variation-type').dispatchEvent(new Event('change'));
  } else if (type && savedFields.length) {
    $('#variation-type').value = 'outro';
    $('#custom-type-config').hidden = false;
    $('#custom-type-name').value = asset.variacoes_tipo;
    savedFields.forEach((field) => createCustomFieldRow(field));
  }
  if (type && savedFields.length) renderVariationRows(savedRows.length ? savedRows : [{}]);
  $('#variation-panel').hidden = !type;
  $('#variation-toggle').setAttribute('aria-expanded', String(Boolean(type)));
  $('#variation-toggle').textContent = type ? '− Ocultar medidas e tamanhos' : '＋ Configurar medidas e tamanhos';
  $('#asset-dialog').showModal();
}

async function editAsset(assetId) {
  const asset = state.bens.find((item) => String(item.id) === String(assetId));
  if (!asset) return toast('Este bem já não está na listagem.', true);
  openEditAsset(asset);
}

async function removeAsset(assetId) {
  const asset = state.bens.find((item) => String(item.id) === String(assetId));
  if (!asset) return toast('Este bem já não está na listagem.', true);
  if (!confirm(`Remover “${asset.nome}” (${asset.codigo}) da listagem? O registro ficará preservado no histórico.`)) return;
  try {
    const response = await fetch(`/api/bens/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Não foi possível remover o bem.');
    }
    state.bens = state.bens.filter((item) => String(item.id) !== String(asset.id));
    await offlineStore.replaceAll('bens', state.bens);
    categoryOptions(); render();
    toast(`Bem ${asset.codigo} removido da listagem.`);
  } catch (error) { toast(error.message || 'Falha ao remover o bem.', true); }
}

async function syncQueue() {
  if (!state.online) return 0;
  const pending = await offlineStore.all('fila');
  let synced = 0;
  for (const item of pending) {
    try {
      const response = await fetch('/api/bens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.body) });
      if (!response.ok) break;
      await response.json();
      await offlineStore.clearQueueItem(item.id);
      if (item.localId) state.bens = state.bens.filter((asset) => asset.id !== item.localId);
      synced++;
    } catch { break; }
  }
  return synced;
}

async function loadData() {
  try {
    const assets = await getJson('/api/bens');
    setConnection(true, 'Inventário sincronizado');
    const localPending = (await offlineStore.all('bens')).filter((item) => item.pending);
    state.bens = [...localPending, ...assets];
    await offlineStore.replaceAll('bens', state.bens);
    const synced = await syncQueue();
    if (synced) {
      const fresh = await getJson('/api/bens');
      state.bens = [...state.bens.filter((item) => item.pending), ...fresh];
      await offlineStore.replaceAll('bens', state.bens);
      toast(`${synced} ${synced === 1 ? 'cadastro sincronizado' : 'cadastros sincronizados'}.`);
    }
    $('#last-updated').textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (error) {
    state.bens = await offlineStore.all('bens');
    setConnection(false, error.status === 503 ? 'Configure a conexão Supabase' : state.bens.length ? 'Cópia local em modo offline' : 'Supabase indisponível');
    $('#last-updated').textContent = state.bens.length ? 'Exibindo última cópia deste dispositivo' : 'Sem dados em cache';
  }
  categoryOptions(); render();
}

const quantityDialog = $('#quantity-dialog');
function updateQuantityPreview() {
  const amount = Number($('#quantity-amount').value);
  const base = Number($('#quantity-current').textContent);
  $('#quantity-preview').textContent = Number.isInteger(amount) && amount > 0 ? String(base + amount) : '—';
}
function openQuantityDialog(assetId) {
  const asset = state.bens.find((item) => String(item.id) === String(assetId));
  if (!asset) return toast('Este bem já não está na listagem.', true);
  $('#quantity-asset-id').value = asset.id;
  $('#quantity-asset-name').textContent = `${asset.nome} · ${asset.codigo}`;
  $('#quantity-current').textContent = String(quantityOf(asset));
  $('#quantity-amount').value = '1';
  updateQuantityPreview();
  quantityDialog.showModal();
  $('#quantity-amount').select();
}
$('#quantity-amount').addEventListener('input', updateQuantityPreview);
document.querySelectorAll('[data-close-quantity]').forEach((button) => button.addEventListener('click', () => quantityDialog.close()));
$('#quantity-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const assetId = $('#quantity-asset-id').value;
  const amount = Number($('#quantity-amount').value);
  if (!Number.isInteger(amount) || amount < 1) return toast('Informe uma quantidade inteira maior que zero.', true);
  const current = state.bens.find((asset) => String(asset.id) === String(assetId));
  if (!current) { quantityDialog.close(); return toast('Este bem já não está na listagem.', true); }
  // Atualização imediata na tela; se o servidor recusar, a linha volta ao valor anterior.
  state.bens = state.bens.map((asset) => String(asset.id) === String(assetId) ? { ...asset, quantidade: quantityOf(asset) + amount } : asset);
  render();
  quantityDialog.close();
  try {
    const response = await fetch(`/api/bens/${encodeURIComponent(assetId)}/quantidade`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantidade: amount }) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Não foi possível adicionar a quantidade.');
    }
    const updated = await response.json();
    state.bens = state.bens.map((asset) => String(asset.id) === String(assetId) ? updated : asset);
    await offlineStore.replaceAll('bens', state.bens);
    render();
    toast(`+${amount} un. em ${updated.codigo}. Total: ${updated.quantidade} un.`);
  } catch (error) {
    state.bens = state.bens.map((asset) => String(asset.id) === String(assetId) ? current : asset);
    render();
    toast(error.message || 'Falha ao adicionar a quantidade.', true);
  }
});
$('#refresh-button').addEventListener('click', async () => {
  const button = $('#refresh-button');
  button.disabled = true;
  button.classList.add('spinning');
  try {
    await loadData();
    toast(state.online ? 'Lista atualizada.' : 'Sem conexão: exibindo a cópia deste dispositivo.', !state.online);
  } finally {
    button.disabled = false;
    button.classList.remove('spinning');
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadData(); });
$('#search-input').addEventListener('input', render);
$('#filter-category').addEventListener('change', render);
$('#export-button').addEventListener('click', () => $('#export-options').classList.toggle('open'));
$('#add-asset-button').addEventListener('click', openNewAsset);
$('#asset-rows').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'edit') editAsset(button.dataset.id);
  if (button.dataset.action === 'delete') removeAsset(button.dataset.id);
  if (button.dataset.action === 'add-qty') openQuantityDialog(button.dataset.id);
});
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => $('#asset-dialog').close()));
$('#asset-dialog').addEventListener('close', () => $('#asset-form').reset());
$('#asset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#save-asset');
  const assetId = $('#asset-id').value;
  button.disabled = true;
  let payload;
  try {
    payload = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, variationPayload());
    const response = await fetch(assetId ? `/api/bens/${encodeURIComponent(assetId)}` : '/api/bens', { method: assetId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || 'Não foi possível salvar o bem.'), { status: response.status });
    }
    const result = await response.json();
    if (assetId) state.bens = state.bens.map((asset) => String(asset.id) === String(assetId) ? result : asset);
    else state.bens.unshift(result);
    await offlineStore.replaceAll('bens', state.bens);
    categoryOptions();
    form.reset();
    $('#asset-dialog').close();
    render();
    toast(assetId ? `Bem ${result.codigo} atualizado.` : `Bem ${result.codigo} adicionado à listagem.`);
  } catch (error) {
    if (error instanceof TypeError && !assetId) {
      try {
        payload ||= Object.fromEntries(new FormData(form).entries());
        if (!payload.variacoes_tipo) Object.assign(payload, variationPayload());
        const localRecord = { ...payload, id: `offline-${crypto.randomUUID()}`, codigo: 'Pendente', created_at: new Date().toISOString(), pending: true };
        state.bens.unshift(localRecord);
        await offlineStore.replaceAll('bens', state.bens);
        await offlineStore.enqueue({ body: payload, localId: localRecord.id });
        categoryOptions(); render(); form.reset(); $('#asset-dialog').close();
        toast('Salvo neste dispositivo; será sincronizado quando a conexão voltar.');
      } catch (queueError) { toast(queueError.message || 'Não foi possível guardar o cadastro offline.', true); }
    } else toast(error.message || 'Falha ao salvar o bem.', true);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener('click', (event) => { if (!event.target.closest('.export-menu')) $('#export-options').classList.remove('open'); });
$('#today').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date());
window.addEventListener('online', loadData);
let installPrompt = null;
const installButton = $('#install-app');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) installButton.hidden = true;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = isStandalone;
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(ios ? 'No Safari, toque em Partilhar e escolha “Adicionar ao ecrã principal”.' : 'Use a opção “Instalar ASVATH Box” ou “Instalar app” no menu do navegador.');
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; toast('ASVATH Box instalado neste dispositivo.'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
loadData();
