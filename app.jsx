const { useState, useRef, useEffect, useMemo } = React;

// ── constants ─────────────────────────────────────────────────────────────────
// gold é o ACENTO temático (var --accent): pálido no escuro, dourado escuro e
// legível no claro. Assim os detalhes aparecem bem nos dois modos.
const C = { green:'#34D399', amber:'#FBBF24', red:'#F87171', blue:'#3A8EFF', gold:'var(--accent)', cyan:'#7AD9FF', gray:'#7C89A8' };

function themeVars(t) {
  return t === 'light'
    ? '--bg:#F4F6FA;--panel:#FFFFFF;--panel2:#EEF2F8;--hover:rgba(14,25,54,.04);--border:rgba(14,25,54,.12);--track:rgba(14,25,54,.10);--text:#0E1936;--dim:#4E586F;--faint:#77819A;--gold:#E7C053;--accent:#976F00;--blue:#2A73E6;--cyan:#1C86B8;--red:#E0544E;'
    : '--bg:#0E1936;--panel:#0A0F1F;--panel2:#101a3a;--hover:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);--track:rgba(255,255,255,.08);--text:#ECEFF7;--dim:#8A95B4;--faint:#5E688C;--gold:#FBE49A;--accent:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;';
}

// ── helpers ───────────────────────────────────────────────────────────────────
const Svg = ({ d, w=16, h=16, color='currentColor', sw=1.7, extra={} }) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={extra}>
    <path d={d}/>
  </svg>
);

const SvgMulti = ({ children, w=16, h=16, color='currentColor', sw=1.7 }) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

// Ícone "i" que mostra a explicação ao passar o mouse OU clicar (útil em telas
// de toque). Usado pra tirar texto explicativo longo de dentro dos formulários.
function InfoTip({ text, width = 260, align = 'left' }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position:'relative', display:'inline-flex', verticalAlign:'middle', marginLeft:6 }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ width:15, height:15, borderRadius:'50%', border:'1px solid var(--faint)', color:'var(--faint)',
          fontSize:9.5, fontWeight:700, fontStyle:'italic', display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', flexShrink:0, userSelect:'none' }}>i</span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:59 }}/>
          <div style={{ position:'absolute', zIndex:60, top:'130%', [align]:0, width,
            padding:'10px 12px', borderRadius:9, background:'var(--panel2)', border:'1px solid var(--border)',
            boxShadow:'0 10px 28px rgba(0,0,0,.4)', fontSize:11.5, lineHeight:1.55, color:'var(--dim)', fontWeight:400 }}>
            {text}
          </div>
        </>
      )}
    </span>
  );
}

function scoreColor(s) { return s >= 75 ? C.green : s >= 50 ? C.amber : C.red; }

function badgeStyle(cor) {
  // color-mix aceita hex e CSS vars (var(--accent)), então o badge dourado fica
  // legível no claro sem quebrar a concatenação de alpha.
  return { display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
    padding:'3px 9px', borderRadius:20,
    background:`color-mix(in srgb, ${cor} 15%, transparent)`, color:cor,
    border:`1px solid color-mix(in srgb, ${cor} 34%, transparent)`, whiteSpace:'nowrap' };
}

function StatusDot({ color, pulse }) {
  return <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0,
    animation: pulse ? 'hpulse 2s ease-in-out infinite' : 'none' }} />;
}

function Checkbox({ checked }) {
  return (
    <div style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${checked ? C.blue : 'var(--border)'}`,
      background: checked ? C.blue : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {checked && <SvgMulti w={11} h={11} color="#fff" sw={3}><path d="M20 6L9 17l-5-5"/></SvgMulti>}
    </div>
  );
}

function ScoreBar({ score }) {
  const col = scoreColor(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:5, borderRadius:3, background:'var(--track)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:3, width:score+'%', background:col }} />
      </div>
      <span style={{ fontSize:12, fontWeight:600, color:col, minWidth:20 }}>{score}</span>
    </div>
  );
}

function ScoreRing({ score, size=84 }) {
  const col = scoreColor(score);
  const r = size/2 - 7;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score/100);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--track)" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', lineHeight:1 }}>
        <span style={{ fontSize:size>70?20:16, fontWeight:600, color:col }}>{score}</span>
        <span style={{ fontSize:8.5, color:'var(--faint)', marginTop:2, letterSpacing:'.06em' }}>SCORE</span>
      </div>
    </div>
  );
}

function MiniChart({ vals, color }) {
  const w=560, h=130, max=Math.max(...vals)*1.1, step=w/(vals.length-1);
  const pts = vals.map((v,i) => [i*step, h-10-(v/max)*(h-28)]);
  const line = pts.map((p,i) => (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display:'block' }}>
      <path d={area} fill={color} fillOpacity={.1}/>
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height:8, borderRadius:5, background:'var(--track)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:pct+'%', borderRadius:5, background:color }}/>
    </div>
  );
}

function CrosshairBig() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none" stroke="currentColor">
      <circle cx={100} cy={100} r={78} strokeWidth={2} strokeDasharray="5 9"/>
      <path d="M100 6v26M100 168v26M6 100h26M168 100h26" strokeWidth={3} strokeLinecap="round"/>
      <path d="M100 60L132 122H68z" strokeWidth={3} strokeLinejoin="round"/>
      <circle cx={100} cy={100} r={6} strokeWidth={3}/>
    </svg>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} title="Tema"
      style={{ width:38, height:38, borderRadius:9, border:'1px solid var(--border)',
        background:'var(--panel)', color:'var(--dim)', cursor:'pointer', display:'flex',
        alignItems:'center', justifyContent:'center' }}>
      {theme === 'dark'
        ? <SvgMulti w={17} h={17} sw={1.7}>
            <circle cx={12} cy={12} r={4}/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>
          </SvgMulti>
        : <SvgMulti w={17} h={17} sw={1.7}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></SvgMulti>
      }
    </button>
  );
}

const TEL_PATH = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z';
const MAIL_PATH = 'M3 5h18v14H3zM3 7l9 6 9-6';

// Ícones de contato na lista: VERDE quando o enriquecimento achou o dado,
// VERMELHO quando não. Clicar abre só aquele contato (telefone OU e-mail) num
// balãozinho — e permite EDITAR/INCLUIR o dado ali mesmo (qualificação manual),
// sem abrir o painel inteiro do lead.
function ContactCell({ leadId, emailVal, phoneVal, onSaved }) {
  const [pop, setPop] = useState(null);   // { tipo, x, y }
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!pop) return;
    const fechar = () => setPop(null);
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [pop]);

  const abrir = (e, tipo, atual) => {
    e.stopPropagation();   // não abre o painel do lead
    const r = e.currentTarget.getBoundingClientRect();
    setVal(atual || '');
    setPop(p => (p && p.tipo === tipo) ? null : {
      tipo, y: r.bottom + 6,
      x: Math.max(8, Math.min(r.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 268)),
    });
  };
  const salvar = async (e) => {
    e.stopPropagation();
    if (!leadId) return;
    setSaving(true);
    try {
      const body = pop.tipo === 'email' ? { email: val.trim() } : { telefone: val.trim() };
      await fetch(`/api/leads/${leadId}/contato`, {
        method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      onSaved && onSaved();
      setPop(null);
    } catch (_) {} finally { setSaving(false); }
  };
  const icone = (tipo, v, path, label) => (
    <svg key={tipo} onClick={e => abrir(e, tipo, v)} title={label}
      width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={v ? C.green : C.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ cursor:'pointer' }}>
      <path d={path}/>
    </svg>
  );
  const atualVal = pop ? (pop.tipo === 'email' ? emailVal : phoneVal) : null;
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }} onClick={e => e.stopPropagation()}>
      {icone('email', emailVal, MAIL_PATH, 'E-mail')}
      {icone('telefone', phoneVal, TEL_PATH, 'Telefone')}
      {pop && (
        <div onClick={e => e.stopPropagation()} style={{ position:'fixed', left:pop.x, top:pop.y, zIndex:80, width:252,
          background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px',
          boxShadow:'0 8px 24px rgba(0,0,0,.28)' }}>
          <div style={{ fontSize:10, color:'var(--faint)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>
            {pop.tipo === 'email' ? 'E-mail' : 'Telefone'}
          </div>
          {atualVal
            ? <a href={(pop.tipo === 'email' ? 'mailto:' : 'tel:') + atualVal} onClick={e => e.stopPropagation()}
                style={{ color:'var(--text)', textDecoration:'none', fontWeight:500, fontSize:12.5, wordBreak:'break-all' }}>{atualVal}</a>
            : <span style={{ color:C.red, fontSize:12 }}>Não encontrado — inclua abaixo</span>}
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={val} autoFocus onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') salvar(e); }}
              placeholder={pop.tipo === 'email' ? 'contato@empresa.com.br' : '(11) 99999-9999'}
              style={{ flex:1, minWidth:0, height:32, borderRadius:8, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 9px', fontSize:12.5, fontFamily:'inherit' }}/>
            <button onClick={salvar} disabled={saving}
              style={{ height:32, padding:'0 12px', borderRadius:8, border:'none', background:'var(--gold)',
                color:'#0E1936', fontWeight:600, fontSize:12, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap' }}>
              {saving ? '…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────
// Data e hora de criação, no fuso do navegador (ex.: "14/08 · 09:48").
const dataHora = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
};
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return 'há ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'há ' + h + 'h';
  const d = Math.floor(h / 24);
  return 'há ' + d + ' dia' + (d > 1 ? 's' : '');
}

function fmtNum(n) {
  const num = parseInt(n) || 0;
  return num.toLocaleString('pt-BR');
}

function hasEmail(contatos) {
  if (!Array.isArray(contatos)) return false;
  return contatos.some(c => c.tipo === 'email');
}
function hasPhone(contatos) {
  if (!Array.isArray(contatos)) return false;
  return contatos.some(c => c.tipo === 'telefone');
}

const statusColors = { Qualificado:C.gold, Novo:C.blue, Enviado:C.green, Incompleto:C.amber, Descartado:C.gray };

// "Enviado" sozinho não diz nada sobre o que foi feito com o lead: pode ter sido
// o motor entregando ao CRM ou alguém marcando à mão depois de passar o contato
// pro time. A etiqueta mostra qual dos dois, e o tooltip diz quando e por quem.
// statusAtual vem separado porque no painel do lead o status na tela pode já ter
// mudado (Aprovar/Descartar) sem o objeto ter sido recarregado — sem isso a
// etiqueta continuaria dizendo "Enviado · manual" num lead recém-descartado.
function envioDoLead(l, statusAtual) {
  if ((statusAtual || l?.status) !== 'Enviado') return null;
  const quando = d => { try { return new Date(d).toLocaleString('pt-BR'); } catch (_) { return ''; } };
  if (l?.enviado_crm_em) return { rotulo:'Enviado · CRM', titulo:`Entregue ao CRM pelo motor em ${quando(l.enviado_crm_em)}` };
  if (l?.enviado_manual_em) return { rotulo:'Enviado · manual',
    titulo:`Marcado à mão em ${quando(l.enviado_manual_em)}${l.enviado_por ? ' por ' + l.enviado_por : ''}` };
  return null;
}
const buscaStatusColors = { Ativa:C.green, Pausada:C.amber, Esgotada:C.blue, Encerrada:C.gray };
const healthColors = { green:C.green, amber:C.amber, red:C.red, gray:C.gray };

// Descoberta "Pela internet" (web-first) desligada na interface: ela consulta a
// CNPJá UMA VEZ POR EMPRESA pra confirmar o CNPJ (contra ~100 empresas por
// consulta no modo por CNAE), então sai muito mais cara. TODO o código do modo
// web continua no backend e nos radares já criados — pra reativar, basta trocar
// esta chave para true.
const DESCOBERTA_WEB_HABILITADA = false;

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { key:'dashboard', label:'Dashboard', icon:'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z' },
  { key:'buscas', label:'Radares', icon:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3' },
  { key:'leads', label:'Leads', icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3' },
  { key:'propostas', label:'Propostas', icon:'M9 12h6M9 16h6M9 8h2M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z' },
  { key:'semelhantes', label:'Semelhantes', icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5' },
];
// acesso: 'master' → só o login MASTER da Hunter (dados sigilosos: quais APIs
// alimentam o produto). 'admin' → admin do cliente (gestão do próprio time).
const NAV_ADMIN = [
  { key:'integracoes', label:'Integrações', acesso:'master', icon:'M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8' },
  { key:'usuarios', label:'Usuários', acesso:'admin', icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  { key:'agente', label:'Agente SWOT', acesso:'master', icon:'M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3zM12 8v4M9 12h6' },
  { key:'config', label:'Configurações', acesso:'master', icon:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' },
  { key:'monitor', label:'Monitoramento', acesso:'master', icon:'M22 12h-4l-3 9L9 3l-3 9H2' },
];
// Telas que exigem MASTER (usado também na guarda de navegação do App).
const TELAS_MASTER = new Set(['integracoes', 'config', 'monitor', 'agente']);

function podeVer(it, user) {
  if (it.acesso === 'master') return !!user?.master;
  if (it.acesso === 'admin') return !!user?.master || user?.papel === 'Admin';
  return true;
}

function TrocarSenhaModal({ onClose }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [nova2, setNova2] = useState('');
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (nova.length < 6) { setMsg({ ok:false, txt:'A nova senha precisa ter ao menos 6 caracteres.' }); return; }
    if (nova !== nova2) { setMsg({ ok:false, txt:'A confirmação não bate com a nova senha.' }); return; }
    setSalvando(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/trocar-senha', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ senha_atual: atual, senha_nova: nova })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao trocar a senha.');
      setMsg({ ok:true, txt:'Senha alterada com sucesso.' });
      setAtual(''); setNova(''); setNova2('');
      setTimeout(onClose, 1200);
    } catch (e) { setMsg({ ok:false, txt:e.message }); }
    finally { setSalvando(false); }
  };
  const inp = { width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
    background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit', marginBottom:10 };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:90, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.6)' }}/>
      <div style={{ position:'relative', width:400, maxWidth:'92vw', background:'var(--panel)',
        border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
        <h3 style={{ fontSize:15, fontWeight:600, margin:'0 0 16px' }}>Trocar minha senha</h3>
        <input type="password" placeholder="Senha atual" value={atual} onChange={e=>setAtual(e.target.value)} style={inp}/>
        <input type="password" placeholder="Nova senha (mín. 6)" value={nova} onChange={e=>setNova(e.target.value)} style={inp}/>
        <input type="password" placeholder="Confirmar nova senha" value={nova2} onChange={e=>setNova2(e.target.value)} style={inp}/>
        {msg && <div style={{ fontSize:12.5, color: msg.ok ? C.green : C.red, margin:'4px 0 12px' }}>{msg.txt}</div>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
          <button onClick={onClose} style={{ height:38, padding:'0 16px', borderRadius:9, border:'1px solid var(--border)',
            background:'transparent', color:'var(--text)', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ height:38, padding:'0 18px', borderRadius:9, border:'none',
            background:'var(--gold)', color:'#0E1936', fontWeight:600, fontSize:13, fontFamily:'inherit', cursor:'pointer', opacity:salvando?.6:1 }}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ screen, onNav, onLogout, user }) {
  const [modalSenha, setModalSenha] = useState(false);
  const nome = user?.nome || '…';
  const papel = user?.master ? 'Master' : (user?.papel || '');
  const ini = nome.split(' ').slice(0,2).map(w=>w[0]).join('');
  const adminItems = NAV_ADMIN.filter(it => podeVer(it, user));
  const navStyle = (key) => {
    const active = screen === key || (key === 'buscas' && screen === 'buscaDetail');
    return {
      display:'flex', alignItems:'center', gap:11, padding:'9px 12px', borderRadius:9,
      fontSize:13.5, fontWeight:500, cursor:'pointer', textDecoration:'none',
      color: active ? 'var(--accent)' : 'var(--dim)',
      background: active ? 'var(--panel2)' : 'transparent',
      boxShadow: active ? 'inset 2px 0 0 var(--accent)' : 'none',
      transition:'background .12s',
    };
  };
  const renderNav = (items) => items.map(it => (
    <a key={it.key} onClick={() => onNav(it.key)} className="nav-link" style={navStyle(it.key)}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke={screen === it.key || (it.key==='buscas' && screen==='buscaDetail') ? 'var(--accent)' : '#8A95B4'}
        strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
        <path d={it.icon}/>
      </svg>
      <span>{it.label}</span>
    </a>
  ));
  return (
    <aside style={{ width:236, flexShrink:0, background:'var(--panel)', borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'20px 20px 22px' }}>
        <img src="hunter_logo_icon.png" alt="Hunter" style={{ width:30, height:30 }}/>
        <span style={{ fontSize:16, fontWeight:600, letterSpacing:'.2em' }}>HUNTER</span>
      </div>
      <nav style={{ display:'flex', flexDirection:'column', gap:2, padding:'4px 12px', flex:1, overflowY:'auto' }}>
        {renderNav(NAV_MAIN)}
        {adminItems.length > 0 && (
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.14em', color:'var(--faint)',
            padding:'18px 12px 8px' }}>ADMINISTRAÇÃO</div>
        )}
        {renderNav(adminItems)}
      </nav>
      <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:C.blue, color:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>{ini}</div>
          <div style={{ lineHeight:1.3, overflow:'hidden' }}>
            <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nome}</div>
            <div style={{ fontSize:11, color:'var(--faint)' }}>{papel}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <button onClick={() => setModalSenha(true)} className="nav-link"
            style={{ flex:1, height:32, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
              color:'var(--dim)', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Trocar senha</button>
          <button onClick={onLogout} className="nav-link"
            style={{ flex:1, height:32, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
              color:'var(--dim)', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Sair</button>
        </div>
      </div>
      {modalSenha && <TrocarSenhaModal onClose={() => setModalSenha(false)}/>}
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
const TITLES = {
  dashboard: ['Dashboard', 'Visão geral da operação'],
  leads: ['Leads', 'Curadoria e envio de leads qualificados'],
  buscas: ['Radares', 'Gerencie seus radares de leads'],
  buscaDetail: ['Detalhe do Radar', 'Produção e leads deste radar'],
  nova: ['Criar Radar', 'Configure um novo radar de leads'],
  propostas: ['Propostas', 'Suas propostas de valor (o que você vende)'],
  agente: ['Agente SWOT', 'Fichamento comercial que personaliza a análise'],
  integracoes: ['Integrações', 'Conexões com APIs e CRM'],
  usuarios: ['Usuários', 'Permissões e acessos'],
  config: ['Configurações', 'Parâmetros gerais do sistema'],
  monitor: ['Monitoramento', 'Saúde do sistema e filas'],
};

function SinoAlertas() {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState({ alertas: [], total: 0 });

  const carregar = () => fetch('/api/alertas', { credentials:'same-origin' })
    .then(r => r.json()).then(d => setData(d && Array.isArray(d.alertas) ? d : { alertas:[], total:0 })).catch(() => {});
  useEffect(() => { carregar(); const id = setInterval(carregar, 30000); return () => clearInterval(id); }, []);

  const n = data.total || 0;
  const corTipo = t => t === 'erro' ? C.red : t === 'aviso' ? C.amber : C.blue;

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setAberto(a => !a)} title="Alertas"
        style={{ position:'relative', width:38, height:38, borderRadius:9,
          border:'1px solid var(--border)', background:'var(--panel)', color:'var(--dim)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <SvgMulti w={17} h={17} sw={1.7}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></SvgMulti>
        {n > 0 && (
          <span style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, padding:'0 4px',
            borderRadius:8, background:C.red, color:'#fff', fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid var(--bg)' }}>
            {n > 9 ? '9+' : n}
          </span>
        )}
      </button>
      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
          <div style={{ position:'absolute', top:46, right:0, width:340, zIndex:41,
            background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12,
            boxShadow:'0 12px 32px rgba(0,0,0,.5)', overflow:'hidden' }}>
            <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)',
              fontSize:13, fontWeight:600 }}>Alertas {n > 0 && <span style={{ color:'var(--faint)', fontWeight:400 }}>· {n}</span>}</div>
            <div style={{ maxHeight:340, overflowY:'auto' }}>
              {data.alertas.length === 0 ? (
                <div style={{ padding:'22px 16px', fontSize:12.5, color:'var(--faint)', textAlign:'center' }}>
                  Nenhum alerta. Tudo tranquilo. ✓
                </div>
              ) : data.alertas.map((a, i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5, background:corTipo(a.tipo) }}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:500 }}>{a.titulo}</div>
                    {a.detalhe && <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:2, wordBreak:'break-word' }}>{a.detalhe}</div>}
                    {a.quando && <div style={{ fontSize:11, color:'var(--faint)', marginTop:2 }}>{timeAgo(a.quando)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Topbar({ screen, theme, onTheme, onNova, user }) {
  const [title, sub] = TITLES[screen] || ['',''];
  const ini = (user?.nome || '').split(' ').slice(0,2).map(w=>w[0]).join('') || 'U';
  return (
    <header style={{ height:64, flexShrink:0, borderBottom:'1px solid var(--border)',
      display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px',
      background:'var(--bg)', position:'sticky', top:0, zIndex:20 }}>
      <div style={{ display:'flex', flexDirection:'column', lineHeight:1.2 }}>
        <h2 style={{ fontSize:17, fontWeight:600, margin:0 }}>{title}</h2>
        <span style={{ fontSize:12, color:'var(--faint)' }}>{sub}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onNova} style={{ display:'flex', alignItems:'center', gap:8, height:38, padding:'0 16px',
          borderRadius:9, border:'none', background:'var(--gold)', color:'#0E1936', fontWeight:600,
          fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
          <Svg d="M12 5v14M5 12h14" color="#0E1936" w={16} h={16} sw={2}/>
          Criar Radar
        </button>
        <ThemeToggle theme={theme} onToggle={onTheme}/>
        <SinoAlertas/>
        <div style={{ width:34, height:34, borderRadius:9, background:C.blue, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, cursor:'pointer' }}>{ini}</div>
      </div>
    </header>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ onOpenBusca }) {
  const [data, setData] = useState(null);
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    fetch('/api/dashboard', { credentials:'same-origin' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
    fetch('/api/alertas', { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => setAlertas(Array.isArray(d?.alertas) ? d.alertas : []))
      .catch(() => {});
  }, []);

  if (!data) {
    return <div style={{ color:'var(--faint)', padding:40, textAlign:'center' }}>Carregando…</div>;
  }

  const { metricas = {}, buscasAtivas = [], atividade = [] } = data || {};
  const qual = parseInt(metricas.leadsQualificados) || 0;
  const fora = parseInt(metricas.leadsForaPerfil) || 0;
  const verificados = qual + fora;   // passaram pela segmentação (Score 1)
  const taxaQ = verificados ? Math.round(qual / verificados * 100) : 0;

  const metrics = [
    { label:'Radares ativos', value:fmtNum(metricas.buscasAtivas), icon:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3', iColor:C.blue, trend:'em produção', tColor:'var(--dim)' },
    { label:'Empresas encontradas', value:fmtNum(metricas.empresasEncontradas), icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3', iColor:C.gold, trend:`${fmtNum(verificados)} verificadas`, tColor:'var(--dim)' },
    { label:'Leads qualificados', value:fmtNum(metricas.leadsQualificados), icon:'M20 6L9 17l-5-5', iColor:C.green, trend:`${taxaQ}% aproveit. · ${fmtNum(fora)} fora do perfil`, tColor:'var(--dim)' },
    { label:'Enviados ao CRM', value:fmtNum(metricas.leadsCRM), icon:'M5 12h14M13 5l7 7-7 7', iColor:C.cyan, trend:'total enviado', tColor:'var(--dim)' },
  ];

  const hlLabel = { green:'produzindo', amber:'atenção', red:'parada', gray:'encerrada' };
  const corAlerta = t => t === 'erro' ? C.red : t === 'aviso' ? C.amber : C.blue;

  return (
    <div style={{ maxWidth:1180 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontSize:12.5, color:'var(--dim)' }}>{m.label}</span>
              <Svg d={m.icon} color={m.iColor} sw={1.7}/>
            </div>
            <div style={{ fontSize:30, fontWeight:600, letterSpacing:'-.02em', lineHeight:1 }}>{m.value}</div>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:10, fontSize:12, color:m.tColor }}>
              <span>{m.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.55fr 1fr', gap:16 }}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:'6px 6px 8px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 12px' }}>
            <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Radares ativos</h3>
            <a onClick={() => onOpenBusca(null)} style={{ fontSize:12, color:C.blue, cursor:'pointer', textDecoration:'none' }}>Ver todas</a>
          </div>
          {buscasAtivas.length === 0 && (
            <div style={{ padding:'20px 16px', fontSize:13, color:'var(--faint)' }}>Nenhum radar ativo.</div>
          )}
          {buscasAtivas.map(b => (
            <div key={b.id} onClick={() => onOpenBusca(b.id)} className="row-hover"
              style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:10, cursor:'pointer' }}>
              <StatusDot color={healthColors[b.health]} pulse={b.health==='green'}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.nome}</div>
                <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:2 }}>{hlLabel[b.health]||'—'}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{fmtNum(b.enc)}</div>
                <div style={{ fontSize:11, color:'var(--faint)' }}>encontrados</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:16 }}>
            <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Alertas</h3>
            {alertas.length === 0 && (
              <div style={{ fontSize:12.5, color:'var(--faint)', padding:'11px 0' }}>Nenhum alerta no momento.</div>
            )}
            {alertas.map((a,i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5, background:corAlerta(a.tipo) }}/>
                <div style={{ fontSize:12.5, lineHeight:1.45 }}>
                  <span>{a.titulo}</span>
                  <div style={{ color:'var(--faint)', fontSize:11.5, marginTop:1 }}>{a.detalhe}{a.quando ? ` · ${timeAgo(a.quando)}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:16, flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Atividade recente</h3>
            {atividade.map((a,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.fantasia}</div>
                  <div style={{ fontSize:11, color:'var(--faint)' }}>{a.cidade}/{a.uf} · {timeAgo(a.criado_em)}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:scoreColor(a.score) }}>{a.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leads ─────────────────────────────────────────────────────────────────────
function ExportModal({ ids, onClose }) {
  const [loading, setLoading] = useState(false);
  const baixar = async () => {
    setLoading(true);
    try {
      const params = ids.length ? '?ids=' + ids.join(',') : '';
      const r = await fetch('/api/leads/export' + params, { credentials:'same-origin' });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'hunter-leads.csv'; a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (_) {
      alert('Erro ao exportar.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.6)' }}/>
      <div style={{ position:'relative', width:440, maxWidth:'92vw', background:'var(--panel)',
        border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid var(--border)' }}>
          <h2 style={{ fontSize:17, fontWeight:600, margin:'0 0 4px' }}>Exportar lista</h2>
          <p style={{ fontSize:13, color:'var(--dim)', margin:0 }}>{ids.length} lead{ids.length!==1?'s':''} selecionado{ids.length!==1?'s':''}.</p>
        </div>
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:9 }}>Formato</label>
            <div style={{ display:'flex', gap:9 }}>
              <div style={{ flex:1, height:40, borderRadius:9, border:`1.5px solid ${C.gold}`,
                background:'color-mix(in srgb, var(--accent) 10%, transparent)', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:13, fontWeight:600, cursor:'pointer' }}>CSV</div>
            </div>
          </div>
          <div style={{ fontSize:12.5, color:'var(--dim)' }}>
            Inclui: razão social, CNPJ, decisor, cargo, contatos, score e status.
          </div>
        </div>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)',
          display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ height:42, padding:'0 18px', borderRadius:10,
            border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
            fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
          <button onClick={baixar} disabled={loading} style={{ height:42, padding:'0 20px', borderRadius:10,
            border:'none', background:'var(--gold)', color:'#0E1936', fontWeight:600,
            fontSize:13.5, fontFamily:'inherit', cursor:'pointer', opacity:loading?.6:1 }}>
            {loading ? 'Gerando…' : 'Gerar e baixar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Impressão / PDF de lead(s) ────────────────────────────────────────────────
// Gera uma folha limpa (mesma info do painel) e abre o diálogo de impressão do
// navegador (permite "Salvar como PDF"). Serve pra 1 lead ou vários (1 por
// página). Sem dependência, sem servidor.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}
function secaoLeadHtml(l) {
  const esc = escHtml;
  const cv = l.contato_validado || {};
  const sw = l.swot || {};
  const status = l.status || '';
  const listaHtml = (arr) => (Array.isArray(arr) && arr.length)
    ? '<ul>' + arr.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="vazio">—</p>';
  const linha = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || '—')}</td></tr>`;
  const quad = (titulo, arr) => `<div class="q"><h4>${esc(titulo)}</h4>${listaHtml(arr)}</div>`;
  return `<section class="lead">
  <h1>${esc(l.fantasia || l.razao)}</h1>
  <p class="sub">${esc(l.razao)}</p>
  <p class="cnpj">CNPJ ${esc(l.cnpj)}</p>
  <span class="score">Score ${esc(l.score)} / 100 · ${esc(status)}</span>

  <h3>Dados cadastrais · Receita Federal</h3>
  <table>
    ${linha('CNAE principal', l.cnae)}${linha('Setor', l.setor)}${linha('Porte', l.porte)}
    ${linha('Situação', l.situacao)}${linha('Abertura', l.abertura)}${linha('Capital social', l.capital)}
    ${linha('Cidade/UF', [l.cidade, l.uf].filter(Boolean).join('/'))}${linha('Natureza jurídica', l.natureza_juridica)}
    ${linha('Optante Simples', l.opcao_simples == null ? '' : (l.opcao_simples ? 'Sim' : 'Não'))}${linha('Endereço', l.endereco)}
  </table>

  <h3>Decisor</h3>
  <table>${linha('Nome', l.decisor)}${linha('Cargo', l.cargo)}</table>

  <h3>Contato comercial validado</h3>
  <table>
    ${linha('Telefone', cv.telefone)}${linha('WhatsApp', cv.whatsapp)}${linha('E-mail', cv.email)}${linha('Site', cv.website)}
  </table>
  ${cv.resumo_site ? `<div class="callout"><b>Sobre a empresa (site):</b><br>${esc(cv.resumo_site)}</div>` : ''}

  ${sw.resumo || sw.swot ? `<h3>Análise SWOT · briefing</h3>
    ${sw.resumo ? `<p>${esc(sw.resumo)}</p>` : ''}
    ${(Array.isArray(sw.fatos_uteis) && sw.fatos_uteis.length) ? `<div class="q"><h4>Fatos úteis pro contato</h4>${listaHtml(sw.fatos_uteis)}</div>` : ''}
    ${(Array.isArray(sw.dores_provaveis) && sw.dores_provaveis.length) ? `<div class="q"><h4>Dores prováveis</h4>${listaHtml(sw.dores_provaveis)}</div>` : ''}
    <div class="swot" style="margin-top:12px">
      ${quad('Forças', sw.swot?.forcas)}${quad('Fraquezas', sw.swot?.fraquezas)}
      ${quad('Oportunidades', sw.swot?.oportunidades)}${quad('Ameaças', sw.swot?.ameacas)}
    </div>
    ${(sw.sinal_comercial || sw.gancho) ? `<div class="callout" style="margin-top:12px"><b>Sinal comercial:</b> ${esc(sw.sinal_comercial || sw.gancho)}</div>` : ''}
  ` : ''}
  <div class="rod">Gerado pelo Hunter em ${esc(new Date().toLocaleString('pt-BR'))}</div>
</section>`;
}
function abrirImpressaoLeads(leads) {
  const lista = (Array.isArray(leads) ? leads : [leads]).filter(Boolean);
  if (!lista.length) return;
  const titulo = lista.length === 1
    ? escHtml(lista[0].fantasia || lista[0].razao || lista[0].cnpj) + ' — Hunter'
    : `${lista.length} empresas — Hunter`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${titulo}</title>
<style>
  *{box-sizing:border-box} body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:32px;max-width:760px}
  h1{font-size:22px;margin:0 0 2px} .sub{color:#555;margin:0 0 2px} .cnpj{color:#777;font-size:12px;font-family:ui-monospace,monospace}
  .score{display:inline-block;margin-top:8px;padding:3px 10px;border:1px solid #bbb;border-radius:20px;font-size:12px}
  h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;border-bottom:1px solid #ddd;padding-bottom:5px;margin:26px 0 10px}
  table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:5px 8px;vertical-align:top;font-size:13px}
  th{color:#666;font-weight:600;width:38%} tr:nth-child(even){background:#f6f6f6}
  .swot{display:grid;grid-template-columns:1fr 1fr;gap:12px} .q{border:1px solid #e2e2e2;border-radius:8px;padding:10px 12px}
  .q h4{margin:0 0 6px;font-size:12px} ul{margin:0;padding-left:18px} li{margin:2px 0} .vazio{color:#999;margin:0}
  .callout{background:#f2f7ff;border:1px solid #cfe0f7;border-radius:8px;padding:10px 12px;margin-top:8px}
  .rod{margin-top:30px;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:8px}
  .lead + .lead{page-break-before:always}
  @media print{body{margin:12mm}}
</style></head><body>
${lista.map(secaoLeadHtml).join('\n')}
  <script>window.onload=function(){window.print()}<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { window.alert('Permita pop-ups para gerar o PDF/impressão.'); return; }
  w.document.write(html);
  w.document.close();
}

function Leads({ refreshKey, onOpenLead, onCrm }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [emailOnly, setEmailOnly] = useState(false);
  const [filterBusca, setFilterBusca] = useState('');
  const [filterLocal, setFilterLocal] = useState('');
  const [debouncedLocal, setDebouncedLocal] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [buscasOpts, setBuscasOpts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportIds, setExportIds] = useState(null);
  const [tick, setTick] = useState(0);   // força recarregar a lista após ações em lote
  const [varredura, setVarredura] = useState(null);   // { criterio, candidatos } achados após um joinha

  // Atualiza UMA linha no lugar, sem refazer a busca — evita o pisca e a perda
  // da posição de rolagem quando o usuário marca vários leads seguidos.
  const patchLead = (id, patch) =>
    setLeads(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  // Depois de marcar um lead, procura os outros com o MESMO perfil (mesma
  // atividade + mesmo porte) e oferece marcar todos de uma vez.
  const varrerIguais = async (id) => {
    try {
      const r = await fetch('/api/leads/' + id + '/mesmo-perfil', { credentials:'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.candidatos?.length) setVarredura(d);
    } catch (_) {}
  };

  const marcarLote = async () => {
    const ids = (varredura?.candidatos || []).map(c => c.id);
    if (!ids.length) return;
    try {
      const r = await fetch('/api/leads/fora-do-perfil-lote', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids })
      });
      if (r.ok) {
        const set = new Set(ids);
        setLeads(ls => ls.map(l => set.has(l.id)
          ? { ...l, status:'Descartado', contato_status:'fora_do_perfil' } : l));
      }
    } catch (_) {}
    setVarredura(null);
  };
  const debRef = useRef(null);
  const locRef = useRef(null);
  const PER_PAGE = 20;

  // Lista de buscas pra o filtro (mantém todas, aprovadas ou não).
  useEffect(() => {
    fetch('/api/buscas', { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => setBuscasOpts(Array.isArray(d) ? d : (d.buscas || [])))
      .catch(() => {});
  }, []);

  const handleQ = (e) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { setDebouncedQ(v); setPage(1); }, 400);
  };

  const handleLocal = (e) => {
    const v = e.target.value;
    setFilterLocal(v);
    clearTimeout(locRef.current);
    locRef.current = setTimeout(() => { setDebouncedLocal(v); setPage(1); }, 400);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filterStatus) params.set('status', filterStatus);
    if (emailOnly) params.set('email_only', 'true');
    if (filterBusca) params.set('busca_id', filterBusca);
    if (debouncedLocal) params.set('local', debouncedLocal);
    if (filterScore) params.set('score_min', filterScore);
    params.set('page', page);
    fetch('/api/leads?' + params, { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQ, filterStatus, emailOnly, filterBusca, debouncedLocal, filterScore, page, refreshKey, tick]);

  const allSel = leads.length > 0 && leads.every(l => selected.includes(l.id));
  const toggleSel = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const toggleAll = () => setSelected(allSel ? [] : leads.map(l => l.id));

  // Sem checar o r.ok, um erro do servidor virava sucesso silencioso: a seleção
  // limpava, a lista recarregava e nada tinha mudado. Foi assim que "Aprovar" e
  // "Descartar" passaram despercebidos devolvendo 400.
  const batchAction = async (acao) => {
    if (!selected.length) return;
    const r = await fetch('/api/leads/acoes', {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ids: selected, acao })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { window.alert(d.erro || 'Não foi possível concluir a ação.'); return; }
    // Leads que já foram entregues ao CRM não aceitam marcação manual — avisa
    // em vez de deixar o usuário achar que marcou todos.
    if (d.ignorados_crm > 0) {
      window.alert(`${d.ignorados_crm} lead(s) já tinham sido entregues ao CRM pelo motor e não foram alterados — a marcação manual vale só para os que ainda não passaram por lá.`);
    }
    setSelected([]);
    setTick(t => t + 1); // recarrega a lista de fato (setPage no mesmo valor era no-op)
  };

  // Exclusão definitiva (com confirmação): remove os leads da base. Diferente de
  // "Descartar", que só muda o status e mantém a empresa na lista.
  const excluirLote = () => {
    if (!selected.length) return;
    const ok = window.confirm(
      `Excluir definitivamente ${selected.length} empresa${selected.length !== 1 ? 's' : ''} da lista de leads?\n\n` +
      `Esta ação não pode ser desfeita. As empresas excluídas ficam bloqueadas e NÃO reaparecem em buscas futuras.`
    );
    if (!ok) return;
    batchAction('excluir');
  };

  // Re-enriquecer: re-roda a validação de contato + SWOT dos selecionados (busca
  // nova), sem duplicar. Bom pra atualizar dados de leads já existentes.
  const [reenriq, setReenriq] = useState(false);
  const reenriquecerLote = async () => {
    if (!selected.length || reenriq) return;
    setReenriq(true);
    try {
      const r = await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids: selected, acao: 'reenriquecer' })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { window.alert(d.erro || 'Não foi possível re-enriquecer agora.'); return; }
      setSelected([]);
      window.alert(`Re-enriquecimento iniciado para ${d.reenfileirados ?? selected.length} empresa(s). Os dados atualizam em alguns instantes — recarregue a lista ou abra o lead para ver.`);
    } finally { setReenriq(false); }
  };

  // Refazer análise: só o agente SWOT. Não encosta em telefone/e-mail/site —
  // é o botão pra usar quando o contato já está certo e só o briefing ficou
  // vazio ou ruim (o "Re-enriquecer" refaria a busca e sobrescreveria o bom).
  const [regSwot, setRegSwot] = useState(false);
  const regerarSwotLote = async () => {
    if (!selected.length || regSwot) return;
    setRegSwot(true);
    try {
      const r = await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids: selected, acao: 'regerar_swot' })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { window.alert(d.erro || 'Não foi possível refazer a análise agora.'); return; }
      setSelected([]);
      window.alert(`Análise sendo refeita para ${d.reenfileirados ?? selected.length} empresa(s). Os contatos NÃO são alterados. O briefing aparece em alguns instantes — abra o lead para ver.`);
    } finally { setRegSwot(false); }
  };

  // PDF em lote: busca o detalhe completo de cada lead selecionado e gera uma
  // folha com todos (1 empresa por página), mesma info do PDF individual.
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const gerarPdfLote = async () => {
    if (!selected.length || gerandoPdf) return;
    setGerandoPdf(true);
    try {
      const detalhes = await Promise.all(selected.map(id =>
        fetch('/api/leads/' + id, { credentials:'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)
      ));
      abrirImpressaoLeads(detalhes.filter(Boolean));
    } finally { setGerandoPdf(false); }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  const selBtnStyle = (variant) => ({
    height:34, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)',
    background: variant==='gold' ? 'var(--gold)' : 'transparent',
    color: variant==='gold' ? '#0E1936' : variant==='dim' ? 'var(--dim)' : 'var(--text)',
    fontSize:12.5, fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontWeight: variant==='gold'?600:400
  });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <div style={{ position:'relative', flex:1, minWidth:220, maxWidth:320 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth={1.8} strokeLinecap="round"
            style={{ position:'absolute', left:12, top:11 }}>
            <circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input value={q} onChange={handleQ} placeholder="Buscar empresa, decisor…"
            style={{ width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
              background:'var(--panel)', color:'var(--text)', padding:'0 12px 0 34px', fontSize:13, fontFamily:'inherit' }}/>
        </div>
        <select value={filterBusca} onChange={e => { setFilterBusca(e.target.value); setPage(1); }}
          style={{ height:38, padding:'0 10px', borderRadius:9, border:'1px solid var(--border)', maxWidth:220,
            background:'var(--panel)', color: filterBusca ? 'var(--text)' : 'var(--dim)',
            fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Todos os radares</option>
          {buscasOpts.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height:38, padding:'0 10px', borderRadius:9, border:'1px solid var(--border)',
            background:'var(--panel)', color: filterStatus ? 'var(--text)' : 'var(--dim)',
            fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Status</option>
          <option value="Novo">Novo</option>
          <option value="Qualificado">Qualificado</option>
          <option value="Incompleto">Incompleto</option>
          <option value="Enviado">Enviado (todos)</option>
          <option value="Enviado:crm">Enviado · pelo CRM</option>
          <option value="Enviado:manual">Enviado · marcado à mão</option>
          <option value="Descartado">Descartado</option>
        </select>
        <input value={filterLocal} onChange={handleLocal} placeholder="Local (cidade/UF)"
          style={{ height:38, width:150, borderRadius:9, border:'1px solid var(--border)',
            background:'var(--panel)', color:'var(--text)', padding:'0 12px', fontSize:12.5, fontFamily:'inherit' }}/>
        <select value={filterScore} onChange={e => { setFilterScore(e.target.value); setPage(1); }}
          style={{ height:38, padding:'0 10px', borderRadius:9, border:'1px solid var(--border)',
            background:'var(--panel)', color: filterScore ? 'var(--text)' : 'var(--dim)',
            fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Score</option>
          <option value="90">≥ 90</option>
          <option value="75">≥ 75</option>
          <option value="60">≥ 60</option>
          <option value="40">≥ 40</option>
        </select>
        <div style={{ flex:1 }}/>
        <button onClick={() => { setEmailOnly(e => !e); setPage(1); }}
          style={{ height:38, padding:'0 13px', borderRadius:9, fontSize:12.5, fontFamily:'inherit',
            cursor:'pointer', display:'flex', alignItems:'center', gap:7,
            ...(emailOnly
              ? { border:`1px solid ${C.green}`, background:C.green+'1f', color:C.green }
              : { border:'1px solid var(--border)', background:'var(--panel)', color:'var(--dim)' }) }}>
          <SvgMulti w={14} h={14} sw={1.8}><rect x={3} y={5} width={18} height={14} rx={2}/><path d="M3 7l9 6 9-6"/></SvgMulti>
          Só e-mail válido
        </button>
      </div>

      {varredura && (
        <div style={{ display:'flex', alignItems:'center', gap:14, background:'var(--panel2)',
          border:`1px solid ${C.red}`, borderRadius:11, padding:'12px 15px', marginBottom:14,
          animation:'hfade .2s ease', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:260 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>
              Achei {varredura.candidatos.length} lead{varredura.candidatos.length!==1?'s':''} com o mesmo perfil
            </div>
            <div style={{ fontSize:12, color:'var(--faint)', lineHeight:1.5 }}>
              {varredura.criterio?.tipo === 'nome' ? (
                <>Nome contém {varredura.criterio.palavras.map(p => <b key={p}>“{p}”</b>).reduce((a,b) => [a,', ',b])}.
                  Marcar todos de uma vez poupa o clique um a um — e cada um vira exemplo do que evitar.</>
              ) : (
                <>Mesma atividade{varredura.criterio?.setor ? ` (${varredura.criterio.setor})` : ''}
                  {varredura.criterio?.porte ? ` e mesmo porte (${varredura.criterio.porte})` : ''}.
                  <b style={{ color:'#F59E0B' }}> Confira a lista antes:</b> o nome desta empresa não tinha palavra
                  distintiva, então o critério aqui é só a firmografia — e dentro de um mesmo CNAE costuma haver
                  cliente bom e ruim misturados.</>
              )}
            </div>
            <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:6 }}>
              {varredura.candidatos.slice(0, 4).map(c => c.fantasia).join(' · ')}
              {varredura.candidatos.length > 4 ? ` · e mais ${varredura.candidatos.length - 4}` : ''}
            </div>
          </div>
          <button onClick={marcarLote}
            style={{ height:36, padding:'0 15px', borderRadius:9, border:'none', background:C.red,
              color:'#fff', fontWeight:600, fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
            Marcar {varredura.candidatos.length} como fora do perfil
          </button>
          <button onClick={() => setVarredura(null)}
            style={{ height:36, padding:'0 14px', borderRadius:9, border:'1px solid var(--border)',
              background:'transparent', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
            Agora não
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:14, background:'var(--panel2)',
          border:`1px solid ${C.blue}`, borderRadius:11, padding:'10px 14px', marginBottom:14,
          animation:'hfade .2s ease' }}>
          <span style={{ fontSize:13, fontWeight:600, color:C.blue }}>{selected.length} selecionado{selected.length!==1?'s':''}</span>
          <div style={{ width:1, height:20, background:'var(--border)' }}/>
          <button onClick={() => onCrm(selected)} style={selBtnStyle('gold')}>
            <Svg d="M5 12h14M13 5l7 7-7 7" color="#0E1936" w={14} h={14} sw={2}/>
            Enviar ao CRM
          </button>
          <button onClick={() => setExportIds(selected)} style={selBtnStyle('normal')}>Exportar CSV</button>
          <button onClick={gerarPdfLote} disabled={gerandoPdf} style={selBtnStyle('normal')}>
            <Svg d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" w={14} h={14} sw={1.7}/>
            {gerandoPdf ? 'Gerando…' : 'Gerar PDF'}
          </button>
          <button onClick={reenriquecerLote} disabled={reenriq} style={selBtnStyle('normal')}>
            <Svg d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" w={14} h={14} sw={1.7}/>
            {reenriq ? 'Enviando…' : 'Re-enriquecer'}
          </button>
          <button onClick={regerarSwotLote} disabled={regSwot} style={selBtnStyle('normal')}
            title="Refaz só o briefing da IA. Telefone, e-mail e site ficam como estão.">
            <SvgMulti w={14} h={14} sw={1.7}>
              <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17"/>
              <circle cx={12} cy={12} r={4}/>
            </SvgMulti>
            {regSwot ? 'Enviando…' : 'Refazer análise'}
          </button>
          <button onClick={() => batchAction('marcar_enviado')} style={selBtnStyle('normal')}
            title="Marca à mão que estes leads foram entregues ao time de vendas (sem passar pelo CRM).">
            <Svg d="M20 6L9 17l-5-5" color={C.green} w={14} h={14} sw={2.2}/>
            Marcar como enviado
          </button>
          <button onClick={() => batchAction('desmarcar_enviado')} style={selBtnStyle('dim')}
            title="Desfaz a marcação manual. Leads entregues pelo CRM não são afetados.">
            Desmarcar envio
          </button>
          <button onClick={() => batchAction('aprovar')} style={selBtnStyle('normal')}>Aprovar</button>
          <button onClick={() => batchAction('descartar')} style={selBtnStyle('dim')}>Descartar</button>
          <button onClick={excluirLote}
            style={{ height:34, padding:'0 12px', borderRadius:8, border:`1px solid ${C.red}`,
              background:'transparent', color:C.red, fontSize:12.5, fontFamily:'inherit', cursor:'pointer',
              display:'flex', alignItems:'center', gap:7 }}>
            <Svg d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" color={C.red} w={14} h={14} sw={1.7}/>
            Excluir
          </button>
          <div style={{ flex:1 }}/>
          <button onClick={() => setSelected([])} style={{ background:'none', border:'none', color:'var(--faint)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Limpar</button>
        </div>
      )}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'40px 2.3fr 1.1fr .8fr 1.4fr 96px 90px 110px',
          alignItems:'center', gap:10, padding:'12px 18px', borderBottom:'1px solid var(--border)',
          fontSize:11, fontWeight:600, letterSpacing:'.04em', color:'var(--faint)', textTransform:'uppercase' }}>
          <div onClick={toggleAll} style={{ cursor:'pointer' }}><Checkbox checked={allSel}/></div>
          <div>Empresa</div><div>Setor · porte</div><div>Local</div><div>Decisor</div>
          <div>Score</div><div>Contato</div><div>Status</div>
        </div>
        {loading && (
          <div style={{ padding:'28px 18px', fontSize:13, color:'var(--faint)', textAlign:'center' }}>Carregando…</div>
        )}
        {!loading && leads.length === 0 && (
          <div style={{ padding:'28px 18px', fontSize:13, color:'var(--faint)', textAlign:'center' }}>Nenhum lead encontrado.</div>
        )}
        {!loading && leads.map(l => {
          const sel = selected.includes(l.id);
          return (
            <div key={l.id} onClick={() => onOpenLead(l.id)} className="row-hover"
              style={{ display:'grid', gridTemplateColumns:'40px 2.3fr 1.1fr .8fr 1.4fr 96px 90px 110px',
                alignItems:'center', gap:10, padding:'13px 18px',
                borderBottom:'1px solid var(--border)', cursor:'pointer',
                background: sel ? 'var(--panel2)' : 'transparent' }}>
              <div onClick={e => { e.stopPropagation(); toggleSel(l.id); }} style={{ cursor:'pointer' }}>
                <Checkbox checked={sel}/>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.fantasia}</div>
                <div style={{ fontSize:11, color:'var(--faint)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.razao}</div>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.setor}</div>
                <div style={{ fontSize:11, color:'var(--faint)' }}>{l.porte}</div>
              </div>
              <div style={{ fontSize:12.5 }}>{l.cidade}<span style={{ color:'var(--faint)' }}>/{l.uf}</span></div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.decisor}</div>
                <div style={{ fontSize:11, color:'var(--faint)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.cargo}</div>
              </div>
              <ScoreBar score={l.score}/>
              <ContactCell leadId={l.id} emailVal={l.email_valor} phoneVal={l.telefone_valor} onSaved={() => setTick(t => t + 1)}/>
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-start' }}>
                {(() => { const e = envioDoLead(l, l.status); return (
                  <span title={e?.titulo || undefined}
                    style={{ ...badgeStyle(statusColors[l.status]||C.gray), whiteSpace:'nowrap' }}>
                    {e ? e.rotulo : l.status}
                  </span>
                ); })()}
                {l.contato_pendente && (
                  <span title="Sem WhatsApp/telefone — não enviado ao CRM automaticamente"
                    style={{ ...badgeStyle(C.red), whiteSpace:'nowrap' }}>sem contato</span>
                )}
                <ForaDoPerfil leadId={l.id} compacto
                  marcado={l.contato_status === 'fora_do_perfil'}
                  onMudou={(patch) => patchLead(l.id, patch)}
                  onVarrer={varrerIguais}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, fontSize:12, color:'var(--faint)' }}>
        <span>Mostrando {leads.length} de {fmtNum(total)} leads</span>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
            style={{ height:30, width:30, borderRadius:7, border:'1px solid var(--border)',
              background:'var(--panel)', color:'var(--dim)', cursor:'pointer', opacity:page<=1?.4:1 }}>‹</button>
          <span style={{ lineHeight:'30px', fontSize:11 }}>{page}/{totalPages||1}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
            style={{ height:30, width:30, borderRadius:7, border:'1px solid var(--border)',
              background:'var(--panel)', color:'var(--dim)', cursor:'pointer', opacity:page>=totalPages?.4:1 }}>›</button>
        </div>
      </div>

      {exportIds && <ExportModal ids={exportIds} onClose={() => setExportIds(null)}/>}
    </div>
  );
}

// ── Buscas ────────────────────────────────────────────────────────────────────
function Buscas({ onOpen }) {
  const [buscas, setBuscas] = useState(null);

  const carregar = () => {
    fetch('/api/buscas', { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => setBuscas(Array.isArray(d) ? d : (d.buscas || [])))
      .catch(() => setBuscas([]));
  };
  useEffect(carregar, []);

  const excluir = async (e, b) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir o radar "${b.nome}"?\nOs leads dele serão removidos. As empresas continuam no histórico global.`)) return;
    const r = await fetch('/api/buscas/' + b.id, { method:'DELETE', credentials:'same-origin' });
    if (!r.ok) { const d = await r.json().catch(()=>({})); window.alert(d.erro || 'Erro ao excluir.'); return; }
    carregar();
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ position:'relative', flex:1, maxWidth:300 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth={1.8} strokeLinecap="round"
            style={{ position:'absolute', left:12, top:11 }}>
            <circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input placeholder="Buscar por nome…" style={{ width:'100%', height:38, borderRadius:9,
            border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)',
            padding:'0 12px 0 34px', fontSize:13, fontFamily:'inherit' }}/>
        </div>
      </div>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'24px 2fr 1fr 1fr 1.1fr .8fr .8fr .8fr 1fr 40px',
          alignItems:'center', gap:10, padding:'12px 18px', borderBottom:'1px solid var(--border)',
          fontSize:11, fontWeight:600, letterSpacing:'.04em', color:'var(--faint)', textTransform:'uppercase' }}>
          <div/><div>Nome</div><div>Status</div><div>Criada por</div><div>Criada em</div>
          <div>Encontr.</div><div>Qualif.</div><div>CRM</div><div>Atividade</div><div/>
        </div>
        {buscas === null && (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Carregando…</div>
        )}
        {buscas && buscas.length === 0 && (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Nenhum radar encontrado.</div>
        )}
        {buscas && buscas.map(b => (
          <div key={b.id} onClick={() => onOpen(b.id)} className="row-hover"
            style={{ display:'grid', gridTemplateColumns:'24px 2fr 1fr 1fr 1.1fr .8fr .8fr .8fr 1fr 40px',
              alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
            <div><StatusDot color={healthColors[b.health]||C.gray} pulse={b.health==='green'}/></div>
            <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.nome}</div>
            <div><span style={badgeStyle(buscaStatusColors[b.status]||C.gray)}>{b.status}</span></div>
            <div style={{ fontSize:12.5, color:'var(--dim)' }}>{b.criador_nome || b.criador || '—'}</div>
            <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.35 }}>{dataHora(b.criado_em)}</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{fmtNum(b.encontrados ?? b.enc)}</div>
            <div style={{ fontSize:13, color:'var(--dim)' }}>{fmtNum(b.qualificados ?? b.qual)}</div>
            <div style={{ fontSize:13, color:C.cyan }}>{fmtNum(b.enviados ?? b.crm)}</div>
            <div style={{ fontSize:12, color:'var(--faint)' }}>{timeAgo(b.ultima_ativ)}</div>
            <div>
              <button onClick={(e) => excluir(e, b)} title="Excluir radar"
                style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
                  color:'var(--dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <SvgMulti w={15} h={15} sw={1.7}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6"/></SvgMulti>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PerfilMedio: mostra o perfil destilado da lista (lookalike) ────────────────
function PerfilMedio({ perfil }) {
  const confCor = perfil.confianca === 'alta' ? C.green : perfil.confianca === 'média' ? C.gold : '#F59E0B';
  const cnaeNome = c => (_cnaeCache || []).find(x => x.c === c)?.d || c;
  const barra = (label, freq, extra) => (
    <div key={label} style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
        <span style={{ color:'var(--text)' }}>{label}</span>
        <span style={{ color:'var(--faint)', fontVariantNumeric:'tabular-nums' }}>{Math.round(freq*100)}%{extra || ''}</span>
      </div>
      <div style={{ height:5, borderRadius:3, background:'var(--panel2)' }}>
        <div style={{ height:'100%', borderRadius:3, width:`${Math.round(freq*100)}%`, background:C.gold }}/>
      </div>
    </div>
  );
  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:18, marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Perfil médio detectado</h3>
        <span style={{ fontSize:11, padding:'2px 9px', borderRadius:20, color:confCor, border:`1px solid ${confCor}` }}>
          confiança {perfil.confianca}
        </span>
        <span style={{ fontSize:12, color:'var(--faint)' }}>{perfil.amostra} empresas analisadas</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:22 }}>
        <div>
          <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Atividades (CNAE)</div>
          {(perfil.cnaes || []).slice(0, 5).map(x => barra(cnaeNome(x.c), x.freq))}
        </div>
        <div>
          <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>UF</div>
          {(perfil.ufs || []).slice(0, 4).map(x => barra(x.uf, x.freq))}
          <div style={{ fontSize:11.5, color:'var(--faint)', margin:'12px 0 8px', textTransform:'uppercase', letterSpacing:.4 }}>Porte</div>
          {(perfil.portes || []).slice(0, 3).map(x => barra(x.porte, x.freq))}
        </div>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
        {perfil.capitais?.[0] && (
          <span style={{ fontSize:11.5, padding:'4px 10px', borderRadius:7, background:'var(--panel2)', border:'1px solid var(--border)', color:'var(--dim)' }}>
            Capital típico: {perfil.capitais[0].faixa}
          </span>
        )}
        {perfil.simples_prop != null && (
          <span style={{ fontSize:11.5, padding:'4px 10px', borderRadius:7, background:'var(--panel2)', border:'1px solid var(--border)', color:'var(--dim)' }}>
            Simples: {Math.round(perfil.simples_prop*100)}% optantes
          </span>
        )}
        {perfil.abertura?.de && (
          <span style={{ fontSize:11.5, padding:'4px 10px', borderRadius:7, background:'var(--panel2)', border:'1px solid var(--border)', color:'var(--dim)' }}>
            Abertura: {String(perfil.abertura.de).slice(0,4)}–{String(perfil.abertura.ate).slice(0,4)}
          </span>
        )}
      </div>
      {perfil.diagnostico?.length > 0 && (
        <div style={{ borderTop:'1px solid var(--border)', marginTop:14, paddingTop:14 }}>
          <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>
            O que define esta lista
          </div>
          <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:10, lineHeight:1.5 }}>
            Sua lista só tem compradores, então o Hunter mede o quanto cada característica é <b>concentrada</b> entre
            eles e <b>desproporcional</b> em relação ao mercado. O que separa comprador de não-comprador leva mais
            pontos no score; o que aparece espalhado pesa pouco.
          </div>
          {[...perfil.diagnostico].sort((a,b) => b.peso - a.peso).map(d => {
            const rot = { CNAE:'Atividade (CNAE)', UF:'Estado (UF)', PORTE:'Porte', CAPITAL:'Capital', SIMPLES:'Simples' }[d.dim] || d.dim;
            const forca = d.poder >= 0.5 ? 'define bem' : d.poder >= 0.2 ? 'ajuda a definir' : 'quase não define';
            const cor = d.poder >= 0.5 ? C.green : d.poder >= 0.2 ? C.gold : 'var(--faint)';
            return (
              <div key={d.dim} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:12, color:'var(--text)', width:130 }}>{rot}</span>
                <div style={{ flex:1, height:5, borderRadius:3, background:'var(--panel2)' }}>
                  <div style={{ height:'100%', borderRadius:3, width:`${Math.round(d.peso)}%`, background:cor }}/>
                </div>
                <span style={{ fontSize:11.5, color:cor, width:104, textAlign:'right' }}>{forca}</span>
                <span style={{ fontSize:11.5, color:'var(--faint)', width:52, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                  {Math.round(d.peso)} pts
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize:11, color:'var(--faint)', marginTop:12, lineHeight:1.5 }}>
        Esse perfil alimenta a descoberta (busca semelhantes na nossa base) e o Score 1 — quanto mais parecida com o núcleo desta lista, maior a nota do lead.
        O <b>corte de score</b> do radar é o quanto de proximidade você exige: 100 é a cópia do seu cliente típico, e cada característica fora do padrão desconta os pontos da tabela acima.
      </div>
    </div>
  );
}

// Joinha pra baixo: marca o lead como "fora do perfil". Além de descartar, vira
// CONTRAEXEMPLO na lista de semelhantes do radar — o motor passa a saber o que
// EVITAR, não só o que procurar.
function ForaDoPerfil({ leadId, marcado, onMudou, onVarrer, compacto }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const clicar = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/leads/' + leadId + '/fora-do-perfil', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ desfazer: !!marcado })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'erro');
      // Atualiza SÓ esta linha. Recarregar a lista inteira fazia a página piscar
      // e voltar pro topo — insuportável pra marcar vários leads em sequência.
      onMudou && onMudou(marcado
        ? { status:'Novo', contato_status:null }
        : { status:'Descartado', contato_status:'fora_do_perfil' });
      if (!marcado) {
        setMsg(d.aprendeu ? `Aprendido (${d.negativos})` : 'Descartado');
        setTimeout(() => setMsg(null), 3500);
        onVarrer && onVarrer(leadId);   // procura outros iguais a este
      }
    } catch (_) { setMsg('Falhou'); setTimeout(() => setMsg(null), 3000); }
    finally { setBusy(false); }
  };

  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
      <button type="button" onClick={clicar} disabled={busy}
        title={marcado
          ? 'Marcado como fora do perfil — clique pra desfazer'
          : 'Fora do perfil: descarta e ensina o radar a evitar empresas assim'}
        style={{ height: compacto ? 28 : 30, width: compacto ? 28 : 30, borderRadius:8, cursor: busy ? 'wait' : 'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0,
          border:'1px solid ' + (marcado ? C.red : 'var(--border)'),
          background: marcado ? 'color-mix(in srgb, ' + C.red + ' 14%, transparent)' : 'transparent',
          color: marcado ? C.red : 'var(--faint)' }}>
        <Svg d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"
          w={15} h={15} sw={1.7} color="currentColor"/>
      </button>
      {msg && <span style={{ fontSize:11, color:'var(--faint)' }}>{msg}</span>}
    </span>
  );
}

// ── BuscaDetail ───────────────────────────────────────────────────────────────
function BuscaDetail({ buscaId, onBack, onOpenLead, onDuplicar }) {
  const [data, setData] = useState(null);
  const [toggling, setToggling] = useState(false);

  const carregar = () => {
    fetch('/api/buscas/' + buscaId, { credentials:'same-origin' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  };
  useEffect(() => {
    if (!buscaId) return;
    carregar();
    const id = setInterval(carregar, 15000); // auto-refresh enquanto a busca roda
    return () => clearInterval(id);
  }, [buscaId]);

  const toggleStatus = async () => {
    if (!data) return;
    const novoStatus = (data.busca || data).status === 'Ativa' ? 'Pausada' : 'Ativa';
    setToggling(true);
    await fetch('/api/buscas/' + buscaId, {
      method:'PATCH', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ status: novoStatus })
    }).catch(() => {});
    setToggling(false);
    carregar();
  };

  if (!data) return <div style={{ color:'var(--faint)', padding:40, textAlign:'center' }}>Carregando…</div>;

  const b = data.busca || data;
  const leads = data.leads || [];
  const criterios = b.criterios || {};
  const tags = Array.isArray(criterios.chips) && criterios.chips.length
    ? criterios.chips
    : Object.entries(criterios)
        .filter(([k]) => !['params', 'cnaes_rotulos', 'texto', 'query', 'proposta_valor'].includes(k))
        .flatMap(([k, v]) => Array.isArray(v) ? v.map(x => k + ': ' + x) : (typeof v === 'object' ? [] : [k + ': ' + v]))
        .filter(Boolean);
  const proposta = criterios.params?.proposta_valor || criterios.proposta_valor || '';

  const rodarDeNovo = async () => {
    setToggling(true);
    await fetch('/api/buscas/' + buscaId, {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ status: 'Ativa' })
    }).catch(() => {});
    setToggling(false);
    carregar();
  };

  return (
    <div style={{ maxWidth:1180 }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none',
        border:'none', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer',
        marginBottom:14, padding:0 }}>‹ Voltar para radares</button>

      <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:20 }}>
        <div style={{ marginTop:4 }}><StatusDot color={healthColors[b.health]||C.gray} pulse={b.health==='green'}/></div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h1 style={{ fontSize:20, fontWeight:600, margin:0 }}>{b.nome}</h1>
            <span style={badgeStyle(buscaStatusColors[b.status]||C.gray)}>{b.status}</span>
          </div>
          {tags.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:10 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize:12, padding:'5px 10px', borderRadius:7,
                  background:'var(--panel2)', border:'1px solid var(--border)', color:'var(--dim)' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {(b.status === 'Ativa' || b.status === 'Pausada') && (
            <button onClick={toggleStatus} disabled={toggling}
              style={{ height:38, padding:'0 15px', borderRadius:9, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text)', fontSize:13, fontFamily:'inherit', cursor:'pointer',
                opacity:toggling?.6:1 }}>
              {toggling ? '…' : b.status === 'Ativa' ? 'Pausar' : 'Retomar'}
            </button>
          )}
          {(b.status === 'Esgotada' || b.status === 'Encerrada') && (
            <button onClick={rodarDeNovo} disabled={toggling}
              style={{ height:38, padding:'0 15px', borderRadius:9, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text)', fontSize:13, fontFamily:'inherit', cursor:'pointer',
                opacity:toggling?.6:1, display:'inline-flex', alignItems:'center', gap:7 }}>
              <Svg d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" w={14} h={14} sw={1.7}/>
              {toggling ? '…' : 'Rodar de novo'}
            </button>
          )}
          {onDuplicar && (
            <button onClick={() => onDuplicar(b)}
              style={{ height:38, padding:'0 15px', borderRadius:9, border:'1px solid var(--border)',
                background:'transparent', color:'var(--dim)', fontSize:13, fontFamily:'inherit', cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:7 }}>
              <Svg d="M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-2M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" w={14} h={14} sw={1.7}/>
              Duplicar
            </button>
          )}
        </div>
      </div>

      {proposta && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:'.06em', color:'var(--faint)', textTransform:'uppercase', marginBottom:5 }}>O que se vende (alimenta o SWOT)</div>
          <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5 }}>{proposta}</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:18 }}>
        {[['Encontrados', fmtNum(b.enc), 'var(--text)'],
          ['Segmentadas (perfil)', fmtNum((b.qual||0)+(b.sem_contato||0)), C.blue],
          ['Qualificados', fmtNum(b.qual), C.green],
          ['Sem contato', fmtNum(b.sem_contato), C.red],
          ['Fora do perfil', fmtNum(b.fora), C.amber],
          ['Enviados ao CRM', fmtNum(b.crm), C.cyan]].map(([label,val,col]) => (
          <div key={label} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:600, color:col }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:18 }}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Produção ao longo do tempo</h3>
            <span style={{ fontSize:12, color:'var(--faint)' }}>últimos 14 dias</span>
          </div>
          {(b.producao && b.producao.some(v => v > 0)) ? (
            <MiniChart vals={b.producao} color={C.gold}/>
          ) : (
            <div style={{ height:120, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:12.5, color:'var(--faint)' }}>Sem produção ainda — aguardando o motor.</div>
          )}
        </div>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 16px' }}>Universo estimado</h3>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:30, fontWeight:600 }}>{fmtNum(b.enc)}</span>
            <span style={{ fontSize:12.5, color:'var(--faint)' }}>de ~{fmtNum(b.universo_est || 0)} empresas</span>
          </div>
          <ProgressBar pct={b.universo_est ? Math.min(100, Math.round(parseInt(b.enc)/b.universo_est*100)) : 0} color={C.gold}/>
          <div style={{ fontSize:12, color:'var(--faint)', marginTop:12, lineHeight:1.5 }}>
            Última atividade: {timeAgo(b.ultima_ativ)}.
          </div>
        </div>
      </div>

      {criterios.params?.perfil && <PerfilMedio perfil={criterios.params.perfil}/>}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'15px 18px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Leads deste radar</h3>
        </div>
        {leads.length === 0 && (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Nenhum lead ainda.</div>
        )}
        {leads.map(l => (
          <div key={l.id} onClick={() => onOpenLead(l.id)} className="row-hover"
            style={{ display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr 120px 100px',
              alignItems:'center', gap:10, padding:'13px 18px',
              borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
            <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.fantasia}</div>
            <div style={{ fontSize:12.5, color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.decisor}</div>
            <div style={{ fontSize:12.5 }}>{l.cidade}/{l.uf}</div>
            <ScoreBar score={l.score}/>
            <div><span style={badgeStyle(statusColors[l.status]||C.gray)}>{l.status}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Nova Busca ────────────────────────────────────────────────────────────────
const UFS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PORTES_BR = ['Micro','Pequena','Média','Grande'];

// Tabela CNAE (código + descrição) carregada uma vez e cacheada no módulo.
let _cnaeCache = null;
let _municCache = null;
const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtCnae = c => { const d = String(c).padStart(7, '0'); return `${d.slice(0,4)}-${d.slice(4,5)}/${d.slice(5,7)}`; };

const ABERTURA_OPCOES = [
  { k:'qualquer', label:'Qualquer \u00e9poca' },
  { k:'6m',  label:'Abertas nos \u00faltimos 6 meses' },
  { k:'1a',  label:'Abertas no \u00faltimo ano' },
  { k:'2a',  label:'Abertas nos \u00faltimos 2 anos' },
  { k:'5a',  label:'Abertas nos \u00faltimos 5 anos' },
  { k:'+5a', label:'Com mais de 5 anos' },
];
const CAPITAL_OPCOES = [
  { k:'qualquer', label:'Qualquer' },
  { k:'ate50',    label:'At\u00e9 R$ 50 mil', lte:50000 },
  { k:'50a500',   label:'R$ 50 mil a 500 mil', gte:50000, lte:500000 },
  { k:'500a5mi',  label:'R$ 500 mil a 5 mi', gte:500000, lte:5000000 },
  { k:'+5mi',     label:'Acima de R$ 5 mi', gte:5000000 },
];
function foundedFromPreset(k) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const mAgo = m => { const d = new Date(now); d.setMonth(d.getMonth() - m); return iso(d); };
  switch (k) {
    case '6m':  return { gte: mAgo(6) };
    case '1a':  return { gte: mAgo(12) };
    case '2a':  return { gte: mAgo(24) };
    case '5a':  return { gte: mAgo(60) };
    case '+5a': return { lte: mAgo(60) };
    default:    return {};
  }
}

// Reverte os filtros de abertura/capital pra a chave do preset na duplicação.
// Prefere a chave salva (abertura_preset/capital_preset); senão, aproxima.
function capitalInicial(p) {
  if (p?.capital_preset) return p.capital_preset;
  const gte = p?.equity_gte ?? null, lte = p?.equity_lte ?? null;
  if (gte == null && lte == null) return 'qualquer';
  const m = CAPITAL_OPCOES.find(o => (o.gte ?? null) === gte && (o.lte ?? null) === lte);
  return m ? m.k : 'qualquer';
}
function aberturaInicial(p) {
  if (p?.abertura_preset) return p.abertura_preset;
  const gte = p?.founded_gte, lte = p?.founded_lte;
  if (!gte && !lte) return 'qualquer';
  // Aproxima pela distância em meses (datas foram calculadas na criação).
  const mesesAte = iso => { try { return Math.round((Date.now() - new Date(iso).getTime()) / (30.44 * 864e5)); } catch { return null; } };
  if (lte && !gte) return '+5a';   // só limite superior antigo = "mais de 5 anos"
  const m = mesesAte(gte);
  if (m == null) return 'qualquer';
  const alvo = [['6m', 6], ['1a', 12], ['2a', 24], ['5a', 60]];
  let melhor = 'qualquer', dif = Infinity;
  for (const [k, mm] of alvo) { const d = Math.abs(mm - m); if (d < dif) { dif = d; melhor = k; } }
  return melhor;
}

// Dropdown enxuto pra escolher UMA proposta salva na criação do radar. A gestão
// (criar/editar/excluir as até 5) vive na tela Propostas. `value` = texto da
// variação escolhida; `onChange(texto)` sobe pro NovaBusca.
function PropostaDropdown({ value, onChange, inicial }) {
  const [lista, setLista] = useState(null);

  useEffect(() => {
    fetch('/api/propostas', { credentials:'same-origin' })
      .then(r => r.json())
      .then(rows => {
        const arr = Array.isArray(rows) ? rows : [];
        setLista(arr);
        const alvo = (value || inicial || '').trim();
        if (alvo && !value) {
          const m = arr.find(p => (p.texto || '').trim() === alvo);
          if (m) onChange(m.texto);
        }
      })
      .catch(() => setLista([]));
  }, []);

  const arr = lista || [];
  const alvo = (value || '').trim();
  const sel = arr.find(p => (p.texto || '').trim() === alvo);
  const selId = sel ? String(sel.id) : '';

  return (
    <div>
      <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
        O que você vende — proposta de valor <span style={{ color:'var(--faint)' }}>(alimenta o agente SWOT)</span>
      </label>
      {lista === null ? (
        <div style={{ fontSize:12.5, color:'var(--faint)' }}>Carregando…</div>
      ) : arr.length === 0 ? (
        <div style={{ fontSize:12.5, color:'var(--faint)', padding:'11px 12px', borderRadius:10,
          border:'1px dashed var(--border)', background:'var(--panel2)', lineHeight:1.5 }}>
          Nenhuma variação salva ainda. Cadastre suas propostas no menu <b>Propostas</b> e volte aqui pra escolher.
        </div>
      ) : (
        <select value={selId}
          onChange={e => { const p = arr.find(x => String(x.id) === e.target.value); onChange(p ? p.texto : ''); }}
          style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
            background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Nenhuma — o agente usa só CNAE + site</option>
          {arr.map(p => <option key={p.id} value={String(p.id)}>{p.rotulo || ('Variação — ' + (p.texto || '').slice(0, 45))}</option>)}
        </select>
      )}
      {sel && (
        <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.5, marginTop:8, padding:'9px 11px',
          borderRadius:9, background:'var(--panel2)', border:'1px solid var(--border)' }}>{sel.texto}</div>
      )}
      <div style={{ fontSize:11, color:'var(--faint)', marginTop:8, lineHeight:1.4 }}>
        Gerencie suas variações no menu <b>Propostas</b> — salve até 5 e escolha a mais adequada a cada radar.
      </div>
    </div>
  );
}

// ── Semelhantes: gestão das listas de clientes (criar / renomear / excluir) ────
// A lista é a matéria-prima do radar "Semelhantes": o Hunter lê a firmografia
// dessas empresas e destila o perfil de quem compra. Aqui ela vira um item
// reaproveitável — sobe uma vez, usa em quantos radares quiser.
function Semelhantes() {
  const [listas, setListas] = useState(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [aviso, setAviso] = useState(null);   // guardrail: clientes que saíram da esteira
  const [editNome, setEditNome] = useState(null);     // chave da lista em renomeação
  const [editRotulo, setEditRotulo] = useState('');
  const arquivoRef = useRef();

  const carregar = () => {
    fetch('/api/listas', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setListas(Array.isArray(d) ? d : []))
      .catch(() => setListas([]));
  };
  useEffect(() => { carregar(); }, []);

  const cnpjs = useMemo(() => {
    const vistos = new Set(), out = [];
    for (const m of String(texto).matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) {
      const d = m[0].replace(/\D/g, '');
      if (d.length === 14 && !vistos.has(d)) { vistos.add(d); out.push(d); }
    }
    return out;
  }, [texto]);

  // O endpoint recebe o arquivo em base64 dentro de um JSON (não multipart).
  const importarArquivo = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadMsg({ ok:false, txt:'Arquivo muito grande (máx. 10MB).' }); return; }
    setUploadMsg({ ok:true, txt:'Lendo arquivo…' });
    try {
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('falha ao ler'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/cnpjs/extrair', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nome: file.name, base64 })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'erro ao extrair');
      const achados = Array.isArray(d.cnpjs) ? d.cnpjs : [];
      if (!achados.length) {
        setUploadMsg({ ok:false, txt:'Nenhum CNPJ encontrado no arquivo. Se for PDF escaneado (imagem), use um .txt/.csv.' });
        return;
      }
      const jaTem = new Set(texto.split(/[\s,;]+/).map(x => x.replace(/\D/g,'')).filter(x => x.length === 14));
      const novos = achados.filter(c => !jaTem.has(c));
      setTexto(prev => (prev.trim() ? prev.trim() + '\n' : '') + novos.join('\n'));
      setUploadMsg({ ok:true, txt:`${achados.length} CNPJ(s) no arquivo · ${novos.length} novo(s) adicionado(s).` });
      if (!nome.trim()) setNome(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setUploadMsg({ ok:false, txt:'Não consegui ler este arquivo. Tente um .txt, .csv ou PDF com texto.' });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const criar = async () => {
    if (!nome.trim()) { setErro('Dê um nome à lista.'); return; }
    if (cnpjs.length < 3) { setErro(`Poucos CNPJs válidos (${cnpjs.length}). O mínimo são 3 — o recomendado é 15+.`); return; }
    setSalvando(true); setErro(null);
    try {
      const r = await fetch('/api/listas', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nome: nome.trim(), cnpjs })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar a lista.');
      setAviso(d.retirados > 0
        ? `${d.retirados} lead(s) da sua base eram empresas desta lista e saíram da esteira — elas são o modelo da busca, não alvo.`
        : null);
      setCriando(false); setNome(''); setTexto(''); setUploadMsg(null); carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const renomear = async (l) => {
    const novo = editRotulo.trim();
    if (!novo) return;
    const r = await fetch('/api/listas/' + encodeURIComponent(l.nome), {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ rotulo: novo })
    });
    if (r.ok) { setEditNome(null); carregar(); }
    else { const d = await r.json().catch(() => ({})); alert(d.erro || 'Erro ao renomear.'); }
  };

  const excluir = async (l) => {
    if (!window.confirm(`Excluir a lista "${l.rotulo}" e suas ${l.n} empresas?`)) return;
    const r = await fetch('/api/listas/' + encodeURIComponent(l.nome), { method:'DELETE', credentials:'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { carregar(); return; }
    if (r.status === 409) {
      if (!window.confirm(`${d.erro}. Excluir mesmo assim? Esses radares param de se re-perfilar.`)) return;
      const r2 = await fetch('/api/listas/' + encodeURIComponent(l.nome) + '?forcar=1', { method:'DELETE', credentials:'same-origin' });
      if (r2.ok) carregar();
      return;
    }
    alert(d.erro || 'Erro ao excluir.');
  };

  const arr = listas || [];
  const conf = n => n < 6 ? ['baixa','#F59E0B'] : n < 15 ? ['média', C.gold] : ['alta','#4ADE80'];

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, gap:12, flexWrap:'wrap' }}>
        <div style={{ fontSize:12.5, color:'var(--faint)', lineHeight:1.5, maxWidth:560 }}>
          Listas de clientes que já compraram. O Hunter lê a firmografia dessas empresas e monta o perfil de quem
          compra de você — depois procura empresas parecidas. A mesma lista serve para vários radares (regiões e
          cortes diferentes), e quanto maior, mais preciso o perfil. As empresas da lista nunca voltam como lead:
          elas são o modelo da busca, não o alvo.
        </div>
        <button type="button" onClick={() => { setCriando(true); setErro(null); }} disabled={criando}
          style={{ height:38, padding:'0 16px', borderRadius:9, border:'none', background: criando ? 'var(--panel2)' : 'var(--gold)',
            color: criando ? 'var(--faint)' : '#0E1936', fontWeight:600, fontSize:13, fontFamily:'inherit',
            cursor: criando ? 'default' : 'pointer', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:7 }}>
          <Svg d="M12 5v14M5 12h14" w={15} h={15} sw={1.8}/> Nova lista
        </button>
      </div>

      {aviso && (
        <div style={{ background:'var(--panel)', border:'1px solid #4ADE80', borderRadius:11, padding:'11px 14px',
          marginBottom:14, fontSize:12.5, color:'var(--text)', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ flex:1 }}>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)}
            style={{ background:'none', border:'none', color:'var(--faint)', cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>×</button>
        </div>
      )}

      {criando && (
        <div style={{ background:'var(--panel)', border:`1px solid ${C.gold}`, borderRadius:13, padding:18, marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Nova lista</div>
          <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
            placeholder="Nome da lista (ex.: Clientes 2025, Compradores linha refrigeração)"
            style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)', marginBottom:11,
              background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
            <input ref={arquivoRef} type="file" accept=".txt,.csv,.pdf,text/plain,text/csv,application/pdf"
              onChange={e => importarArquivo(e.target.files?.[0])} style={{ display:'none' }}/>
            <button type="button" onClick={() => arquivoRef.current?.click()}
              style={{ height:34, padding:'0 14px', borderRadius:9, border:'1px dashed var(--border)',
                background:'transparent', color:'var(--text)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:7 }}>
              <Svg d="M12 3v12M7 8l5-5 5 5M5 21h14" w={15} h={15} sw={1.7}/>
              Enviar arquivo (.txt, .csv, .pdf)
            </button>
            {uploadMsg && <span style={{ fontSize:11.5, color: uploadMsg.ok ? 'var(--faint)' : '#F59E0B' }}>{uploadMsg.txt}</span>}
          </div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Cole os CNPJs (um por linha ou separados por vírgula), ou envie um arquivo acima."
            style={{ width:'100%', minHeight:110, borderRadius:12, border:'1px solid var(--border)',
              background:'var(--panel2)', color:'var(--text)', padding:12, fontSize:13,
              fontFamily:'inherit', lineHeight:1.6, resize:'vertical' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:9, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color: cnpjs.length >= 3 ? 'var(--text)' : '#F59E0B' }}>
              {cnpjs.length} CNPJ{cnpjs.length === 1 ? '' : 's'} válido{cnpjs.length === 1 ? '' : 's'}
            </span>
            {cnpjs.length > 0 && (() => { const [rot, cor] = conf(cnpjs.length); return (
              <span style={{ fontSize:11, padding:'2px 9px', borderRadius:20, color:cor, border:`1px solid ${cor}` }}>
                confiança do perfil: {rot}
              </span>
            ); })()}
          </div>
          {erro && <div style={{ fontSize:12, color:'#F87171', marginTop:9 }}>{erro}</div>}
          <div style={{ display:'flex', gap:9, marginTop:14 }}>
            <button type="button" onClick={criar} disabled={salvando}
              style={{ height:36, padding:'0 16px', borderRadius:9, border:'none', background:'var(--gold)',
                color:'#0E1936', fontWeight:600, fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar lista'}
            </button>
            <button type="button" onClick={() => { setCriando(false); setErro(null); }}
              style={{ height:36, padding:'0 16px', borderRadius:9, border:'1px solid var(--border)',
                background:'transparent', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {listas === null ? (
        <div style={{ fontSize:13, color:'var(--faint)' }}>Carregando…</div>
      ) : arr.length === 0 && !criando ? (
        <div style={{ fontSize:13, color:'var(--faint)', padding:'28px 18px', textAlign:'center',
          border:'1px dashed var(--border)', borderRadius:12 }}>
          Nenhuma lista ainda. Clique em <b>Nova lista</b> pra subir seus clientes.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {arr.map(l => {
            const [rot, cor] = conf(l.n);
            return (
              <div key={l.nome} style={{ display:'flex', gap:13, alignItems:'center', padding:'14px 16px',
                borderRadius:12, background:'var(--panel)', border:'1px solid var(--border)' }}>
                <Svg d={l.automatica
                  ? 'M21 12a9 9 0 1 1-6.2-8.6M21 3v6h-6'
                  : 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'}
                  color={l.automatica ? C.gold : 'var(--faint)'} w={18} h={18} sw={1.7} extra={{ flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  {editNome === l.nome ? (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input value={editRotulo} onChange={e => setEditRotulo(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') renomear(l); if (e.key === 'Escape') setEditNome(null); }}
                        style={{ flex:1, height:32, borderRadius:8, border:`1px solid ${C.gold}`,
                          background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:13, fontFamily:'inherit' }}/>
                      <button type="button" onClick={() => renomear(l)}
                        style={{ height:32, padding:'0 12px', borderRadius:8, border:'none', background:'var(--gold)',
                          color:'#0E1936', fontWeight:600, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Salvar</button>
                      <button type="button" onClick={() => setEditNome(null)}
                        style={{ height:32, padding:'0 10px', borderRadius:8, border:'1px solid var(--border)',
                          background:'transparent', color:'var(--dim)', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>{l.rotulo}</div>
                      <div style={{ fontSize:12, color:'var(--faint)' }}>
                        {l.n} empresa{l.n === 1 ? '' : 's'} · confiança <span style={{ color:cor }}>{rot}</span>
                        {l.automatica && ' · alimentada pelo CRM automaticamente'}
                      </div>
                    </>
                  )}
                </div>
                {editNome !== l.nome && (
                  <div style={{ display:'flex', gap:7, flexShrink:0 }}>
                    <button type="button" onClick={() => { setEditNome(l.nome); setEditRotulo(l.rotulo); }} title="Renomear"
                      style={{ height:32, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)',
                        background:'transparent', color:'var(--dim)', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>
                      Renomear
                    </button>
                    {!l.automatica && (
                      <button type="button" onClick={() => excluir(l)} title="Excluir"
                        style={{ height:32, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)',
                          background:'transparent', color:'#F87171', fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>
                        Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:16, lineHeight:1.55 }}>
        A lista marcada como <b>alimentada pelo CRM</b> cresce sozinha: cada cliente que o CRM marca como convertido
        entra nela, e os radares ligados a ela refazem o perfil automaticamente. Ela pode ser renomeada, mas não
        excluída. Para usar qualquer lista, crie um radar do tipo <b>Semelhantes</b> e escolha-a no menu suspenso.
      </div>
    </div>
  );
}

// Tela dedicada: gestão das até 5 propostas de valor (criar / editar / excluir).
function Propostas() {
  const [lista, setLista] = useState(null);
  const [editId, setEditId] = useState(null);   // id em edição, 'novo', ou null
  const [rotulo, setRotulo] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => { fetch('/api/propostas', { credentials:'same-origin' })
    .then(r => r.json()).then(rows => setLista(Array.isArray(rows) ? rows : [])).catch(() => setLista([])); };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditId('novo'); setRotulo(''); setTexto(''); setErro(null); };
  const abrirEdit = (p) => { setEditId(p.id); setRotulo(p.rotulo || ''); setTexto(p.texto || ''); setErro(null); };

  const salvar = async () => {
    const t = texto.trim();
    if (!t) { setErro('Escreva a proposta.'); return; }
    setSalvando(true); setErro(null);
    try {
      const novo = editId === 'novo';
      const r = await fetch(novo ? '/api/propostas' : '/api/propostas/' + editId, {
        method: novo ? 'POST' : 'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rotulo: rotulo.trim(), texto: t })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar.');
      setEditId(null); carregar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const excluir = async (p) => {
    if (!window.confirm('Excluir a variação "' + (p.rotulo || 'sem rótulo') + '"?')) return;
    const r = await fetch('/api/propostas/' + p.id, { method:'DELETE', credentials:'same-origin' });
    if (r.ok) carregar();
  };

  const arr = lista || [];
  const cheio = arr.length >= 5;
  const editando = editId != null;

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16, gap:12, flexWrap:'wrap' }}>
        <div style={{ fontSize:12.5, color:'var(--faint)', lineHeight:1.5, maxWidth:560 }}>
          Cadastre até 5 variações de "o que você vende". Na criação de cada radar você escolhe uma —
          é o que o agente SWOT usa pra analisar cada empresa sob a ótica da sua oferta.
        </div>
        <button type="button" onClick={abrirNovo} disabled={cheio || editando}
          style={{ height:38, padding:'0 16px', borderRadius:9, border:'none', background:(cheio||editando) ? 'var(--panel2)' : 'var(--gold)',
            color:(cheio||editando) ? 'var(--faint)' : '#0E1936', fontWeight:600, fontSize:13, fontFamily:'inherit',
            cursor:(cheio||editando) ? 'default' : 'pointer', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:7 }}>
          <Svg d="M12 5v14M5 12h14" w={15} h={15} sw={1.8}/> Nova variação
        </button>
      </div>
      {cheio && !editando && (
        <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:12 }}>Limite de 5 atingido — exclua uma pra criar outra.</div>
      )}

      {editId === 'novo' && (
        <PropostaForm rotulo={rotulo} setRotulo={setRotulo} texto={texto} setTexto={setTexto}
          erro={erro} salvando={salvando} onSalvar={salvar} onCancelar={() => setEditId(null)} titulo="Nova variação"/>
      )}

      {lista === null ? (
        <div style={{ fontSize:13, color:'var(--faint)' }}>Carregando…</div>
      ) : arr.length === 0 && editId !== 'novo' ? (
        <div style={{ fontSize:13, color:'var(--faint)', padding:'28px 18px', textAlign:'center',
          border:'1px dashed var(--border)', borderRadius:12 }}>
          Nenhuma variação ainda. Clique em <b>Nova variação</b> pra criar a primeira.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {arr.map((p, i) => editId === p.id ? (
            <PropostaForm key={p.id} rotulo={rotulo} setRotulo={setRotulo} texto={texto} setTexto={setTexto}
              erro={erro} salvando={salvando} onSalvar={salvar} onCancelar={() => setEditId(null)} titulo="Editar variação"/>
          ) : (
            <div key={p.id} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'14px 16px',
              borderRadius:12, background:'var(--panel)', border:'1px solid var(--border)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{p.rotulo || ('Variação ' + (i + 1))}</div>
                <div style={{ fontSize:12.5, color:'var(--dim)', lineHeight:1.5 }}>{p.texto}</div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button type="button" onClick={() => abrirEdit(p)} title="Editar" disabled={editando}
                  style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
                    color:'var(--dim)', cursor: editando ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: editando ? .5 : 1 }}>
                  <Svg d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" w={15} h={15} sw={1.7}/>
                </button>
                <button type="button" onClick={() => excluir(p)} title="Excluir" disabled={editando}
                  style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
                    color:'var(--dim)', cursor: editando ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity: editando ? .5 : 1 }}>
                  <Svg d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" w={15} h={15} sw={1.7}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropostaForm({ rotulo, setRotulo, texto, setTexto, erro, salvando, onSalvar, onCancelar, titulo }) {
  return (
    <div style={{ padding:16, borderRadius:12, border:'1px solid var(--gold)', background:'var(--panel)', marginBottom:12 }}>
      <div style={{ fontSize:12.5, fontWeight:600, marginBottom:10 }}>{titulo}</div>
      <input value={rotulo} onChange={e => setRotulo(e.target.value)}
        placeholder="Rótulo (opcional) — ex: Pitch clínicas"
        style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--border)',
          background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:12.5, fontFamily:'inherit', marginBottom:9 }}/>
      <textarea value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Ex: software de gestão de agenda para clínicas, que reduz faltas e lota horários ociosos"
        style={{ width:'100%', minHeight:80, borderRadius:8, border:'1px solid var(--border)',
          background:'var(--panel2)', color:'var(--text)', padding:10, fontSize:12.5, fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }}/>
      {erro && <div style={{ fontSize:11.5, color:'#F59E0B', marginTop:6 }}>{erro}</div>}
      <div style={{ display:'flex', gap:8, marginTop:10 }}>
        <button type="button" onClick={onSalvar} disabled={salvando}
          style={{ height:34, padding:'0 16px', borderRadius:8, border:'none', background:C.gold, color:'#0E1936',
            fontWeight:600, fontSize:12.5, fontFamily:'inherit', cursor: salvando ? 'default' : 'pointer', opacity: salvando ? .7 : 1 }}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancelar}
          style={{ height:34, padding:'0 14px', borderRadius:8, border:'1px solid var(--border)', background:'transparent',
            color:'var(--dim)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

// Fichamento comercial do cliente (só master): calibra o agente SWOT sem mexer
// no treinamento técnico base. Preenchido na reunião de onboarding.
const SWOT_PERGUNTAS = [
  { k:'icp',              label:'Cliente ideal (ICP)',            ph:'Que tipo de empresa é o seu melhor cliente? Setor, porte, região, características.' },
  { k:'diferencial',      label:'Diferencial competitivo',        ph:'O que te diferencia? Por que os clientes fecham com você e não com o concorrente?' },
  { k:'dores',            label:'Dores que você resolve',         ph:'Quais problemas do cliente o seu produto/serviço resolve na prática?' },
  { k:'processo',         label:'Modelo de processo comercial',   ph:'Como é o seu processo de vendas? Etapas, ciclo médio, quem decide, quantas reuniões.' },
  { k:'cadencia',         label:'Cadência de abordagem',          ph:'Como o time aborda? Canais (ligação, e-mail, WhatsApp, social), nº de toques, ritmo.' },
  { k:'gatilhos',         label:'Gatilhos de bom timing',         ph:'Que sinais indicam que a empresa é uma boa hora pra abordar? (crescimento, contratação, etc.)' },
  { k:'objecoes',         label:'Objeções comuns',                ph:'Principais objeções que você ouve e como o time costuma contornar.' },
  { k:'desqualificadores',label:'Desqualificadores (mau lead)',   ph:'O que torna uma empresa um MAU lead pra você? Quando descartar de cara.' },
  { k:'concorrentes',     label:'Concorrentes / alternativas',    ph:'Com quem você concorre — incluindo "não fazer nada" ou solução interna do cliente.' },
  { k:'tom',              label:'Tom desejado do briefing',       ph:'Como você quer o briefing? Mais direto e objetivo, mais consultivo, foco em dados…' },
  { k:'observacoes',      label:'Observações adicionais',         ph:'Qualquer outra instrução que ajude o agente a entender o seu negócio.' },
];

function AgenteSwot() {
  const [perfil, setPerfil] = useState(null);   // null = carregando
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    fetch('/api/config', { credentials:'same-origin' })
      .then(r => r.json())
      .then(c => setPerfil((c && typeof c.swot_perfil === 'object' && c.swot_perfil) || {}))
      .catch(() => setPerfil({}));
  }, []);

  const setCampo = (k, v) => { setPerfil(p => ({ ...(p || {}), [k]: v })); setSalvo(false); };

  const salvar = async () => {
    setSalvando(true); setErro(null); setSalvo(false);
    try {
      const r = await fetch('/api/config', {
        method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ swot_perfil: perfil || {} })
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.erro || 'Erro ao salvar.'); }
      setSalvo(true);
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const preenchidos = SWOT_PERGUNTAS.filter(q => String((perfil || {})[q.k] || '').trim()).length;

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ padding:16, borderRadius:12, background:'var(--panel)', border:'1px solid var(--border)', marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Treinamento técnico (base — sempre ativo)</div>
        <div style={{ fontSize:12.5, color:'var(--dim)', lineHeight:1.55 }}>
          O agente já vem treinado pra extrair fatos concretos de cada empresa (site + firmografia + motivo do match),
          montar um SWOT sob a ótica da sua venda e entregar dados úteis pro closer — sem inventar e sem escrever
          mensagem pronta. Isso é fixo e garante a qualidade. Abaixo você <b>personaliza</b> esse agente pro cliente:
          quanto mais completo o fichamento, mais afiada a análise.
        </div>
      </div>

      {perfil === null ? (
        <div style={{ fontSize:13, color:'var(--faint)' }}>Carregando…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {SWOT_PERGUNTAS.map(q => (
            <div key={q.k}>
              <label style={{ display:'block', fontSize:12.5, fontWeight:600, marginBottom:6 }}>{q.label}</label>
              <textarea value={(perfil || {})[q.k] || ''} onChange={e => setCampo(q.k, e.target.value)} placeholder={q.ph}
                style={{ width:'100%', minHeight:64, borderRadius:10, border:'1px solid var(--border)',
                  background:'var(--panel2)', color:'var(--text)', padding:11, fontSize:12.5,
                  fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }}/>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:14, position:'sticky', bottom:0,
            padding:'12px 0', background:'linear-gradient(transparent, var(--bg) 30%)' }}>
            <button type="button" onClick={salvar} disabled={salvando}
              style={{ height:40, padding:'0 20px', borderRadius:9, border:'none', background:C.gold, color:'#0E1936',
                fontWeight:600, fontSize:13, fontFamily:'inherit', cursor: salvando ? 'default' : 'pointer', opacity: salvando ? .7 : 1 }}>
              {salvando ? 'Salvando…' : 'Salvar fichamento'}
            </button>
            <span style={{ fontSize:12, color:'var(--faint)' }}>{preenchidos}/{SWOT_PERGUNTAS.length} campos preenchidos</span>
            {salvo && <span style={{ fontSize:12.5, color:'#4ADE80' }}>✓ Salvo — o agente já usa isso nas próximas análises.</span>}
            {erro && <span style={{ fontSize:12.5, color:'#F59E0B' }}>{erro}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function NovaBusca({ onSalvar, inicial }) {
  // Duplicação: pré-preenche a partir de uma busca existente (só os critérios;
  // data de abertura/capital voltam pro padrão e podem ser reajustados).
  const iniCrit = inicial?.criterios || {};
  const iniP = iniCrit.params || {};
  const iniProposta = iniP.proposta_valor || iniCrit.proposta_valor || '';
  const [tipo, setTipo] = useState(inicial?.tipo || 'icp');
  const [corte, setCorte] = useState(inicial?.corte_score ?? 60);
  const [saving, setSaving] = useState(false);
  const [ufs, setUfs] = useState(Array.isArray(iniP.ufs) ? iniP.ufs : []);
  const [portes, setPortes] = useState(Array.isArray(iniP.portes) ? iniP.portes : []);
  const [cnaeBusca, setCnaeBusca] = useState('');
  const [cnaeSel, setCnaeSel] = useState(
    Array.isArray(iniP.cnaes_rotulos) ? iniP.cnaes_rotulos
      : (Array.isArray(iniP.cnaes) ? iniP.cnaes.map(c => ({ c: String(c), d: fmtCnae(c) })) : []));
  const [kwText, setKwText] = useState(Array.isArray(iniP.keywords) ? iniP.keywords.join(', ') : '');
  // cnpja | web. Com o modo web desligado, força 'cnpja' — inclusive ao duplicar
  // um radar web antigo, senão o formulário abriria sem os campos de CNAE/UF.
  const [modoDesc, setModoDesc] = useState(
    DESCOBERTA_WEB_HABILITADA ? (iniP.modo_descoberta || 'cnpja') : 'cnpja'
  );
  const [cnaeData, setCnaeData] = useState([]);
  const [cnaeFoco, setCnaeFoco] = useState(false);
  const [municBusca, setMunicBusca] = useState('');
  const [municSel, setMunicSel] = useState(Array.isArray(iniP.municipios_rotulos) ? iniP.municipios_rotulos : []);
  const [municData, setMunicData] = useState([]);
  const [municFoco, setMunicFoco] = useState(false);
  const [abertura, setAbertura] = useState(aberturaInicial(iniP));
  const [capital, setCapital] = useState(capitalInicial(iniP));
  const [crmAuto, setCrmAuto] = useState(!!inicial?.crm_auto);
  // Filas do CRM (se houver CRM configurado): permite mandar cada radar pra uma
  // fila diferente. Vazio = usa a fila padrão das Integrações.
  const [crmFilas, setCrmFilas] = useState([]);
  const [crmFilaPadrao, setCrmFilaPadrao] = useState(null);
  const [crmQueue, setCrmQueue] = useState(inicial?.crm_queue_id ? String(inicial.crm_queue_id) : '');
  const [listaCnpj, setListaCnpj] = useState(Array.isArray(iniCrit.cnpjs) ? iniCrit.cnpjs.join('\n') : '');
  const [uploadMsg, setUploadMsg] = useState(null);   // feedback do upload de arquivo
  // Listas de semelhantes salvas (menu Semelhantes). O radar só ESCOLHE uma —
  // criar/renomear/excluir vive na tela dedicada.
  const [listas, setListas] = useState([]);
  const [listaSel, setListaSel] = useState(inicial?.lista || '');

  const arquivoRef = useRef();
  const [iaCarregando, setIaCarregando] = useState(false);
  const [iaSug, setIaSug] = useState(null);   // resultados da IA (ou null)
  const [iaErro, setIaErro] = useState(null);
  const nomeRef = useRef();
  const [propostaSel, setPropostaSel] = useState(iniProposta);   // texto da variação de proposta escolhida

  // Listas salvas (manuais + a automática do CRM), pra escolher em vez de
  // re-subir o mesmo arquivo a cada radar novo.
  const carregarListas = () => {
    fetch('/api/listas', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const arr = Array.isArray(d) ? d : [];
        setListas(arr);
        // Uma lista só? já deixa escolhida — não faz sentido obrigar o clique.
        if (arr.length === 1 && !inicial?.lista) setListaSel(arr[0].nome);
      })
      .catch(() => {});
  };
  useEffect(() => { carregarListas(); }, []);

  // CNPJs válidos (14 dígitos, sem repetição) colados na aba lista/lookalike.
  useEffect(() => {
    fetch('/api/crm/filas', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : { filas: [] })
      .then(d => {
        setCrmFilas(Array.isArray(d.filas) ? d.filas : []);
        setCrmFilaPadrao(d.padrao != null ? String(d.padrao) : null);
      })
      .catch(() => {});
  }, []);

  const crmFilaPadraoNome = crmFilas.find(q => String(q.id) === crmFilaPadrao)?.queue || '';

  const cnpjsParsed = useMemo(() => {
    const vistos = new Set();
    for (const item of listaCnpj.split(/[\s,;]+/)) {
      const c = item.replace(/\D/g, '');
      if (c.length === 14) vistos.add(c);
    }
    return [...vistos];
  }, [listaCnpj]);
  const MIN_LOOKALIKE = 3;

  // Upload de arquivo (.txt/.csv/.pdf) com CNPJs: lê o arquivo, extrai os CNPJs
  // no servidor (grátis, sem consulta paga) e junta ao que já está no campo.
  const importarArquivo = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setUploadMsg({ ok:false, txt:'Arquivo muito grande (máx. 10MB).' }); return; }
    setUploadMsg({ ok:true, txt:'Lendo arquivo…' });
    try {
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('falha ao ler'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/cnpjs/extrair', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nome: file.name, base64 })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro ao extrair');
      if (!d.cnpjs?.length) {
        setUploadMsg({ ok:false, txt:'Nenhum CNPJ encontrado no arquivo. Se for PDF escaneado (imagem), use um .txt/.csv.' });
        return;
      }
      // Junta ao textarea sem duplicar com o que já foi digitado.
      const jaTem = new Set(listaCnpj.split(/[\s,;]+/).map(x => x.replace(/\D/g,'')).filter(x => x.length === 14));
      const novos = d.cnpjs.filter(c => !jaTem.has(c));
      setListaCnpj(prev => (prev.trim() ? prev.trim() + '\n' : '') + novos.join('\n'));
      setUploadMsg({ ok:true, txt:`${d.cnpjs.length} CNPJ(s) no arquivo · ${novos.length} novo(s) adicionado(s).` });
    } catch (e) {
      setUploadMsg({ ok:false, txt: 'Não consegui ler este arquivo. Tente um .txt, .csv ou PDF com texto.' });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  // Palavra-chave no nome/fantasia. Vírgula = OU; dentro de um termo, espaço = E.
  // Removemos conectivos (de, da, e...) pra "Purificador de água" virar E("purificador","água").
  const KW_STOP = new Set(['de','da','do','das','dos','e','com','para','a','o','os','as','em','no','na','ou']);
  const keywords = useMemo(() => kwText.split(/[,;]/).map(t =>
    t.trim().split(/\s+/).filter(w => w && !KW_STOP.has(w.toLowerCase())).join(' ')
  ).filter(Boolean), [kwText]);

  useEffect(() => {
    if (_cnaeCache) { setCnaeData(_cnaeCache); }
    else fetch('/cnae.json', { credentials:'same-origin' }).then(r => r.json())
      .then(d => { _cnaeCache = d; setCnaeData(d); }).catch(() => {});
    if (_municCache) { setMunicData(_municCache); }
    else fetch('/municipios.json', { credentials:'same-origin' }).then(r => r.json())
      .then(d => { _municCache = d; setMunicData(d); }).catch(() => {});
    // Puxa os padrões da tela de Configurações como valores iniciais.
    fetch('/api/config', { credentials:'same-origin' }).then(r => r.json())
      .then(c => { if (c?.corte_padrao != null) setCorte(c.corte_padrao); if (c?.descoberta_modo_padrao) setModoDesc(c.descoberta_modo_padrao); })
      .catch(() => {});
  }, []);

  const municResultados = useMemo(() => {
    const q = semAcento(municBusca.trim());
    if (q.length < 2) return [];
    const out = [];
    for (const m of municData) {
      if (ufs.length && !ufs.includes(m.uf)) continue; // respeita a UF escolhida
      if (semAcento(m.n).includes(q)) { out.push(m); if (out.length >= 25) break; }
    }
    return out;
  }, [municBusca, municData, ufs]);

  const addMunic = m => { setMunicSel(prev => prev.find(x => x.c === m.c) ? prev : [...prev, m]); setMunicBusca(''); };
  const removeMunic = c => setMunicSel(prev => prev.filter(x => x.c !== c));

  // Busca local por PALAVRAS-CHAVE (token), não substring literal: "loja
  // purificador agua" acha CNAEs que contenham essas palavras, rankeado por
  // quantas casaram. Assim linguagem natural já funciona sem IA na maioria dos casos.
  const STOP = new Set(['de','da','do','das','dos','e','em','para','por','com','sem','que','os','as','um','uma','the','of']);
  const cnaeMatch = useMemo(() => {
    const q = semAcento(cnaeBusca.trim());
    if (q.length < 2) return { lista: [], coberturaBaixa: false };
    const qDig = q.replace(/\D/g, '');
    if (qDig.length >= 3 && qDig.length === q.replace(/\s/g,'').length) {
      // busca por código
      return { lista: cnaeData.filter(s => s.c.includes(qDig)).slice(0, 25), coberturaBaixa: false };
    }
    const tokens = q.split(/\s+/).filter(t => t.length >= 3 && !STOP.has(t));
    if (!tokens.length) return { lista: [], coberturaBaixa: false };
    const scored = [];
    for (const s of cnaeData) {
      const d = semAcento(s.d);
      let hits = 0, exatos = 0;
      for (const t of tokens) {
        // Casa só no INÍCIO de palavra. Substring solto trazia lixo: "loja"
        // casava dentro de "aLOJAmento", "agua" dentro de qualquer coisa.
        const i = d.indexOf(t);
        let achou = false;
        for (let p = i; p !== -1; p = d.indexOf(t, p + 1)) {
          if (p === 0 || !/[a-z0-9]/.test(d[p - 1])) {
            achou = true;
            // Palavra inteira (não é só prefixo) vale mais: "agua" em "água"
            // conta mais que "agua" em "aguardente".
            if (p + t.length === d.length || !/[a-z0-9]/.test(d[p + t.length])) exatos++;
            break;
          }
        }
        if (achou) hits++;
      }
      if (hits > 0) scored.push({ s, hits, exatos });
    }
    if (!scored.length) return { lista: [], coberturaBaixa: false };
    // Só considera quem casou MAIS termos. Antes, um CNAE que batia 1 de 3
    // aparecia lado a lado com um que batia os 3 — daí a lista sem sentido.
    const melhor = Math.max(...scored.map(x => x.hits));
    // Casou menos da METADE dos termos? Então é ruído — o termo comercial não
    // existe na CNAE ("purificador", "pet shop"). Nesse caso NÃO mostramos
    // lista nenhuma: exibir resultado errado é pior que não exibir nada, e a
    // busca por IA é o caminho certo. O limiar de metade evita falso positivo:
    // "clinica veterinaria" acha "Atividades veterinárias" casando 1 de 2, e
    // esse resultado está certo.
    if (melhor * 2 < tokens.length) return { lista: [], coberturaBaixa: true };
    return {
      lista: scored
        .filter(x => x.hits === melhor)
        .sort((a, b) => b.exatos - a.exatos || a.s.d.length - b.s.d.length)
        .slice(0, 25)
        .map(x => x.s),
      coberturaBaixa: false,
    };
  }, [cnaeBusca, cnaeData]);
  const cnaeResultados = cnaeMatch.lista;
  const cnaeCoberturaBaixa = cnaeMatch.coberturaBaixa;

  const addCnae = s => { setCnaeSel(prev => prev.find(x => x.c === s.c) ? prev : [...prev, s]); setCnaeBusca(''); setIaSug(null); setIaErro(null); };
  const removeCnae = c => setCnaeSel(prev => prev.filter(x => x.c !== c));

  // Busca inteligente: manda a frase pro backend, que usa a IA pra mapear em CNAEs reais.
  const buscarComIA = async () => {
    const texto = cnaeBusca.trim();
    if (texto.length < 3) return;
    setIaCarregando(true); setIaErro(null); setIaSug(null);
    try {
      const r = await fetch('/api/cnae/sugerir', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ texto })
      });
      const d = await r.json();
      if (d.erro === 'ia_inativa') { setIaErro('A busca inteligente não está disponível no momento. Tente palavras-chave mais simples.'); }
      else if (!r.ok || d.erro) { setIaErro('Não consegui consultar a IA agora. Tente palavras-chave mais simples.'); }
      else if (!d.sugestoes?.length) { setIaErro('A IA não encontrou CNAE para essa descrição. Tente reformular.'); }
      else setIaSug(d.sugestoes);
    } catch (_) { setIaErro('Falha de conexão ao buscar com IA.'); }
    finally { setIaCarregando(false); }
  };

  const tipos = [
    { key:'icp', titulo:'Por perfil (ICP)', desc:'Defina CNAE, UF e porte do cliente ideal.',
      icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12h.01' },
    { key:'cnpj', titulo:'Por CNPJ (um ou lista)', desc:'Cole 1 ou mais CNPJs — cada um vira um lead.',
      icon:'M9 12h6M9 16h6M9 8h2M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z' },
    { key:'lookalike', titulo:'Semelhantes a uma lista', desc:'Suba clientes que já converteram.',
      icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5' },
  ];

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const salvar = async () => {
    const nome = nomeRef.current?.value?.trim();
    if (!nome) { alert('Informe o nome do radar.'); return; }
    if (tipo === 'lookalike' && !listaSel) {
      alert('Escolha a lista de clientes. Se ainda não tem nenhuma, cadastre no menu "Semelhantes".');
      return;
    }
    if (tipo === 'cnpj' && cnpjsParsed.length < 1) {
      alert('Informe ao menos 1 CNPJ válido (14 dígitos).');
      return;
    }
    if (tipo === 'icp' && modoDesc === 'web' && keywords.length === 0) {
      alert('No modo "Pela internet", informe o que buscar (ex.: purificadores de água).');
      return;
    }
    if (tipo === 'icp' && modoDesc === 'cnpja' && cnaeSel.length === 0 && keywords.length === 0 && municSel.length === 0) {
      const ok = window.confirm(
        'Nenhuma atividade, palavra-chave ou município.\n\nO radar vai trazer empresas de TODOS os ramos' +
        (ufs.length ? ' da(s) UF(s) escolhida(s)' : ' do Brasil') +
        '. Para mirar o alvo, escolha uma atividade OU use a "palavra-chave no nome" (ex.: purificador, filtro).\n\nContinuar mesmo assim?'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      // No modo internet, filtros de base cadastral (CNAE/abertura/capital) não se
      // aplicam à descoberta — zera pra não sujar os chips nem o Score 1.
      const isWeb = modoDesc === 'web';
      const cnaes = isWeb ? [] : cnaeSel.map(s => s.c);
      const cnaesRot = isWeb ? [] : cnaeSel;
      const fnd = isWeb ? {} : foundedFromPreset(abertura);
      const cap = isWeb ? {} : (CAPITAL_OPCOES.find(o => o.k === capital) || {});
      const aberturaLabel = ABERTURA_OPCOES.find(o => o.k === abertura)?.label;
      const capitalLabel = CAPITAL_OPCOES.find(o => o.k === capital)?.label;
      const chips = [
        ...(isWeb ? ['Descoberta: internet'] : []),
        ...(keywords.length ? [`${isWeb ? 'Busca' : 'Palavra-chave'}: ${keywords.join(', ')}`] : []),
        ...ufs.map(u => `UF: ${u}`),
        ...municSel.map(m => `Município: ${m.n}`),
        ...portes.map(p => `Porte: ${p}`),
        ...cnaesRot.map(s => `CNAE: ${s.d}`),
        ...(!isWeb && abertura !== 'qualquer' ? [`Abertura: ${aberturaLabel}`] : []),
        ...(!isWeb && capital !== 'qualquer' ? [`Capital: ${capitalLabel}`] : []),
      ];
      const propostaValor = (propostaSel || '').trim();
      const criterios = tipo === 'icp'
        ? { chips, params: {
            ufs, portes, cnaes, cnaes_rotulos: cnaesRot, keywords, modo_descoberta: modoDesc,
            municipios_cod: municSel.map(m => m.c), municipios_rotulos: municSel,
            founded_gte: fnd.gte || null, founded_lte: fnd.lte || null,
            equity_gte: cap.gte ?? null, equity_lte: cap.lte ?? null,
            abertura_preset: abertura, capital_preset: capital,   // guarda a chave pra duplicação reverter certinho
            proposta_valor: propostaValor,
          }, proposta_valor: propostaValor }
        : { cnpjs: cnpjsParsed, proposta_valor: propostaValor };

      // Semelhantes: a lista fica GRAVADA e o radar aponta pra ela. Assim ela
      // aparece na próxima vez e o radar re-perfila sozinho quando ela cresce.
      let listaRadar = null;
      if (tipo === 'lookalike') {
        listaRadar = listaSel;
        // Geografia escolhida na mão: onde procurar os semelhantes (a lista diz
        // O QUE procurar). Vazio = usa as UFs onde os clientes da lista estão.
        criterios.geo = {
          ufs, municipios_cod: municSel.map(m => m.c), municipios_rotulos: municSel,
        };
      }

      const r = await fetch('/api/buscas', {
        method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nome, tipo, corte_score: corte, crm_auto: crmAuto,
          crm_queue_id: crmQueue || null, lista: listaRadar, criterios })
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.erro || 'Erro ao criar radar.'); }
      onSalvar();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth:760 }}>
      <div style={{ display:'flex', gap:12, marginBottom:26 }}>
        {tipos.map(t => {
          const active = tipo === t.key;
          return (
            <div key={t.key} onClick={() => setTipo(t.key)}
              style={{ flex:1, textAlign:'left', padding:18, borderRadius:13, cursor:'pointer',
                background:'var(--panel)', transition:'all .12s',
                border: active ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
                boxShadow: active ? `0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent)` : 'none' }}>
              <Svg d={t.icon} color={active ? C.gold : 'var(--dim)'} sw={1.7}/>
              <div style={{ fontSize:14, fontWeight:600, margin:'11px 0 4px', color: active ? 'var(--text)' : 'var(--dim)' }}>{t.titulo}</div>
              <div style={{ fontSize:12, color:'var(--faint)', lineHeight:1.45 }}>{t.desc}</div>
            </div>
          );
        })}
      </div>

      {tipo === 'icp' ? (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:18 }}>
          {DESCOBERTA_WEB_HABILITADA && (
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--dim)', marginBottom:9 }}>
              Como descobrir as empresas
              <InfoTip text={<>
                <b>Por CNPJ:</b> filtra a base cadastral oficial por atividade, UF e palavra-chave no nome — econômico e direto.<br/><br/>
                <b>Pela internet:</b> busca pelo que a empresa anuncia (como um cliente pesquisaria) e depois confirma os dados
                oficiais — pega nichos que a classificação padrão não cobre. Tende a ser mais caro.
              </>}/>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              {[['cnpja','Por CNPJ'], ['web','Pela internet']].map(([k, t]) => {
                const on = modoDesc === k;
                return (
                  <div key={k} onClick={() => setModoDesc(k)}
                    style={{ flex:1, cursor:'pointer', padding:'11px 13px', borderRadius:10, textAlign:'center',
                      border: on ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
                      background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent' }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color: on ? 'var(--text)' : 'var(--dim)' }}>{t}</div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
          {modoDesc === 'cnpja' && (
          <div style={{ marginBottom:18, position:'relative' }}>
            <label style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
              Atividade — descreva em palavras quem você quer
              <InfoTip text="A descrição vira uma atividade automaticamente. Se a busca não achar nada parecido, use o botão de busca inteligente que aparece logo abaixo do campo."/>
            </label>
            <input value={cnaeBusca}
              onChange={e => { setCnaeBusca(e.target.value); setIaSug(null); setIaErro(null); }}
              onFocus={() => setCnaeFoco(true)}
              onBlur={() => setTimeout(() => setCnaeFoco(false), 150)}
              onKeyDown={e => { if (e.key === 'Enter' && cnaeResultados.length === 0) { e.preventDefault(); buscarComIA(); } }}
              placeholder="Ex: lojas de purificadores de água, clínicas de fisioterapia, transportadoras…"
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            {cnaeFoco && cnaeBusca.trim().length >= 2 && cnaeResultados.length > 0 && (
              <div style={{ position:'absolute', zIndex:30, left:0, right:0, top:'100%', marginTop:4,
                maxHeight:248, overflowY:'auto', background:'var(--panel2)', border:'1px solid var(--border)',
                borderRadius:9, boxShadow:'0 10px 28px rgba(0,0,0,.45)' }}>
                {cnaeResultados.map(s => (
                  <div key={s.c} onMouseDown={() => addCnae(s)} className="row-hover"
                    style={{ padding:'9px 12px', fontSize:12.5, cursor:'pointer', borderBottom:'1px solid var(--border)',
                      display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                    <span>{s.d}</span>
                    <span style={{ color:'var(--faint)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{fmtCnae(s.c)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Busca inteligente (IA): sempre disponível quando há texto — o token
                local traz ruído em frases descritivas, então a IA é o caminho certo. */}
            {cnaeBusca.trim().length >= 3 && (
              <div style={{ marginTop:9, padding:'11px 13px', borderRadius:10, border:'1px dashed var(--border)', background:'var(--panel2)' }}>
                {!iaSug && !iaErro && !iaCarregando && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12.5, color: cnaeCoberturaBaixa ? '#F59E0B' : 'var(--dim)' }}>
                      {cnaeCoberturaBaixa
                        // Achamos só correspondências fracas e preferimos não
                        // listá-las. Diz isso com todas as letras, em vez de um
                        // "nenhuma atividade encontrada" que soa como erro.
                        ? 'A CNAE não tem uma atividade com esse nome comercial. A IA traduz sua descrição nos códigos certos.'
                        : cnaeResultados.length === 0
                          ? 'Nenhuma atividade encontrada por palavra. A IA mapeia a descrição para o CNAE certo.'
                          : 'Não é bem isso? Deixe a IA encontrar o CNAE certo a partir da sua descrição.'}
                    </span>
                    <button type="button" onClick={buscarComIA}
                      style={{ display:'flex', alignItems:'center', gap:7, height:34, padding:'0 14px', borderRadius:9,
                        border:'none', background:C.gold, color:'#0E1936', fontWeight:600, fontSize:12.5, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap' }}>
                      <Svg d="M12 3l1.9 5.8L20 10l-5.1 3.7L16.5 20 12 16.3 7.5 20l1.6-6.3L4 10l6.1-1.2z" color="#0E1936" w={15} h={15} sw={1.6}/>
                      Buscar com IA
                    </button>
                  </div>
                )}
                {iaCarregando && <div style={{ fontSize:12.5, color:'var(--faint)' }}>Consultando a IA…</div>}
                {iaErro && <div style={{ fontSize:12.5, color:'#F59E0B', lineHeight:1.5 }}>{iaErro}</div>}
                {iaSug && iaSug.length > 0 && (
                  <div>
                    <div style={{ fontSize:11.5, color:'var(--faint)', marginBottom:8 }}>Sugestões da IA — clique para adicionar:</div>
                    {iaSug.map(s => (
                      <div key={s.c} onClick={() => addCnae(s)} className="row-hover"
                        style={{ padding:'8px 10px', fontSize:12.5, cursor:'pointer', borderRadius:8,
                          display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                        <span><span style={{ fontSize:10, color:C.gold, border:`1px solid ${C.gold}`, borderRadius:5, padding:'1px 5px', marginRight:7 }}>IA</span>{s.d}</span>
                        <span style={{ color:'var(--faint)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{fmtCnae(s.c)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {cnaeSel.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                {cnaeSel.map(s => (
                  <span key={s.c} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 10px',
                    borderRadius:7, fontSize:11.5, border:`1px solid ${C.gold}`, background:'color-mix(in srgb, var(--accent) 13%, transparent)', color:C.gold }}>
                    {s.d}
                    <span onClick={() => removeCnae(s.c)} title="Remover"
                      style={{ cursor:'pointer', fontWeight:700, fontSize:13, lineHeight:1, opacity:.8 }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          )}
          <div style={{ marginBottom:18 }}>
            {modoDesc === 'cnpja' ? (
              <label style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                Palavra-chave no nome <span style={{ color:'var(--faint)', marginLeft:4 }}>(opcional)</span>
                <InfoTip text={<>
                  Busca no nome/razão social da empresa — use quando o ramo não tem uma atividade específica (ex.: purificadores).<br/><br/>
                  <b>Vírgula = OU</b> (purificador, filtro → tem um ou outro). <b>Espaço = E</b> (purificador água → tem os dois
                  no nome). Dica: uma palavra específica já basta. Pode combinar com atividade/UF.
                </>}/>
              </label>
            ) : (
              <label style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                O que buscar na internet
                <InfoTip text="Escreva como um cliente pesquisaria (ex.: purificadores de água). É o termo da busca — UF e município abaixo miram a região. Depois de achar, o sistema confirma os dados oficiais e segue a qualificação normal."/>
              </label>
            )}
            <input value={kwText} onChange={e => setKwText(e.target.value)}
              placeholder={modoDesc === 'cnpja'
                ? 'Ex: purificador, filtro, água — separe por vírgula'
                : 'Ex: purificadores de água, energia solar, clínicas de estética…'}
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            {keywords.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                {keywords.map((k, i) => (
                  <span key={i} style={{ padding:'5px 10px', borderRadius:7, fontSize:11.5,
                    border:`1px solid ${C.gold}`, background:'color-mix(in srgb, var(--accent) 13%, transparent)', color:C.gold }}>{k}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>UFs</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {UFS_BR.map(u => (
                <span key={u} onClick={() => toggle(ufs, setUfs, u)}
                  style={{ cursor:'pointer', padding:'5px 10px', borderRadius:7, fontSize:11.5,
                    border: ufs.includes(u) ? `1px solid ${C.gold}` : '1px solid var(--border)',
                    background: ufs.includes(u) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
                    color: ufs.includes(u) ? C.gold : 'var(--dim)' }}>{u}</span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Porte</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {PORTES_BR.map(p => (
                <span key={p} onClick={() => toggle(portes, setPortes, p)}
                  style={{ cursor:'pointer', padding:'5px 12px', borderRadius:7, fontSize:11.5,
                    border: portes.includes(p) ? `1px solid ${C.gold}` : '1px solid var(--border)',
                    background: portes.includes(p) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
                    color: portes.includes(p) ? C.gold : 'var(--dim)' }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:18, position:'relative' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
              Municípios <span style={{ color:'var(--faint)' }}>(opcional — busque por nome{ufs.length ? `, dentro de ${ufs.join('/')}` : ''})</span>
            </label>
            <input value={municBusca}
              onChange={e => setMunicBusca(e.target.value)}
              onFocus={() => setMunicFoco(true)}
              onBlur={() => setTimeout(() => setMunicFoco(false), 150)}
              placeholder="Ex: Porto Alegre, Caxias do Sul…"
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            {municFoco && municBusca.trim().length >= 2 && (
              <div style={{ position:'absolute', zIndex:30, left:0, right:0, top:'100%', marginTop:4,
                maxHeight:248, overflowY:'auto', background:'var(--panel2)', border:'1px solid var(--border)',
                borderRadius:9, boxShadow:'0 10px 28px rgba(0,0,0,.45)' }}>
                {municData.length === 0 ? (
                  <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Carregando municípios…</div>
                ) : municResultados.length === 0 ? (
                  <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Nenhum município encontrado{ufs.length ? ' nessa(s) UF(s)' : ''}.</div>
                ) : municResultados.map(m => (
                  <div key={m.c} onMouseDown={() => addMunic(m)} className="row-hover"
                    style={{ padding:'9px 12px', fontSize:12.5, cursor:'pointer', borderBottom:'1px solid var(--border)',
                      display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                    <span>{m.n}</span>
                    <span style={{ color:'var(--faint)', flexShrink:0 }}>{m.uf}</span>
                  </div>
                ))}
              </div>
            )}
            {municSel.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                {municSel.map(m => (
                  <span key={m.c} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 10px',
                    borderRadius:7, fontSize:11.5, border:`1px solid ${C.gold}`, background:'color-mix(in srgb, var(--accent) 13%, transparent)', color:C.gold }}>
                    {m.n} · {m.uf}
                    <span onClick={() => removeMunic(m.c)} title="Remover"
                      style={{ cursor:'pointer', fontWeight:700, fontSize:13, lineHeight:1, opacity:.8 }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {modoDesc === 'cnpja' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:18 }}>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Data de abertura</label>
              <select value={abertura} onChange={e => setAbertura(e.target.value)}
                style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                  background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
                {ABERTURA_OPCOES.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Capital social</label>
              <select value={capital} onChange={e => setCapital(e.target.value)}
                style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                  background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
                {CAPITAL_OPCOES.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
              </select>
            </div>
          </div>
          )}
          <PropostaDropdown value={propostaSel} onChange={setPropostaSel} inicial={iniProposta}/>
        </div>
      ) : (() => {
        const n = cnpjsParsed.length;
        // Importação direta aceita a partir de 1 CNPJ (consulta grátis na Receita);
        // lookalike precisa de amostra pra traçar o perfil médio.
        const minimo = tipo === 'lookalike' ? MIN_LOOKALIKE : 1;
        const ok = n >= minimo;
        const conf = n < 6 ? 'baixa' : n < 15 ? 'média' : 'alta';
        const confCor = conf === 'alta' ? '#4ADE80' : conf === 'média' ? C.gold : '#F59E0B';
        return (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:18 }}>
          {tipo === 'lookalike' && (
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                Lista de clientes <span style={{ color:'var(--faint)' }}>(quem já compra de você)</span>
              </label>
              {listas.length === 0 ? (
                <div style={{ fontSize:12.5, color:'var(--faint)', padding:'12px 14px', borderRadius:10,
                  border:'1px dashed var(--border)', lineHeight:1.5 }}>
                  Nenhuma lista cadastrada ainda. Suba seus clientes no menu <b>Semelhantes</b> e volte aqui pra escolher.
                </div>
              ) : (
                <>
                  <select value={listaSel} onChange={e => setListaSel(e.target.value)}
                    style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                      background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}>
                    <option value="">Escolha uma lista…</option>
                    {listas.map(l => (
                      <option key={l.nome} value={l.nome}>
                        {l.rotulo} — {l.n} empresa{l.n === 1 ? '' : 's'}{l.automatica ? ' (do CRM)' : ''}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const l = listas.find(x => x.nome === listaSel);
                    if (!l) return null;
                    const [rot, cor] = l.n < 6 ? ['baixa','#F59E0B'] : l.n < 15 ? ['média', C.gold] : ['alta','#4ADE80'];
                    return (
                      <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:8, lineHeight:1.5 }}>
                        Confiança do perfil: <span style={{ color:cor }}>{rot}</span> ({l.n} empresas).
                        {l.automatica && ' Esta lista cresce sozinha a cada conversão recebida do CRM, e o radar refaz o perfil junto.'}
                      </div>
                    );
                  })()}
                  <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:8, lineHeight:1.5 }}>
                    Gerencie suas listas no menu <b>Semelhantes</b> — suba, renomeie e reaproveite em quantos radares quiser.
                  </div>
                </>
              )}
            </div>
          )}

          {tipo !== 'lookalike' && (
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>
            {tipo === 'lookalike' ? 'Empresas desta lista' : 'Cole a lista de CNPJs a importar'}
          </div>
          )}
          {tipo !== 'lookalike' && (<>
          <div style={{ fontSize:12, color:'var(--faint)', marginBottom:12, lineHeight:1.45 }}>
            {tipo === 'lookalike'
              ? 'O sistema lê a firmografia dessas empresas (grátis), monta um perfil médio — CNAE, UF, porte, capital — e busca semelhantes na nossa base de empresas ativas. Quanto mais clientes, mais preciso o perfil.'
              : 'Cada CNPJ vira um lead e passa por todo o pipeline (contato, SWOT, CRM). Não expande para semelhantes.'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
            <input ref={arquivoRef} type="file" accept=".txt,.csv,.pdf,text/plain,text/csv,application/pdf"
              onChange={e => importarArquivo(e.target.files?.[0])} style={{ display:'none' }}/>
            <button type="button" onClick={() => arquivoRef.current?.click()}
              style={{ height:34, padding:'0 14px', borderRadius:9, border:'1px dashed var(--border)',
                background:'transparent', color:'var(--text)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:7 }}>
              <Svg d="M12 3v12M7 8l5-5 5 5M5 21h14" w={15} h={15} sw={1.7}/>
              Enviar arquivo (.txt, .csv, .pdf)
            </button>
            {uploadMsg && (
              <span style={{ fontSize:11.5, color: uploadMsg.ok ? 'var(--faint)' : '#F59E0B' }}>{uploadMsg.txt}</span>
            )}
          </div>
          <textarea value={listaCnpj} onChange={e => setListaCnpj(e.target.value)}
            placeholder="Cole os CNPJs (um por linha, ou separados por vírgula), ou envie um arquivo acima. Ex: 12.345.678/0001-90"
            style={{ width:'100%', minHeight:110, borderRadius:12, border:'1px solid var(--border)',
              background:'var(--panel2)', color:'var(--text)', padding:12, fontSize:13,
              fontFamily:'inherit', lineHeight:1.6, resize:'vertical' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:9, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:600, color: ok ? 'var(--text)' : '#F59E0B' }}>
              {n} CNPJ{n === 1 ? '' : 's'} válido{n === 1 ? '' : 's'}
            </span>
            {n > 0 && tipo === 'lookalike' && (
              <span style={{ fontSize:11, padding:'2px 9px', borderRadius:20, color:confCor,
                border:`1px solid ${confCor}`, background:'transparent' }}>
                confiança do perfil: {conf}
              </span>
            )}
            {!ok && (
              <span style={{ fontSize:11.5, color:'#F59E0B' }}>
                mínimo {minimo}{tipo === 'lookalike' ? ' · recomendado 15+' : ''}
              </span>
            )}
          </div>
          </>)}

          {tipo === 'lookalike' && (
            <div style={{ marginTop:18, borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Onde procurar os semelhantes</div>
              <div style={{ fontSize:12, color:'var(--faint)', marginBottom:12, lineHeight:1.45 }}>
                A lista define <b>o que</b> procurar (atividade, porte, perfil). Aqui você define <b>onde</b>.
                Deixe em branco para procurar nos mesmos estados onde os clientes da lista já estão.
              </div>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                Estados <span style={{ color:'var(--faint)' }}>(opcional)</span>
              </label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
                {UFS_BR.map(u => (
                  <span key={u} onClick={() => toggle(ufs, setUfs, u)}
                    style={{ cursor:'pointer', padding:'5px 10px', borderRadius:7, fontSize:11.5,
                      border: ufs.includes(u) ? `1px solid ${C.gold}` : '1px solid var(--border)',
                      background: ufs.includes(u) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
                      color: ufs.includes(u) ? C.gold : 'var(--dim)' }}>{u}</span>
                ))}
              </div>
              <div style={{ position:'relative' }}>
                <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                  Cidades <span style={{ color:'var(--faint)' }}>(opcional{ufs.length ? ` — dentro de ${ufs.join('/')}` : ''})</span>
                </label>
                <input value={municBusca}
                  onChange={e => setMunicBusca(e.target.value)}
                  onFocus={() => setMunicFoco(true)}
                  onBlur={() => setTimeout(() => setMunicFoco(false), 150)}
                  placeholder="Ex: Curitiba, Joinville…"
                  style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                    background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
                {municFoco && municBusca.trim().length >= 2 && (
                  <div style={{ position:'absolute', zIndex:30, left:0, right:0, top:'100%', marginTop:4,
                    maxHeight:248, overflowY:'auto', background:'var(--panel2)', border:'1px solid var(--border)',
                    borderRadius:9, boxShadow:'0 10px 28px rgba(0,0,0,.45)' }}>
                    {municData.length === 0 ? (
                      <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Carregando municípios…</div>
                    ) : municResultados.length === 0 ? (
                      <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Nenhuma cidade encontrada{ufs.length ? ' nessa(s) UF(s)' : ''}.</div>
                    ) : municResultados.map(m => (
                      <div key={m.c} onMouseDown={() => addMunic(m)} className="row-hover"
                        style={{ padding:'9px 12px', fontSize:12.5, cursor:'pointer', borderBottom:'1px solid var(--border)',
                          display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                        <span>{m.n}</span>
                        <span style={{ color:'var(--faint)', flexShrink:0 }}>{m.uf}</span>
                      </div>
                    ))}
                  </div>
                )}
                {municSel.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                    {municSel.map(m => (
                      <span key={m.c} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 10px',
                        borderRadius:7, fontSize:11.5, border:`1px solid ${C.gold}`, background:'color-mix(in srgb, var(--accent) 13%, transparent)', color:C.gold }}>
                        {m.n} · {m.uf}
                        <span onClick={() => removeMunic(m.c)} title="Remover"
                          style={{ cursor:'pointer', fontWeight:700, fontSize:13, lineHeight:1, opacity:.8 }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {(ufs.length > 0 || municSel.length > 0) && (
                <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:11, lineHeight:1.5 }}>
                  Como você fixou a região, o estado deixa de valer pontos no score (todas as empresas encontradas já
                  estarão aí) e esses pontos vão para atividade, porte e capital — o que de fato diferencia uma empresa da outra.
                </div>
              )}
            </div>
          )}

          {(tipo === 'lookalike' || tipo === 'cnpj') && (
            <div style={{ marginTop:18, borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <PropostaDropdown value={propostaSel} onChange={setPropostaSel} inicial={iniProposta}/>
            </div>
          )}
        </div>
        );
      })()}

      {tipo === 'icp' && modoDesc === 'cnpja' && cnaeSel.length === 0 && keywords.length === 0 && municSel.length === 0 && (
        <div style={{ display:'flex', gap:11, padding:'13px 15px', marginBottom:18, borderRadius:12,
          background:'color-mix(in srgb, var(--amber, #FBBF24) 12%, transparent)',
          border:'1px solid color-mix(in srgb, #FBBF24 45%, transparent)' }}>
          <Svg d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
            color="#FBBF24" w={20} h={20} sw={1.7} extra={{ flexShrink:0, marginTop:1 }}/>
          <div style={{ fontSize:12.5, lineHeight:1.5 }}>
            <b>Critério muito amplo.</b> Sem atividade, palavra-chave ou município, o radar varre {ufs.length ? `todas as empresas de ${ufs.join('/')}` : 'o Brasil inteiro'} —
            isso traz nicho errado e <b>consome muito crédito</b>. Escolha ao menos uma atividade, palavra-chave ou município.
          </div>
        </div>
      )}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px 22px' }}>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Nome do Radar</label>
            <input ref={nomeRef} defaultValue={inicial?.nome ? inicial.nome + ' (cópia)' : ''} placeholder="Ex: Agências de marketing — Sul"
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
              <label style={{ fontSize:12, color:'var(--dim)' }}>Corte do Score 1</label>
              <span style={{ fontSize:13, fontWeight:600, color:C.gold }}>{corte} pts</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={corte} onChange={e => setCorte(+e.target.value)}
              style={{ width:'100%', accentColor:'var(--accent)', cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, color:'var(--faint)', marginTop:5 }}>
              <span>permissivo</span><span>rigoroso</span>
            </div>
            <div style={{ fontSize:11, color:'var(--faint)', marginTop:8, lineHeight:1.4 }}>
              O volume é controlado por um teto diário geral (em Configurações), não por radar — o Hunter faz várias
              camadas de garimpo e qualificação, então o limite diário já basta.
            </div>
          </div>
          <div style={{ gridColumn:'1 / -1', borderTop:'1px solid var(--border)', paddingTop:16 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:9 }}>Envio ao CRM (webhook)</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['manual','Manual — envio após triagem'],['auto','Automático — envia ao concluir a análise']].map(([k,label]) => {
                const ativo = (k === 'auto') === crmAuto;
                return (
                  <div key={k} onClick={() => setCrmAuto(k === 'auto')}
                    style={{ flex:1, cursor:'pointer', padding:'11px 13px', borderRadius:10, fontSize:12.5, lineHeight:1.35,
                      border: ativo ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
                      background: ativo ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      color: ativo ? 'var(--text)' : 'var(--dim)' }}>
                    {label}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize:11, color:'var(--faint)', marginTop:7, lineHeight:1.4 }}>
              No automático, cada lead aprovado é enviado ao webhook após o SWOT. No manual, você envia pela triagem. Configure a URL em Integrações.
            </div>
            {crmFilas.length > 0 && (
              <div style={{ marginTop:16 }}>
                <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
                  Fila do CRM para os leads deste radar
                </label>
                <select value={crmQueue} onChange={e => setCrmQueue(e.target.value)}
                  style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                    background:'var(--panel2)', color:'var(--text)', padding:'0 10px', fontSize:13,
                    fontFamily:'inherit', cursor:'pointer' }}>
                  <option value="">Usar a fila padrão das Integrações{crmFilaPadraoNome ? ` (${crmFilaPadraoNome})` : ''}</option>
                  {crmFilas.map(q => <option key={q.id} value={String(q.id)}>{q.queue}</option>)}
                </select>
                <div style={{ fontSize:11, color:'var(--faint)', marginTop:7, lineHeight:1.4 }}>
                  Cada radar pode cair numa fila diferente do CRM. Deixe no padrão se não quiser separar.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={salvar} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:8, height:46, padding:'0 24px', borderRadius:11,
            border:'none', background:'var(--gold)', color:'#0E1936', fontWeight:600, fontSize:14,
            fontFamily:'inherit', cursor:'pointer', opacity:saving?.6:1 }}>
          <Svg d="M5 12h14M13 5l7 7-7 7" color="#0E1936" w={16} h={16} sw={2}/>
          {saving ? 'Criando radar…' : 'Criar Radar'}
        </button>
      </div>
    </div>
  );
}

// ── Integrações ───────────────────────────────────────────────────────────────
const INTEGRACOES_META = {
  'descoberta|cnpja': { nome:'Descoberta de empresas', provedor:'CNPJá',
    icon:'M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', editavel:true },
  'contato|google': { nome:'Contato comercial (Google Meu Negócio)', provedor:'Places API — telefone/WhatsApp + site → e-mail',
    icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18', editavel:true, placeholder:'Colar chave da Places API…' },
  'contato|econodata': { nome:'Contato do decisor (premium)', provedor:'Econodata (match por CNPJ) — opcional',
    icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5', editavel:true, placeholder:'Colar x-api-token…' },
  'busca_web|searxng': { nome:'Busca na web (grátis, própria)', provedor:'SearXNG — servidor próprio, sem cota. É tentado ANTES da Tavily, então o que ele achar não gasta crédito',
    icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18', editavel:false },
  'busca_web|tavily': { nome:'Busca na web (paga, reserva)', provedor:'Tavily — usada quando o SearXNG não acha (sem nenhuma das duas: busca grátis mais fraca)',
    icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18', editavel:true, placeholder:'Colar chave da Tavily (tvly-…)…' },
  'crm|gk': { nome:'CRM GK SaaS (nativo)', provedor:'Contato + ticket automático na fila',
    icon:'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z', especial:'gk' },
  'crm|webhook': { nome:'CRM via Webhook', provedor:'Qualquer CRM (URL de webhook / n8n)',
    icon:'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z', editavel:true, placeholder:'Colar URL do webhook…', temSegredo:true },
  'validacao_email|neverbounce': { nome:'Validação de e-mail', provedor:'NeverBounce',
    icon:'M3 5h18v14H3zM3 7l9 6 9-6', editavel:false },
  'validacao_tel|twilio': { nome:'Validação de telefone', provedor:'Twilio Lookup',
    icon:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z', editavel:false },
  'ia|openai': { nome:'Inteligência (IA) — agente SWOT', provedor:'OpenAI (gpt-4o-mini)',
    icon:'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17', editavel:true,
    temModelo:true, modeloPlaceholder:'modelo (padrão gpt-4o-mini)' },
  'ia|openrouter': { nome:'Inteligência (IA) — OpenRouter', provedor:'OpenRouter — preferida quando ativa; sem crédito, cai na OpenAI',
    icon:'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17', editavel:true,
    placeholder:'Colar chave da OpenRouter (sk-or-…)…',
    temModelo:true, modeloPlaceholder:'modelo (ex.: meta-llama/llama-3.3-70b-instruct:free)' },
};
const INTEGRACOES_ORDEM = ['descoberta|cnpja', 'contato|google', 'contato|econodata', 'busca_web|searxng', 'busca_web|tavily', 'ia|openrouter', 'ia|openai', 'crm|gk', 'crm|webhook'];

// Card especial do CRM GK: fluxo em etapas (conexão → empresas → filas → salvar).
function IntegracaoGK({ row, meta, onSaved }) {
  const cfg = row?.config || {};
  const [backend, setBackend] = useState(cfg.backend || '');
  const [token, setToken] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [companyId, setCompanyId] = useState(cfg.companyId || '');
  const [queueId, setQueueId] = useState(cfg.queueId || '');
  const [conectando, setConectando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [desconectando, setDesconectando] = useState(false);

  const conectado = !!(row && row.ativo && row.tem_chave && cfg.backend && cfg.queueId);

  const desconectar = async () => {
    if (!row) return;
    if (!window.confirm('Desconectar o CRM GK SaaS? O Hunter para de enviar leads pra ele até você reativar.')) return;
    setDesconectando(true);
    try {
      const r = await fetch('/api/integracoes/' + row.id, {
        method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ativo:false })
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.erro || 'Erro ao desconectar.'); }
      onSaved();
    } catch (e) { setErro(e.message); }
    finally { setDesconectando(false); }
  };

  const conectar = async () => {
    setErro(null); setMsg(null); setConectando(true);
    try {
      const r = await fetch('/api/integracoes/gk/conectar', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ backend: backend.trim(), token: token.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao conectar.');
      setEmpresas(d.empresas || []);
      setFilas(d.filas || []);
      if ((d.empresas || []).length === 1) setCompanyId(d.empresas[0].id);
      setMsg('Conexão OK — selecione empresa e fila e salve.');
    } catch (e) { setErro(e.message); }
    finally { setConectando(false); }
  };

  const salvar = async () => {
    if (!backend.trim() || !token.trim()) { setErro('Informe Backend e Token.'); return; }
    // A empresa só é exigida quando o token dá acesso a VÁRIAS (aí é preciso
    // escolher qual). Token com escopo de uma única empresa não lista nenhuma —
    // o próprio CRM já sabe a empresa, e exigir a escolha travava o salvamento.
    if (empresas.length > 0 && !companyId) { setErro('Selecione a empresa (o token dá acesso a mais de uma).'); return; }
    if (!queueId) { setErro('Selecione a fila padrão.'); return; }
    setErro(null); setSalvando(true);
    try {
      const r = await fetch('/api/integracoes', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ categoria:'crm', provedor:'gk', ativo:true, key: token.trim(),
          config: { backend: backend.trim(), companyId: companyId || null, queueId, status:'pending' } })
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.erro || 'Erro ao salvar.'); }
      setToken('');
      onSaved();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  };

  const inputStyle = { width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
    background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:12.5, fontFamily:'inherit' };
  const selStyle = { ...inputStyle, cursor:'pointer' };

  return (
    <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
        <div style={{ width:42, height:42, borderRadius:11, background:'var(--panel2)',
          display:'flex', alignItems:'center', justifyContent:'center', color:'var(--dim)', flexShrink:0 }}>
          <Svg d={meta.icon} w={20} h={20} sw={1.6}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ fontSize:14.5, fontWeight:600 }}>{meta.nome}</span>
            <span style={badgeStyle(conectado ? C.green : C.gray)}>
              <StatusDot color={conectado ? C.green : C.gray} pulse={false}/>
              {conectado ? 'conectado' : 'desconectado'}
            </span>
          </div>
          <div style={{ fontSize:12.5, color:'var(--faint)', marginTop:3 }}>
            {meta.provedor}{conectado ? ' · ' + cfg.backend : ''}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div>
          <label style={{ display:'block', fontSize:11, color:'var(--dim)', marginBottom:5 }}>Backend (URL da API)</label>
          <input value={backend} onChange={e=>setBackend(e.target.value)} placeholder="https://api.gktechai.info" style={inputStyle}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:11, color:'var(--dim)', marginBottom:5 }}>
            Token Bearer {row?.chave_mascarada && <span style={{ color:'var(--faint)' }}>· salvo {row.chave_mascarada}</span>}
          </label>
          <input value={token} onChange={e=>setToken(e.target.value)} placeholder="API.GKPADRAO.xxxxxxxx" style={inputStyle}/>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:(empresas.length||filas.length)?12:0 }}>
        <button onClick={conectar} disabled={conectando}
          style={{ height:38, padding:'0 16px', borderRadius:9, border:'1px solid var(--border)',
            background:'transparent', color:'var(--text)', fontSize:12.5, fontFamily:'inherit',
            cursor: conectando?'default':'pointer', opacity: conectando?.6:1 }}>
          {conectando ? 'Conectando…' : 'Conectar e buscar empresas/filas'}
        </button>
      </div>

      {filas.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: empresas.length > 0 ? '1fr 1fr' : '1fr', gap:12, marginBottom:12 }}>
          {empresas.length > 0 && (
            <div>
              <label style={{ display:'block', fontSize:11, color:'var(--dim)', marginBottom:5 }}>Empresa</label>
              <select value={companyId} onChange={e=>setCompanyId(e.target.value)} style={selStyle}>
                <option value="">Selecione…</option>
                {empresas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--dim)', marginBottom:5 }}>Fila padrão para novos leads</label>
            <select value={queueId} onChange={e=>setQueueId(e.target.value)} style={selStyle}>
              <option value="">Selecione…</option>
              {filas.map(q => <option key={q.id} value={q.id}>{q.queue}</option>)}
            </select>
          </div>
        </div>
      )}

      {erro && <div style={{ fontSize:12, color:C.red, marginBottom:8 }}>{erro}</div>}
      {msg && <div style={{ fontSize:12, color:C.green, marginBottom:8 }}>{msg}</div>}

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={salvar} disabled={salvando}
          style={{ height:38, padding:'0 16px', borderRadius:9, border:'none', background:'var(--gold)',
            color:'#0E1936', fontWeight:600, fontSize:12.5, fontFamily:'inherit',
            cursor: salvando?'default':'pointer', opacity: salvando?.6:1 }}>
          {salvando ? 'Salvando…' : 'Salvar configuração'}
        </button>
        {row?.ativo && (
          <button onClick={desconectar} disabled={desconectando}
            style={{ height:38, padding:'0 16px', borderRadius:9, border:'1px solid var(--border)',
              background:'transparent', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit',
              cursor: desconectando?'default':'pointer', opacity: desconectando?.6:1 }}>
            {desconectando ? 'Desconectando…' : 'Desconectar'}
          </button>
        )}
      </div>
    </div>
  );
}

function Integracoes() {
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const chaveRefs = useRef({});
  const segredoRefs = useRef({});
  const modeloRefs = useRef({});

  const carregar = () => {
    setErro(null);
    fetch('/api/integracoes', { credentials:'same-origin' })
      .then(r => { if (!r.ok) throw new Error('Sem permissão (apenas Admin) ou sessão expirada.'); return r.json(); })
      .then(setRows)
      .catch(e => { setRows([]); setErro(e.message); });
  };
  useEffect(carregar, []);

  const porChave = {};
  (rows || []).forEach(r => { porChave[`${r.categoria}|${r.provedor}`] = r; });

  const salvar = async (chave, categoria, provedor) => {
    const key = (chaveRefs.current[chave]?.value || '').trim();
    const segredo = (segredoRefs.current[chave]?.value || '').trim();
    const modelo = (modeloRefs.current[chave]?.value || '').trim();
    const existente = porChave[chave];
    setSalvando(chave);
    try {
      const cfgExtra = {};
      if (segredo) cfgExtra.secret = segredo;
      if (modelo) cfgExtra.modelo = modelo;
      const corpoConfig = Object.keys(cfgExtra).length
        ? { config: { ...(existente?.config || {}), ...cfgExtra } } : {};
      if (existente) {
        await fetch('/api/integracoes/' + existente.id, {
          method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ ativo:true, ...(key ? { key } : {}), ...corpoConfig })
        });
      } else {
        await fetch('/api/integracoes', {
          method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ categoria, provedor, ativo:true, key, ...corpoConfig })
        });
      }
      if (chaveRefs.current[chave]) chaveRefs.current[chave].value = '';
      if (segredoRefs.current[chave]) segredoRefs.current[chave].value = '';
      carregar();
    } catch (_) {
      window.alert('Erro ao salvar credencial.');
    } finally {
      setSalvando(null);
    }
  };

  const alternar = async (chave) => {
    const existente = porChave[chave];
    if (!existente) return;
    await fetch('/api/integracoes/' + existente.id, {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ativo: !existente.ativo })
    });
    carregar();
  };

  return (
    <div style={{ maxWidth:840, display:'flex', flexDirection:'column', gap:12 }}>
      {erro && <div style={{ fontSize:13, color:C.red, background:'rgba(248,113,113,.1)',
        border:'1px solid rgba(248,113,113,.25)', borderRadius:9, padding:'10px 12px' }}>{erro}</div>}
      {rows === null ? (
        <div style={{ fontSize:13, color:'var(--faint)' }}>Carregando…</div>
      ) : INTEGRACOES_ORDEM.map(chave => {
        const meta = INTEGRACOES_META[chave];
        const [categoria, provedor] = chave.split('|');
        const row = porChave[chave];
        if (meta.especial === 'gk') {
          return <IntegracaoGK key={chave} row={row} meta={meta} onSaved={carregar}/>;
        }
        const conectado = !!(row && row.ativo && row.tem_chave);
        return (
          <div key={chave} style={{ background:'var(--panel)', border:'1px solid var(--border)',
            borderRadius:14, padding:'18px 20px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:'var(--panel2)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'var(--dim)', flexShrink:0 }}>
              <Svg d={meta.icon} w={20} h={20} sw={1.6}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ fontSize:14.5, fontWeight:600 }}>{meta.nome}</span>
                <span style={badgeStyle(conectado ? C.green : C.gray)}>
                  <StatusDot color={conectado ? C.green : C.gray} pulse={false}/>
                  {conectado ? 'conectado' : 'desconectado'}
                </span>
                {!meta.editavel && <span style={badgeStyle(C.gray)}>fase 3.1</span>}
              </div>
              <div style={{ fontSize:12.5, color:'var(--faint)', marginTop:3 }}>
                {meta.provedor}{row?.chave_mascarada ? ' · ' + row.chave_mascarada : ''}
                {meta.temSegredo ? (row?.config?.secret ? ' · segredo configurado' : ' · sem segredo (assinatura desativada)') : ''}
                {meta.temModelo && row?.config?.modelo ? ' · modelo: ' + row.config.modelo : ''}
              </div>
            </div>
            {meta.editavel ? (
              <>
                <input ref={el => chaveRefs.current[chave] = el} placeholder={meta.placeholder || 'Colar chave da API…'}
                  style={{ width:190, height:38, borderRadius:9, border:'1px solid var(--border)',
                    background:'var(--panel2)', color:'var(--dim)', padding:'0 12px', fontSize:12.5,
                    fontFamily:'inherit', letterSpacing:'.05em' }}/>
                {meta.temSegredo && (
                  <input ref={el => segredoRefs.current[chave] = el} placeholder="Colar segredo (HMAC, opcional)…"
                    style={{ width:190, height:38, borderRadius:9, border:'1px solid var(--border)',
                      background:'var(--panel2)', color:'var(--dim)', padding:'0 12px', fontSize:12.5,
                      fontFamily:'inherit', letterSpacing:'.05em' }}/>
                )}
                {meta.temModelo && (
                  <input ref={el => modeloRefs.current[chave] = el} defaultValue={row?.config?.modelo || ''}
                    placeholder={meta.modeloPlaceholder || 'modelo (opcional)'}
                    style={{ width:200, height:38, borderRadius:9, border:'1px solid var(--border)',
                      background:'var(--panel2)', color:'var(--dim)', padding:'0 12px', fontSize:12,
                      fontFamily:'inherit' }}/>
                )}
                <button onClick={() => salvar(chave, categoria, provedor)} disabled={salvando === chave}
                  style={{ height:38, padding:'0 15px', borderRadius:9, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--text)', fontSize:12.5, fontFamily:'inherit',
                    cursor: salvando === chave ? 'default' : 'pointer', flexShrink:0,
                    opacity: salvando === chave ? .6 : 1 }}>
                  {salvando === chave ? 'Salvando…' : 'Salvar'}
                </button>
                {row && (
                  <button onClick={() => alternar(chave)}
                    style={{ height:38, padding:'0 12px', borderRadius:9, border:'1px solid var(--border)',
                      background:'transparent', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit',
                      cursor:'pointer', flexShrink:0 }}>
                    {row.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize:12.5, color:'var(--faint)', flexShrink:0 }}>Em breve</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Usuários ──────────────────────────────────────────────────────────────────
function fmtAcesso(ts) {
  if (!ts) return 'nunca';
  try { return new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch (_) { return '—'; }
}

function Usuarios({ user }) {
  const [users, setUsers] = useState(null);
  const [erro, setErro] = useState(null);
  const [novaCred, setNovaCred] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const isMaster = !!user?.master;
  const papelColors = { Admin:C.gold, Operador:C.blue, Visualizador:C.gray };

  const carregar = () => {
    setErro(null);
    fetch('/api/usuarios', { credentials:'same-origin' })
      .then(r => { if (!r.ok) throw new Error('Sem permissão (apenas Admin) ou sessão expirada.'); return r.json(); })
      .then(setUsers)
      .catch(e => { setUsers([]); setErro(e.message); });
  };
  useEffect(carregar, []);

  const convidar = async () => {
    const nome = window.prompt('Nome do usuário:'); if (!nome) return;
    const email = window.prompt('E-mail:'); if (!email) return;
    const papel = window.prompt('Papel (Admin / Operador / Visualizador):', 'Operador') || 'Operador';
    const resp = await fetch('/api/usuarios', {
      method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ nome, email, papel })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { window.alert(data.erro || 'Erro ao criar usuário.'); return; }
    setCopiado(false);
    setNovaCred({ nome, email, senha: data.senha_provisoria });
    carregar();
  };

  const credText = (c) => 'Acesso ao Hunter\nURL: https://adhunter.antidotodigital.com\nE-mail: ' + c.email +
    '\nSenha provisória: ' + c.senha + '\n(troque a senha no primeiro acesso)';
  const copiar = async (c) => {
    try { await navigator.clipboard.writeText(credText(c)); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch (_) { window.prompt('Copie as credenciais:', credText(c)); }
  };

  const alternar = async (u) => {
    await fetch('/api/usuarios/' + u.id, {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ativo: !u.ativo })
    });
    carregar();
  };

  const excluir = async (u) => {
    if (!window.confirm('Excluir ' + u.nome + ' definitivamente?\nEssa ação não pode ser desfeita.')) return;
    const r = await fetch('/api/usuarios/' + u.id, { method:'DELETE', credentials:'same-origin' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.erro || 'Erro ao excluir.'); return; }
    carregar();
  };

  const toggleMaster = async (u) => {
    const virar = !u.master;
    if (!window.confirm(virar
      ? `Tornar ${u.nome} MASTER? Ele passará a ver Integrações, Configurações e Monitoramento (dados sigilosos da Hunter).`
      : `Remover o MASTER de ${u.nome}? Ele deixa de ver as telas sigilosas.`)) return;
    const r = await fetch('/api/usuarios/' + u.id, {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ master: virar })
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.erro || 'Erro ao alterar master.'); return; }
    carregar();
  };

  const redefinirSenha = async (u) => {
    const nova = window.prompt(`Nova senha para ${u.nome} (mín. 6 caracteres).\nEle poderá trocá-la depois no menu do perfil.`);
    if (nova == null) return;
    if (nova.trim().length < 6) { window.alert('A senha precisa ter ao menos 6 caracteres.'); return; }
    const r = await fetch('/api/usuarios/' + u.id, {
      method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ senha: nova.trim() })
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); window.alert(d.erro || 'Erro ao redefinir senha.'); return; }
    window.alert(`Senha de ${u.nome} redefinida.\n\nE-mail: ${u.email}\nNova senha: ${nova.trim()}\n\nRepasse com segurança — ele pode trocá-la depois.`);
  };

  const cols = '1.7fr 1.3fr 1.2fr 1fr 84px 84px';

  return (
    <div style={{ maxWidth:1010 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <button onClick={convidar} style={{ display:'flex', alignItems:'center', gap:7, height:38, padding:'0 16px',
          borderRadius:9, border:'none', background:'var(--gold)', color:'#0E1936', fontWeight:600,
          fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
          <Svg d="M12 5v14M5 12h14" color="#0E1936" w={15} h={15} sw={2}/>
          Convidar usuário
        </button>
      </div>
      {erro && <div style={{ fontSize:13, color:C.red, background:'rgba(248,113,113,.1)',
        border:'1px solid rgba(248,113,113,.25)', borderRadius:9, padding:'10px 12px', marginBottom:14 }}>{erro}</div>}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:cols,
          alignItems:'center', gap:10, padding:'12px 18px', borderBottom:'1px solid var(--border)',
          fontSize:11, fontWeight:600, letterSpacing:'.04em', color:'var(--faint)', textTransform:'uppercase' }}>
          <div>Usuário</div><div>E-mail</div><div>Papel</div><div>Último acesso</div><div>Status</div><div></div>
        </div>
        {users === null ? (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Carregando…</div>
        ) : users.length === 0 ? (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Nenhum usuário.</div>
        ) : users.map(u => {
          const ini = (u.nome||'?').split(' ').slice(0,2).map(w=>w[0]).join('');
          return (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:cols,
              alignItems:'center', gap:10, padding:'13px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'var(--panel2)', color:C.blue,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>{ini}</div>
                <span style={{ fontSize:13.5, fontWeight:500 }}>{u.nome}</span>
              </div>
              <div style={{ fontSize:12.5, color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.email}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={badgeStyle(papelColors[u.papel]||C.gray)}>{u.papel}</span>
                {u.master ? (
                  <span onClick={isMaster ? () => toggleMaster(u) : undefined}
                    title={isMaster ? 'Login MASTER — clique para remover' : 'Login MASTER da Hunter'}
                    style={{ ...badgeStyle(C.gold), cursor: isMaster ? 'pointer' : 'default' }}>Master</span>
                ) : isMaster ? (
                  <span onClick={() => toggleMaster(u)} title="Tornar master"
                    style={{ ...badgeStyle(C.gray), cursor:'pointer', opacity:.6 }}>+ master</span>
                ) : null}
              </div>
              <div style={{ fontSize:12.5, color:'var(--faint)' }}>{fmtAcesso(u.ultimo_acesso)}</div>
              <div>
                <span onClick={() => alternar(u)} title="Clique para ativar/desativar"
                  style={{ ...badgeStyle(u.ativo ? C.green : C.gray), cursor:'pointer' }}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => redefinirSenha(u)} title="Redefinir senha"
                  style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
                    color:'var(--dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <SvgMulti w={15} h={15} sw={1.7}><path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z"/></SvgMulti>
                </button>
                <button onClick={() => excluir(u)} title="Excluir usuário"
                  style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent',
                    color:'var(--dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <SvgMulti w={15} h={15} sw={1.7}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6"/></SvgMulti>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {novaCred && (
        <div style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={() => setNovaCred(null)} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.6)' }}/>
          <div style={{ position:'relative', width:440, maxWidth:'92vw', background:'var(--panel)',
            border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'22px 24px 0' }}>
              <h2 style={{ fontSize:17, fontWeight:600, margin:'0 0 4px' }}>Usuário criado ✓</h2>
              <p style={{ fontSize:13, color:'var(--dim)', margin:'0 0 18px' }}>Repasse com segurança — a senha provisória só aparece agora.</p>
            </div>
            <div style={{ padding:'0 24px', display:'flex', flexDirection:'column', gap:10 }}>
              {[['Nome', novaCred.nome], ['E-mail', novaCred.email], ['Senha provisória', novaCred.senha]].map(([k,v]) => (
                <div key={k} style={{ background:'var(--panel2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 13px' }}>
                  <div style={{ fontSize:11, color:'var(--faint)', marginBottom:3 }}>{k}</div>
                  <div style={{ fontSize:14, fontWeight:600,
                    fontFamily: k==='Senha provisória' ? 'ui-monospace,monospace' : 'inherit',
                    color: k==='Senha provisória' ? C.gold : 'var(--text)', wordBreak:'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 24px 20px', display:'flex', gap:10 }}>
              <button onClick={() => copiar(novaCred)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                height:42, borderRadius:10, border:'none', background:'var(--gold)', color:'#0E1936',
                fontWeight:600, fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>
                <SvgMulti w={15} h={15} sw={1.8} color="#0E1936"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></SvgMulti>
                {copiado ? 'Copiado!' : 'Copiar credenciais'}
              </button>
              <button onClick={() => setNovaCred(null)} style={{ height:42, padding:'0 16px', borderRadius:10,
                border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
                fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Configurações ─────────────────────────────────────────────────────────────
function Config() {
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sementes, setSementes] = useState(null);
  const [rotacionando, setRotacionando] = useState(false);
  const [demo, setDemo] = useState(null);
  const [limpandoDemo, setLimpandoDemo] = useState(false);
  const [base, setBase] = useState(null);
  const [limpandoTudo, setLimpandoTudo] = useState(false);

  const carregarSementes = () => fetch('/api/sementes/status', { credentials:'same-origin' })
    .then(r => r.json()).then(setSementes).catch(() => {});
  const carregarDemo = () => fetch('/api/admin/demo', { credentials:'same-origin' })
    .then(r => r.json()).then(setDemo).catch(() => {});
  const carregarBase = () => fetch('/api/admin/base', { credentials:'same-origin' })
    .then(r => r.json()).then(setBase).catch(() => {});

  useEffect(() => {
    fetch('/api/config', { credentials:'same-origin' })
      .then(r => r.json()).then(setCfg).catch(() => setCfg({}));
    carregarSementes();
    carregarDemo();
    carregarBase();
  }, []);

  const limparTudo = async () => {
    const total = (base?.buscas || 0) + (base?.leads || 0);
    if (!window.confirm(
      `ATENÇÃO: isso apaga TODA a base operacional — ${base?.buscas || 0} radar(es), ${base?.leads || 0} lead(s) e ` +
      `${base?.empresas || 0} empresa(s) do cache. Mantém usuários, integrações e configurações. NÃO dá pra desfazer.\n\n` +
      `Digite OK na próxima janela para confirmar.`
    )) return;
    const conf = window.prompt('Para confirmar a exclusão total, digite: APAGAR TUDO');
    if (conf !== 'APAGAR TUDO') { setMsg({ ok:false, txt:'Exclusão cancelada.' }); return; }
    setLimpandoTudo(true);
    try {
      const r = await fetch('/api/admin/limpar-tudo', { method:'POST', credentials:'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao limpar.');
      setMsg({ ok:true, txt:'Base operacional zerada. O painel agora está limpo.' });
      carregarBase(); carregarDemo(); carregarSementes();
    } catch (e) { setMsg({ ok:false, txt:e.message }); }
    finally { setLimpandoTudo(false); }
  };

  const limparDemo = async () => {
    if (!window.confirm(
      `Isso vai remover os radares de demonstração e ${demo?.leads || 0} lead(s) que eles geraram ` +
      `(inclui os leads-exemplo e o que os radares demo descobriram com critério amplo). ` +
      `As empresas ficam no cache. Não dá pra desfazer. Continuar?`
    )) return;
    setLimpandoDemo(true);
    try {
      const r = await fetch('/api/admin/limpar-demo', { method:'POST', credentials:'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao limpar.');
      setMsg({ ok:true, txt:`Removidos ${d.buscas_removidas} radar(es) e ${d.leads_removidos} lead(s) de demonstração.` });
      carregarDemo();
    } catch (e) { setMsg({ ok:false, txt:e.message }); }
    finally { setLimpandoDemo(false); }
  };

  const rotacionarSecret = async () => {
    setRotacionando(true);
    try {
      const r = await fetch('/api/webhooks/rotacionar-secret', { method:'POST', credentials:'same-origin' });
      const d = await r.json();
      if (r.ok) set('webhook_entrada_secret', d.secret);
    } catch (_) {} finally { setRotacionando(false); }
  };

  const set = (k, v) => { setCfg(c => ({ ...c, [k]: v })); setMsg(null); };

  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      const r = await fetch('/api/config', {
        method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          limite_diario: cfg.limite_diario, corte_padrao: cfg.corte_padrao,
          descoberta_modo_padrao: cfg.descoberta_modo_padrao,
          web_paid_lookup_ativo: cfg.web_paid_lookup_ativo, web_paid_lookup_limite: cfg.web_paid_lookup_limite,
          ttl_cache_dias: cfg.ttl_cache_dias, parada_min: cfg.parada_min,
          janela_inicio: cfg.janela_inicio, janela_fim: cfg.janela_fim, janela_tz: cfg.janela_tz,
          alerta_email: cfg.alerta_email, crm_auto_global: cfg.crm_auto_global,
          crm_lookalike_auto: cfg.crm_lookalike_auto,
          crm_conversao_tags: cfg.crm_conversao_tags,
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar (apenas Admin).');
      setCfg(d);
      setMsg({ ok:true, txt:'Configurações salvas.' });
    } catch (e) { setMsg({ ok:false, txt:e.message }); }
    finally { setSalvando(false); }
  };

  if (!cfg) return <div style={{ color:'var(--faint)', fontSize:13 }}>Carregando…</div>;

  const inp = { width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
    background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' };
  const numField = (label, key, suf) => (
    <div>
      <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input type="number" value={cfg[key] ?? ''} onChange={e => set(key, e.target.value === '' ? '' : +e.target.value)} style={inp}/>
        {suf && <span style={{ position:'absolute', right:12, top:10, fontSize:12, color:'var(--faint)', pointerEvents:'none' }}>{suf}</span>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:720, display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Parâmetros padrão</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 18px' }}>Valores iniciais aplicados a novos radares e ao motor.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {numField('Limite diário de leads', 'limite_diario', 'leads/dia')}
          {numField('Corte de score', 'corte_padrao', 'pts')}
          {numField('TTL de cache', 'ttl_cache_dias', 'dias')}
        </div>
        <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:12, lineHeight:1.5 }}>
          O <b>limite diário</b> é o teto de leads novos que o motor capta por dia somando todos os radares — protege o
          orçamento. Cada lead captado consome uma vaga <b>na hora em que nasce</b>: se ele for descartado depois (por
          exemplo, quando o enriquecimento não acha telefone), a vaga <b>não</b> volta — a consulta paga já foi feita.
          Ao atingir o teto, a captação pausa e retoma no dia seguinte. 0 = sem teto.
        </div>

        <div style={{ borderTop:'1px solid var(--border)', marginTop:16, paddingTop:16 }}>
          <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:9 }}>
            Horário de funcionamento <span style={{ color:'var(--faint)' }}>(o motor só capta dentro da janela)</span>
          </label>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <select value={cfg.janela_inicio ?? 0} onChange={e => set('janela_inicio', +e.target.value)}
              style={{ ...inp, width:'auto', minWidth:100 }}>
              {Array.from({ length:24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
            </select>
            <span style={{ fontSize:12.5, color:'var(--faint)' }}>até</span>
            <select value={cfg.janela_fim ?? 24} onChange={e => set('janela_fim', +e.target.value)}
              style={{ ...inp, width:'auto', minWidth:100 }}>
              {Array.from({ length:24 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
            </select>
            <select value={cfg.janela_tz || 'America/Sao_Paulo'} onChange={e => set('janela_tz', e.target.value)}
              style={{ ...inp, width:'auto', minWidth:170 }}>
              {[['America/Sao_Paulo','Brasília (GMT-3)'],['America/Manaus','Manaus (GMT-4)'],
                ['America/Cuiaba','Cuiabá (GMT-4)'],['America/Campo_Grande','Campo Grande (GMT-4)'],
                ['America/Belem','Belém (GMT-3)'],['America/Fortaleza','Fortaleza (GMT-3)'],
                ['America/Recife','Recife (GMT-3)'],['America/Bahia','Salvador (GMT-3)'],
                ['America/Porto_Velho','Porto Velho (GMT-4)'],['America/Boa_Vista','Boa Vista (GMT-4)'],
                ['America/Rio_Branco','Rio Branco (GMT-5)'],['America/Noronha','F. de Noronha (GMT-2)'],
                ['UTC','UTC (GMT-0)']].map(([v,t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {(() => {
            const ini = cfg.janela_inicio ?? 0, fim = cfg.janela_fim ?? 24;
            const horas = (ini === 0 && fim >= 24) ? 24 : (fim > ini ? fim - ini : 24 - ini + fim);
            const lim = +cfg.limite_diario || 0;
            const porHora = lim ? Math.max(1, Math.ceil(lim / horas)) : 0;
            return (
              <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:10, lineHeight:1.5 }}>
                {ini === 0 && fim >= 24
                  ? <>O motor está trabalhando <b>24 horas por dia</b>. Defina uma janela pra concentrar a captação no horário comercial.</>
                  : <>O motor trabalha <b>{horas}h por dia</b> ({String(ini).padStart(2,'0')}:00 às {String(fim).padStart(2,'0')}:00
                     {fim <= ini ? ' do dia seguinte' : ''}) e fica parado fora desse período.</>}
                {lim > 0 && <> O teto de {lim} leads/dia é dividido pelas horas da janela: <b>~{porHora} leads por hora</b>.
                  Sobra de um dia não acumula pro dia seguinte.</>}
              </div>
            );
          })()}
        </div>
        {DESCOBERTA_WEB_HABILITADA && (
        <div style={{ borderTop:'1px solid var(--border)', marginTop:16, paddingTop:16 }}>
          <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:9 }}>Modo de descoberta padrão <span style={{ color:'var(--faint)' }}>(cada radar pode trocar)</span></label>
          <div style={{ display:'flex', gap:8 }}>
            {[['cnpja','Por CNPJ','econômico'],['web','Pela internet','pega nichos, mais caro']].map(([k,t,d]) => {
              const on = (cfg.descoberta_modo_padrao || 'cnpja') === k;
              return (
                <div key={k} onClick={() => set('descoberta_modo_padrao', k)}
                  style={{ flex:1, cursor:'pointer', padding:'11px 13px', borderRadius:10,
                    border: on ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
                    background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent' }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color: on ? 'var(--text)' : 'var(--dim)' }}>{t}</div>
                  <div style={{ fontSize:11, color:'var(--faint)', marginTop:2 }}>{d}</div>
                </div>
              );
            })}
          </div>
        </div>
        )}
        {DESCOBERTA_WEB_HABILITADA && (
        <div style={{ borderTop:'1px solid var(--border)', marginTop:16, paddingTop:16 }}>
          <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:9 }}>
            Confirmação paga na descoberta pela internet
          </label>
          <p style={{ fontSize:11.5, color:'var(--faint)', margin:'0 0 12px', lineHeight:1.5 }}>
            Quando o site da empresa não traz o CNPJ, confirmar o cadastro custa 1 consulta paga por empresa — bem mais
            caro que o modo Por CNPJ (~1 crédito a cada 100 empresas). Controle esse gasto aqui. Ao atingir o limite,
            o motor para de confirmar por essa via e segue só com o que acha de graça no próprio site — também
            dividido por hora, igual ao limite diário de leads.
          </p>
          <div onClick={() => set('web_paid_lookup_ativo', !cfg.web_paid_lookup_ativo)}
            style={{ display:'flex', alignItems:'center', gap:13, cursor:'pointer', marginBottom:14,
              background:'var(--panel2)', border:'1px solid '+(cfg.web_paid_lookup_ativo?C.gold:'var(--border)'),
              borderRadius:11, padding:'12px 14px' }}>
            <div style={{ width:42, height:24, borderRadius:12, flexShrink:0, position:'relative',
              background: cfg.web_paid_lookup_ativo ? C.gold : 'var(--border)', transition:'background .15s' }}>
              <div style={{ position:'absolute', top:2, left: cfg.web_paid_lookup_ativo ? 20 : 2, width:20, height:20,
                borderRadius:'50%', background:'#fff', transition:'left .15s' }}/>
            </div>
            <div style={{ fontSize:13, fontWeight:500 }}>
              {cfg.web_paid_lookup_ativo ? 'Confirmação paga ativada' : 'Confirmação paga desativada — só usa o CNPJ do site (grátis)'}
            </div>
          </div>
          {cfg.web_paid_lookup_ativo && (
            <div style={{ maxWidth:220 }}>
              {numField('Limite diário de confirmações pagas', 'web_paid_lookup_limite', 'empresas/dia')}
            </div>
          )}
        </div>
        )}
      </div>

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Automação de envio ao CRM</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 16px' }}>
          Envia ao CRM conectado, automaticamente, os leads que passaram por todo o processo (captados, limpos, pontuados e analisados).
        </p>
        <div onClick={() => set('crm_auto_global', !cfg.crm_auto_global)}
          style={{ display:'flex', alignItems:'center', gap:13, cursor:'pointer',
            background:'var(--panel2)', border:'1px solid '+(cfg.crm_auto_global?C.gold:'var(--border)'),
            borderRadius:11, padding:'14px 16px' }}>
          <div style={{ width:42, height:24, borderRadius:12, flexShrink:0, position:'relative',
            background: cfg.crm_auto_global ? C.gold : 'var(--border)', transition:'background .15s' }}>
            <div style={{ position:'absolute', top:2, left: cfg.crm_auto_global ? 20 : 2, width:20, height:20,
              borderRadius:'50%', background:'#fff', transition:'left .15s' }}/>
          </div>
          <div>
            <div style={{ fontSize:13.5, fontWeight:500 }}>
              {cfg.crm_auto_global ? 'Envio automático ativado' : 'Envio automático desativado'}
            </div>
            <div style={{ fontSize:12, color:'var(--faint)', marginTop:2 }}>
              {cfg.crm_auto_global
                ? 'Cada lead pronto é enviado ao CRM sem intervenção.'
                : 'Os leads ficam para envio manual (botão "Enviar ao CRM" na triagem).'}
            </div>
          </div>
        </div>
        <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:10, lineHeight:1.4 }}>
          Vale para todos os radares. Cada radar também pode forçar o envio automático na sua própria configuração.
        </div>
      </div>

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Aprendizado com o CRM (lista de semelhantes)</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 16px', lineHeight:1.5 }}>
          Quando o closer marca um lead como fechado/comprou/qualificado no CRM, ele avisa o Hunter e esse CNPJ entra
          na lista de semelhantes. O motor re-traça o perfil médio e passa a buscar mais empresas parecidas com quem
          realmente compra — o sistema fica mais preciso sozinho.
        </p>

        <div onClick={() => set('crm_lookalike_auto', !cfg.crm_lookalike_auto)}
          style={{ display:'flex', alignItems:'center', gap:13, cursor:'pointer',
            background:'var(--panel2)', border:'1px solid '+(cfg.crm_lookalike_auto?C.gold:'var(--border)'),
            borderRadius:11, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ width:42, height:24, borderRadius:12, flexShrink:0, position:'relative',
            background: cfg.crm_lookalike_auto ? C.gold : 'var(--border)', transition:'background .15s' }}>
            <div style={{ position:'absolute', top:2, left: cfg.crm_lookalike_auto ? 20 : 2, width:20, height:20,
              borderRadius:'50%', background:'#fff', transition:'left .15s' }}/>
          </div>
          <div>
            <div style={{ fontSize:13.5, fontWeight:500 }}>
              {cfg.crm_lookalike_auto ? 'Radar "Semelhantes — clientes do CRM" ativo' : 'Aprendizado automático desativado'}
            </div>
            <div style={{ fontSize:12, color:'var(--faint)', marginTop:2 }}>
              {cfg.crm_lookalike_auto
                ? 'A cada conversão recebida, o Hunter cria/atualiza um radar lookalike com esses clientes.'
                : 'As conversões são guardadas, mas não geram radar automático.'}
            </div>
          </div>
        </div>

        <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
          Tags que contam como conversão <span style={{ color:'var(--faint)' }}>(separadas por vírgula)</span>
        </label>
        <input value={Array.isArray(cfg.crm_conversao_tags) ? cfg.crm_conversao_tags.join(', ') : (cfg.crm_conversao_tags || '')}
          onChange={e => set('crm_conversao_tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="fechado, comprou, cliente, qualificado, won"
          style={{ ...inp, marginBottom:16 }}/>

        <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
          URL do webhook <span style={{ color:'var(--faint)' }}>(configure no seu CRM para chamar no evento de conversão)</span>
        </label>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input readOnly value={(typeof window !== 'undefined' ? window.location.origin : '') + '/api/webhooks/crm/conversao'}
            onFocus={e => e.target.select()} style={{ ...inp, fontFamily:'ui-monospace, monospace', fontSize:12 }}/>
        </div>

        <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
          Segredo <span style={{ color:'var(--faint)' }}>(envie no header <code>x-hunter-token</code>)</span>
        </label>
        <div style={{ display:'flex', gap:8 }}>
          <input readOnly value={cfg.webhook_entrada_secret || '— ainda não gerado —'}
            onFocus={e => e.target.select()} style={{ ...inp, fontFamily:'ui-monospace, monospace', fontSize:12 }}/>
          <button onClick={rotacionarSecret} disabled={rotacionando}
            style={{ height:38, padding:'0 14px', borderRadius:9, border:'1px solid var(--border)',
              background:'transparent', color:'var(--text)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap' }}>
            {rotacionando ? '…' : cfg.webhook_entrada_secret ? 'Rotacionar' : 'Gerar'}
          </button>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16, padding:'12px 14px',
          background:'var(--panel2)', borderRadius:10, border:'1px solid var(--border)' }}>
          <span style={{ fontSize:22, fontWeight:600, color:C.gold, fontVariantNumeric:'tabular-nums' }}>
            {sementes?.total ?? 0}
          </span>
          <div style={{ fontSize:12, color:'var(--faint)', lineHeight:1.4 }}>
            clientes já na lista de semelhantes{sementes?.busca ? ` · radar ${sementes.busca.status}` : ''}.
            {sementes?.total > 0 && sementes?.ultimas?.[0] && ` Último: ${String(sementes.ultimas[0].cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}.`}
          </div>
        </div>
        <div style={{ fontSize:11, color:'var(--faint)', marginTop:10, lineHeight:1.5 }}>
          No <b>GK SaaS</b>, aponte o webhook de saída (evento de mudança de tag/etapa) para a URL acima. O Hunter
          detecta o CNPJ e a tag em qualquer lugar do payload — não precisa de formato fixo. Se o CRM não deixar
          adicionar o header, mande o segredo na própria URL: <code>…/conversao?token=SEGREDO</code>.
        </div>
      </div>

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Alertas</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 18px' }}>Quando considerar um radar parado, e para quem avisar.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {numField('Parada considerada após', 'parada_min', 'min')}
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Destinatário dos alertas</label>
            <input value={cfg.alerta_email || ''} onChange={e => set('alerta_email', e.target.value)}
              placeholder="ops@empresa.com.br" style={inp}/>
          </div>
        </div>
      </div>

      {demo && (demo.buscas > 0 || demo.leads > 0) && (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Manutenção — dados de demonstração</h3>
          <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 16px', lineHeight:1.5 }}>
            Detectei <b style={{ color:'var(--text)' }}>{demo.buscas} radar(es)</b> de demonstração e
            {' '}<b style={{ color:'var(--text)' }}>{demo.leads} lead(s)</b> gerados por eles (dados de exemplo do primeiro
            boot + o que esses radares descobriram com critério amplo). Remova para o painel refletir só o seu trabalho real.
            As empresas ficam no cache (grátis).
          </p>
          <button onClick={limparDemo} disabled={limpandoDemo}
            style={{ height:40, padding:'0 18px', borderRadius:10, border:'1px solid '+C.red,
              background:'transparent', color:C.red, fontWeight:600, fontSize:13, fontFamily:'inherit',
              cursor: limpandoDemo?'default':'pointer', opacity: limpandoDemo?.6:1 }}>
            {limpandoDemo ? 'Removendo…' : 'Limpar dados de demonstração'}
          </button>
        </div>
      )}

      {base && (base.buscas > 0 || base.leads > 0) && (
        <div style={{ background:'var(--panel)', border:'1px solid color-mix(in srgb, '+C.red+' 40%, var(--border))', borderRadius:14, padding:22 }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px', color:C.red }}>Zona de perigo — apagar tudo</h3>
          <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 16px', lineHeight:1.5 }}>
            Remove <b style={{ color:'var(--text)' }}>toda</b> a base operacional: {fmtNum(base.buscas)} radar(es),
            {' '}{fmtNum(base.leads)} lead(s) e {fmtNum(base.empresas)} empresa(s) do cache. Usuários, integrações
            (chaves) e configurações são mantidos. Use para começar do zero. <b>Irreversível.</b>
          </p>
          <button onClick={limparTudo} disabled={limpandoTudo}
            style={{ height:40, padding:'0 18px', borderRadius:10, border:'none',
              background:C.red, color:'#fff', fontWeight:600, fontSize:13, fontFamily:'inherit',
              cursor: limpandoTudo?'default':'pointer', opacity: limpandoTudo?.6:1 }}>
            {limpandoTudo ? 'Apagando…' : 'Zerar toda a base operacional'}
          </button>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <button onClick={salvar} disabled={salvando}
          style={{ height:44, padding:'0 22px', borderRadius:11, border:'none', background:'var(--gold)',
            color:'#0E1936', fontWeight:600, fontSize:13.5, fontFamily:'inherit',
            cursor: salvando?'default':'pointer', opacity: salvando?.6:1 }}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </button>
        {msg && <span style={{ fontSize:13, color: msg.ok ? C.green : C.red }}>{msg.txt}</span>}
      </div>
    </div>
  );
}

// ── Monitoramento ─────────────────────────────────────────────────────────────
function Monitor() {
  const [data, setData] = useState(null);
  const [limpando, setLimpando] = useState(false);

  const load = () => fetch('/api/monitor/queues', { credentials:'same-origin' })
    .then(r => r.json()).then(setData).catch(() => {});
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const limparDlq = async () => {
    setLimpando(true);
    await fetch('/api/monitor/dlq/limpar', { method:'POST', credentials:'same-origin' }).catch(() => {});
    setLimpando(false);
    load();
  };

  if (!data) {
    return <div style={{ color:'var(--faint)', fontSize:13 }}>Carregando…</div>;
  }

  const queuesByKey = Object.fromEntries((data.queues||[]).map(q => [q.key, q]));
  const totalAtivos = (data.queues||[]).reduce((s,q) => s+q.active, 0);
  const totalEspera = (data.queues||[]).reduce((s,q) => s+q.waiting, 0);
  const totalConcluidos = (data.queues||[]).reduce((s,q) => s+q.completed, 0);
  const totalFalhos = (data.queues||[]).reduce((s,q) => s+q.failed, 0);

  const cards = [
    { label:'Jobs ativos', v:totalAtivos, color:C.blue },
    { label:'Em espera', v:totalEspera, color:C.amber },
    { label:'Concluídos (acumulado)', v:fmtNum(totalConcluidos), color:C.green },
    { label:'Falhos (acumulado)', v:totalFalhos, color:C.red },
  ];

  const etapas = [
    { key:'descoberta', label:'1. Descoberta (CNPJá)' },
    { key:'enriquecimento', label:'2. Enriquecimento (Receita)' },
    { key:'filtroContador', label:'3. Filtro de contador' },
    { key:'score1', label:'4. Score 1 + corte' },
    { key:'validacao', label:'5. Validação de contato' },
    { key:'swot', label:'6. Agente SWOT (OpenAI)' },
    { key:'crm', label:'7. Envio ao CRM' },
  ];

  return (
    <div style={{ maxWidth:1180 }}>
      {!data.motor_conectado && (
        <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid '+C.amber, borderRadius:12,
          padding:'12px 16px', marginBottom:18, fontSize:12.5, color:C.amber }}>
          Motor (Redis/BullMQ) não conectado ao painel — verifique REDIS_HOST no serviço hunter-api.
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {cards.map(q => (
          <div key={q.label} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:13, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:q.color }}/>
              <span style={{ fontSize:12, color:'var(--dim)' }}>{q.label}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:600 }}>{q.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16, marginBottom:18 }}>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'15px 18px', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Pipeline por etapa</h3>
          </div>
          {etapas.map(et => {
            const q = queuesByKey[et.key] || { waiting:0, active:0, completed:0, failed:0 };
            return (
              <div key={et.key} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ flex:1, fontSize:12.5, fontWeight:500 }}>{et.label}</div>
                <span style={{ fontSize:11.5, color:C.blue }}>{q.active} ativos</span>
                <span style={{ fontSize:11.5, color:C.amber }}>{q.waiting} em espera</span>
                <span style={{ fontSize:11.5, color:C.green }}>{fmtNum(q.completed)} concluídos</span>
                <span style={{ fontSize:11.5, color:q.failed ? C.red : 'var(--faint)' }}>{q.failed} falhos</span>
              </div>
            );
          })}
        </div>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 12px' }}>Resumo do motor</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
              <span style={{ color:'var(--faint)' }}>Radares ativos</span>
              <span style={{ fontWeight:600 }}>{data.buscas_ativas}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
              <span style={{ color:'var(--faint)' }}>Empresas no ledger</span>
              <span style={{ fontWeight:600 }}>{fmtNum(data.empresas_total)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
              <span style={{ color:'var(--faint)' }}>Leads — últimas 24h</span>
              <span style={{ fontWeight:600 }}>{fmtNum(data.leads_hoje)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5 }}>
              <span style={{ color:'var(--faint)' }}>Descartados pelo corte — 24h</span>
              <span style={{ fontWeight:600, color:C.red }}>{fmtNum(data.descartados_hoje)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'15px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center' }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:0, flex:1 }}>Dead-letter queue</h3>
          <span style={{ fontSize:11, color:(data.dlq||[]).length ? C.red : 'var(--faint)', marginRight:12 }}>
            {(data.dlq||[]).length} job(s) com falha recente
          </span>
          {(data.dlq||[]).length > 0 && (
            <button onClick={limparDlq} disabled={limpando}
              style={{ height:30, padding:'0 12px', borderRadius:8, border:'1px solid var(--border)',
                background:'transparent', color:'var(--dim)', fontSize:12, fontFamily:'inherit',
                cursor: limpando ? 'default' : 'pointer', opacity: limpando ? .6 : 1 }}>
              {limpando ? 'Limpando…' : 'Limpar'}
            </button>
          )}
        </div>
        {(data.dlq||[]).length === 0 && (
          <div style={{ padding:'18px', fontSize:12.5, color:'var(--faint)' }}>Nenhuma falha recente.</div>
        )}
        {(data.dlq||[]).map((d,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:500 }}>
                <span style={{ color:C.cyan, fontFamily:'ui-monospace,monospace' }}>{d.job}</span>{' '}
                <span style={{ color:'var(--faint)' }}>{d.ref}</span>
              </div>
              <div style={{ fontSize:11.5, color:C.red, marginTop:2 }}>{d.motivo}</div>
            </div>
            <span style={{ fontSize:11, color:'var(--faint)', whiteSpace:'nowrap' }}>{d.quando ? timeAgo(d.quando) : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lead Detail Slideover ─────────────────────────────────────────────────────
function LeadDetailPanel({ leadId, onClose, onCrm, onStatusChange }) {
  const [lead, setLead] = useState(null);
  const [displayStatus, setDisplayStatus] = useState(null);
  const [actioning, setActioning] = useState(false);
  const [editandoContato, setEditandoContato] = useState(false);
  const [contatoForm, setContatoForm] = useState({ telefone:'', email:'', website:'' });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [erroCarga, setErroCarga] = useState(null);

  useEffect(() => {
    if (!leadId) return;
    setLead(null);
    setDisplayStatus(null);
    setEditandoContato(false);
    setErroCarga(null);
    fetch('/api/leads/' + leadId, { credentials:'same-origin' })
      .then(async r => {
        // Sem checar o r.ok, um 404 virava "lead" = {erro:'não encontrado'} e o
        // painel abria com TODOS os campos vazios — parecia que os dados da
        // Receita tinham sumido, quando na verdade o lead não existia mais.
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(r.status === 404
            ? 'Este lead não existe mais (pode ter sido excluído ou descartado pelo motor).'
            : (d.erro || 'Não foi possível carregar o lead.'));
        }
        return r.json();
      })
      .then(l => {
        setLead(l); setDisplayStatus(l.status);
        const cv = l.contato_validado || {};
        setContatoForm({ telefone: cv.telefone || '', email: cv.email || '', website: cv.website || '' });
      })
      .catch(e => setErroCarga(e.message));
  }, [leadId]);

  const salvarContato = async () => {
    setSalvandoContato(true);
    try {
      const r = await fetch(`/api/leads/${leadId}/contato`, {
        method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(contatoForm)
      });
      const d = await r.json();
      if (r.ok) {
        setLead(l => ({ ...l, contato_validado: d.contato_validado, contato_pendente: !d.completo }));
        setEditandoContato(false);
        onStatusChange && onStatusChange();
      }
    } catch (_) {} finally { setSalvandoContato(false); }
  };

  // Refaz SÓ o briefing da IA deste lead. Contato/telefone/e-mail/site ficam
  // intactos — é a diferença pro "Re-enriquecer", que refaz a busca inteira e
  // sobrescreve dado bom. Depois de enfileirar, fica olhando o lead até o
  // briefing mudar: sem isso o usuário clica, nada acontece na tela e parece
  // que quebrou (a IA leva alguns segundos).
  const [regSwot, setRegSwot] = useState(false);
  const regerarSwot = async () => {
    if (regSwot) return;
    setRegSwot(true);
    const antes = JSON.stringify(lead?.swot || {});
    try {
      const r = await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids: [leadId], acao: 'regerar_swot' })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        window.alert(d.erro || 'Não foi possível refazer a análise agora.');
        return;
      }
      for (let i = 0; i < 12; i++) {
        await new Promise(res => setTimeout(res, 4000));
        const novo = await fetch('/api/leads/' + leadId, { credentials:'same-origin' })
          .then(x => x.ok ? x.json() : null).catch(() => null);
        if (novo && JSON.stringify(novo.swot || {}) !== antes) { setLead(novo); return; }
      }
      window.alert('A análise foi enfileirada, mas ainda não voltou. A IA pode estar instável no momento — reabra o lead em alguns minutos.');
    } finally { setRegSwot(false); }
  };

  // Marcador manual "entreguei este lead pro time de vendas". Aparece só pra
  // lead que NÃO passou pelo CRM: quando o motor já entregou, a etiqueta conta a
  // história sozinha e desmarcar seria mentira — o lead está lá de verdade.
  const [marcandoEnvio, setMarcandoEnvio] = useState(false);
  const toggleEnviadoManual = async () => {
    if (marcandoEnvio || !lead) return;
    const jaMarcado = !!lead.enviado_manual_em;
    setMarcandoEnvio(true);
    try {
      const r = await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids:[leadId], acao: jaMarcado ? 'desmarcar_enviado' : 'marcar_enviado' })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { window.alert(d.erro || 'Não foi possível atualizar o marcador.'); return; }
      const novo = await fetch('/api/leads/' + leadId, { credentials:'same-origin' })
        .then(x => x.ok ? x.json() : null).catch(() => null);
      if (novo) { setLead(novo); setDisplayStatus(novo.status); }
      onStatusChange && onStatusChange();
    } finally { setMarcandoEnvio(false); }
  };

  const patchStatus = async (novoStatus) => {
    if (actioning) return;
    setActioning(true);
    try {
      await fetch('/api/leads/' + leadId, {
        method:'PATCH', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ status: novoStatus })
      });
      setDisplayStatus(novoStatus);
      onStatusChange && onStatusChange();
    } catch (_) {}
    setActioning(false);
  };

  if (!lead) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:60 }}>
        <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.55)' }}/>
        <div style={{ position:'absolute', top:0, right:0, height:'100vh', width:560, maxWidth:'94vw',
          background:'var(--panel)', borderLeft:'1px solid var(--border)', display:'flex',
          flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
          color:'var(--faint)', fontSize:13, padding:30, textAlign:'center' }}>
          {erroCarga ? (
            <>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Lead indisponível</div>
              <div style={{ lineHeight:1.5, maxWidth:340 }}>{erroCarga}</div>
              <button onClick={onClose}
                style={{ height:36, padding:'0 18px', borderRadius:9, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text)', fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
                Fechar
              </button>
            </>
          ) : 'Carregando…'}
        </div>
      </div>
    );
  }

  const l = lead;
  const status = displayStatus || l.status;
  const contatos = Array.isArray(l.contatos) ? l.contatos : [];
  const breakdown = Array.isArray(l.breakdown) ? l.breakdown : [];
  const decisorIni = (l.decisor || '').replace(/^(Dr|Dra)\.?\s*/i, '').split(' ').slice(0,2).map(w=>w[0]).join('');

  const mailPath = 'M3 5h18v14H3zM3 7l9 6 9-6';
  const telPath = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z';
  const webPath = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18';
  const contactIcon = (tipo) => {
    if (tipo === 'email') return <Svg d={mailPath} color={C.blue} w={16} h={16} sw={1.8}/>;
    if (tipo === 'telefone') return <Svg d={telPath} color={C.green} w={16} h={16} sw={1.8}/>;
    return <Svg d={webPath} color={C.cyan} w={16} h={16} sw={1.8}/>;
  };

  const seloStyle = (validado) => ({
    display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600,
    padding:'3px 7px', borderRadius:6, whiteSpace:'nowrap',
    background: validado ? C.green+'1f' : C.amber+'1f',
    color: validado ? C.green : C.amber,
  });

  const breakdownColor = (b) => {
    if (!b.positivo) return b.delta && b.delta !== '0' && b.delta !== '—' ? C.red : C.gray;
    return C.green;
  };

  const cadastrais = [
    { k:'CNAE principal', v:l.cnae },
    { k:'Setor', v:l.setor },
    { k:'Porte', v:l.porte },
    { k:'Situação', v:l.situacao, ok: l.situacao === 'Ativa' },
    { k:'Abertura', v:l.abertura },
    { k:'Capital social', v:l.capital },
    { k:'Cidade/UF', v:[l.cidade, l.uf].filter(Boolean).join('/') },
    { k:'Natureza jurídica', v:l.natureza_juridica },
    { k:'Optante Simples', v:l.opcao_simples == null ? null : (l.opcao_simples ? 'Sim' : 'Não') },
    { k:'Endereço', v:l.endereco },
  ];

  // Abre a folha de impressão/PDF deste lead (usa o gerador compartilhado).
  const imprimirLead = () => abrirImpressaoLeads([{ ...l, status }]);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.55)', animation:'hfade .2s ease' }}/>
      <div style={{ position:'absolute', top:0, right:0, height:'100vh', width:560, maxWidth:'94vw',
        background:'var(--panel)', borderLeft:'1px solid var(--border)', overflowY:'auto',
        animation:'hslide .28s cubic-bezier(.22,.61,.36,1)' }}>

        <div style={{ position:'sticky', top:0, zIndex:2, background:'var(--panel)',
          borderBottom:'1px solid var(--border)', padding:'18px 24px',
          display:'flex', alignItems:'flex-start', gap:16 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5 }}>
              {(() => { const e = envioDoLead(l, status); return (
                <span title={e?.titulo || undefined} style={badgeStyle(statusColors[status]||C.gray)}>
                  {e ? e.rotulo : status}
                </span>
              ); })()}
              <span style={{ fontSize:11.5, color:'var(--faint)' }}>{l.cnpj}</span>
            </div>
            {(() => { const e = envioDoLead(l, status); return e ? (
              <p style={{ fontSize:11.5, color:'var(--faint)', margin:'0 0 4px' }}>{e.titulo}</p>
            ) : null; })()}
            <h2 style={{ fontSize:19, fontWeight:600, margin:0 }}>{l.fantasia}</h2>
            <p style={{ fontSize:12.5, color:'var(--dim)', margin:'3px 0 0' }}>{l.razao}</p>
          </div>
          <ScoreRing score={l.score} size={84}/>
          <button onClick={imprimirLead} title="Imprimir ou salvar em PDF"
            style={{ flexShrink:0, height:32, padding:'0 11px', borderRadius:8,
              border:'1px solid var(--border)', background:'transparent', color:'var(--dim)',
              cursor:'pointer', fontSize:12, fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 }}>
            <Svg d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" w={15} h={15} sw={1.7}/>
            PDF
          </button>
          <button onClick={onClose} style={{ flexShrink:0, width:32, height:32, borderRadius:8,
            border:'1px solid var(--border)', background:'transparent', color:'var(--dim)',
            cursor:'pointer', fontSize:15 }}>✕</button>
        </div>

        <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:20 }}>
          <section>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'var(--faint)',
              marginBottom:12, textTransform:'uppercase' }}>Dados cadastrais · Receita Federal</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 18px' }}>
              {cadastrais.map(c => (
                <div key={c.k}>
                  <div style={{ fontSize:11, color:'var(--faint)', marginBottom:3 }}>{c.k}</div>
                  <div style={{ fontSize:13, display:'flex', alignItems:'center', gap:7 }}>
                    {c.ok && <span style={{ width:7, height:7, borderRadius:'50%', background:C.green, display:'inline-block', flexShrink:0 }}/>}
                    <span>{c.v || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'var(--faint)',
              marginBottom:12, textTransform:'uppercase' }}>Decisor</div>
            {l.decisor ? (
              <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ width:42, height:42, borderRadius:11, background:C.blue, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600,
                  fontSize:14, flexShrink:0 }}>{decisorIni}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{l.decisor}</div>
                  <div style={{ fontSize:12, color:'var(--dim)' }}>{l.cargo || 'Sócio(a)'}</div>
                </div>
                <div style={{ flex:1 }}/>
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
                  color:C.cyan, background:'rgba(122,217,255,.1)', border:'1px solid rgba(122,217,255,.2)',
                  padding:'5px 9px', borderRadius:7 }}>
                  <SvgMulti w={12} h={12} sw={2} color={C.cyan}><path d="M20 6L9 17l-5-5"/></SvgMulti>
                  Receita Federal
                </span>
              </div>
            ) : (
              <div style={{ fontSize:12.5, color:'var(--faint)', lineHeight:1.5, background:'var(--panel2)',
                border:'1px dashed var(--border)', borderRadius:10, padding:'11px 13px' }}>
                Decisor não identificado no quadro societário — comum em MEI e empresas com sócio único
                pessoa jurídica. Use o contato comercial validado abaixo, quando houver.
              </div>
            )}
          </section>

          {(() => {
            const cvv = l.contato_validado || {};
            const temContato = !!(cvv.telefone || cvv.email);
            return (
            <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color: temContato ? C.green : C.red, textTransform:'uppercase', flex:1 }}>
                  {temContato ? 'Contato do decisor · validado' : 'Contato · pendente'}
                </span>
                <button onClick={() => setEditandoContato(v => !v)}
                  style={{ height:26, padding:'0 10px', borderRadius:7, border:'1px solid var(--border)',
                    background:'transparent', color:'var(--dim)', fontSize:11.5, fontFamily:'inherit', cursor:'pointer' }}>
                  {editandoContato ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editandoContato && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12, background:'var(--panel2)',
                  border:'1px solid var(--border)', borderRadius:11, padding:'12px 13px' }}>
                  {[['telefone','Telefone / WhatsApp','(11) 99999-9999'],['email','E-mail','contato@empresa.com.br'],['website','Site','https://empresa.com.br']].map(([k,lbl,ph]) => (
                    <div key={k}>
                      <label style={{ display:'block', fontSize:10.5, color:'var(--faint)', marginBottom:3 }}>{lbl}</label>
                      <input value={contatoForm[k]} onChange={e => setContatoForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph}
                        style={{ width:'100%', height:34, borderRadius:8, border:'1px solid var(--border)', background:'var(--panel)',
                          color:'var(--text)', padding:'0 10px', fontSize:12.5, fontFamily:'inherit' }}/>
                    </div>
                  ))}
                  <button onClick={salvarContato} disabled={salvandoContato}
                    style={{ height:34, borderRadius:8, border:'none', background:'var(--gold)', color:'#0E1936',
                      fontWeight:600, fontSize:12.5, fontFamily:'inherit', cursor:'pointer', marginTop:2 }}>
                    {salvandoContato ? 'Salvando…' : 'Salvar contato'}
                  </button>
                </div>
              )}
              {!temContato && !editandoContato && (
                <div style={{ fontSize:12, color:'var(--faint)', lineHeight:1.5, marginBottom:12 }}>
                  O enriquecimento não achou telefone/e-mail válidos. Use "Editar" pra inserir manualmente.
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {l.contato_validado?.telefone && (
                  <div style={{ display:'flex', alignItems:'center', gap:11, background:'rgba(74,222,128,.08)',
                    border:'1px solid rgba(74,222,128,.25)', borderRadius:10, padding:'11px 13px' }}>
                    <Svg d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" color={C.green} w={16} h={16} sw={1.8}/>
                    <span style={{ fontSize:13.5, flex:1 }}>{l.contato_validado.telefone}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:C.green }}>✓ validado</span>
                  </div>
                )}
                {l.contato_validado?.email && (
                  <div style={{ display:'flex', alignItems:'center', gap:11, background:'rgba(74,222,128,.08)',
                    border:'1px solid rgba(74,222,128,.25)', borderRadius:10, padding:'11px 13px' }}>
                    <Svg d="M3 5h18v14H3zM3 7l9 6 9-6" color={C.green} w={16} h={16} sw={1.8}/>
                    <span style={{ fontSize:13.5, flex:1, wordBreak:'break-all' }}>{l.contato_validado.email}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:C.green }}>✓ validado</span>
                  </div>
                )}
                {l.contato_validado?.website && (
                  <a href={l.contato_validado.website} target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:11, background:'var(--panel2)',
                      border:'1px solid var(--border)', borderRadius:10, padding:'11px 13px', textDecoration:'none' }}>
                    <Svg d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18" color="var(--dim)" w={16} h={16} sw={1.8}/>
                    <span style={{ fontSize:13, flex:1, color:'var(--text)', wordBreak:'break-all' }}>{l.contato_validado.website}</span>
                  </a>
                )}
                {l.contato_validado?.resumo_site && (
                  <div style={{ fontSize:12, color:'var(--dim)', lineHeight:1.5, background:'var(--panel2)',
                    borderRadius:10, padding:'10px 13px', fontStyle:'italic' }}>
                    "{l.contato_validado.resumo_site}"
                    <div style={{ fontSize:10, color:'var(--faint)', marginTop:5, fontStyle:'normal' }}>Extraído do site — usado como contexto pelo agente SWOT</div>
                  </div>
                )}
              </div>
            </section>
            );
          })()}

          {contatos.length > 0 && (
            <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'var(--faint)',
                marginBottom:12, textTransform:'uppercase' }}>Contatos</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {contatos.map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:11, background:'var(--panel2)',
                    border:'1px solid var(--border)', borderRadius:10, padding:'11px 13px' }}>
                    {contactIcon(c.tipo)}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.valor}</div>
                      <div style={{ fontSize:10.5, color:'var(--faint)' }}>{c.fonte} · {c.recencia}</div>
                    </div>
                    <span style={seloStyle(c.validado)}>{c.selo || (c.validado ? 'verificado' : 'não verif.')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {l.swot && (
            <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <SvgMulti w={14} h={14} sw={1.8} color={C.blue}>
                  <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17"/>
                  <circle cx={12} cy={12} r={4}/>
                </SvgMulti>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:C.blue, textTransform:'uppercase', flex:1 }}>
                  Briefing SWOT · IA
                </span>
              </div>
              {/* Sem resumo E sem quadrantes = a IA não devolveu nada. Antes a
                  seção aparecia em branco e não dava pra saber se era falha ou
                  se o lead simplesmente não tinha análise. */}
              {!l.swot.resumo && !l.swot.swot && (
                <p style={{ fontSize:12.5, lineHeight:1.55, margin:'0 0 12px', color:'var(--dim)' }}>
                  A análise ainda não foi gerada para este lead — a IA pode ter falhado ou estar indisponível
                  no momento. Clique em “Refazer análise” abaixo. Os contatos não são alterados.
                </p>
              )}
              {l.swot.resumo && (
                <p style={{ fontSize:13, lineHeight:1.6, margin:'0 0 14px', color:'var(--text)' }}>{l.swot.resumo}</p>
              )}
              {Array.isArray(l.swot.fatos_uteis) && l.swot.fatos_uteis.length > 0 && (
                <div style={{ background:'color-mix(in srgb, '+C.green+' 9%, transparent)', border:'1px solid color-mix(in srgb, '+C.green+' 28%, transparent)',
                  borderRadius:11, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:10.5, fontWeight:600, color:C.green, marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Fatos úteis pro contato</div>
                  <ul style={{ margin:0, padding:'0 0 0 16px', fontSize:12.5, lineHeight:1.6, color:'var(--text)' }}>
                    {l.swot.fatos_uteis.map((f,i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(l.swot.dores_provaveis) && l.swot.dores_provaveis.length > 0 && (
                <div style={{ background:'color-mix(in srgb, '+C.amber+' 9%, transparent)', border:'1px solid color-mix(in srgb, '+C.amber+' 28%, transparent)',
                  borderRadius:11, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:10.5, fontWeight:600, color:C.amber, marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Dores prováveis</div>
                  <ul style={{ margin:0, padding:'0 0 0 16px', fontSize:12.5, lineHeight:1.6, color:'var(--text)' }}>
                    {l.swot.dores_provaveis.map((d,i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  ['Forças', l.swot.swot?.forcas, C.green],
                  ['Fraquezas', l.swot.swot?.fraquezas, C.red],
                  ['Oportunidades', l.swot.swot?.oportunidades, C.blue],
                  ['Ameaças', l.swot.swot?.ameacas, C.amber],
                ].map(([titulo, itens, cor]) => (
                  <div key={titulo} style={{ background:'var(--panel2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 12px' }}>
                    <div style={{ fontSize:11, fontWeight:600, color:cor, marginBottom:6 }}>{titulo}</div>
                    <ul style={{ margin:0, padding:'0 0 0 15px', fontSize:12, lineHeight:1.5, color:'var(--dim)' }}>
                      {(Array.isArray(itens) ? itens : []).map((it,i) => <li key={i}>{it}</li>)}
                      {(!itens || !itens.length) && <li style={{ color:'var(--faint)', listStyle:'none', marginLeft:-15 }}>—</li>}
                    </ul>
                  </div>
                ))}
              </div>
              {(l.swot.sinal_comercial || l.swot.gancho) && (
                <div style={{ background:'rgba(58,142,255,.07)', border:'1px solid rgba(58,142,255,.22)', borderRadius:11, padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:10.5, fontWeight:600, color:C.blue, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Sinal comercial</div>
                  <p style={{ fontSize:13, lineHeight:1.55, margin:0, color:'var(--text)' }}>{l.swot.sinal_comercial || l.swot.gancho}</p>
                </div>
              )}
              <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={regerarSwot} disabled={regSwot}
                  title="Refaz só o briefing da IA. Telefone, e-mail e site ficam como estão."
                  style={{ display:'flex', alignItems:'center', gap:6, height:31, padding:'0 12px',
                    borderRadius:7, border:'1px solid var(--border)', background:'transparent',
                    color: regSwot ? 'var(--faint)' : 'var(--dim)', fontSize:12, fontFamily:'inherit',
                    cursor: regSwot ? 'default' : 'pointer' }}>
                  {regSwot ? 'Analisando…' : 'Refazer análise'}
                </button>
                <button onClick={() => navigator.clipboard?.writeText(
                    [l.swot.resumo,
                     l.swot.fatos_uteis?.length ? 'Fatos úteis:\n- ' + l.swot.fatos_uteis.join('\n- ') : '',
                     l.swot.dores_provaveis?.length ? 'Dores prováveis:\n- ' + l.swot.dores_provaveis.join('\n- ') : '',
                     (l.swot.sinal_comercial || l.swot.gancho) ? 'Sinal comercial: ' + (l.swot.sinal_comercial || l.swot.gancho) : ''].filter(Boolean).join('\n\n')).catch(()=>{})}
                  style={{ display:'flex', alignItems:'center', gap:6, height:31, padding:'0 12px',
                    borderRadius:7, border:'1px solid rgba(58,142,255,.3)', background:'transparent',
                    color:C.blue, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Copiar briefing</button>
              </div>
            </section>
          )}

          {breakdown.length > 0 && (
            <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:'var(--faint)',
                marginBottom:12, textTransform:'uppercase' }}>Breakdown do confidence score</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {breakdown.map((b,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:12.5, flex:1, color:'var(--dim)' }}>{b.campo}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:breakdownColor(b), minWidth:34, textAlign:'right' }}>{b.delta}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div style={{ position:'sticky', bottom:0, background:'var(--panel)',
          borderTop:'1px solid var(--border)', padding:'14px 24px', display:'flex', gap:10, flexWrap:'wrap' }}>
          {!l.enviado_crm_em && (
            <button onClick={toggleEnviadoManual} disabled={marcandoEnvio}
              title={l.enviado_manual_em
                ? 'Desfaz a marcação manual de envio ao time de vendas.'
                : 'Registra que você entregou este lead ao time de vendas (sem passar pelo CRM).'}
              style={{ height:42, padding:'0 16px', borderRadius:10,
                border:`1px solid ${l.enviado_manual_em ? C.green : 'var(--border)'}`,
                background:'transparent', color: l.enviado_manual_em ? C.green : 'var(--text)',
                fontSize:13, fontFamily:'inherit', cursor: marcandoEnvio ? 'default' : 'pointer',
                display:'flex', alignItems:'center', gap:7, opacity: marcandoEnvio ? .6 : 1 }}>
              <Svg d="M20 6L9 17l-5-5" color={l.enviado_manual_em ? C.green : 'var(--dim)'} w={15} h={15} sw={2.2}/>
              {l.enviado_manual_em ? 'Enviado ao time' : 'Marcar como enviado'}
            </button>
          )}
          <button onClick={() => onCrm([leadId])}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              gap:7, height:42, borderRadius:10, border:'none', background:'var(--gold)', color:'#0E1936',
              fontWeight:600, fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>
            <Svg d="M5 12h14M13 5l7 7-7 7" color="#0E1936" w={15} h={15} sw={2}/>
            Enviar ao CRM
          </button>
          <button onClick={() => patchStatus('Qualificado')} disabled={actioning || status==='Qualificado'}
            style={{ height:42, padding:'0 16px', borderRadius:10, border:'1px solid var(--border)',
              background:'transparent', color: status==='Qualificado' ? C.green : 'var(--text)',
              fontSize:13, fontFamily:'inherit', cursor:'pointer',
              opacity: actioning||status==='Qualificado' ? .6 : 1 }}>Aprovar</button>
          <button onClick={() => patchStatus('Descartado')} disabled={actioning || status==='Descartado'}
            style={{ height:42, padding:'0 16px', borderRadius:10, border:'1px solid var(--border)',
              background:'transparent', color: status==='Descartado' ? C.red : 'var(--dim)',
              fontSize:13, fontFamily:'inherit', cursor:'pointer',
              opacity: actioning||status==='Descartado' ? .6 : 1 }}>Descartar</button>
        </div>
      </div>
    </div>
  );
}

// ── CRM Modal ─────────────────────────────────────────────────────────────────
function CrmModal({ ids, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [crm, setCrm] = useState(null); // null=carregando

  useEffect(() => {
    fetch('/api/crm/status', { credentials:'same-origin' })
      .then(r => r.json()).then(setCrm).catch(() => setCrm({ ativo:false }));
  }, []);

  const confirmar = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids, acao:'enviar_crm' })
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.erro || 'Erro ao enviar ao CRM.'); }
      onConfirm();
    } catch (e) {
      alert(e.message || 'Erro ao enviar ao CRM.');
    } finally {
      setLoading(false);
    }
  };
  const semCrm = crm && !crm.ativo;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.6)' }}/>
      <div style={{ position:'relative', width:460, maxWidth:'92vw', background:'var(--panel)',
        border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid var(--border)' }}>
          <h2 style={{ fontSize:17, fontWeight:600, margin:'0 0 4px' }}>Enviar ao CRM</h2>
          <p style={{ fontSize:13, color:'var(--dim)', margin:0 }}>{ids.length} lead{ids.length!==1?'s':''} {ids.length!==1?'serão enviados':'será enviado'} — ação deliberada, sem automação.</p>
        </div>
        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>CRM de destino</label>
            <div style={{ height:42, borderRadius:10, border:'1px solid var(--border)', background:'var(--panel2)',
              display:'flex', alignItems:'center', padding:'0 14px', fontSize:13.5 }}>
              <span>{crm === null ? 'Carregando…' : semCrm ? 'Nenhum CRM ativo' : crm.nome}</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:11,
            background: semCrm ? 'rgba(248,113,113,.08)' : 'var(--panel2)',
            border:'1px solid '+(semCrm ? 'rgba(248,113,113,.25)' : 'var(--border)'), borderRadius:10, padding:'12px 14px' }}>
            <SvgMulti w={17} h={17} sw={1.8} color={semCrm ? C.red : C.cyan}>
              <circle cx={12} cy={12} r={10}/><path d="M12 16v-4M12 8h.01"/>
            </SvgMulti>
            <span style={{ fontSize:12.5, color: semCrm ? C.red : 'var(--dim)', lineHeight:1.45 }}>
              {semCrm
                ? 'Nenhum CRM conectado no momento. Fale com o administrador do sistema.'
                : (crm?.detalhe || 'Os dados do lead serão enviados ao CRM configurado.')}
            </span>
          </div>
        </div>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)',
          display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ height:42, padding:'0 18px', borderRadius:10,
            border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
            fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={loading || semCrm || crm === null}
            style={{ height:42, padding:'0 20px', borderRadius:10, border:'none', background:'var(--gold)',
              color:'#0E1936', fontWeight:600, fontSize:13.5, fontFamily:'inherit',
              cursor:(loading||semCrm||crm===null)?'default':'pointer',
              opacity:(loading||semCrm||crm===null)?.6:1 }}>
            {loading ? 'Enviando…' : 'Confirmar envio'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('hunter_theme') || 'dark'; } catch (_) { return 'dark'; }
  });
  const [screen, setScreen] = useState('dashboard');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [crmIds, setCrmIds] = useState(null);
  const [buscaDetailId, setBuscaDetailId] = useState(null);
  const [user, setUser] = useState(null);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);
  const [decisao, setDecisao] = useState(null);   // leads aguardando decisão manual
  const [duplicarDe, setDuplicarDe] = useState(null);   // busca a duplicar (pré-preenche Nova busca)

  useEffect(() => {
    fetch('/api/auth/me', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); })
      .catch(() => {});
    // Popup do próximo login: leads que acharam só telefone (sem e-mail).
    fetch('/api/leads/decisao-pendente', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.leads?.length) setDecisao(d.leads); })
      .catch(() => {});
  }, []);

  const navTo = (s) => { setScreen(s); setOpenLeadId(null); setCrmIds(null); if (s !== 'nova') setDuplicarDe(null); };
  const duplicarBusca = (b) => { setDuplicarDe(b); setScreen('nova'); setOpenLeadId(null); };
  // Persiste o tema escolhido: só muda quando o usuário clica (sobrevive ao reload).
  const toggleTheme = () => setTheme(t => {
    const novo = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('hunter_theme', novo); } catch (_) {}
    return novo;
  });
  const logout = async () => {
    try { await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin' }); } catch (_) {}
    window.location = '/';
  };

  const openBusca = (id) => {
    if (id) { setBuscaDetailId(id); setScreen('buscaDetail'); }
    else { setScreen('buscas'); }
  };

  const vars = themeVars(theme);
  const cssVarObj = Object.fromEntries(
    vars.split(';').filter(Boolean).map(s => {
      const i = s.indexOf(':');
      return [s.slice(0,i).trim(), s.slice(i+1).trim()];
    })
  );
  const rootStyle = { display:'flex', minHeight:'100vh', width:'100%', fontFamily:'Inter,system-ui,sans-serif',
    color:'var(--text)', background:'var(--bg)', WebkitFontSmoothing:'antialiased', ...cssVarObj };

  const renderScreen = () => {
    // Guarda: telas sigilosas (Integrações/Config/Monitoramento) só para o MASTER.
    if (TELAS_MASTER.has(screen) && !user?.master) return <Dashboard onOpenBusca={openBusca}/>;
    if (screen === 'usuarios' && !(user?.master || user?.papel === 'Admin')) return <Dashboard onOpenBusca={openBusca}/>;
    switch(screen) {
      case 'dashboard': return <Dashboard onOpenBusca={openBusca}/>;
      case 'leads': return (
        <Leads refreshKey={leadsRefreshKey} onOpenLead={setOpenLeadId} onCrm={setCrmIds}/>
      );
      case 'buscas': return <Buscas onOpen={openBusca}/>;
      case 'buscaDetail': return <BuscaDetail buscaId={buscaDetailId} onBack={() => setScreen('buscas')} onOpenLead={setOpenLeadId} onDuplicar={duplicarBusca}/>;
      case 'nova': return <NovaBusca key={duplicarDe ? 'dup-'+duplicarDe.id : 'nova'} inicial={duplicarDe} onSalvar={() => navTo('buscas')}/>;
      case 'propostas': return <Propostas/>;
      case 'semelhantes': return <Semelhantes/>;
      case 'agente': return <AgenteSwot/>;
      case 'integracoes': return <Integracoes/>;
      case 'usuarios': return <Usuarios user={user}/>;
      case 'config': return <Config/>;
      case 'monitor': return <Monitor/>;
      default: return null;
    }
  };

  return (
    <div style={rootStyle}>
      <div style={{ display:'flex', width:'100%', minHeight:'100vh' }}>
        <Sidebar screen={screen} onNav={navTo} onLogout={logout} user={user}/>
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', background:'var(--bg)' }}>
          <Topbar screen={screen} theme={theme} onTheme={toggleTheme} onNova={() => navTo('nova')} user={user}/>
          <main style={{ flex:1, overflowY:'auto', padding:28 }}>
            {renderScreen()}
          </main>
        </div>
      </div>

      {openLeadId && (
        <LeadDetailPanel
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
          onCrm={(ids) => setCrmIds(ids)}
          onStatusChange={() => setLeadsRefreshKey(k => k + 1)}
        />
      )}
      {crmIds && (
        <CrmModal
          ids={crmIds}
          onClose={() => setCrmIds(null)}
          onConfirm={() => { setCrmIds(null); setLeadsRefreshKey(k => k + 1); }}
        />
      )}
      {decisao && decisao.length > 0 && (
        <DecisaoModal
          leads={decisao}
          onClose={() => setDecisao(null)}
          onAbrirLead={(id) => { setDecisao(null); setOpenLeadId(id); }}
          onResolvido={() => setLeadsRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}

// Popup do próximo login: leads que acharam SÓ telefone (sem e-mail). Para cada
// um: enviar mesmo assim ao CRM / achar manualmente / marcar não qualificado.
function DecisaoModal({ leads, onClose, onAbrirLead, onResolvido }) {
  const [lista, setLista] = useState(leads);
  const [busy, setBusy] = useState(null);

  const resolver = async (id, acao) => {
    setBusy(id);
    try {
      await fetch(`/api/leads/${id}/decisao`, {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ acao })
      });
      onResolvido && onResolvido();
      const resto = lista.filter(l => l.id !== id);
      setLista(resto);
      if (!resto.length) onClose();
    } catch (_) {} finally { setBusy(null); }
  };
  // O joinha já resolveu o lead pelo seu próprio endpoint — aqui é só tirar da
  // fila do popup (chamar /decisao de novo mandaria uma ação inválida).
  const removerDaLista = (id) => {
    onResolvido && onResolvido();
    const resto = lista.filter(l => l.id !== id);
    setLista(resto);
    if (!resto.length) onClose();
  };
  const acharManual = async (id) => {
    try {
      await fetch(`/api/leads/${id}/decisao`, {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ acao:'manual' })
      });
    } catch (_) {}
    onResolvido && onResolvido();
    onAbrirLead(id);   // abre o lead pra editar o contato à mão
  };

  const btn = (cor, bg) => ({ height:32, padding:'0 12px', borderRadius:8, border:`1px solid ${cor}`,
    background: bg || 'transparent', color: bg ? '#0E1936' : cor, fontSize:12, fontFamily:'inherit',
    cursor:'pointer', whiteSpace:'nowrap' });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:95, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(5,9,20,.6)' }}/>
      <div style={{ position:'relative', width:640, maxWidth:'96vw', maxHeight:'86vh', overflowY:'auto',
        background:'var(--panel)', border:'1px solid var(--border)', borderRadius:16, padding:'22px 24px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:6 }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontSize:17, fontWeight:600, margin:0 }}>Leads aguardando decisão</h2>
            <p style={{ fontSize:12.5, color:'var(--faint)', margin:'4px 0 0', lineHeight:1.5 }}>
              Estes leads têm telefone mas o enriquecimento não achou e-mail. Escolha o que fazer com cada um.
            </p>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)',
            background:'transparent', color:'var(--dim)', cursor:'pointer', fontSize:15 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
          {lista.map(l => (
            <div key={l.id} style={{ border:'1px solid var(--border)', borderRadius:11, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {l.fantasia || l.razao}
                  </div>
                  <div style={{ fontSize:11.5, color:'var(--faint)' }}>
                    {l.cidade}/{l.uf} · tel {l.telefone || '—'} · sem e-mail
                  </div>
                </div>
                <span style={badgeStyle(C.gold)}>score {l.score}</span>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button disabled={busy===l.id} onClick={() => resolver(l.id, 'enviar')} style={btn(C.gold, C.gold)}>Enviar assim mesmo</button>
                <button disabled={busy===l.id} onClick={() => acharManual(l.id)} style={btn('var(--border)')}>Achar manualmente</button>
                <button disabled={busy===l.id} onClick={() => resolver(l.id, 'descartar')} style={btn(C.red)}>Não qualificado</button>
                <ForaDoPerfil leadId={l.id} marcado={false} onMudou={() => removerDaLista(l.id)}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sem isto, QUALQUER erro de render em QUALQUER componente (um bug pontual,
// um dado inesperado da API) derruba a árvore inteira e vira tela branca —
// sem mensagem nenhuma pro usuário. Com o boundary, mostra uma tela de erro
// com botão de recarregar, e imprime o erro completo no console (F12) pra
// dar pra diagnosticar a causa em vez de só "ficou branco".
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  componentDidCatch(erro, info) {
    console.error('[Hunter] erro de render capturado:', erro, info?.componentStack);
  }
  render() {
    if (this.state.erro) {
      return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
          background:'#0E1936', color:'#ECEFF7', fontFamily:'Inter,system-ui,sans-serif', padding:24 }}>
          <div style={{ maxWidth:440, textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:600, marginBottom:10 }}>Algo deu errado nesta tela</div>
            <div style={{ fontSize:13, color:'#8A95B4', marginBottom:18, lineHeight:1.5 }}>
              A tela travou por um erro inesperado. Recarregar costuma resolver. Se continuar, avise o
              suporte com um print do console (tecla F12 → aba Console).
            </div>
            <button onClick={() => window.location.reload()}
              style={{ height:40, padding:'0 20px', borderRadius:9, border:'none', background:'#FBE49A',
                color:'#0E1936', fontWeight:600, fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
