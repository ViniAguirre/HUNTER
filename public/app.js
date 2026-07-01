const {
  useState,
  useRef,
  useEffect,
  useMemo
} = React;

// ── constants ─────────────────────────────────────────────────────────────────
const C = {
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  blue: '#3A8EFF',
  gold: '#FBE49A',
  cyan: '#7AD9FF',
  gray: '#7C89A8'
};
function themeVars(t) {
  return t === 'light' ? '--bg:#F4F6FA;--panel:#FFFFFF;--panel2:#EEF2F8;--hover:rgba(14,25,54,.04);--border:rgba(14,25,54,.10);--track:rgba(14,25,54,.08);--text:#0E1936;--dim:#5A6480;--faint:#8A93A8;--gold:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;' : '--bg:#0E1936;--panel:#0A0F1F;--panel2:#101a3a;--hover:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);--track:rgba(255,255,255,.08);--text:#ECEFF7;--dim:#8A95B4;--faint:#5E688C;--gold:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;';
}

// ── helpers ───────────────────────────────────────────────────────────────────
const Svg = ({
  d,
  w = 16,
  h = 16,
  color = 'currentColor',
  sw = 1.7,
  extra = {}
}) => /*#__PURE__*/React.createElement("svg", {
  width: w,
  height: h,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: extra
}, /*#__PURE__*/React.createElement("path", {
  d: d
}));
const SvgMulti = ({
  children,
  w = 16,
  h = 16,
  color = 'currentColor',
  sw = 1.7
}) => /*#__PURE__*/React.createElement("svg", {
  width: w,
  height: h,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, children);
function scoreColor(s) {
  return s >= 75 ? C.green : s >= 50 ? C.amber : C.red;
}
function badgeStyle(hex) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 20,
    background: hex + '1f',
    color: hex,
    border: `1px solid ${hex}33`,
    whiteSpace: 'nowrap'
  };
}
function StatusDot({
  color,
  pulse
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
      display: 'inline-block',
      flexShrink: 0,
      animation: pulse ? 'hpulse 2s ease-in-out infinite' : 'none'
    }
  });
}
function Checkbox({
  checked
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      border: `1.5px solid ${checked ? C.blue : 'var(--border)'}`,
      background: checked ? C.blue : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, checked && /*#__PURE__*/React.createElement(SvgMulti, {
    w: 11,
    h: 11,
    color: "#fff",
    sw: 3
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  })));
}
function ScoreBar({
  score
}) {
  const col = scoreColor(score);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      background: 'var(--track)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 3,
      width: score + '%',
      background: col
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: col,
      minWidth: 20
    }
  }, score));
}
function ScoreRing({
  score,
  size = 84
}) {
  const col = scoreColor(score);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--track)",
    strokeWidth: 6
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: col,
    strokeWidth: 6,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: off
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: size > 70 ? 20 : 16,
      fontWeight: 600,
      color: col
    }
  }, score), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      color: 'var(--faint)',
      marginTop: 2,
      letterSpacing: '.06em'
    }
  }, "SCORE")));
}
function MiniChart({
  vals,
  color
}) {
  const w = 560,
    h = 130,
    max = Math.max(...vals) * 1.1,
    step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - 10 - v / max * (h - 28)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    width: "100%",
    height: h,
    preserveAspectRatio: "none",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: color,
    fillOpacity: .1
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function ProgressBar({
  pct,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 5,
      background: 'var(--track)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: pct + '%',
      borderRadius: 5,
      background: color
    }
  }));
}
function CrosshairBig() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: "0 0 200 200",
    fill: "none",
    stroke: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 100,
    cy: 100,
    r: 78,
    strokeWidth: 2,
    strokeDasharray: "5 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M100 6v26M100 168v26M6 100h26M168 100h26",
    strokeWidth: 3,
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M100 60L132 122H68z",
    strokeWidth: 3,
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 100,
    cy: 100,
    r: 6,
    strokeWidth: 3
  }));
}
function ThemeToggle({
  theme,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    title: "Tema",
    style: {
      width: 38,
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, theme === 'dark' ? /*#__PURE__*/React.createElement(SvgMulti, {
    w: 17,
    h: 17,
    sw: 1.7
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 4
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
  })) : /*#__PURE__*/React.createElement(SvgMulti, {
    w: 17,
    h: 17,
    sw: 1.7
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  })));
}
function ContactIcons({
  email,
  phone
}) {
  const ok = (has, path, title) => /*#__PURE__*/React.createElement("svg", {
    key: title,
    title: title,
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: has ? C.green : 'var(--faint)',
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      opacity: has ? 1 : .4
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: path
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, ok(email, 'M3 5h18v14H3zM3 7l9 6 9-6', 'E-mail'), ok(phone, 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z', 'Telefone'));
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
const statusColors = {
  Qualificado: C.gold,
  Novo: C.blue,
  Enviado: C.green,
  Incompleto: C.amber,
  Descartado: C.gray
};
const buscaStatusColors = {
  Ativa: C.green,
  Pausada: C.amber,
  Esgotada: C.blue,
  Encerrada: C.gray
};
const healthColors = {
  green: C.green,
  amber: C.amber,
  red: C.red,
  gray: C.gray
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_MAIN = [{
  key: 'dashboard',
  label: 'Dashboard',
  icon: 'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z'
}, {
  key: 'buscas',
  label: 'Buscas',
  icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3'
}, {
  key: 'leads',
  label: 'Leads',
  icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3'
}];
const NAV_ADMIN = [{
  key: 'integracoes',
  label: 'Integrações',
  icon: 'M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8'
}, {
  key: 'usuarios',
  label: 'Usuários',
  icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'
}, {
  key: 'config',
  label: 'Configurações',
  icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'
}, {
  key: 'monitor',
  label: 'Monitoramento',
  icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
}];
function Sidebar({
  screen,
  onNav,
  onLogout,
  user
}) {
  const nome = user?.nome || '…';
  const papel = user?.papel || '';
  const ini = nome.split(' ').slice(0, 2).map(w => w[0]).join('');
  const navStyle = key => {
    const active = screen === key || key === 'buscas' && screen === 'buscaDetail';
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '9px 12px',
      borderRadius: 9,
      fontSize: 13.5,
      fontWeight: 500,
      cursor: 'pointer',
      textDecoration: 'none',
      color: active ? '#FBE49A' : 'var(--dim)',
      background: active ? 'var(--panel2)' : 'transparent',
      boxShadow: active ? 'inset 2px 0 0 #FBE49A' : 'none',
      transition: 'background .12s'
    };
  };
  const renderNav = items => items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it.key,
    onClick: () => onNav(it.key),
    className: "nav-link",
    style: navStyle(it.key)
  }, /*#__PURE__*/React.createElement("svg", {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: screen === it.key || it.key === 'buscas' && screen === 'buscaDetail' ? '#FBE49A' : '#8A95B4',
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: it.icon
  })), /*#__PURE__*/React.createElement("span", null, it.label)));
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 236,
      flexShrink: 0,
      background: 'var(--panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '20px 20px 22px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "hunter_logo_icon.png",
    alt: "Hunter",
    style: {
      width: 30,
      height: 30
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: '.2em'
    }
  }, "HUNTER")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '4px 12px',
      flex: 1,
      overflowY: 'auto'
    }
  }, renderNav(NAV_MAIN), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '.14em',
      color: 'var(--faint)',
      padding: '18px 12px 8px'
    }
  }, "ADMINISTRA\xC7\xC3O"), renderNav(NAV_ADMIN)), /*#__PURE__*/React.createElement("div", {
    onClick: onLogout,
    style: {
      padding: '14px 16px',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: C.blue,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 600,
      flexShrink: 0
    }
  }, ini), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.3,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, nome), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, papel, " \xB7 sair"))));
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
  monitor: ['Monitoramento', 'Saúde do sistema e filas']
};
function SinoAlertas() {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState({
    alertas: [],
    total: 0
  });
  const carregar = () => fetch('/api/alertas', {
    credentials: 'same-origin'
  }).then(r => r.json()).then(d => setData(d && Array.isArray(d.alertas) ? d : {
    alertas: [],
    total: 0
  })).catch(() => {});
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 30000);
    return () => clearInterval(id);
  }, []);
  const n = data.total || 0;
  const corTipo = t => t === 'erro' ? C.red : t === 'aviso' ? C.amber : C.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAberto(a => !a),
    title: "Alertas",
    style: {
      position: 'relative',
      width: 38,
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 17,
    h: 17,
    sw: 1.7
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
  })), n > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      borderRadius: 8,
      background: C.red,
      color: '#fff',
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1.5px solid var(--bg)'
    }
  }, n > 9 ? '9+' : n)), aberto && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setAberto(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 40
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 46,
      right: 0,
      width: 340,
      zIndex: 41,
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,.5)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
      fontWeight: 600
    }
  }, "Alertas ", n > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontWeight: 400
    }
  }, "\xB7 ", n)), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 340,
      overflowY: 'auto'
    }
  }, data.alertas.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 16px',
      fontSize: 12.5,
      color: 'var(--faint)',
      textAlign: 'center'
    }
  }, "Nenhum alerta. Tudo tranquilo. \u2713") : data.alertas.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      flexShrink: 0,
      marginTop: 5,
      background: corTipo(a.tipo)
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 500
    }
  }, a.titulo), a.detalhe && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginTop: 2,
      wordBreak: 'break-word'
    }
  }, a.detalhe), a.quando && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 2
    }
  }, timeAgo(a.quando)))))))));
}
function Topbar({
  screen,
  theme,
  onTheme,
  onNova,
  user
}) {
  const [title, sub] = TITLES[screen] || ['', ''];
  const ini = (user?.nome || '').split(' ').slice(0, 2).map(w => w[0]).join('') || 'U';
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      flexShrink: 0,
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.2
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onNova,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 5v14M5 12h14",
    color: "#0E1936",
    w: 16,
    h: 16,
    sw: 2
  }), "Nova busca"), /*#__PURE__*/React.createElement(ThemeToggle, {
    theme: theme,
    onToggle: onTheme
  }), /*#__PURE__*/React.createElement(SinoAlertas, null), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: C.blue,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, ini)));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({
  onOpenBusca
}) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/dashboard', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setData).catch(() => {});
  }, []);
  if (!data) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--faint)',
        padding: 40,
        textAlign: 'center'
      }
    }, "Carregando\u2026");
  }
  const {
    metricas = {},
    buscasAtivas = [],
    atividade = []
  } = data || {};
  const qual = parseInt(metricas.leadsQualificados) || 0;
  const enc = parseInt(metricas.leadsEncontrados) || 1;
  const taxaQ = Math.round(qual / enc * 100);
  const metrics = [{
    label: 'Buscas ativas',
    value: fmtNum(metricas.buscasAtivas),
    icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
    iColor: C.blue,
    trend: 'em produção',
    tColor: 'var(--dim)'
  }, {
    label: 'Leads encontrados',
    value: fmtNum(metricas.leadsEncontrados),
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3',
    iColor: C.gold,
    trend: 'total acumulado',
    tColor: 'var(--dim)'
  }, {
    label: 'Leads qualificados',
    value: fmtNum(metricas.leadsQualificados),
    icon: 'M20 6L9 17l-5-5',
    iColor: C.green,
    trend: `${taxaQ}% taxa de qualif.`,
    tColor: 'var(--dim)'
  }, {
    label: 'Enviados ao CRM',
    value: fmtNum(metricas.leadsCRM),
    icon: 'M5 12h14M13 5l7 7-7 7',
    iColor: C.cyan,
    trend: 'total enviado',
    tColor: 'var(--dim)'
  }];
  const hlLabel = {
    green: 'produzindo',
    amber: 'ritmo lento',
    red: 'parada',
    gray: 'encerrada'
  };
  const alertas = [{
    color: C.red,
    titulo: 'Busca "Construtoras SP" está parada há 2h',
    tempo: 'erro de heartbeat'
  }, {
    color: C.amber,
    titulo: 'Universo de "Clínicas NE" 82% varrido',
    tempo: 'há 25 min'
  }, {
    color: C.blue,
    titulo: 'Integração de validação de e-mail reconectada',
    tempo: 'há 1h'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 24
    }
  }, metrics.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.label,
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '18px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)'
    }
  }, m.label), /*#__PURE__*/React.createElement(Svg, {
    d: m.icon,
    color: m.iColor,
    sw: 1.7
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: '-.02em',
      lineHeight: 1
    }
  }, m.value), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      fontSize: 12,
      color: m.tColor
    }
  }, /*#__PURE__*/React.createElement("span", null, m.trend))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.55fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '6px 6px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px 12px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0
    }
  }, "Buscas ativas"), /*#__PURE__*/React.createElement("a", {
    onClick: () => onOpenBusca(null),
    style: {
      fontSize: 12,
      color: C.blue,
      cursor: 'pointer',
      textDecoration: 'none'
    }
  }, "Ver todas")), buscasAtivas.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 16px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Nenhuma busca ativa."), buscasAtivas.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => onOpenBusca(b.id),
    className: "row-hover",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 16px',
      borderRadius: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    color: healthColors[b.health],
    pulse: b.health === 'green'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, b.nome), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginTop: 2
    }
  }, b.ritmo, " leads/h \xB7 ", hlLabel[b.health] || '—')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, fmtNum(b.enc)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, "encontrados"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Alertas"), alertas.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      padding: '11px 0',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      flexShrink: 0,
      marginTop: 5,
      background: a.color
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("span", null, a.titulo), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 11.5,
      marginTop: 1
    }
  }, a.tempo))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 16,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Atividade recente"), atividade.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.fantasia), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, a.cidade, "/", a.uf, " \xB7 ", timeAgo(a.criado_em))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: scoreColor(a.score)
    }
  }, a.score)))))));
}

// ── Leads ─────────────────────────────────────────────────────────────────────
function ExportModal({
  ids,
  onClose
}) {
  const [loading, setLoading] = useState(false);
  const baixar = async () => {
    setLoading(true);
    try {
      const params = ids.length ? '?ids=' + ids.join(',') : '';
      const r = await fetch('/api/leads/export' + params, {
        credentials: 'same-origin'
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hunter-leads.csv';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (_) {
      alert('Erro ao exportar.');
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(5,9,20,.6)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 440,
      maxWidth: '92vw',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Exportar lista"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--dim)',
      margin: 0
    }
  }, ids.length, " lead", ids.length !== 1 ? 's' : '', " selecionado", ids.length !== 1 ? 's' : '', ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Formato"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 40,
      borderRadius: 9,
      border: `1.5px solid ${C.gold}`,
      background: 'rgba(251,228,154,.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "CSV"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)'
    }
  }, "Inclui: raz\xE3o social, CNPJ, decisor, cargo, contatos, score e status.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      height: 42,
      padding: '0 18px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: baixar,
    disabled: loading,
    style: {
      height: 42,
      padding: '0 20px',
      borderRadius: 10,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: loading ? .6 : 1
    }
  }, loading ? 'Gerando…' : 'Gerar e baixar'))));
}
function Leads({
  refreshKey,
  onOpenLead,
  onCrm
}) {
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
  const handleQ = e => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setDebouncedQ(v);
      setPage(1);
    }, 400);
  };
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (filterStatus) params.set('status', filterStatus);
    if (emailOnly) params.set('email_only', 'true');
    params.set('page', page);
    fetch('/api/leads?' + params, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => {
      setLeads(d.leads || []);
      setTotal(d.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [debouncedQ, filterStatus, emailOnly, page, refreshKey]);
  const allSel = leads.length > 0 && leads.every(l => selected.includes(l.id));
  const toggleSel = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(allSel ? [] : leads.map(l => l.id));
  const batchAction = async acao => {
    if (!selected.length) return;
    await fetch('/api/leads/acoes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: selected,
        acao
      })
    });
    setSelected([]);
    setPage(p => p); // trigger refresh via useEffect
  };
  const totalPages = Math.ceil(total / PER_PAGE);
  const selBtnStyle = variant => ({
    height: 34,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: variant === 'gold' ? 'var(--gold)' : 'transparent',
    color: variant === 'gold' ? '#0E1936' : variant === 'dim' ? 'var(--dim)' : 'var(--text)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: variant === 'gold' ? 600 : 400
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 220,
      maxWidth: 320
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--faint)",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    style: {
      position: 'absolute',
      left: 12,
      top: 11
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 11,
    cy: 11,
    r: 7
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  })), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: handleQ,
    placeholder: "Buscar empresa, decisor\u2026",
    style: {
      width: '100%',
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--text)',
      padding: '0 12px 0 34px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  })), /*#__PURE__*/React.createElement("select", {
    value: filterStatus,
    onChange: e => {
      setFilterStatus(e.target.value);
      setPage(1);
    },
    style: {
      height: 38,
      padding: '0 10px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: filterStatus ? 'var(--text)' : 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Status"), /*#__PURE__*/React.createElement("option", {
    value: "Novo"
  }, "Novo"), /*#__PURE__*/React.createElement("option", {
    value: "Qualificado"
  }, "Qualificado"), /*#__PURE__*/React.createElement("option", {
    value: "Incompleto"
  }, "Incompleto"), /*#__PURE__*/React.createElement("option", {
    value: "Enviado"
  }, "Enviado"), /*#__PURE__*/React.createElement("option", {
    value: "Descartado"
  }, "Descartado")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEmailOnly(e => !e);
      setPage(1);
    },
    style: {
      height: 38,
      padding: '0 13px',
      borderRadius: 9,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      ...(emailOnly ? {
        border: `1px solid ${C.green}`,
        background: C.green + '1f',
        color: C.green
      } : {
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        color: 'var(--dim)'
      })
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 14,
    h: 14,
    sw: 1.8
  }, /*#__PURE__*/React.createElement("rect", {
    x: 3,
    y: 5,
    width: 18,
    height: 14,
    rx: 2
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 7l9 6 9-6"
  })), "S\xF3 e-mail v\xE1lido")), selected.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--panel2)',
      border: `1px solid ${C.blue}`,
      borderRadius: 11,
      padding: '10px 14px',
      marginBottom: 14,
      animation: 'hfade .2s ease'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.blue
    }
  }, selected.length, " selecionado", selected.length !== 1 ? 's' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 20,
      background: 'var(--border)'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onCrm(selected),
    style: selBtnStyle('gold')
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M5 12h14M13 5l7 7-7 7",
    color: "#0E1936",
    w: 14,
    h: 14,
    sw: 2
  }), "Enviar ao CRM"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setExportIds(selected),
    style: selBtnStyle('normal')
  }, "Exportar CSV"), /*#__PURE__*/React.createElement("button", {
    onClick: () => batchAction('aprovar'),
    style: selBtnStyle('normal')
  }, "Aprovar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => batchAction('descartar'),
    style: selBtnStyle('dim')
  }, "Descartar"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelected([]),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--faint)',
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'inherit'
    }
  }, "Limpar")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '40px 2.3fr 1.1fr .8fr 1.4fr 96px 90px 110px',
      alignItems: 'center',
      gap: 10,
      padding: '12px 18px',
      borderBottom: '1px solid var(--border)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      color: 'var(--faint)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: toggleAll,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: allSel
  })), /*#__PURE__*/React.createElement("div", null, "Empresa"), /*#__PURE__*/React.createElement("div", null, "Setor \xB7 porte"), /*#__PURE__*/React.createElement("div", null, "Local"), /*#__PURE__*/React.createElement("div", null, "Decisor"), /*#__PURE__*/React.createElement("div", null, "Score"), /*#__PURE__*/React.createElement("div", null, "Contato"), /*#__PURE__*/React.createElement("div", null, "Status")), loading && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 18px',
      fontSize: 13,
      color: 'var(--faint)',
      textAlign: 'center'
    }
  }, "Carregando\u2026"), !loading && leads.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 18px',
      fontSize: 13,
      color: 'var(--faint)',
      textAlign: 'center'
    }
  }, "Nenhum lead encontrado."), !loading && leads.map(l => {
    const sel = selected.includes(l.id);
    const email = hasEmail(l.contatos);
    const phone = hasPhone(l.contatos);
    return /*#__PURE__*/React.createElement("div", {
      key: l.id,
      onClick: () => onOpenLead(l.id),
      className: "row-hover",
      style: {
        display: 'grid',
        gridTemplateColumns: '40px 2.3fr 1.1fr .8fr 1.4fr 96px 90px 110px',
        alignItems: 'center',
        gap: 10,
        padding: '13px 18px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: sel ? 'var(--panel2)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        toggleSel(l.id);
      },
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Checkbox, {
      checked: sel
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l.fantasia), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--faint)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l.razao)), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l.setor), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--faint)'
      }
    }, l.porte)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5
      }
    }, l.cidade, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--faint)'
      }
    }, "/", l.uf)), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l.decisor), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--faint)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l.cargo)), /*#__PURE__*/React.createElement(ScoreBar, {
      score: l.score
    }), /*#__PURE__*/React.createElement(ContactIcons, {
      email: email,
      phone: phone
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(statusColors[l.status] || C.gray)
    }, l.status)));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mostrando ", leads.length, " de ", fmtNum(total), " leads"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.max(1, p - 1)),
    disabled: page <= 1,
    style: {
      height: 30,
      width: 30,
      borderRadius: 7,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      cursor: 'pointer',
      opacity: page <= 1 ? .4 : 1
    }
  }, "\u2039"), /*#__PURE__*/React.createElement("span", {
    style: {
      lineHeight: '30px',
      fontSize: 11
    }
  }, page, "/", totalPages || 1), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.min(totalPages, p + 1)),
    disabled: page >= totalPages,
    style: {
      height: 30,
      width: 30,
      borderRadius: 7,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      cursor: 'pointer',
      opacity: page >= totalPages ? .4 : 1
    }
  }, "\u203A"))), exportIds && /*#__PURE__*/React.createElement(ExportModal, {
    ids: exportIds,
    onClose: () => setExportIds(null)
  }));
}

// ── Buscas ────────────────────────────────────────────────────────────────────
function Buscas({
  onOpen
}) {
  const [buscas, setBuscas] = useState(null);
  const carregar = () => {
    fetch('/api/buscas', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => setBuscas(Array.isArray(d) ? d : d.buscas || [])).catch(() => setBuscas([]));
  };
  useEffect(carregar, []);
  const excluir = async (e, b) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir a busca "${b.nome}"?\nOs leads dela serão removidos. As empresas continuam no histórico global.`)) return;
    const r = await fetch('/api/buscas/' + b.id, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.erro || 'Erro ao excluir.');
      return;
    }
    carregar();
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      maxWidth: 300
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--faint)",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    style: {
      position: 'absolute',
      left: 12,
      top: 11
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 11,
    cy: 11,
    r: 7
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  })), /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por nome\u2026",
    style: {
      width: '100%',
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--text)',
      padding: '0 12px 0 34px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr 40px',
      alignItems: 'center',
      gap: 10,
      padding: '12px 18px',
      borderBottom: '1px solid var(--border)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      color: 'var(--faint)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", null, "Nome"), /*#__PURE__*/React.createElement("div", null, "Status"), /*#__PURE__*/React.createElement("div", null, "Criada por"), /*#__PURE__*/React.createElement("div", null, "Ritmo"), /*#__PURE__*/React.createElement("div", null, "Encontr."), /*#__PURE__*/React.createElement("div", null, "Qualif."), /*#__PURE__*/React.createElement("div", null, "CRM"), /*#__PURE__*/React.createElement("div", null, "Atividade"), /*#__PURE__*/React.createElement("div", null)), buscas === null && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 18px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026"), buscas && buscas.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 18px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Nenhuma busca encontrada."), buscas && buscas.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => onOpen(b.id),
    className: "row-hover",
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr 40px',
      alignItems: 'center',
      gap: 10,
      padding: '14px 18px',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatusDot, {
    color: healthColors[b.health] || C.gray,
    pulse: b.health === 'green'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, b.nome), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(buscaStatusColors[b.status] || C.gray)
  }, b.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)'
    }
  }, b.criador_nome || b.criador || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, b.ritmo ? b.ritmo + '/h' : '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, fmtNum(b.encontrados ?? b.enc)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--dim)'
    }
  }, fmtNum(b.qualificados ?? b.qual)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.cyan
    }
  }, fmtNum(b.enviados ?? b.crm)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, timeAgo(b.ultima_ativ)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: e => excluir(e, b),
    title: "Excluir busca",
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 15,
    h: 15,
    sw: 1.7
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6"
  }))))))));
}

// ── BuscaDetail ───────────────────────────────────────────────────────────────
function BuscaDetail({
  buscaId,
  onBack,
  onOpenLead
}) {
  const [data, setData] = useState(null);
  const [toggling, setToggling] = useState(false);
  const carregar = () => {
    fetch('/api/buscas/' + buscaId, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setData).catch(() => {});
  };
  useEffect(() => {
    if (buscaId) carregar();
  }, [buscaId]);
  const toggleStatus = async () => {
    if (!data) return;
    const novoStatus = (data.busca || data).status === 'Ativa' ? 'Pausada' : 'Ativa';
    setToggling(true);
    await fetch('/api/buscas/' + buscaId, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: novoStatus
      })
    }).catch(() => {});
    setToggling(false);
    carregar();
  };
  if (!data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--faint)',
      padding: 40,
      textAlign: 'center'
    }
  }, "Carregando\u2026");
  const b = data.busca || data;
  const leads = data.leads || [];
  const criterios = b.criterios || {};
  const tags = Array.isArray(criterios.chips) && criterios.chips.length ? criterios.chips : Object.entries(criterios).filter(([k]) => !['params', 'cnaes_rotulos', 'texto', 'query'].includes(k)).flatMap(([k, v]) => Array.isArray(v) ? v.map(x => k + ': ' + x) : typeof v === 'object' ? [] : [k + ': ' + v]).filter(Boolean);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      marginBottom: 14,
      padding: 0
    }
  }, "\u2039 Voltar para buscas"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    color: healthColors[b.health] || C.gray,
    pulse: b.health === 'green'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 20,
      fontWeight: 600,
      margin: 0
    }
  }, b.nome), /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(buscaStatusColors[b.status] || C.gray)
  }, b.status)), tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 10
    }
  }, tags.map(tag => /*#__PURE__*/React.createElement("span", {
    key: tag,
    style: {
      fontSize: 12,
      padding: '5px 10px',
      borderRadius: 7,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--dim)'
    }
  }, tag)))), (b.status === 'Ativa' || b.status === 'Pausada') && /*#__PURE__*/React.createElement("button", {
    onClick: toggleStatus,
    disabled: toggling,
    style: {
      height: 38,
      padding: '0 15px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: toggling ? .6 : 1
    }
  }, toggling ? '…' : b.status === 'Ativa' ? 'Pausar' : 'Retomar')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12,
      marginBottom: 18
    }
  }, [['Encontrados', fmtNum(b.enc), 'var(--text)'], ['Qualificados', fmtNum(b.qual), C.green], ['Enviados ao CRM', fmtNum(b.crm), C.cyan]].map(([label, val, col]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 600,
      color: col
    }
  }, val)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0
    }
  }, "Produ\xE7\xE3o ao longo do tempo"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "\xFAltimos 14 dias")), /*#__PURE__*/React.createElement(MiniChart, {
    vals: [8, 14, 11, 19, 24, 18, 27, 31, 26, 34, 29, 38, 33, 42],
    color: C.gold
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 16px'
    }
  }, "Universo estimado"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 30,
      fontWeight: 600
    }
  }, fmtNum(b.enc)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "de ~", fmtNum(b.universo_est || 0), " empresas")), /*#__PURE__*/React.createElement(ProgressBar, {
    pct: b.universo_est ? Math.min(100, Math.round(parseInt(b.enc) / b.universo_est * 100)) : 0,
    color: C.gold
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "Ritmo atual: ", b.ritmo || 0, " leads/h. \xDAltima atividade: ", timeAgo(b.ultima_ativ), "."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '15px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0
    }
  }, "Leads desta busca")), leads.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 18px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Nenhum lead ainda."), leads.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    onClick: () => onOpenLead(l.id),
    className: "row-hover",
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1.3fr 1fr 120px 100px',
      alignItems: 'center',
      gap: 10,
      padding: '13px 18px',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, l.fantasia), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, l.decisor), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, l.cidade, "/", l.uf), /*#__PURE__*/React.createElement(ScoreBar, {
    score: l.score
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(statusColors[l.status] || C.gray)
  }, l.status))))));
}

// ── Nova Busca ────────────────────────────────────────────────────────────────
const UFS_BR = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const PORTES_BR = ['Micro', 'Pequena', 'Média', 'Grande'];

// Tabela CNAE (código + descrição) carregada uma vez e cacheada no módulo.
let _cnaeCache = null;
let _municCache = null;
const semAcento = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtCnae = c => {
  const d = String(c).padStart(7, '0');
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5, 7)}`;
};
const ABERTURA_OPCOES = [{
  k: 'qualquer',
  label: 'Qualquer \u00e9poca'
}, {
  k: '6m',
  label: 'Abertas nos \u00faltimos 6 meses'
}, {
  k: '1a',
  label: 'Abertas no \u00faltimo ano'
}, {
  k: '2a',
  label: 'Abertas nos \u00faltimos 2 anos'
}, {
  k: '5a',
  label: 'Abertas nos \u00faltimos 5 anos'
}, {
  k: '+5a',
  label: 'Com mais de 5 anos'
}];
const CAPITAL_OPCOES = [{
  k: 'qualquer',
  label: 'Qualquer'
}, {
  k: 'ate50',
  label: 'At\u00e9 R$ 50 mil',
  lte: 50000
}, {
  k: '50a500',
  label: 'R$ 50 mil a 500 mil',
  gte: 50000,
  lte: 500000
}, {
  k: '500a5mi',
  label: 'R$ 500 mil a 5 mi',
  gte: 500000,
  lte: 5000000
}, {
  k: '+5mi',
  label: 'Acima de R$ 5 mi',
  gte: 5000000
}];
function foundedFromPreset(k) {
  const now = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const mAgo = m => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    return iso(d);
  };
  switch (k) {
    case '6m':
      return {
        gte: mAgo(6)
      };
    case '1a':
      return {
        gte: mAgo(12)
      };
    case '2a':
      return {
        gte: mAgo(24)
      };
    case '5a':
      return {
        gte: mAgo(60)
      };
    case '+5a':
      return {
        lte: mAgo(60)
      };
    default:
      return {};
  }
}
function NovaBusca({
  onSalvar
}) {
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
  const [municBusca, setMunicBusca] = useState('');
  const [municSel, setMunicSel] = useState([]);
  const [municData, setMunicData] = useState([]);
  const [municFoco, setMunicFoco] = useState(false);
  const [abertura, setAbertura] = useState('qualquer');
  const [capital, setCapital] = useState('qualquer');
  const nomeRef = useRef();
  const criteriosRef = useRef();
  useEffect(() => {
    if (_cnaeCache) {
      setCnaeData(_cnaeCache);
    } else fetch('/cnae.json', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => {
      _cnaeCache = d;
      setCnaeData(d);
    }).catch(() => {});
    if (_municCache) {
      setMunicData(_municCache);
    } else fetch('/municipios.json', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => {
      _municCache = d;
      setMunicData(d);
    }).catch(() => {});
  }, []);
  const municResultados = useMemo(() => {
    const q = semAcento(municBusca.trim());
    if (q.length < 2) return [];
    const out = [];
    for (const m of municData) {
      if (ufs.length && !ufs.includes(m.uf)) continue; // respeita a UF escolhida
      if (semAcento(m.n).includes(q)) {
        out.push(m);
        if (out.length >= 25) break;
      }
    }
    return out;
  }, [municBusca, municData, ufs]);
  const addMunic = m => {
    setMunicSel(prev => prev.find(x => x.c === m.c) ? prev : [...prev, m]);
    setMunicBusca('');
  };
  const removeMunic = c => setMunicSel(prev => prev.filter(x => x.c !== c));
  const cnaeResultados = useMemo(() => {
    const q = semAcento(cnaeBusca.trim());
    if (q.length < 2) return [];
    const qDig = q.replace(/\D/g, '');
    const out = [];
    for (const s of cnaeData) {
      if (semAcento(s.d).includes(q) || qDig.length >= 3 && s.c.includes(qDig)) {
        out.push(s);
        if (out.length >= 25) break;
      }
    }
    return out;
  }, [cnaeBusca, cnaeData]);
  const addCnae = s => {
    setCnaeSel(prev => prev.find(x => x.c === s.c) ? prev : [...prev, s]);
    setCnaeBusca('');
  };
  const removeCnae = c => setCnaeSel(prev => prev.filter(x => x.c !== c));
  const tipos = [{
    key: 'icp',
    titulo: 'Por perfil (ICP)',
    desc: 'Defina CNAE, UF e porte do cliente ideal.',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12h.01'
  }, {
    key: 'cnpj',
    titulo: 'Por lista de CNPJ',
    desc: 'Faça upload ou cole uma lista de CNPJs.',
    icon: 'M9 12h6M9 16h6M9 8h2M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'
  }, {
    key: 'lookalike',
    titulo: 'Semelhantes a uma lista',
    desc: 'Suba clientes que já converteram.',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5'
  }];
  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const salvar = async () => {
    const nome = nomeRef.current?.value?.trim();
    if (!nome) {
      alert('Informe o nome da busca.');
      return;
    }
    if (tipo === 'icp' && cnaeSel.length === 0) {
      const ok = window.confirm('Nenhuma atividade selecionada.\n\nA busca vai trazer empresas de TODOS os ramos' + (ufs.length ? ' da(s) UF(s) escolhida(s)' : ' do Brasil') + '. Para filtrar por ramo, digite no campo "Atividade" e clique no resultado (vira chip dourado).\n\nContinuar mesmo assim?');
      if (!ok) return;
    }
    setSaving(true);
    try {
      const cnaes = cnaeSel.map(s => s.c);
      const fnd = foundedFromPreset(abertura);
      const cap = CAPITAL_OPCOES.find(o => o.k === capital) || {};
      const aberturaLabel = ABERTURA_OPCOES.find(o => o.k === abertura)?.label;
      const capitalLabel = CAPITAL_OPCOES.find(o => o.k === capital)?.label;
      const chips = [...ufs.map(u => `UF: ${u}`), ...municSel.map(m => `Município: ${m.n}`), ...portes.map(p => `Porte: ${p}`), ...cnaeSel.map(s => `CNAE: ${s.d}`), ...(abertura !== 'qualquer' ? [`Abertura: ${aberturaLabel}`] : []), ...(capital !== 'qualquer' ? [`Capital: ${capitalLabel}`] : [])];
      const criterios = tipo === 'icp' ? {
        chips,
        params: {
          ufs,
          portes,
          cnaes,
          cnaes_rotulos: cnaeSel,
          municipios_cod: municSel.map(m => m.c),
          municipios_rotulos: municSel,
          founded_gte: fnd.gte || null,
          founded_lte: fnd.lte || null,
          equity_gte: cap.gte ?? null,
          equity_lte: cap.lte ?? null,
          query: criteriosRef.current?.value || ''
        },
        texto: criteriosRef.current?.value || ''
      } : {
        texto: criteriosRef.current?.value || ''
      };
      const r = await fetch('/api/buscas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome,
          tipo,
          ritmo,
          corte_score: corte,
          criterios
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao criar busca.');
      }
      onSalvar();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 26
    }
  }, tipos.map(t => {
    const active = tipo === t.key;
    return /*#__PURE__*/React.createElement("div", {
      key: t.key,
      onClick: () => setTipo(t.key),
      style: {
        flex: 1,
        textAlign: 'left',
        padding: 18,
        borderRadius: 13,
        cursor: 'pointer',
        background: 'var(--panel)',
        transition: 'all .12s',
        border: active ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
        boxShadow: active ? `0 0 0 3px rgba(251,228,154,.08)` : 'none'
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: t.icon,
      color: active ? C.gold : 'var(--dim)',
      sw: 1.7
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        margin: '11px 0 4px',
        color: active ? 'var(--text)' : 'var(--dim)'
      }
    }, t.titulo), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)',
        lineHeight: 1.45
      }
    }, t.desc));
  })), tipo === 'icp' ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Atividade \u2014 busque por palavra (vira CNAE automaticamente)"), /*#__PURE__*/React.createElement("input", {
    value: cnaeBusca,
    onChange: e => setCnaeBusca(e.target.value),
    onFocus: () => setCnaeFoco(true),
    onBlur: () => setTimeout(() => setCnaeFoco(false), 150),
    placeholder: "Ex: fisioterapia, restaurante, desenvolvimento de software\u2026",
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }), cnaeFoco && cnaeBusca.trim().length >= 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 30,
      left: 0,
      right: 0,
      top: '100%',
      marginTop: 4,
      maxHeight: 248,
      overflowY: 'auto',
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 9,
      boxShadow: '0 10px 28px rgba(0,0,0,.45)'
    }
  }, cnaeData.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Carregando atividades\u2026") : cnaeResultados.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Nenhuma atividade encontrada.") : cnaeResultados.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.c,
    onMouseDown: () => addCnae(s),
    className: "row-hover",
    style: {
      padding: '9px 12px',
      fontSize: 12.5,
      cursor: 'pointer',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, s.d), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtCnae(s.c))))), cnaeSel.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 9
    }
  }, cnaeSel.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.c,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 10px',
      borderRadius: 7,
      fontSize: 11.5,
      border: `1px solid ${C.gold}`,
      background: 'rgba(251,228,154,.1)',
      color: C.gold
    }
  }, s.d, /*#__PURE__*/React.createElement("span", {
    onClick: () => removeCnae(s.c),
    title: "Remover",
    style: {
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
      lineHeight: 1,
      opacity: .8
    }
  }, "\xD7"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "UFs"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, UFS_BR.map(u => /*#__PURE__*/React.createElement("span", {
    key: u,
    onClick: () => toggle(ufs, setUfs, u),
    style: {
      cursor: 'pointer',
      padding: '5px 10px',
      borderRadius: 7,
      fontSize: 11.5,
      border: ufs.includes(u) ? `1px solid ${C.gold}` : '1px solid var(--border)',
      background: ufs.includes(u) ? 'rgba(251,228,154,.1)' : 'transparent',
      color: ufs.includes(u) ? C.gold : 'var(--dim)'
    }
  }, u)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Porte"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, PORTES_BR.map(p => /*#__PURE__*/React.createElement("span", {
    key: p,
    onClick: () => toggle(portes, setPortes, p),
    style: {
      cursor: 'pointer',
      padding: '5px 12px',
      borderRadius: 7,
      fontSize: 11.5,
      border: portes.includes(p) ? `1px solid ${C.gold}` : '1px solid var(--border)',
      background: portes.includes(p) ? 'rgba(251,228,154,.1)' : 'transparent',
      color: portes.includes(p) ? C.gold : 'var(--dim)'
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Munic\xEDpios ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(opcional \u2014 busque por nome", ufs.length ? `, dentro de ${ufs.join('/')}` : '', ")")), /*#__PURE__*/React.createElement("input", {
    value: municBusca,
    onChange: e => setMunicBusca(e.target.value),
    onFocus: () => setMunicFoco(true),
    onBlur: () => setTimeout(() => setMunicFoco(false), 150),
    placeholder: "Ex: Porto Alegre, Caxias do Sul\u2026",
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }), municFoco && municBusca.trim().length >= 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 30,
      left: 0,
      right: 0,
      top: '100%',
      marginTop: 4,
      maxHeight: 248,
      overflowY: 'auto',
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 9,
      boxShadow: '0 10px 28px rgba(0,0,0,.45)'
    }
  }, municData.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Carregando munic\xEDpios\u2026") : municResultados.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Nenhum munic\xEDpio encontrado", ufs.length ? ' nessa(s) UF(s)' : '', ".") : municResultados.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.c,
    onMouseDown: () => addMunic(m),
    className: "row-hover",
    style: {
      padding: '9px 12px',
      fontSize: 12.5,
      cursor: 'pointer',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, m.n), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      flexShrink: 0
    }
  }, m.uf)))), municSel.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 9
    }
  }, municSel.map(m => /*#__PURE__*/React.createElement("span", {
    key: m.c,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 10px',
      borderRadius: 7,
      fontSize: 11.5,
      border: `1px solid ${C.gold}`,
      background: 'rgba(251,228,154,.1)',
      color: C.gold
    }
  }, m.n, " \xB7 ", m.uf, /*#__PURE__*/React.createElement("span", {
    onClick: () => removeMunic(m.c),
    title: "Remover",
    style: {
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
      lineHeight: 1,
      opacity: .8
    }
  }, "\xD7"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Data de abertura"), /*#__PURE__*/React.createElement("select", {
    value: abertura,
    onChange: e => setAbertura(e.target.value),
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 10px',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, ABERTURA_OPCOES.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.k,
    value: o.k
  }, o.label)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Capital social"), /*#__PURE__*/React.createElement("select", {
    value: capital,
    onChange: e => setCapital(e.target.value),
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 10px',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, CAPITAL_OPCOES.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.k,
    value: o.k
  }, o.label))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Descri\xE7\xE3o livre (opcional, contexto pro agente SWOT)"), /*#__PURE__*/React.createElement("textarea", {
    ref: criteriosRef,
    placeholder: "Ex: empresas com time comercial estruturado, foco em B2B",
    style: {
      width: '100%',
      minHeight: 70,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: 12,
      fontSize: 13,
      fontFamily: 'inherit',
      lineHeight: 1.5,
      resize: 'vertical'
    }
  }))) : /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1.5px dashed var(--border)',
      borderRadius: 14,
      padding: 40,
      textAlign: 'center',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    color: "var(--faint)",
    w: 34,
    h: 34,
    sw: 1.5,
    extra: {
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, "Arraste um arquivo CSV ou clique para enviar"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      marginTop: 5
    }
  }, "Uma coluna de CNPJ, ou cole a lista no campo abaixo"), /*#__PURE__*/React.createElement("textarea", {
    ref: criteriosRef,
    placeholder: "Cole a lista de CNPJs (um por linha)",
    style: {
      width: '100%',
      minHeight: 70,
      marginTop: 16,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: 12,
      fontSize: 13,
      fontFamily: 'inherit',
      lineHeight: 1.5,
      resize: 'vertical'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '18px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Nome da busca"), /*#__PURE__*/React.createElement("input", {
    ref: nomeRef,
    placeholder: "Ex: Ag\xEAncias de marketing \u2014 Sul",
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: 'var(--dim)'
    }
  }, "Ritmo da torneira"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.gold
    }
  }, ritmo, " leads/h")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 20,
    max: 300,
    step: 10,
    value: ritmo,
    onChange: e => setRitmo(+e.target.value),
    style: {
      width: '100%',
      accentColor: '#FBE49A',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10.5,
      color: 'var(--faint)',
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement("span", null, "econ\xF4mico"), /*#__PURE__*/React.createElement("span", null, "agressivo"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: 'var(--dim)'
    }
  }, "Corte do Score 1"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.gold
    }
  }, corte, " pts")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    step: 5,
    value: corte,
    onChange: e => setCorte(+e.target.value),
    style: {
      width: '100%',
      accentColor: '#FBE49A',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10.5,
      color: 'var(--faint)',
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement("span", null, "permissivo"), /*#__PURE__*/React.createElement("span", null, "rigoroso"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: saving,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 46,
      padding: '0 24px',
      borderRadius: 11,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 14,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: saving ? .6 : 1
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M5 12h14M13 5l7 7-7 7",
    color: "#0E1936",
    w: 16,
    h: 16,
    sw: 2
  }), saving ? 'Criando…' : 'Ligar busca')));
}

// ── Integrações ───────────────────────────────────────────────────────────────
const INTEGRACOES_META = {
  'descoberta|cnpja': {
    nome: 'Descoberta de empresas',
    provedor: 'CNPJá',
    icon: 'M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    editavel: true
  },
  'crm|rdstation': {
    nome: 'CRM',
    provedor: 'RD Station',
    icon: 'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z',
    editavel: false
  },
  'validacao_email|neverbounce': {
    nome: 'Validação de e-mail',
    provedor: 'NeverBounce',
    icon: 'M3 5h18v14H3zM3 7l9 6 9-6',
    editavel: false
  },
  'validacao_tel|twilio': {
    nome: 'Validação de telefone',
    provedor: 'Twilio Lookup',
    icon: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z',
    editavel: false
  },
  'ia|claude': {
    nome: 'Inteligência (IA)',
    provedor: 'Claude · Anthropic',
    icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17',
    editavel: false
  }
};
const INTEGRACOES_ORDEM = ['descoberta|cnpja', 'crm|rdstation', 'validacao_email|neverbounce', 'validacao_tel|twilio', 'ia|claude'];
function Integracoes() {
  const [rows, setRows] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const chaveRefs = useRef({});
  const carregar = () => {
    setErro(null);
    fetch('/api/integracoes', {
      credentials: 'same-origin'
    }).then(r => {
      if (!r.ok) throw new Error('Sem permissão (apenas Admin) ou sessão expirada.');
      return r.json();
    }).then(setRows).catch(e => {
      setRows([]);
      setErro(e.message);
    });
  };
  useEffect(carregar, []);
  const porChave = {};
  (rows || []).forEach(r => {
    porChave[`${r.categoria}|${r.provedor}`] = r;
  });
  const salvar = async (chave, categoria, provedor) => {
    const key = (chaveRefs.current[chave]?.value || '').trim();
    const existente = porChave[chave];
    setSalvando(chave);
    try {
      if (existente) {
        await fetch('/api/integracoes/' + existente.id, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ativo: true,
            ...(key ? {
              key
            } : {})
          })
        });
      } else {
        await fetch('/api/integracoes', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            categoria,
            provedor,
            ativo: true,
            key
          })
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
  const alternar = async chave => {
    const existente = porChave[chave];
    if (!existente) return;
    await fetch('/api/integracoes/' + existente.id, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ativo: !existente.ativo
      })
    });
    carregar();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 840,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, erro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.red,
      background: 'rgba(248,113,113,.1)',
      border: '1px solid rgba(248,113,113,.25)',
      borderRadius: 9,
      padding: '10px 12px'
    }
  }, erro), rows === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : INTEGRACOES_ORDEM.map(chave => {
    const meta = INTEGRACOES_META[chave];
    const [categoria, provedor] = chave.split('|');
    const row = porChave[chave];
    const conectado = !!(row && row.ativo && row.tem_chave);
    return /*#__PURE__*/React.createElement("div", {
      key: chave,
      style: {
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 42,
        height: 42,
        borderRadius: 11,
        background: 'var(--panel2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dim)',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: meta.icon,
      w: 20,
      h: 20,
      sw: 1.6
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14.5,
        fontWeight: 600
      }
    }, meta.nome), /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(conectado ? C.green : C.gray)
    }, /*#__PURE__*/React.createElement(StatusDot, {
      color: conectado ? C.green : C.gray,
      pulse: false
    }), conectado ? 'conectado' : 'desconectado'), !meta.editavel && /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(C.gray)
    }, "fase 3.1")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--faint)',
        marginTop: 3
      }
    }, meta.provedor, row?.chave_mascarada ? ' · ' + row.chave_mascarada : '')), meta.editavel ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
      ref: el => chaveRefs.current[chave] = el,
      placeholder: "Colar chave da API\u2026",
      style: {
        width: 190,
        height: 38,
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'var(--panel2)',
        color: 'var(--dim)',
        padding: '0 12px',
        fontSize: 12.5,
        fontFamily: 'inherit',
        letterSpacing: '.05em'
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => salvar(chave, categoria, provedor),
      disabled: salvando === chave,
      style: {
        height: 38,
        padding: '0 15px',
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: 12.5,
        fontFamily: 'inherit',
        cursor: salvando === chave ? 'default' : 'pointer',
        flexShrink: 0,
        opacity: salvando === chave ? .6 : 1
      }
    }, salvando === chave ? 'Salvando…' : 'Salvar'), row && /*#__PURE__*/React.createElement("button", {
      onClick: () => alternar(chave),
      style: {
        height: 38,
        padding: '0 12px',
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--dim)',
        fontSize: 12.5,
        fontFamily: 'inherit',
        cursor: 'pointer',
        flexShrink: 0
      }
    }, row.ativo ? 'Desativar' : 'Ativar')) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--faint)',
        flexShrink: 0
      }
    }, "Em breve"));
  }));
}

// ── Usuários ──────────────────────────────────────────────────────────────────
function fmtAcesso(ts) {
  if (!ts) return 'nunca';
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '—';
  }
}
function Usuarios() {
  const [users, setUsers] = useState(null);
  const [erro, setErro] = useState(null);
  const [novaCred, setNovaCred] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const papelColors = {
    Admin: C.gold,
    Operador: C.blue,
    Visualizador: C.gray
  };
  const carregar = () => {
    setErro(null);
    fetch('/api/usuarios', {
      credentials: 'same-origin'
    }).then(r => {
      if (!r.ok) throw new Error('Sem permissão (apenas Admin) ou sessão expirada.');
      return r.json();
    }).then(setUsers).catch(e => {
      setUsers([]);
      setErro(e.message);
    });
  };
  useEffect(carregar, []);
  const convidar = async () => {
    const nome = window.prompt('Nome do usuário:');
    if (!nome) return;
    const email = window.prompt('E-mail:');
    if (!email) return;
    const papel = window.prompt('Papel (Admin / Operador / Visualizador):', 'Operador') || 'Operador';
    const resp = await fetch('/api/usuarios', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nome,
        email,
        papel
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      window.alert(data.erro || 'Erro ao criar usuário.');
      return;
    }
    setCopiado(false);
    setNovaCred({
      nome,
      email,
      senha: data.senha_provisoria
    });
    carregar();
  };
  const credText = c => 'Acesso ao Hunter\nURL: https://adhunter.antidotodigital.com\nE-mail: ' + c.email + '\nSenha provisória: ' + c.senha + '\n(troque a senha no primeiro acesso)';
  const copiar = async c => {
    try {
      await navigator.clipboard.writeText(credText(c));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (_) {
      window.prompt('Copie as credenciais:', credText(c));
    }
  };
  const alternar = async u => {
    await fetch('/api/usuarios/' + u.id, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ativo: !u.ativo
      })
    });
    carregar();
  };
  const excluir = async u => {
    if (!window.confirm('Excluir ' + u.nome + ' definitivamente?\nEssa ação não pode ser desfeita.')) return;
    const r = await fetch('/api/usuarios/' + u.id, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.erro || 'Erro ao excluir.');
      return;
    }
    carregar();
  };
  const cols = '2fr 1.3fr .9fr 1fr 90px 44px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1010
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: convidar,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 5v14M5 12h14",
    color: "#0E1936",
    w: 15,
    h: 15,
    sw: 2
  }), "Convidar usu\xE1rio")), erro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.red,
      background: 'rgba(248,113,113,.1)',
      border: '1px solid rgba(248,113,113,.25)',
      borderRadius: 9,
      padding: '10px 12px',
      marginBottom: 14
    }
  }, erro), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      alignItems: 'center',
      gap: 10,
      padding: '12px 18px',
      borderBottom: '1px solid var(--border)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      color: 'var(--faint)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("div", null, "Usu\xE1rio"), /*#__PURE__*/React.createElement("div", null, "E-mail"), /*#__PURE__*/React.createElement("div", null, "Papel"), /*#__PURE__*/React.createElement("div", null, "\xDAltimo acesso"), /*#__PURE__*/React.createElement("div", null, "Status"), /*#__PURE__*/React.createElement("div", null)), users === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 18px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : users.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 18px',
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Nenhum usu\xE1rio.") : users.map(u => {
    const ini = (u.nome || '?').split(' ').slice(0, 2).map(w => w[0]).join('');
    return /*#__PURE__*/React.createElement("div", {
      key: u.id,
      style: {
        display: 'grid',
        gridTemplateColumns: cols,
        alignItems: 'center',
        gap: 10,
        padding: '13px 18px',
        borderBottom: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 9,
        background: 'var(--panel2)',
        color: C.blue,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0
      }
    }, ini), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 500
      }
    }, u.nome)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--dim)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, u.email), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(papelColors[u.papel] || C.gray)
    }, u.papel)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--faint)'
      }
    }, fmtAcesso(u.ultimo_acesso)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      onClick: () => alternar(u),
      title: "Clique para ativar/desativar",
      style: {
        ...badgeStyle(u.ativo ? C.green : C.gray),
        cursor: 'pointer'
      }
    }, u.ativo ? 'Ativo' : 'Inativo')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
      onClick: () => excluir(u),
      title: "Excluir usu\xE1rio",
      style: {
        width: 30,
        height: 30,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--dim)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(SvgMulti, {
      w: 15,
      h: 15,
      sw: 1.7
    }, /*#__PURE__*/React.createElement("path", {
      d: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6"
    })))));
  })), novaCred && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setNovaCred(null),
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(5,9,20,.6)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 440,
      maxWidth: '92vw',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px 0'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Usu\xE1rio criado \u2713"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--dim)',
      margin: '0 0 18px'
    }
  }, "Repasse com seguran\xE7a \u2014 a senha provis\xF3ria s\xF3 aparece agora.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, [['Nome', novaCred.nome], ['E-mail', novaCred.email], ['Senha provisória', novaCred.senha]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 13px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginBottom: 3
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      fontFamily: k === 'Senha provisória' ? 'ui-monospace,monospace' : 'inherit',
      color: k === 'Senha provisória' ? C.gold : 'var(--text)',
      wordBreak: 'break-all'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px 20px',
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => copiar(novaCred),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      height: 42,
      borderRadius: 10,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 15,
    h: 15,
    sw: 1.8,
    color: "#0E1936"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "9",
    width: "11",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 15V5a2 2 0 0 1 2-2h10"
  })), copiado ? 'Copiado!' : 'Copiar credenciais'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setNovaCred(null),
    style: {
      height: 42,
      padding: '0 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Fechar")))));
}

// ── Configurações ─────────────────────────────────────────────────────────────
function Config() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Par\xE2metros padr\xE3o"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 18px'
    }
  }, "Valores aplicados a novas buscas."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 16
    }
  }, [['Ritmo padrão', '120 leads/h'], ['Corte de score', '60'], ['TTL de cache', '30 dias']].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    defaultValue: val,
    style: {
      width: '100%',
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Alertas"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 18px'
    }
  }, "Limites do heartbeat e destinat\xE1rios."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, [['Parada considerada após', '30 min sem pulso'], ['Destinatários', 'ops@empresa.com.br']].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    defaultValue: val,
    style: {
      width: '100%',
      height: 38,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    style: {
      height: 44,
      padding: '0 22px',
      borderRadius: 11,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Salvar altera\xE7\xF5es")));
}

// ── Monitoramento ─────────────────────────────────────────────────────────────
function Monitor() {
  const [data, setData] = useState(null);
  const [limpando, setLimpando] = useState(false);
  const load = () => fetch('/api/monitor/queues', {
    credentials: 'same-origin'
  }).then(r => r.json()).then(setData).catch(() => {});
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);
  const limparDlq = async () => {
    setLimpando(true);
    await fetch('/api/monitor/dlq/limpar', {
      method: 'POST',
      credentials: 'same-origin'
    }).catch(() => {});
    setLimpando(false);
    load();
  };
  if (!data) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--faint)',
        fontSize: 13
      }
    }, "Carregando\u2026");
  }
  const queuesByKey = Object.fromEntries((data.queues || []).map(q => [q.key, q]));
  const totalAtivos = (data.queues || []).reduce((s, q) => s + q.active, 0);
  const totalEspera = (data.queues || []).reduce((s, q) => s + q.waiting, 0);
  const totalConcluidos = (data.queues || []).reduce((s, q) => s + q.completed, 0);
  const totalFalhos = (data.queues || []).reduce((s, q) => s + q.failed, 0);
  const cards = [{
    label: 'Jobs ativos',
    v: totalAtivos,
    color: C.blue
  }, {
    label: 'Em espera',
    v: totalEspera,
    color: C.amber
  }, {
    label: 'Concluídos (acumulado)',
    v: fmtNum(totalConcluidos),
    color: C.green
  }, {
    label: 'Falhos (acumulado)',
    v: totalFalhos,
    color: C.red
  }];
  const etapas = [{
    key: 'descoberta',
    label: '1. Descoberta (CNPJá)'
  }, {
    key: 'enriquecimento',
    label: '2. Enriquecimento (Receita)'
  }, {
    key: 'filtroContador',
    label: '3. Filtro de contador'
  }, {
    key: 'score1',
    label: '4. Score 1 + corte'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180
    }
  }, !data.motor_conectado && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(251,191,36,.08)',
      border: '1px solid ' + C.amber,
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 18,
      fontSize: 12.5,
      color: C.amber
    }
  }, "Motor (Redis/BullMQ) n\xE3o conectado ao painel \u2014 verifique REDIS_HOST no servi\xE7o hunter-api."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, cards.map(q => /*#__PURE__*/React.createElement("div", {
    key: q.label,
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 13,
      padding: '16px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: q.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--dim)'
    }
  }, q.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 600
    }
  }, q.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '15px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0
    }
  }, "Pipeline por etapa")), etapas.map(et => {
    const q = queuesByKey[et.key] || {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
    return /*#__PURE__*/React.createElement("div", {
      key: et.key,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        fontSize: 12.5,
        fontWeight: 500
      }
    }, et.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: C.blue
      }
    }, q.active, " ativos"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: C.amber
      }
    }, q.waiting, " em espera"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: C.green
      }
    }, fmtNum(q.completed), " conclu\xEDdos"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: q.failed ? C.red : 'var(--faint)'
      }
    }, q.failed, " falhos"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 12px'
    }
  }, "Resumo do motor"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "Buscas ativas"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, data.buscas_ativas)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "Empresas no ledger"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, fmtNum(data.empresas_total))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "Leads \u2014 \xFAltimas 24h"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, fmtNum(data.leads_hoje))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "Descartados pelo corte \u2014 24h"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: C.red
    }
  }, fmtNum(data.descartados_hoje)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '15px 18px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0,
      flex: 1
    }
  }, "Dead-letter queue"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: (data.dlq || []).length ? C.red : 'var(--faint)',
      marginRight: 12
    }
  }, (data.dlq || []).length, " job(s) com falha recente"), (data.dlq || []).length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: limparDlq,
    disabled: limpando,
    style: {
      height: 30,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: limpando ? 'default' : 'pointer',
      opacity: limpando ? .6 : 1
    }
  }, limpando ? 'Limpando…' : 'Limpar')), (data.dlq || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Nenhuma falha recente."), (data.dlq || []).map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.cyan,
      fontFamily: 'ui-monospace,monospace'
    }
  }, d.job), ' ', /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, d.ref)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: C.red,
      marginTop: 2
    }
  }, d.motivo)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      whiteSpace: 'nowrap'
    }
  }, d.quando ? timeAgo(d.quando) : '')))));
}

// ── Lead Detail Slideover ─────────────────────────────────────────────────────
function LeadDetailPanel({
  leadId,
  onClose,
  onCrm,
  onStatusChange
}) {
  const [lead, setLead] = useState(null);
  const [displayStatus, setDisplayStatus] = useState(null);
  const [actioning, setActioning] = useState(false);
  useEffect(() => {
    if (!leadId) return;
    setLead(null);
    setDisplayStatus(null);
    fetch('/api/leads/' + leadId, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(l => {
      setLead(l);
      setDisplayStatus(l.status);
    }).catch(() => {});
  }, [leadId]);
  const patchStatus = async novoStatus => {
    if (actioning) return;
    setActioning(true);
    try {
      await fetch('/api/leads/' + leadId, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: novoStatus
        })
      });
      setDisplayStatus(novoStatus);
      onStatusChange && onStatusChange();
    } catch (_) {}
    setActioning(false);
  };
  if (!lead) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 60
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(5,9,20,.55)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100vh',
        width: 560,
        maxWidth: '94vw',
        background: 'var(--panel)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--faint)',
        fontSize: 13
      }
    }, "Carregando\u2026"));
  }
  const l = lead;
  const status = displayStatus || l.status;
  const contatos = Array.isArray(l.contatos) ? l.contatos : [];
  const breakdown = Array.isArray(l.breakdown) ? l.breakdown : [];
  const decisorIni = (l.decisor || '').replace(/^(Dr|Dra)\.?\s*/i, '').split(' ').slice(0, 2).map(w => w[0]).join('');
  const mailPath = 'M3 5h18v14H3zM3 7l9 6 9-6';
  const telPath = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z';
  const webPath = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18';
  const contactIcon = tipo => {
    if (tipo === 'email') return /*#__PURE__*/React.createElement(Svg, {
      d: mailPath,
      color: C.blue,
      w: 16,
      h: 16,
      sw: 1.8
    });
    if (tipo === 'telefone') return /*#__PURE__*/React.createElement(Svg, {
      d: telPath,
      color: C.green,
      w: 16,
      h: 16,
      sw: 1.8
    });
    return /*#__PURE__*/React.createElement(Svg, {
      d: webPath,
      color: C.cyan,
      w: 16,
      h: 16,
      sw: 1.8
    });
  };
  const seloStyle = validado => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 7px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
    background: validado ? C.green + '1f' : C.amber + '1f',
    color: validado ? C.green : C.amber
  });
  const breakdownColor = b => {
    if (!b.positivo) return b.delta && b.delta !== '0' && b.delta !== '—' ? C.red : C.gray;
    return C.green;
  };
  const cadastrais = [{
    k: 'CNAE principal',
    v: l.cnae
  }, {
    k: 'Porte',
    v: l.porte
  }, {
    k: 'Situação',
    v: l.situacao,
    ok: l.situacao === 'Ativa'
  }, {
    k: 'Abertura',
    v: l.abertura
  }, {
    k: 'Capital social',
    v: l.capital
  }, {
    k: 'Endereço',
    v: l.endereco
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(5,9,20,.55)',
      animation: 'hfade .2s ease'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      right: 0,
      height: '100vh',
      width: 560,
      maxWidth: '94vw',
      background: 'var(--panel)',
      borderLeft: '1px solid var(--border)',
      overflowY: 'auto',
      animation: 'hslide .28s cubic-bezier(.22,.61,.36,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      background: 'var(--panel)',
      borderBottom: '1px solid var(--border)',
      padding: '18px 24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(statusColors[status] || C.gray)
  }, status), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)'
    }
  }, l.cnpj)), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 19,
      fontWeight: 600,
      margin: 0
    }
  }, l.fantasia), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)',
      margin: '3px 0 0'
    }
  }, l.razao)), /*#__PURE__*/React.createElement(ScoreRing, {
    score: l.score,
    size: 84
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      flexShrink: 0,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: 'pointer',
      fontSize: 15
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.08em',
      color: 'var(--faint)',
      marginBottom: 12,
      textTransform: 'uppercase'
    }
  }, "Dados cadastrais \xB7 Receita Federal"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '14px 18px'
    }
  }, cadastrais.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginBottom: 3
    }
  }, c.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, c.ok && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: C.green,
      display: 'inline-block',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, c.v || '—')))))), /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.08em',
      color: 'var(--faint)',
      marginBottom: 12,
      textTransform: 'uppercase'
    }
  }, "Decisor"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 11,
      background: C.blue,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      fontSize: 14,
      flexShrink: 0
    }
  }, decisorIni), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 500
    }
  }, l.decisor), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--dim)'
    }
  }, l.cargo)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      color: C.cyan,
      background: 'rgba(122,217,255,.1)',
      border: '1px solid rgba(122,217,255,.2)',
      padding: '5px 9px',
      borderRadius: 7
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 12,
    h: 12,
    sw: 2,
    color: C.cyan
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  })), "Receita Federal"))), contatos.length > 0 && /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.08em',
      color: 'var(--faint)',
      marginBottom: 12,
      textTransform: 'uppercase'
    }
  }, "Contatos"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, contatos.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '11px 13px'
    }
  }, contactIcon(c.tipo), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, c.valor), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--faint)'
    }
  }, c.fonte, " \xB7 ", c.recencia)), /*#__PURE__*/React.createElement("span", {
    style: seloStyle(c.validado)
  }, c.selo || (c.validado ? 'verificado' : 'não verif.')))))), l.abordagem && /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 14,
    h: 14,
    sw: 1.8,
    color: C.blue
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 4
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.08em',
      color: C.blue,
      textTransform: 'uppercase'
    }
  }, "Sugest\xE3o de abordagem \xB7 IA")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(58,142,255,.07)',
      border: '1px solid rgba(58,142,255,.22)',
      borderRadius: 11,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: 1.6,
      margin: '0 0 12px',
      color: 'var(--text)'
    }
  }, l.abordagem), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => navigator.clipboard?.writeText(l.abordagem).catch(() => {}),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 31,
      padding: '0 12px',
      borderRadius: 7,
      border: '1px solid rgba(58,142,255,.3)',
      background: 'transparent',
      color: C.blue,
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Copiar")))), breakdown.length > 0 && /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.08em',
      color: 'var(--faint)',
      marginBottom: 12,
      textTransform: 'uppercase'
    }
  }, "Breakdown do confidence score"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, breakdown.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      flex: 1,
      color: 'var(--dim)'
    }
  }, b.campo), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: breakdownColor(b),
      minWidth: 34,
      textAlign: 'right'
    }
  }, b.delta)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 0,
      background: 'var(--panel)',
      borderTop: '1px solid var(--border)',
      padding: '14px 24px',
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onCrm([leadId]),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      height: 42,
      borderRadius: 10,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M5 12h14M13 5l7 7-7 7",
    color: "#0E1936",
    w: 15,
    h: 15,
    sw: 2
  }), "Enviar ao CRM"), /*#__PURE__*/React.createElement("button", {
    onClick: () => patchStatus('Qualificado'),
    disabled: actioning || status === 'Qualificado',
    style: {
      height: 42,
      padding: '0 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: status === 'Qualificado' ? C.green : 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: actioning || status === 'Qualificado' ? .6 : 1
    }
  }, "Aprovar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => patchStatus('Descartado'),
    disabled: actioning || status === 'Descartado',
    style: {
      height: 42,
      padding: '0 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: status === 'Descartado' ? C.red : 'var(--dim)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: actioning || status === 'Descartado' ? .6 : 1
    }
  }, "Descartar"))));
}

// ── CRM Modal ─────────────────────────────────────────────────────────────────
function CrmModal({
  ids,
  onClose,
  onConfirm
}) {
  const [loading, setLoading] = useState(false);
  const confirmar = async () => {
    setLoading(true);
    try {
      await fetch('/api/leads/acoes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids,
          acao: 'enviar_crm',
          crm_destino: 'RD Station'
        })
      });
      onConfirm();
    } catch (_) {
      alert('Erro ao enviar ao CRM.');
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(5,9,20,.6)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 460,
      maxWidth: '92vw',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      margin: '0 0 4px'
    }
  }, "Enviar ao CRM"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--dim)',
      margin: 0
    }
  }, ids.length, " lead", ids.length !== 1 ? 's' : '', " ", ids.length !== 1 ? 'serão enviados' : 'será enviado', " \u2014 a\xE7\xE3o deliberada, sem automa\xE7\xE3o.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "CRM de destino"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 42,
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("span", null, "RD Station"), /*#__PURE__*/React.createElement(Svg, {
    d: "M6 9l6 6 6-6",
    w: 14,
    h: 14,
    color: "var(--dim)",
    sw: 2
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 17,
    h: 17,
    sw: 1.8,
    color: C.cyan
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 10
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)',
      lineHeight: 1.45
    }
  }, "Mapeamento de campos validado \u2014 raz\xE3o social, decisor, contatos e score ser\xE3o sincronizados."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      height: 42,
      padding: '0 18px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: confirmar,
    disabled: loading,
    style: {
      height: 42,
      padding: '0 20px',
      borderRadius: 10,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: loading ? .6 : 1
    }
  }, loading ? 'Enviando…' : 'Confirmar envio'))));
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
    fetch('/api/auth/me', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : null).then(u => {
      if (u) setUser(u);
    }).catch(() => {});
  }, []);
  const navTo = s => {
    setScreen(s);
    setOpenLeadId(null);
    setCrmIds(null);
  };
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch (_) {}
    window.location = '/';
  };
  const openBusca = id => {
    if (id) {
      setBuscaDetailId(id);
      setScreen('buscaDetail');
    } else {
      setScreen('buscas');
    }
  };
  const vars = themeVars(theme);
  const cssVarObj = Object.fromEntries(vars.split(';').filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  }));
  const rootStyle = {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    fontFamily: 'Inter,system-ui,sans-serif',
    color: 'var(--text)',
    background: 'var(--bg)',
    WebkitFontSmoothing: 'antialiased',
    ...cssVarObj
  };
  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':
        return /*#__PURE__*/React.createElement(Dashboard, {
          onOpenBusca: openBusca
        });
      case 'leads':
        return /*#__PURE__*/React.createElement(Leads, {
          refreshKey: leadsRefreshKey,
          onOpenLead: setOpenLeadId,
          onCrm: setCrmIds
        });
      case 'buscas':
        return /*#__PURE__*/React.createElement(Buscas, {
          onOpen: openBusca
        });
      case 'buscaDetail':
        return /*#__PURE__*/React.createElement(BuscaDetail, {
          buscaId: buscaDetailId,
          onBack: () => setScreen('buscas'),
          onOpenLead: setOpenLeadId
        });
      case 'nova':
        return /*#__PURE__*/React.createElement(NovaBusca, {
          onSalvar: () => navTo('buscas')
        });
      case 'integracoes':
        return /*#__PURE__*/React.createElement(Integracoes, null);
      case 'usuarios':
        return /*#__PURE__*/React.createElement(Usuarios, null);
      case 'config':
        return /*#__PURE__*/React.createElement(Config, null);
      case 'monitor':
        return /*#__PURE__*/React.createElement(Monitor, null);
      default:
        return null;
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: rootStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      width: '100%',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    screen: screen,
    onNav: navTo,
    onLogout: logout,
    user: user
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    screen: screen,
    theme: theme,
    onTheme: toggleTheme,
    onNova: () => navTo('nova'),
    user: user
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 28
    }
  }, renderScreen()))), openLeadId && /*#__PURE__*/React.createElement(LeadDetailPanel, {
    leadId: openLeadId,
    onClose: () => setOpenLeadId(null),
    onCrm: ids => setCrmIds(ids),
    onStatusChange: () => setLeadsRefreshKey(k => k + 1)
  }), crmIds && /*#__PURE__*/React.createElement(CrmModal, {
    ids: crmIds,
    onClose: () => setCrmIds(null),
    onConfirm: () => {
      setCrmIds(null);
      setLeadsRefreshKey(k => k + 1);
    }
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
