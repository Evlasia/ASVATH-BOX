import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createAsset, deleteAsset, isSupabaseConfigured, listAssets, updateAsset } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: { directives: { styleSrc: ["'self'", "'unsafe-inline'"] } }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public', { extensions: ['html'] }));
const run = (handler) => (req, res) => Promise.resolve(handler(req, res)).catch((error) => res.status(error.status || 500).json({ error: error.message || 'Erro interno.' }));
const assetFields = ['nome', 'categoria', 'variacoes_tipo', 'variacoes_campos', 'variacoes'];
const pick = (object, fields) => Object.fromEntries(fields.filter((key) => object[key] !== undefined).map((key) => [key, object[key] === '' ? null : object[key]]));

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'supabase', configured: isSupabaseConfigured, supportsAdding: true, supportsEditing: true, supportsRemoving: true }));
app.use('/api', (_req, res, next) => {
  if (!isSupabaseConfigured) return res.status(503).json({ error: 'Configure as credenciais do Supabase no arquivo .env.' });
  next();
});
app.get('/api/bens', run(async (req, res) => res.json(await listAssets({ q: req.query.q, categoria: req.query.categoria }))));
app.post('/api/bens', run(async (req, res) => {
  const data = pick(req.body || {}, assetFields);
  if (!String(data.nome || '').trim()) return res.status(400).json({ error: 'Informe o nome do bem.' });
  if (data.categoria != null) data.categoria = String(data.categoria).trim() || null;
  if (data.variacoes_tipo != null) {
    data.variacoes_tipo = String(data.variacoes_tipo).trim();
    if (data.variacoes_tipo.length > 80) return res.status(400).json({ error: 'O nome do tipo deve ter até 80 caracteres.' });
  }
  if (data.variacoes_campos !== undefined) {
    if (!Array.isArray(data.variacoes_campos) || data.variacoes_campos.length > 20) return res.status(400).json({ error: 'Configure até 20 campos de medida.' });
    const keys = new Set();
    data.variacoes_campos = data.variacoes_campos.map((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) throw Object.assign(new Error('Definição de campo inválida.'), { status: 400 });
      const key = String(field.key || '');
      const rotulo = String(field.rotulo || '').trim();
      const tipo = String(field.tipo || '');
      const unidade = String(field.unidade || '').trim();
      if (!/^[a-z0-9_-]{1,40}$/i.test(key) || keys.has(key)) throw Object.assign(new Error('Identificador de campo inválido ou repetido.'), { status: 400 });
      if (!rotulo || rotulo.length > 40 || unidade.length > 12) throw Object.assign(new Error('Informe um nome de campo válido e uma unidade de até 12 caracteres.'), { status: 400 });
      if (!['texto', 'numero', 'medida', 'quantidade'].includes(tipo)) throw Object.assign(new Error('Tipo de campo inválido.'), { status: 400 });
      keys.add(key);
      return { key, rotulo, tipo, unidade };
    });
  }
  if ((data.variacoes_campos?.length || data.variacoes?.length) && !data.variacoes_tipo) return res.status(400).json({ error: 'Informe o tipo das medidas configuradas.' });
  if (data.variacoes?.length && !data.variacoes_campos?.length) return res.status(400).json({ error: 'Configure os campos antes de adicionar valores de medida.' });
  if (data.variacoes !== undefined) {
    if (!Array.isArray(data.variacoes) || data.variacoes.length > 50) return res.status(400).json({ error: 'Lista de medidas ou tamanhos inválida.' });
    data.variacoes = data.variacoes.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !item.valores || typeof item.valores !== 'object' || Array.isArray(item.valores)) throw Object.assign(new Error('Variação inválida.'), { status: 400 });
      const valores = {};
      for (const field of data.variacoes_campos || []) {
        const value = item.valores[field.key];
        if (value == null || value === '') continue;
        if (field.tipo === 'texto') {
          const text = String(value).trim();
          if (text.length > 120) throw Object.assign(new Error(`O campo ${field.rotulo} deve ter até 120 caracteres.`), { status: 400 });
          if (text) valores[field.key] = text;
        } else {
          const number = Number(value);
          if (!Number.isFinite(number) || number < 0 || (field.tipo === 'quantidade' && !Number.isInteger(number))) throw Object.assign(new Error(`Valor inválido para ${field.rotulo}.`), { status: 400 });
          valores[field.key] = number;
        }
      }
      return { valores };
    }).filter((item) => Object.keys(item.valores).length);
    if (!data.variacoes_campos?.length) { delete data.variacoes; delete data.variacoes_campos; delete data.variacoes_tipo; }
  }
  res.status(201).json(await createAsset(data));
}));
app.patch('/api/bens/:id', run(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identificador de bem inválido.' });
  const data = pick(req.body || {}, assetFields);
  if (!String(data.nome || '').trim()) return res.status(400).json({ error: 'Informe o nome do bem.' });
  if (data.categoria != null) data.categoria = String(data.categoria).trim() || null;
  if (data.variacoes_tipo != null) {
    data.variacoes_tipo = String(data.variacoes_tipo).trim();
    if (data.variacoes_tipo.length > 80) return res.status(400).json({ error: 'O nome do tipo deve ter até 80 caracteres.' });
  }
  if (data.variacoes_campos !== undefined) {
    if (!Array.isArray(data.variacoes_campos) || data.variacoes_campos.length > 20) return res.status(400).json({ error: 'Configure até 20 campos de medida.' });
    const keys = new Set();
    data.variacoes_campos = data.variacoes_campos.map((field) => {
      if (!field || typeof field !== 'object' || Array.isArray(field)) throw Object.assign(new Error('Definição de campo inválida.'), { status: 400 });
      const key = String(field.key || '');
      const rotulo = String(field.rotulo || '').trim();
      const tipo = String(field.tipo || '');
      const unidade = String(field.unidade || '').trim();
      if (!/^[a-z0-9_-]{1,40}$/i.test(key) || keys.has(key)) throw Object.assign(new Error('Identificador de campo inválido ou repetido.'), { status: 400 });
      if (!rotulo || rotulo.length > 40 || unidade.length > 12) throw Object.assign(new Error('Informe um nome de campo válido e uma unidade de até 12 caracteres.'), { status: 400 });
      if (!['texto', 'numero', 'medida', 'quantidade'].includes(tipo)) throw Object.assign(new Error('Tipo de campo inválido.'), { status: 400 });
      keys.add(key);
      return { key, rotulo, tipo, unidade };
    });
  }
  if ((data.variacoes_campos?.length || data.variacoes?.length) && !data.variacoes_tipo) return res.status(400).json({ error: 'Informe o tipo das medidas configuradas.' });
  if (data.variacoes?.length && !data.variacoes_campos?.length) return res.status(400).json({ error: 'Configure os campos antes de adicionar valores de medida.' });
  if (data.variacoes !== undefined) {
    if (!Array.isArray(data.variacoes) || data.variacoes.length > 50) return res.status(400).json({ error: 'Lista de medidas ou tamanhos inválida.' });
    data.variacoes = data.variacoes.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !item.valores || typeof item.valores !== 'object' || Array.isArray(item.valores)) throw Object.assign(new Error('Variação inválida.'), { status: 400 });
      const valores = {};
      for (const field of data.variacoes_campos || []) {
        const value = item.valores[field.key];
        if (value == null || value === '') continue;
        if (field.tipo === 'texto') {
          const text = String(value).trim();
          if (text.length > 120) throw Object.assign(new Error(`O campo ${field.rotulo} deve ter até 120 caracteres.`), { status: 400 });
          if (text) valores[field.key] = text;
        } else {
          const number = Number(value);
          if (!Number.isFinite(number) || number < 0 || (field.tipo === 'quantidade' && !Number.isInteger(number))) throw Object.assign(new Error(`Valor inválido para ${field.rotulo}.`), { status: 400 });
          valores[field.key] = number;
        }
      }
      return { valores };
    }).filter((item) => Object.keys(item.valores).length);
    if (!data.variacoes_campos?.length) { data.variacoes = []; data.variacoes_campos = []; data.variacoes_tipo = null; }
  }
  res.json(await updateAsset(req.params.id, data));
}));
app.delete('/api/bens/:id', run(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identificador de bem inválido.' });
  await deleteAsset(req.params.id);
  res.status(204).end();
}));
app.get('/api/export/:format', run(async (req, res) => {
  const rows = await listAssets();
  const columns = [
    ['codigo', 'Código'], ['nome', 'Bem'], ['categoria', 'Categoria'],
    ['variacoes_tipo', 'Tipo de medida'], ['variacoes_resumo', 'Medidas e tamanhos'], ['created_at', 'Criado em']
  ];
  const summarize = (row) => {
    const fields = row.variacoes_campos || [];
    return (row.variacoes || []).map((item) => fields.map((field) => {
      const value = item.valores?.[field.key];
      return value == null || value === '' ? '' : `${field.rotulo}: ${value}${field.unidade ? ` ${field.unidade}` : ''}`;
    }).filter(Boolean).join(' · ')).filter(Boolean).join('; ');
  };
  const normalized = rows.map((row) => ({
    ...row,
    variacoes_resumo: summarize(row),
    created_at: row.created_at ? new Date(row.created_at).toLocaleDateString('pt-BR') : ''
  }));
  if (req.params.format === 'csv') {
    const csv = [columns.map(([, label]) => label).join(';'), ...normalized.map((row) => columns.map(([key]) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="asvath-box-bens.csv"');
    return res.send(`\ufeff${csv}`);
  }
  if (req.params.format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bens');
    sheet.columns = columns.map(([key, header]) => ({ header, key, width: Math.min(32, Math.max(16, header.length + 3)) }));
    normalized.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FF080A0B' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3C91B' } };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="asvath-box-bens.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }
  if (req.params.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="asvath-box-bens.pdf"');
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32 });
    pdf.pipe(res);
    pdf.rect(32, 32, 778, 50).fill('#080a0b');
    pdf.fillColor('#f3c91b').fontSize(18).text('ASVATH Box', 46, 43, { continued: true });
    pdf.fillColor('#ffffff').fontSize(11).text('  |  Inventário de bens');
    pdf.fillColor('#555555').moveDown(1.5).fontSize(8).text(`Gerado em ${new Date().toLocaleString('pt-BR')} - ${rows.length} bens`);
    pdf.moveDown();
    const headings = columns.map(([, label]) => label);
    const widths = [78, 150, 105, 105, 240, 100];
    const drawHeader = () => {
      let x = 32; const y = pdf.y;
      pdf.rect(32, y - 4, 778, 18).fill('#f3c91b');
      headings.forEach((heading, index) => { pdf.fillColor('#111111').font('Helvetica-Bold').fontSize(7).text(heading, x, y, { width: widths[index] }); x += widths[index]; });
      pdf.moveDown(1.5);
    };
    drawHeader();
    for (const row of normalized) {
      if (pdf.y > 530) { pdf.addPage(); drawHeader(); }
      const values = columns.map(([key]) => row[key]);
      let x = 32; const y = pdf.y;
      values.forEach((value, index) => { pdf.fillColor('#333333').font('Helvetica').fontSize(7).text(String(value || '-'), x, y, { width: widths[index], height: 26, ellipsis: true }); x += widths[index]; });
      pdf.moveDown(2.4);
    }
    return pdf.end();
  }
  return res.status(404).json({ error: 'Formato de exportação desconhecido. Use csv, xlsx ou pdf.' });
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota inexistente ou indisponível.' }));

app.listen(port, '0.0.0.0', () => {
  console.log(`ASVATH Box disponível em http://0.0.0.0:${port}`);
  console.log(`Supabase ${isSupabaseConfigured ? 'configurado' : 'aguardando configuração em .env'}`);
});
