'use strict';
/*
 * Hunter — tags de radar.
 *
 * Etiquetas livres que o usuário põe no radar (ex.: "Campanha Outubro", "VIP",
 * "Região Sul") e que vão junto em CADA lead enviado ao CRM, pra triagem lá:
 * filtro de fila, automação, distribuição pro vendedor certo.
 */
const MAX_TAGS = 10;
const MAX_TAG = 40;

// Aceita array ou texto separado por vírgula. Tira espaço sobrando, corta no
// tamanho máximo e remove repetida sem diferenciar maiúscula/acento — "VIP" e
// "vip" virariam duas regras diferentes no CRM. Mantém a grafia da 1ª vez.
function normalizarTags(entrada) {
  const lista = Array.isArray(entrada) ? entrada : String(entrada || '').split(',');
  const vistas = new Set();
  const out = [];
  for (const bruto of lista) {
    const tag = String(bruto ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG).trim();
    if (!tag) continue;
    const chave = tag.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// Chave de comparação: a mesma regra do CRM — sem diferenciar maiúscula nem
// acento, palavra inteira (a tag toda tem que ser igual).
const chaveTag = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

// Lista de tags que as regras do CRM reconhecem (o CRM manda a lista inteira).
// Diferente das tags de um radar, aqui não há teto de 10: é o catálogo todo.
// Tag maior que MAX_TAG nunca bateria com uma tag de radar (que é cortada
// nesse tamanho), então volta em `ignoradas` pra o CRM saber.
const MAX_TAGS_CRM = 500;
function normalizarListaCrm(entrada) {
  const tags = [], ignoradas = [], vistas = new Set();
  for (const bruto of Array.isArray(entrada) ? entrada : []) {
    if (typeof bruto !== 'string') continue;
    const tag = bruto.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG) { ignoradas.push({ tag, motivo: `mais de ${MAX_TAG} caracteres` }); continue; }
    const k = chaveTag(tag);
    if (vistas.has(k)) continue;
    vistas.add(k);
    if (tags.length >= MAX_TAGS_CRM) { ignoradas.push({ tag, motivo: `passou de ${MAX_TAGS_CRM} tags` }); continue; }
    tags.push(tag);
  }
  return { tags, ignoradas };
}

module.exports = { normalizarTags, normalizarListaCrm, chaveTag, MAX_TAGS, MAX_TAG, MAX_TAGS_CRM };
