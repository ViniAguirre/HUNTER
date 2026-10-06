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

module.exports = { normalizarTags, MAX_TAGS, MAX_TAG };
