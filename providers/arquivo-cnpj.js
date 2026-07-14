'use strict';
/*
 * Hunter — extração de CNPJs de arquivo enviado (upload).
 * Aceita texto (.txt/.csv) e PDF com camada de texto. Para PDF, descomprime os
 * streams de conteúdo com o zlib nativo (FlateDecode) — sem dependência externa.
 * PDF escaneado (imagem, sem texto) não rende nada: aí é preciso um arquivo de
 * texto. Sempre valida 14 dígitos e remove duplicados.
 */
const zlib = require('zlib');

const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;

// Puxa os CNPJs de um texto qualquer (14 dígitos após limpar máscara).
function cnpjsDeTexto(texto) {
  const out = [];
  const vistos = new Set();
  for (const m of String(texto || '').matchAll(RE_CNPJ)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length === 14 && !vistos.has(d)) { vistos.add(d); out.push(d); }
  }
  return out;
}

// Descomprime os streams de um PDF e devolve todo o texto que der pra recuperar.
// Cobre streams FlateDecode (o caso comum) e também o conteúdo já legível.
function textoDePdf(buffer) {
  const partes = [];
  const bin = buffer.toString('latin1');
  // Conteúdo não comprimido (alguns PDFs simples) entra direto.
  partes.push(bin);
  // Cada bloco stream…endstream: tenta inflar (zlib raw e normal).
  const decs = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(bin)) !== null) {
    const raw = Buffer.from(m[1], 'latin1');
    for (const fn of [zlib.inflateSync, zlib.inflateRawSync, zlib.gunzipSync]) {
      try { const d = fn(raw).toString('latin1'); decs.push(d); partes.push(d); break; } catch (_) {}
    }
  }
  // Muitos PDFs de "imprimir → salvar como PDF" (Chrome/Word) NÃO guardam o
  // texto como ASCII: guardam índices de glifo (<0013> Tj) + uma tabela
  // ToUnicode que traduz glifo→caractere. Decodificamos isso pra recuperar os
  // dígitos do CNPJ (senão o regex não acha nada nesses arquivos).
  const texto = decodificarGlifos(decs);
  if (texto) partes.push(texto);
  return partes.join('\n');
}

// Reconstrói o texto a partir dos índices de glifo usando as tabelas ToUnicode
// (bfchar/bfrange) presentes nos streams. Best-effort: junta todas as tabelas.
function decodificarGlifos(decs) {
  const mapa = new Map();
  const hexToStr = h => { let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return s; };
  for (const d of decs) {
    for (const bloco of d.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
      for (const mm of bloco.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) mapa.set(parseInt(mm[1], 16), hexToStr(mm[2]));
    }
    for (const bloco of d.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
      for (const mm of bloco.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const ini = parseInt(mm[1], 16), fim = parseInt(mm[2], 16), dst = parseInt(mm[3], 16);
        for (let g = ini, k = 0; g <= fim && k < 65536; g++, k++) mapa.set(g, String.fromCharCode(dst + k));
      }
    }
  }
  if (!mapa.size) return '';
  const decodeHex = h => { let s = ''; for (let i = 0; i + 4 <= h.length; i += 4) { const g = parseInt(h.substr(i, 4), 16); if (mapa.has(g)) s += mapa.get(g); } return s; };
  let texto = '';
  for (const d of decs) {
    if (!/Tj|TJ/.test(d)) continue;
    for (const mm of d.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) texto += decodeHex(mm[1]);
    for (const mm of d.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const h of mm[1].matchAll(/<([0-9A-Fa-f]+)>/g)) texto += decodeHex(h[1]);
      texto += ' ';
    }
    texto += '\n';
  }
  return texto;
}

// Ponto de entrada: recebe o buffer do arquivo e o nome (pra detectar .pdf).
// Retorna { cnpjs, tipo }. `max` limita pra não estourar (padrão 5000).
function extrair(buffer, nome = '', max = 5000) {
  const ehPdf = /\.pdf$/i.test(nome) || buffer.slice(0, 5).toString('latin1') === '%PDF-';
  const texto = ehPdf ? textoDePdf(buffer) : buffer.toString('utf8');
  const cnpjs = cnpjsDeTexto(texto).slice(0, max);
  return { cnpjs, tipo: ehPdf ? 'pdf' : 'texto' };
}

module.exports = { extrair, cnpjsDeTexto, textoDePdf, decodificarGlifos };
