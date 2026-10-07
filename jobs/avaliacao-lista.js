'use strict';
/*
 * Nota de segurança da lista de semelhantes (Jev).
 *
 * Cada empresa POSITIVA da lista é comparada ao cliente ideal (texto de uma
 * proposta de valor) pelo Jev, numa escala de 4 níveis. A nota 0–100 e a lista
 * de suspeitas saem de typesafe.notaDaLista, no código. Nada muda na lista nem
 * nos radares: o resultado vai para `avaliacoes_lista` e o usuário decide o que
 * remover. Só roda para o tenant com a integração decisao|typesafe ativa.
 */
const typesafe = require('../providers/typesafe');
const { enrichComRetry, upsertEmpresa, TETO_AMOSTRA } = require('./descoberta');

module.exports = async function avaliacaoLista(job, pool) {
  const { avaliacao_id } = job.data;
  const { rows: [av] } = await pool.query(
    `SELECT id, lista, icp_texto FROM avaliacoes_lista WHERE id=$1`, [avaliacao_id]);
  if (!av) return { skipped: 'avaliacao_inexistente' };

  const falhar = async (msg) => {
    await pool.query(`UPDATE avaliacoes_lista SET status='erro', erro=$2, concluido_em=now() WHERE id=$1`,
      [av.id, String(msg).slice(0, 300)]);
    return { erro: msg };
  };

  const ig = await typesafe.integracao(pool);
  if (!ig) return falhar('integração Decisões (Jev) inativa');

  const { rows: sementes } = await pool.query(
    `SELECT cnpj FROM sementes WHERE lista=$1 AND tipo = 'positiva'
     ORDER BY criado_em DESC LIMIT $2`, [av.lista, TETO_AMOSTRA]);
  if (!sementes.length) return falhar('lista sem empresas');

  const { rows: [ck] } = await pool.query(
    `SELECT key_cifrada FROM integracoes
     WHERE categoria='descoberta' AND provedor='cnpja' AND ativo=true ORDER BY ordem LIMIT 1`);

  // Firmografia: o cadastro global costuma já ter (o radar perfilou a lista);
  // o que faltar é consultado como no perfilamento, e fica no cadastro.
  const empresas = [];
  let semDados = 0;
  for (const { cnpj } of sementes) {
    let { rows: [e] } = await pool.query(
      `SELECT cnpj, razao, fantasia, cnae, setor, porte, cidade, uf, abertura, capital, contatos_verificados
       FROM empresas WHERE cnpj=$1`, [cnpj]);
    if (!e) {
      try {
        e = await enrichComRetry(cnpj, 6, ck?.key_cifrada || null);
        await upsertEmpresa(pool, e);
      } catch (_) { semDados++; continue; }
    }
    empresas.push({ ...e, resumo_site: typesafe.resumoSite(e.contatos_verificados) });
  }
  if (!empresas.length) return falhar('nenhuma empresa da lista com dados cadastrais');

  let r;
  try {
    const perfil = await typesafe.perfilComprador(pool);
    r = await typesafe.avaliarAderencia(ig.apiKey, av.icp_texto, empresas, { modelo: ig.modelo, perfil, modo: 'cliente' });
  } catch (e) { return falhar(e.message); }
  const nota = typesafe.notaDaLista(r.itens);
  if (!nota) return falhar('o Jev não devolveu nota para nenhuma empresa');

  const itens = r.itens.map(x => ({
    cnpj: x.cnpj, nome: x.nome,
    nivel: x.nivel == null ? null : Math.round(x.nivel * 100) / 100,
    norm: x.norm == null ? null : Math.round(x.norm * 100) / 100,
    confianca: x.confianca == null ? null : Math.round(x.confianca * 100) / 100,
  }));
  const resultado = {
    ...nota,
    sem_dados: semDados,
    total_lista: sementes.length,
    tokens: r.tokens,
    falhas_jev: r.falhas || 0,
    suspeitas_lista: itens.filter(x => x.norm != null && x.norm < 0.5).sort((a, b) => a.norm - b.norm),
    itens,
  };
  await pool.query(
    `UPDATE avaliacoes_lista SET status='pronta', nota=$2, faixa=$3, resultado=$4::jsonb,
            modelo=$5, concluido_em=now() WHERE id=$1`,
    [av.id, nota.nota, nota.faixa, JSON.stringify(resultado), r.modelo]);
  return { nota: nota.nota, faixa: nota.faixa, avaliadas: nota.avaliadas };
};

