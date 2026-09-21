'use strict';
/*
 * Hunter — servidor MCP (Model Context Protocol) embutido.
 *
 * Transporte "Streamable HTTP": JSON-RPC 2.0 num POST só, resposta em JSON.
 * É o que plataformas de agente hospedadas (Hermes, Buzz, Claude, etc.) usam
 * pra falar com um servidor remoto — stdio não serve aqui, porque exigiria o
 * processo rodando ao lado do agente, e o Hunter está noutro servidor.
 *
 * Escrito à mão, sem SDK, de propósito: o subconjunto que um servidor de
 * ferramentas precisa é pequeno (initialize, tools/list, tools/call, ping) e
 * não vale uma dependência nova na imagem de produção por causa dele.
 */

// Versões do protocolo que sabemos falar, da mais nova pra mais velha. O cliente
// pede uma no initialize; devolvemos a dele se conhecermos, senão a nossa mais
// nova — que é o que a especificação manda fazer na negociação.
const VERSOES = ['2025-06-18', '2025-03-26', '2024-11-05'];

const ERRO = {
  parse: -32700, requisicao: -32600, metodo: -32601, parametros: -32602, interno: -32603,
};

const resposta = (id, result) => ({ jsonrpc: '2.0', id, result });
const falha = (id, code, message, data) => ({
  jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) },
});

// Resultado de ferramenta no formato do protocolo. Texto sempre: o agente lê
// JSON melhor do que qualquer estrutura exótica, e todo cliente sabe exibir.
const conteudo = (texto, isError = false) => ({
  content: [{ type: 'text', text: typeof texto === 'string' ? texto : JSON.stringify(texto, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

async function tratarMensagem(msg, { ferramentas, servidor, ctx }) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return falha(msg?.id, ERRO.requisicao, 'mensagem JSON-RPC inválida');
  }
  const { id, method, params } = msg;
  // Sem `id` é notificação: a especificação proíbe responder. Devolvemos null e
  // quem chama transforma em 202 sem corpo.
  const notificacao = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const pedida = params?.protocolVersion;
      return resposta(id, {
        protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: servidor.nome, version: servidor.versao },
        instructions: servidor.instrucoes || undefined,
      });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return notificacao ? null : resposta(id, {});
    case 'tools/list':
      return resposta(id, {
        tools: ferramentas.map(f => ({
          name: f.nome, description: f.descricao, inputSchema: f.schema,
        })),
      });
    case 'tools/call': {
      const alvo = ferramentas.find(f => f.nome === params?.name);
      if (!alvo) return falha(id, ERRO.parametros, `ferramenta desconhecida: ${params?.name}`);
      try {
        const saida = await alvo.executar(params?.arguments || {}, ctx);
        return resposta(id, conteudo(saida));
      } catch (e) {
        // Erro DE FERRAMENTA volta como resultado com isError, não como erro de
        // protocolo: assim o agente lê o motivo e se corrige (ex.: "limite de 5
        // atingido, exclua uma antes") em vez de só ver a chamada falhar.
        return resposta(id, conteudo({ erro: e.message }, true));
      }
    }
    default:
      return notificacao ? null : falha(id, ERRO.metodo, `método não suportado: ${method}`);
  }
}

// Handler Express. `autenticar(req)` devolve o contexto (ou lança) — quem monta
// decide como a chave é conferida.
function criarHandler({ ferramentas, servidor, autenticar }) {
  return async function handlerMcp(req, res) {
    let ctx;
    try {
      ctx = await autenticar(req);
    } catch (e) {
      // 401 com WWW-Authenticate: é assim que o cliente MCP sabe que precisa de
      // credencial, em vez de achar que o servidor está quebrado.
      res.set('WWW-Authenticate', 'Bearer realm="hunter"');
      return res.status(401).json(falha(null, ERRO.requisicao, e.message || 'não autorizado'));
    }
    const corpo = req.body;
    if (corpo == null || typeof corpo !== 'object') {
      return res.status(400).json(falha(null, ERRO.parse, 'corpo JSON inválido'));
    }
    try {
      if (Array.isArray(corpo)) {
        const saidas = [];
        for (const m of corpo) {
          const r = await tratarMensagem(m, { ferramentas, servidor, ctx });
          if (r) saidas.push(r);
        }
        return saidas.length ? res.json(saidas) : res.status(202).end();
      }
      const r = await tratarMensagem(corpo, { ferramentas, servidor, ctx });
      if (!r) return res.status(202).end();
      return res.json(r);
    } catch (e) {
      console.error('[mcp]', e);
      return res.status(500).json(falha(corpo?.id, ERRO.interno, 'erro interno'));
    }
  };
}

module.exports = { criarHandler, VERSOES };
