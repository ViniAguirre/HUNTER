const { useState, useRef, useEffect, useMemo } = React;

// ── constants ─────────────────────────────────────────────────────────────────
const C = { green:'#34D399', amber:'#FBBF24', red:'#F87171', blue:'#3A8EFF', gold:'#FBE49A', cyan:'#7AD9FF', gray:'#7C89A8' };

function themeVars(t) {
  return t === 'light'
    ? '--bg:#F4F6FA;--panel:#FFFFFF;--panel2:#EEF2F8;--hover:rgba(14,25,54,.04);--border:rgba(14,25,54,.10);--track:rgba(14,25,54,.08);--text:#0E1936;--dim:#5A6480;--faint:#8A93A8;--gold:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;'
    : '--bg:#0E1936;--panel:#0A0F1F;--panel2:#101a3a;--hover:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);--track:rgba(255,255,255,.08);--text:#ECEFF7;--dim:#8A95B4;--faint:#5E688C;--gold:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;';
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

function scoreColor(s) { return s >= 75 ? C.green : s >= 50 ? C.amber : C.red; }

function badgeStyle(hex) {
  return { display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600,
    padding:'3px 9px', borderRadius:20, background:hex+'1f', color:hex, border:`1px solid ${hex}33`, whiteSpace:'nowrap' };
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

function ContactIcons({ email, phone }) {
  const ok = (has, path, title) => (
    <svg key={title} title={title} width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke={has ? C.green : 'var(--faint)'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: has ? 1 : .4 }}>
      <path d={path}/>
    </svg>
  );
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      {ok(email, 'M3 5h18v14H3zM3 7l9 6 9-6', 'E-mail')}
      {ok(phone, 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z', 'Telefone')}
    </div>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────
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
const buscaStatusColors = { Ativa:C.green, Pausada:C.amber, Esgotada:C.blue, Encerrada:C.gray };
const healthColors = { green:C.green, amber:C.amber, red:C.red, gray:C.gray };

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { key:'dashboard', label:'Dashboard', icon:'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z' },
  { key:'buscas', label:'Buscas', icon:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3' },
  { key:'leads', label:'Leads', icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3' },
];
const NAV_ADMIN = [
  { key:'integracoes', label:'Integrações', icon:'M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8' },
  { key:'usuarios', label:'Usuários', icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  { key:'config', label:'Configurações', icon:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' },
  { key:'monitor', label:'Monitoramento', icon:'M22 12h-4l-3 9L9 3l-3 9H2' },
];

function Sidebar({ screen, onNav, onLogout, user }) {
  const nome = user?.nome || '…';
  const papel = user?.papel || '';
  const ini = nome.split(' ').slice(0,2).map(w=>w[0]).join('');
  const navStyle = (key) => {
    const active = screen === key || (key === 'buscas' && screen === 'buscaDetail');
    return {
      display:'flex', alignItems:'center', gap:11, padding:'9px 12px', borderRadius:9,
      fontSize:13.5, fontWeight:500, cursor:'pointer', textDecoration:'none',
      color: active ? '#FBE49A' : 'var(--dim)',
      background: active ? 'var(--panel2)' : 'transparent',
      boxShadow: active ? 'inset 2px 0 0 #FBE49A' : 'none',
      transition:'background .12s',
    };
  };
  const renderNav = (items) => items.map(it => (
    <a key={it.key} onClick={() => onNav(it.key)} className="nav-link" style={navStyle(it.key)}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke={screen === it.key || (it.key==='buscas' && screen==='buscaDetail') ? '#FBE49A' : '#8A95B4'}
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
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.14em', color:'var(--faint)',
          padding:'18px 12px 8px' }}>ADMINISTRAÇÃO</div>
        {renderNav(NAV_ADMIN)}
      </nav>
      <div onClick={onLogout} style={{ padding:'14px 16px', borderTop:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
        <div style={{ width:32, height:32, borderRadius:8, background:C.blue, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>{ini}</div>
        <div style={{ lineHeight:1.3, overflow:'hidden' }}>
          <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nome}</div>
          <div style={{ fontSize:11, color:'var(--faint)' }}>{papel} · sair</div>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
const TITLES = {
  dashboard: ['Dashboard', 'Visão geral da operação'],
  leads: ['Leads', 'Curadoria e envio de leads qualificados'],
  buscas: ['Buscas', 'Gerencie suas torneiras de leads'],
  buscaDetail: ['Detalhe da busca', 'Produção e leads desta busca'],
  nova: ['Nova busca', 'Configure uma nova torneira de leads'],
  integracoes: ['Integrações', 'Conexões com APIs e CRM'],
  usuarios: ['Usuários', 'Permissões e acessos'],
  config: ['Configurações', 'Parâmetros gerais do sistema'],
  monitor: ['Monitoramento', 'Saúde do sistema e filas'],
};

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
          Nova busca
        </button>
        <ThemeToggle theme={theme} onToggle={onTheme}/>
        <button title="Alertas" style={{ position:'relative', width:38, height:38, borderRadius:9,
          border:'1px solid var(--border)', background:'var(--panel)', color:'var(--dim)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <SvgMulti w={17} h={17} sw={1.7}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></SvgMulti>
          <span style={{ position:'absolute', top:7, right:8, width:7, height:7, borderRadius:'50%',
            background:C.red, border:'1.5px solid var(--panel)' }}/>
        </button>
        <div style={{ width:34, height:34, borderRadius:9, background:C.blue, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, cursor:'pointer' }}>{ini}</div>
      </div>
    </header>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ onOpenBusca }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard', { credentials:'same-origin' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return <div style={{ color:'var(--faint)', padding:40, textAlign:'center' }}>Carregando…</div>;
  }

  const { metricas = {}, buscasAtivas = [], atividade = [] } = data || {};
  const qual = parseInt(metricas.leadsQualificados) || 0;
  const enc = parseInt(metricas.leadsEncontrados) || 1;
  const taxaQ = Math.round(qual / enc * 100);

  const metrics = [
    { label:'Buscas ativas', value:fmtNum(metricas.buscasAtivas), icon:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3', iColor:C.blue, trend:'em produção', tColor:'var(--dim)' },
    { label:'Leads encontrados', value:fmtNum(metricas.leadsEncontrados), icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3', iColor:C.gold, trend:'total acumulado', tColor:'var(--dim)' },
    { label:'Leads qualificados', value:fmtNum(metricas.leadsQualificados), icon:'M20 6L9 17l-5-5', iColor:C.green, trend:`${taxaQ}% taxa de qualif.`, tColor:'var(--dim)' },
    { label:'Enviados ao CRM', value:fmtNum(metricas.leadsCRM), icon:'M5 12h14M13 5l7 7-7 7', iColor:C.cyan, trend:'total enviado', tColor:'var(--dim)' },
  ];

  const hlLabel = { green:'produzindo', amber:'ritmo lento', red:'parada', gray:'encerrada' };

  const alertas = [
    { color:C.red, titulo:'Busca "Construtoras SP" está parada há 2h', tempo:'erro de heartbeat' },
    { color:C.amber, titulo:'Universo de "Clínicas NE" 82% varrido', tempo:'há 25 min' },
    { color:C.blue, titulo:'Integração de validação de e-mail reconectada', tempo:'há 1h' },
  ];

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
            <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Buscas ativas</h3>
            <a onClick={() => onOpenBusca(null)} style={{ fontSize:12, color:C.blue, cursor:'pointer', textDecoration:'none' }}>Ver todas</a>
          </div>
          {buscasAtivas.length === 0 && (
            <div style={{ padding:'20px 16px', fontSize:13, color:'var(--faint)' }}>Nenhuma busca ativa.</div>
          )}
          {buscasAtivas.map(b => (
            <div key={b.id} onClick={() => onOpenBusca(b.id)} className="row-hover"
              style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:10, cursor:'pointer' }}>
              <StatusDot color={healthColors[b.health]} pulse={b.health==='green'}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.nome}</div>
                <div style={{ fontSize:11.5, color:'var(--faint)', marginTop:2 }}>{b.ritmo} leads/h · {hlLabel[b.health]||'—'}</div>
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
            {alertas.map((a,i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5, background:a.color }}/>
                <div style={{ fontSize:12.5, lineHeight:1.45 }}>
                  <span>{a.titulo}</span>
                  <div style={{ color:'var(--faint)', fontSize:11.5, marginTop:1 }}>{a.tempo}</div>
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
                background:'rgba(251,228,154,.08)', display:'flex', alignItems:'center',
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

function Leads({ refreshKey, onOpenLead, onCrm }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [emailOnly, setEmailOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportIds, setExportIds] = useState(null);
  const debRef = useRef(null);
  const PER_PAGE = 20;

  const handleQ = (e) => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { setDebouncedQ(v); setPage(1); }, 400);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filterStatus) params.set('status', filterStatus);
    if (emailOnly) params.set('email_only', 'true');
    params.set('page', page);
    fetch('/api/leads?' + params, { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => { setLeads(d.leads || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQ, filterStatus, emailOnly, page, refreshKey]);

  const allSel = leads.length > 0 && leads.every(l => selected.includes(l.id));
  const toggleSel = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const toggleAll = () => setSelected(allSel ? [] : leads.map(l => l.id));

  const batchAction = async (acao) => {
    if (!selected.length) return;
    await fetch('/api/leads/acoes', {
      method:'POST', credentials:'same-origin',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ids: selected, acao })
    });
    setSelected([]);
    setPage(p => p); // trigger refresh via useEffect
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
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height:38, padding:'0 10px', borderRadius:9, border:'1px solid var(--border)',
            background:'var(--panel)', color: filterStatus ? 'var(--text)' : 'var(--dim)',
            fontSize:12.5, fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Status</option>
          <option value="Novo">Novo</option>
          <option value="Qualificado">Qualificado</option>
          <option value="Incompleto">Incompleto</option>
          <option value="Enviado">Enviado</option>
          <option value="Descartado">Descartado</option>
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
          <button onClick={() => batchAction('aprovar')} style={selBtnStyle('normal')}>Aprovar</button>
          <button onClick={() => batchAction('descartar')} style={selBtnStyle('dim')}>Descartar</button>
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
          const email = hasEmail(l.contatos);
          const phone = hasPhone(l.contatos);
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
              <ContactIcons email={email} phone={phone}/>
              <div><span style={badgeStyle(statusColors[l.status]||C.gray)}>{l.status}</span></div>
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

  useEffect(() => {
    fetch('/api/buscas', { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => setBuscas(d.buscas || []))
      .catch(() => setBuscas([]));
  }, []);

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
        <div style={{ display:'grid', gridTemplateColumns:'24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr',
          alignItems:'center', gap:10, padding:'12px 18px', borderBottom:'1px solid var(--border)',
          fontSize:11, fontWeight:600, letterSpacing:'.04em', color:'var(--faint)', textTransform:'uppercase' }}>
          <div/><div>Nome</div><div>Status</div><div>Criada por</div><div>Ritmo</div>
          <div>Encontr.</div><div>Qualif.</div><div>CRM</div><div>Atividade</div>
        </div>
        {buscas === null && (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Carregando…</div>
        )}
        {buscas && buscas.length === 0 && (
          <div style={{ padding:'22px 18px', fontSize:13, color:'var(--faint)' }}>Nenhuma busca encontrada.</div>
        )}
        {buscas && buscas.map(b => (
          <div key={b.id} onClick={() => onOpen(b.id)} className="row-hover"
            style={{ display:'grid', gridTemplateColumns:'24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr',
              alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
            <div><StatusDot color={healthColors[b.health]||C.gray} pulse={b.health==='green'}/></div>
            <div style={{ fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.nome}</div>
            <div><span style={badgeStyle(buscaStatusColors[b.status]||C.gray)}>{b.status}</span></div>
            <div style={{ fontSize:12.5, color:'var(--dim)' }}>{b.criador || '—'}</div>
            <div style={{ fontSize:12.5 }}>{b.ritmo ? b.ritmo+'/h' : '—'}</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{fmtNum(b.enc)}</div>
            <div style={{ fontSize:13, color:'var(--dim)' }}>{fmtNum(b.qual)}</div>
            <div style={{ fontSize:13, color:C.cyan }}>{fmtNum(b.crm)}</div>
            <div style={{ fontSize:12, color:'var(--faint)' }}>{timeAgo(b.ultima_ativ)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BuscaDetail ───────────────────────────────────────────────────────────────
function BuscaDetail({ buscaId, onBack, onOpenLead }) {
  const [data, setData] = useState(null);
  const [toggling, setToggling] = useState(false);

  const carregar = () => {
    fetch('/api/buscas/' + buscaId, { credentials:'same-origin' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  };
  useEffect(() => { if (buscaId) carregar(); }, [buscaId]);

  const toggleStatus = async () => {
    if (!data) return;
    const novoStatus = data.busca.status === 'Ativa' ? 'Pausada' : 'Ativa';
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

  const { busca: b, leads } = data;
  const criterios = b.criterios || {};
  const tags = Object.entries(criterios).flatMap(([k, v]) => Array.isArray(v) ? v.map(x => k+': '+x) : [k+': '+v]).filter(Boolean);

  return (
    <div style={{ maxWidth:1180 }}>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none',
        border:'none', color:'var(--dim)', fontSize:12.5, fontFamily:'inherit', cursor:'pointer',
        marginBottom:14, padding:0 }}>‹ Voltar para buscas</button>

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
        {(b.status === 'Ativa' || b.status === 'Pausada') && (
          <button onClick={toggleStatus} disabled={toggling}
            style={{ height:38, padding:'0 15px', borderRadius:9, border:'1px solid var(--border)',
              background:'transparent', color:'var(--text)', fontSize:13, fontFamily:'inherit', cursor:'pointer',
              opacity:toggling?.6:1 }}>
            {toggling ? '…' : b.status === 'Ativa' ? 'Pausar' : 'Retomar'}
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:18 }}>
        {[['Encontrados', fmtNum(b.enc), 'var(--text)'],
          ['Qualificados', fmtNum(b.qual), C.green],
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
          <MiniChart vals={[8,14,11,19,24,18,27,31,26,34,29,38,33,42]} color={C.gold}/>
        </div>
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 16px' }}>Universo estimado</h3>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:30, fontWeight:600 }}>{fmtNum(b.enc)}</span>
            <span style={{ fontSize:12.5, color:'var(--faint)' }}>de ~{fmtNum(b.universo_est || 0)} empresas</span>
          </div>
          <ProgressBar pct={b.universo_est ? Math.min(100, Math.round(parseInt(b.enc)/b.universo_est*100)) : 0} color={C.gold}/>
          <div style={{ fontSize:12, color:'var(--faint)', marginTop:12, lineHeight:1.5 }}>
            Ritmo atual: {b.ritmo || 0} leads/h. Última atividade: {timeAgo(b.ultima_ativ)}.
          </div>
        </div>
      </div>

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'15px 18px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontSize:14, fontWeight:600, margin:0 }}>Leads desta busca</h3>
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
const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtCnae = c => { const d = String(c).padStart(7, '0'); return `${d.slice(0,4)}-${d.slice(4,5)}/${d.slice(5,7)}`; };

function NovaBusca({ onSalvar }) {
  const [tipo, setTipo] = useState('icp');
  const [ritmo, setRitmo] = useState(120);
  const [corte, setCorte] = useState(60);
  const [saving, setSaving] = useState(false);
  const [ufs, setUfs] = useState([]);
  const [portes, setPortes] = useState([]);
  const [cnaeBusca, setCnaeBusca] = useState('');
  const [cnaeSel, setCnaeSel] = useState([]);
  const [cnaeData, setCnaeData] = useState([]);
  const [cnaeFoco, setCnaeFoco] = useState(false);
  const nomeRef = useRef();
  const criteriosRef = useRef();

  useEffect(() => {
    if (_cnaeCache) { setCnaeData(_cnaeCache); return; }
    fetch('/cnae.json', { credentials:'same-origin' })
      .then(r => r.json())
      .then(d => { _cnaeCache = d; setCnaeData(d); })
      .catch(() => {});
  }, []);

  const cnaeResultados = useMemo(() => {
    const q = semAcento(cnaeBusca.trim());
    if (q.length < 2) return [];
    const qDig = q.replace(/\D/g, '');
    const out = [];
    for (const s of cnaeData) {
      if (semAcento(s.d).includes(q) || (qDig.length >= 3 && s.c.includes(qDig))) {
        out.push(s);
        if (out.length >= 25) break;
      }
    }
    return out;
  }, [cnaeBusca, cnaeData]);

  const addCnae = s => { setCnaeSel(prev => prev.find(x => x.c === s.c) ? prev : [...prev, s]); setCnaeBusca(''); };
  const removeCnae = c => setCnaeSel(prev => prev.filter(x => x.c !== c));

  const tipos = [
    { key:'icp', titulo:'Por perfil (ICP)', desc:'Defina CNAE, UF e porte do cliente ideal.',
      icon:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12h.01' },
    { key:'cnpj', titulo:'Por lista de CNPJ', desc:'Faça upload ou cole uma lista de CNPJs.',
      icon:'M9 12h6M9 16h6M9 8h2M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z' },
    { key:'lookalike', titulo:'Semelhantes a uma lista', desc:'Suba clientes que já converteram.',
      icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5' },
  ];

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const salvar = async () => {
    const nome = nomeRef.current?.value?.trim();
    if (!nome) { alert('Informe o nome da busca.'); return; }
    setSaving(true);
    try {
      const cnaes = cnaeSel.map(s => s.c);
      const chips = [
        ...ufs.map(u => `UF: ${u}`),
        ...portes.map(p => `Porte: ${p}`),
        ...cnaeSel.map(s => `CNAE: ${s.d}`),
      ];
      const criterios = tipo === 'icp'
        ? { chips, params: { ufs, portes, cnaes, cnaes_rotulos: cnaeSel, query: criteriosRef.current?.value || '' }, texto: criteriosRef.current?.value || '' }
        : { texto: criteriosRef.current?.value || '' };
      const r = await fetch('/api/buscas', {
        method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ nome, tipo, ritmo, corte_score: corte, criterios })
      });
      if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.erro || 'Erro ao criar busca.'); }
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
                boxShadow: active ? `0 0 0 3px rgba(251,228,154,.08)` : 'none' }}>
              <Svg d={t.icon} color={active ? C.gold : 'var(--dim)'} sw={1.7}/>
              <div style={{ fontSize:14, fontWeight:600, margin:'11px 0 4px', color: active ? 'var(--text)' : 'var(--dim)' }}>{t.titulo}</div>
              <div style={{ fontSize:12, color:'var(--faint)', lineHeight:1.45 }}>{t.desc}</div>
            </div>
          );
        })}
      </div>

      {tipo === 'icp' ? (
        <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:18 }}>
          <div style={{ marginBottom:18, position:'relative' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
              Atividade — busque por palavra (vira CNAE automaticamente)
            </label>
            <input value={cnaeBusca}
              onChange={e => setCnaeBusca(e.target.value)}
              onFocus={() => setCnaeFoco(true)}
              onBlur={() => setTimeout(() => setCnaeFoco(false), 150)}
              placeholder="Ex: fisioterapia, restaurante, desenvolvimento de software…"
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            {cnaeFoco && cnaeBusca.trim().length >= 2 && (
              <div style={{ position:'absolute', zIndex:30, left:0, right:0, top:'100%', marginTop:4,
                maxHeight:248, overflowY:'auto', background:'var(--panel2)', border:'1px solid var(--border)',
                borderRadius:9, boxShadow:'0 10px 28px rgba(0,0,0,.45)' }}>
                {cnaeData.length === 0 ? (
                  <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Carregando atividades…</div>
                ) : cnaeResultados.length === 0 ? (
                  <div style={{ padding:'10px 12px', fontSize:12.5, color:'var(--faint)' }}>Nenhuma atividade encontrada.</div>
                ) : cnaeResultados.map(s => (
                  <div key={s.c} onMouseDown={() => addCnae(s)} className="row-hover"
                    style={{ padding:'9px 12px', fontSize:12.5, cursor:'pointer', borderBottom:'1px solid var(--border)',
                      display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                    <span>{s.d}</span>
                    <span style={{ color:'var(--faint)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{fmtCnae(s.c)}</span>
                  </div>
                ))}
              </div>
            )}
            {cnaeSel.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:9 }}>
                {cnaeSel.map(s => (
                  <span key={s.c} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 10px',
                    borderRadius:7, fontSize:11.5, border:`1px solid ${C.gold}`, background:'rgba(251,228,154,.1)', color:C.gold }}>
                    {s.d}
                    <span onClick={() => removeCnae(s.c)} title="Remover"
                      style={{ cursor:'pointer', fontWeight:700, fontSize:13, lineHeight:1, opacity:.8 }}>×</span>
                  </span>
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
                    background: ufs.includes(u) ? 'rgba(251,228,154,.1)' : 'transparent',
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
                    background: portes.includes(p) ? 'rgba(251,228,154,.1)' : 'transparent',
                    color: portes.includes(p) ? C.gold : 'var(--dim)' }}>{p}</span>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>
              Descrição livre (opcional, contexto pro agente SWOT)
            </label>
            <textarea ref={criteriosRef} placeholder="Ex: empresas com time comercial estruturado, foco em B2B"
              style={{ width:'100%', minHeight:70, borderRadius:12, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:12, fontSize:13,
                fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }}/>
          </div>
        </div>
      ) : (
        <div style={{ border:'1.5px dashed var(--border)', borderRadius:14, padding:40,
          textAlign:'center', marginBottom:24 }}>
          <Svg d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
            color="var(--faint)" w={34} h={34} sw={1.5} extra={{ marginBottom:12 }}/>
          <div style={{ fontSize:14, fontWeight:500 }}>Arraste um arquivo CSV ou clique para enviar</div>
          <div style={{ fontSize:12, color:'var(--faint)', marginTop:5 }}>Uma coluna de CNPJ, ou cole a lista no campo abaixo</div>
          <textarea ref={criteriosRef} placeholder="Cole a lista de CNPJs (um por linha)"
            style={{ width:'100%', minHeight:70, marginTop:16, borderRadius:12, border:'1px solid var(--border)',
              background:'var(--panel2)', color:'var(--text)', padding:12, fontSize:13,
              fontFamily:'inherit', lineHeight:1.5, resize:'vertical' }}/>
        </div>
      )}

      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:20, marginBottom:18 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px 22px' }}>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>Nome da busca</label>
            <input ref={nomeRef} placeholder="Ex: Agências de marketing — Sul"
              style={{ width:'100%', height:40, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
              <label style={{ fontSize:12, color:'var(--dim)' }}>Ritmo da torneira</label>
              <span style={{ fontSize:13, fontWeight:600, color:C.gold }}>{ritmo} leads/h</span>
            </div>
            <input type="range" min={20} max={300} step={10} value={ritmo} onChange={e => setRitmo(+e.target.value)}
              style={{ width:'100%', accentColor:'#FBE49A', cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, color:'var(--faint)', marginTop:5 }}>
              <span>econômico</span><span>agressivo</span>
            </div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
              <label style={{ fontSize:12, color:'var(--dim)' }}>Corte do Score 1</label>
              <span style={{ fontSize:13, fontWeight:600, color:C.gold }}>{corte} pts</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={corte} onChange={e => setCorte(+e.target.value)}
              style={{ width:'100%', accentColor:'#FBE49A', cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10.5, color:'var(--faint)', marginTop:5 }}>
              <span>permissivo</span><span>rigoroso</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={salvar} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:8, height:46, padding:'0 24px', borderRadius:11,
            border:'none', background:'var(--gold)', color:'#0E1936', fontWeight:600, fontSize:14,
            fontFamily:'inherit', cursor:'pointer', opacity:saving?.6:1 }}>
          <Svg d="M5 12h14M13 5l7 7-7 7" color="#0E1936" w={16} h={16} sw={2}/>
          {saving ? 'Criando…' : 'Ligar busca'}
        </button>
      </div>
    </div>
  );
}

// ── Integrações ───────────────────────────────────────────────────────────────
const INTEGRACOES_META = {
  'descoberta|cnpja': { nome:'Descoberta de empresas', provedor:'CNPJá',
    icon:'M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', editavel:true },
  'crm|rdstation': { nome:'CRM', provedor:'RD Station',
    icon:'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z', editavel:false },
  'validacao_email|neverbounce': { nome:'Validação de e-mail', provedor:'NeverBounce',
    icon:'M3 5h18v14H3zM3 7l9 6 9-6', editavel:false },
  'validacao_tel|twilio': { nome:'Validação de telefone', provedor:'Twilio Lookup',
    icon:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z', editavel:false },
  'ia|claude': { nome:'Inteligência (IA)', provedor:'Claude · Anthropic',
    icon:'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17', editavel:false },
};
const INTEGRACOES_ORDEM = ['descoberta|cnpja', 'crm|rdstation', 'validacao_email|neverbounce', 'validacao_tel|twilio', 'ia|claude'];

function Integracoes() {
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const chaveRefs = useRef({});

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
    const existente = porChave[chave];
    setSalvando(chave);
    try {
      if (existente) {
        await fetch('/api/integracoes/' + existente.id, {
          method:'PATCH', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ ativo:true, ...(key ? { key } : {}) })
        });
      } else {
        await fetch('/api/integracoes', {
          method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ categoria, provedor, ativo:true, key })
        });
      }
      if (chaveRefs.current[chave]) chaveRefs.current[chave].value = '';
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
              </div>
            </div>
            {meta.editavel ? (
              <>
                <input ref={el => chaveRefs.current[chave] = el} placeholder="Colar chave da API…"
                  style={{ width:190, height:38, borderRadius:9, border:'1px solid var(--border)',
                    background:'var(--panel2)', color:'var(--dim)', padding:'0 12px', fontSize:12.5,
                    fontFamily:'inherit', letterSpacing:'.05em' }}/>
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

function Usuarios() {
  const [users, setUsers] = useState(null);
  const [erro, setErro] = useState(null);
  const [novaCred, setNovaCred] = useState(null);
  const [copiado, setCopiado] = useState(false);
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

  const cols = '2fr 1.3fr .9fr 1fr 90px 44px';

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
              <div><span style={badgeStyle(papelColors[u.papel]||C.gray)}>{u.papel}</span></div>
              <div style={{ fontSize:12.5, color:'var(--faint)' }}>{fmtAcesso(u.ultimo_acesso)}</div>
              <div>
                <span onClick={() => alternar(u)} title="Clique para ativar/desativar"
                  style={{ ...badgeStyle(u.ativo ? C.green : C.gray), cursor:'pointer' }}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
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
  return (
    <div style={{ maxWidth:720, display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Parâmetros padrão</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 18px' }}>Valores aplicados a novas buscas.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
          {[['Ritmo padrão','120 leads/h'],['Corte de score','60'],['TTL de cache','30 dias']].map(([label,val]) => (
            <div key={label}>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>{label}</label>
              <input defaultValue={val} style={{ width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, padding:22 }}>
        <h3 style={{ fontSize:14, fontWeight:600, margin:'0 0 4px' }}>Alertas</h3>
        <p style={{ fontSize:12.5, color:'var(--faint)', margin:'0 0 18px' }}>Limites do heartbeat e destinatários.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[['Parada considerada após','30 min sem pulso'],['Destinatários','ops@empresa.com.br']].map(([label,val]) => (
            <div key={label}>
              <label style={{ display:'block', fontSize:12, color:'var(--dim)', marginBottom:7 }}>{label}</label>
              <input defaultValue={val} style={{ width:'100%', height:38, borderRadius:9, border:'1px solid var(--border)',
                background:'var(--panel2)', color:'var(--text)', padding:'0 12px', fontSize:13, fontFamily:'inherit' }}/>
            </div>
          ))}
        </div>
      </div>
      <div>
        <button style={{ height:44, padding:'0 22px', borderRadius:11, border:'none', background:'var(--gold)',
          color:'#0E1936', fontWeight:600, fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>Salvar alterações</button>
      </div>
    </div>
  );
}

// ── Monitoramento ─────────────────────────────────────────────────────────────
function Monitor() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => fetch('/api/monitor/queues', { credentials:'same-origin' })
      .then(r => r.json()).then(setData).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

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
              <span style={{ color:'var(--faint)' }}>Buscas ativas</span>
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
          <span style={{ fontSize:11, color:(data.dlq||[]).length ? C.red : 'var(--faint)' }}>
            {(data.dlq||[]).length} job(s) com falha recente
          </span>
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

  useEffect(() => {
    if (!leadId) return;
    setLead(null);
    setDisplayStatus(null);
    fetch('/api/leads/' + leadId, { credentials:'same-origin' })
      .then(r => r.json())
      .then(l => { setLead(l); setDisplayStatus(l.status); })
      .catch(() => {});
  }, [leadId]);

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
          alignItems:'center', justifyContent:'center', color:'var(--faint)', fontSize:13 }}>
          Carregando…
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
    { k:'Porte', v:l.porte },
    { k:'Situação', v:l.situacao, ok: l.situacao === 'Ativa' },
    { k:'Abertura', v:l.abertura },
    { k:'Capital social', v:l.capital },
    { k:'Endereço', v:l.endereco },
  ];

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
              <span style={badgeStyle(statusColors[status]||C.gray)}>{status}</span>
              <span style={{ fontSize:11.5, color:'var(--faint)' }}>{l.cnpj}</span>
            </div>
            <h2 style={{ fontSize:19, fontWeight:600, margin:0 }}>{l.fantasia}</h2>
            <p style={{ fontSize:12.5, color:'var(--dim)', margin:'3px 0 0' }}>{l.razao}</p>
          </div>
          <ScoreRing score={l.score} size={84}/>
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
            <div style={{ display:'flex', alignItems:'center', gap:13 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:C.blue, color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600,
                fontSize:14, flexShrink:0 }}>{decisorIni}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:500 }}>{l.decisor}</div>
                <div style={{ fontSize:12, color:'var(--dim)' }}>{l.cargo}</div>
              </div>
              <div style={{ flex:1 }}/>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
                color:C.cyan, background:'rgba(122,217,255,.1)', border:'1px solid rgba(122,217,255,.2)',
                padding:'5px 9px', borderRadius:7 }}>
                <SvgMulti w={12} h={12} sw={2} color={C.cyan}><path d="M20 6L9 17l-5-5"/></SvgMulti>
                Receita Federal
              </span>
            </div>
          </section>

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

          {l.abordagem && (
            <section style={{ borderTop:'1px solid var(--border)', paddingTop:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <SvgMulti w={14} h={14} sw={1.8} color={C.blue}>
                  <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17"/>
                  <circle cx={12} cy={12} r={4}/>
                </SvgMulti>
                <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.08em', color:C.blue, textTransform:'uppercase' }}>
                  Sugestão de abordagem · IA
                </span>
              </div>
              <div style={{ background:'rgba(58,142,255,.07)', border:'1px solid rgba(58,142,255,.22)',
                borderRadius:11, padding:14 }}>
                <p style={{ fontSize:13, lineHeight:1.6, margin:'0 0 12px', color:'var(--text)' }}>{l.abordagem}</p>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => navigator.clipboard?.writeText(l.abordagem).catch(()=>{})}
                    style={{ display:'flex', alignItems:'center', gap:6, height:31, padding:'0 12px',
                      borderRadius:7, border:'1px solid rgba(58,142,255,.3)', background:'transparent',
                      color:C.blue, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>Copiar</button>
                </div>
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
          borderTop:'1px solid var(--border)', padding:'14px 24px', display:'flex', gap:10 }}>
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
  const confirmar = async () => {
    setLoading(true);
    try {
      await fetch('/api/leads/acoes', {
        method:'POST', credentials:'same-origin',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ids, acao:'enviar_crm', crm_destino:'RD Station' })
      });
      onConfirm();
    } catch (_) {
      alert('Erro ao enviar ao CRM.');
    } finally {
      setLoading(false);
    }
  };
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
              display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', fontSize:13.5 }}>
              <span>RD Station</span>
              <Svg d="M6 9l6 6 6-6" w={14} h={14} color="var(--dim)" sw={2}/>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:11, background:'var(--panel2)',
            border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
            <SvgMulti w={17} h={17} sw={1.8} color={C.cyan}>
              <circle cx={12} cy={12} r={10}/><path d="M12 16v-4M12 8h.01"/>
            </SvgMulti>
            <span style={{ fontSize:12.5, color:'var(--dim)', lineHeight:1.45 }}>
              Mapeamento de campos validado — razão social, decisor, contatos e score serão sincronizados.
            </span>
          </div>
        </div>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)',
          display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ height:42, padding:'0 18px', borderRadius:10,
            border:'1px solid var(--border)', background:'transparent', color:'var(--text)',
            fontSize:13.5, fontFamily:'inherit', cursor:'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={loading}
            style={{ height:42, padding:'0 20px', borderRadius:10, border:'none', background:'var(--gold)',
              color:'#0E1936', fontWeight:600, fontSize:13.5, fontFamily:'inherit', cursor:'pointer',
              opacity:loading?.6:1 }}>
            {loading ? 'Enviando…' : 'Confirmar envio'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState('dark');
  const [screen, setScreen] = useState('dashboard');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [crmIds, setCrmIds] = useState(null);
  const [buscaDetailId, setBuscaDetailId] = useState(null);
  const [user, setUser] = useState(null);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me', { credentials:'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); })
      .catch(() => {});
  }, []);

  const navTo = (s) => { setScreen(s); setOpenLeadId(null); setCrmIds(null); };
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
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
    switch(screen) {
      case 'dashboard': return <Dashboard onOpenBusca={openBusca}/>;
      case 'leads': return (
        <Leads refreshKey={leadsRefreshKey} onOpenLead={setOpenLeadId} onCrm={setCrmIds}/>
      );
      case 'buscas': return <Buscas onOpen={openBusca}/>;
      case 'buscaDetail': return <BuscaDetail buscaId={buscaDetailId} onBack={() => setScreen('buscas')} onOpenLead={setOpenLeadId}/>;
      case 'nova': return <NovaBusca onSalvar={() => navTo('buscas')}/>;
      case 'integracoes': return <Integracoes/>;
      case 'usuarios': return <Usuarios/>;
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
