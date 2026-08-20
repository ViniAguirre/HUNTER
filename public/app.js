const {
  useState,
  useRef,
  useEffect,
  useMemo
} = React;

// ── constants ─────────────────────────────────────────────────────────────────
// gold é o ACENTO temático (var --accent): pálido no escuro, dourado escuro e
// legível no claro. Assim os detalhes aparecem bem nos dois modos.
const C = {
  green: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  blue: '#3A8EFF',
  gold: 'var(--accent)',
  cyan: '#7AD9FF',
  gray: '#7C89A8'
};
function themeVars(t) {
  return t === 'light' ? '--bg:#F4F6FA;--panel:#FFFFFF;--panel2:#EEF2F8;--hover:rgba(14,25,54,.04);--border:rgba(14,25,54,.12);--track:rgba(14,25,54,.10);--text:#0E1936;--dim:#4E586F;--faint:#77819A;--gold:#E7C053;--accent:#976F00;--blue:#2A73E6;--cyan:#1C86B8;--red:#E0544E;' : '--bg:#0E1936;--panel:#0A0F1F;--panel2:#101a3a;--hover:rgba(255,255,255,.04);--border:rgba(255,255,255,.08);--track:rgba(255,255,255,.08);--text:#ECEFF7;--dim:#8A95B4;--faint:#5E688C;--gold:#FBE49A;--accent:#FBE49A;--blue:#3A8EFF;--cyan:#7AD9FF;--red:#F87171;';
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

// Ícone "i" que mostra a explicação ao passar o mouse OU clicar (útil em telas
// de toque). Usado pra tirar texto explicativo longo de dentro dos formulários.
function InfoTip({
  text,
  width = 260,
  align = 'left'
}) {
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      verticalAlign: 'middle',
      marginLeft: 6
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      setOpen(o => !o);
    },
    style: {
      width: 15,
      height: 15,
      borderRadius: '50%',
      border: '1px solid var(--faint)',
      color: 'var(--faint)',
      fontSize: 9.5,
      fontWeight: 700,
      fontStyle: 'italic',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      userSelect: 'none'
    }
  }, "i"), open && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 59
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      zIndex: 60,
      top: '130%',
      [align]: 0,
      width,
      padding: '10px 12px',
      borderRadius: 9,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 28px rgba(0,0,0,.4)',
      fontSize: 11.5,
      lineHeight: 1.55,
      color: 'var(--dim)',
      fontWeight: 400
    }
  }, text)));
}
function scoreColor(s) {
  return s >= 75 ? C.green : s >= 50 ? C.amber : C.red;
}
function badgeStyle(cor) {
  // color-mix aceita hex e CSS vars (var(--accent)), então o badge dourado fica
  // legível no claro sem quebrar a concatenação de alpha.
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 20,
    background: `color-mix(in srgb, ${cor} 15%, transparent)`,
    color: cor,
    border: `1px solid color-mix(in srgb, ${cor} 34%, transparent)`,
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
const TEL_PATH = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z';
const MAIL_PATH = 'M3 5h18v14H3zM3 7l9 6 9-6';

// Ícones de contato na lista: VERDE quando o enriquecimento achou o dado,
// VERMELHO quando não. Clicar abre só aquele contato (telefone OU e-mail) num
// balãozinho — e permite EDITAR/INCLUIR o dado ali mesmo (qualificação manual),
// sem abrir o painel inteiro do lead.
function ContactCell({
  leadId,
  emailVal,
  phoneVal,
  onSaved
}) {
  const [pop, setPop] = useState(null); // { tipo, x, y }
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!pop) return;
    const fechar = () => setPop(null);
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [pop]);
  const abrir = (e, tipo, atual) => {
    e.stopPropagation(); // não abre o painel do lead
    const r = e.currentTarget.getBoundingClientRect();
    setVal(atual || '');
    setPop(p => p && p.tipo === tipo ? null : {
      tipo,
      y: r.bottom + 6,
      x: Math.max(8, Math.min(r.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 268))
    });
  };
  const salvar = async e => {
    e.stopPropagation();
    if (!leadId) return;
    setSaving(true);
    try {
      const body = pop.tipo === 'email' ? {
        email: val.trim()
      } : {
        telefone: val.trim()
      };
      await fetch(`/api/leads/${leadId}/contato`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      onSaved && onSaved();
      setPop(null);
    } catch (_) {} finally {
      setSaving(false);
    }
  };
  const icone = (tipo, v, path, label) => /*#__PURE__*/React.createElement("svg", {
    key: tipo,
    onClick: e => abrir(e, tipo, v),
    title: label,
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: v ? C.green : C.red,
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: path
  }));
  const atualVal = pop ? pop.tipo === 'email' ? emailVal : phoneVal : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    },
    onClick: e => e.stopPropagation()
  }, icone('email', emailVal, MAIL_PATH, 'E-mail'), icone('telefone', phoneVal, TEL_PATH, 'Telefone'), pop && /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'fixed',
      left: pop.x,
      top: pop.y,
      zIndex: 80,
      width: 252,
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 12px',
      boxShadow: '0 8px 24px rgba(0,0,0,.28)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--faint)',
      marginBottom: 5,
      textTransform: 'uppercase',
      letterSpacing: '.05em'
    }
  }, pop.tipo === 'email' ? 'E-mail' : 'Telefone'), atualVal ? /*#__PURE__*/React.createElement("a", {
    href: (pop.tipo === 'email' ? 'mailto:' : 'tel:') + atualVal,
    onClick: e => e.stopPropagation(),
    style: {
      color: 'var(--text)',
      textDecoration: 'none',
      fontWeight: 500,
      fontSize: 12.5,
      wordBreak: 'break-all'
    }
  }, atualVal) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontSize: 12
    }
  }, "N\xE3o encontrado \u2014 inclua abaixo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: val,
    autoFocus: true,
    onChange: e => setVal(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') salvar(e);
    },
    placeholder: pop.tipo === 'email' ? 'contato@empresa.com.br' : '(11) 99999-9999',
    style: {
      flex: 1,
      minWidth: 0,
      height: 32,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 9px',
      fontSize: 12.5,
      fontFamily: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: saving,
    style: {
      height: 32,
      padding: '0 12px',
      borderRadius: 8,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, saving ? '…' : 'Salvar'))));
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

// Descoberta "Pela internet" (web-first) desligada na interface: ela consulta a
// CNPJá UMA VEZ POR EMPRESA pra confirmar o CNPJ (contra ~100 empresas por
// consulta no modo por CNAE), então sai muito mais cara. TODO o código do modo
// web continua no backend e nos radares já criados — pra reativar, basta trocar
// esta chave para true.
const DESCOBERTA_WEB_HABILITADA = false;

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_MAIN = [{
  key: 'dashboard',
  label: 'Dashboard',
  icon: 'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z'
}, {
  key: 'buscas',
  label: 'Radares',
  icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3'
}, {
  key: 'leads',
  label: 'Leads',
  icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3'
}, {
  key: 'propostas',
  label: 'Propostas',
  icon: 'M9 12h6M9 16h6M9 8h2M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'
}, {
  key: 'semelhantes',
  label: 'Semelhantes',
  icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5'
}];
// acesso: 'master' → só o login MASTER da Hunter (dados sigilosos: quais APIs
// alimentam o produto). 'admin' → admin do cliente (gestão do próprio time).
const NAV_ADMIN = [{
  key: 'integracoes',
  label: 'Integrações',
  acesso: 'master',
  icon: 'M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8'
}, {
  key: 'usuarios',
  label: 'Usuários',
  acesso: 'admin',
  icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'
}, {
  key: 'agente',
  label: 'Agente SWOT',
  acesso: 'master',
  icon: 'M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3zM12 8v4M9 12h6'
}, {
  key: 'config',
  label: 'Configurações',
  acesso: 'master',
  icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'
}, {
  key: 'monitor',
  label: 'Monitoramento',
  acesso: 'master',
  icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
}];
// Telas que exigem MASTER (usado também na guarda de navegação do App).
const TELAS_MASTER = new Set(['integracoes', 'config', 'monitor', 'agente']);
function podeVer(it, user) {
  if (it.acesso === 'master') return !!user?.master;
  if (it.acesso === 'admin') return !!user?.master || user?.papel === 'Admin';
  return true;
}
function TrocarSenhaModal({
  onClose
}) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [nova2, setNova2] = useState('');
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (nova.length < 6) {
      setMsg({
        ok: false,
        txt: 'A nova senha precisa ter ao menos 6 caracteres.'
      });
      return;
    }
    if (nova !== nova2) {
      setMsg({
        ok: false,
        txt: 'A confirmação não bate com a nova senha.'
      });
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          senha_atual: atual,
          senha_nova: nova
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao trocar a senha.');
      setMsg({
        ok: true,
        txt: 'Senha alterada com sucesso.'
      });
      setAtual('');
      setNova('');
      setNova2('');
      setTimeout(onClose, 1200);
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSalvando(false);
    }
  };
  const inp = {
    width: '100%',
    height: 38,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--panel2)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    marginBottom: 10
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 90,
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
      width: 400,
      maxWidth: '92vw',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      margin: '0 0 16px'
    }
  }, "Trocar minha senha"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Senha atual",
    value: atual,
    onChange: e => setAtual(e.target.value),
    style: inp
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Nova senha (m\xEDn. 6)",
    value: nova,
    onChange: e => setNova(e.target.value),
    style: inp
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Confirmar nova senha",
    value: nova2,
    onChange: e => setNova2(e.target.value),
    style: inp
  }), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: msg.ok ? C.green : C.red,
      margin: '4px 0 12px'
    }
  }, msg.txt), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'flex-end',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
    style: {
      height: 38,
      padding: '0 18px',
      borderRadius: 9,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      opacity: salvando ? .6 : 1
    }
  }, salvando ? 'Salvando…' : 'Salvar'))));
}
function Sidebar({
  screen,
  onNav,
  onLogout,
  user
}) {
  const [modalSenha, setModalSenha] = useState(false);
  const nome = user?.nome || '…';
  const papel = user?.master ? 'Master' : user?.papel || '';
  const ini = nome.split(' ').slice(0, 2).map(w => w[0]).join('');
  const adminItems = NAV_ADMIN.filter(it => podeVer(it, user));
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
      color: active ? 'var(--accent)' : 'var(--dim)',
      background: active ? 'var(--panel2)' : 'transparent',
      boxShadow: active ? 'inset 2px 0 0 var(--accent)' : 'none',
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
    stroke: screen === it.key || it.key === 'buscas' && screen === 'buscaDetail' ? 'var(--accent)' : '#8A95B4',
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
  }, renderNav(NAV_MAIN), adminItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '.14em',
      color: 'var(--faint)',
      padding: '18px 12px 8px'
    }
  }, "ADMINISTRA\xC7\xC3O"), renderNav(adminItems)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
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
  }, papel))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setModalSenha(true),
    className: "nav-link",
    style: {
      flex: 1,
      height: 32,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Trocar senha"), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    className: "nav-link",
    style: {
      flex: 1,
      height: 32,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Sair"))), modalSenha && /*#__PURE__*/React.createElement(TrocarSenhaModal, {
    onClose: () => setModalSenha(false)
  }));
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
  }), "Criar Radar"), /*#__PURE__*/React.createElement(ThemeToggle, {
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
  const [alertas, setAlertas] = useState([]);
  useEffect(() => {
    fetch('/api/dashboard', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setData).catch(() => {});
    fetch('/api/alertas', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => setAlertas(Array.isArray(d?.alertas) ? d.alertas : [])).catch(() => {});
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
  const fora = parseInt(metricas.leadsForaPerfil) || 0;
  const verificados = qual + fora; // passaram pela segmentação (Score 1)
  const taxaQ = verificados ? Math.round(qual / verificados * 100) : 0;
  const metrics = [{
    label: 'Radares ativos',
    value: fmtNum(metricas.buscasAtivas),
    icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
    iColor: C.blue,
    trend: 'em produção',
    tColor: 'var(--dim)'
  }, {
    label: 'Empresas encontradas',
    value: fmtNum(metricas.empresasEncontradas),
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3',
    iColor: C.gold,
    trend: `${fmtNum(verificados)} verificadas`,
    tColor: 'var(--dim)'
  }, {
    label: 'Leads qualificados',
    value: fmtNum(metricas.leadsQualificados),
    icon: 'M20 6L9 17l-5-5',
    iColor: C.green,
    trend: `${taxaQ}% aproveit. · ${fmtNum(fora)} fora do perfil`,
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
    amber: 'atenção',
    red: 'parada',
    gray: 'encerrada'
  };
  const corAlerta = t => t === 'erro' ? C.red : t === 'aviso' ? C.amber : C.blue;
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
  }, "Radares ativos"), /*#__PURE__*/React.createElement("a", {
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
  }, "Nenhum radar ativo."), buscasAtivas.map(b => /*#__PURE__*/React.createElement("div", {
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
  }, hlLabel[b.health] || '—')), /*#__PURE__*/React.createElement("div", {
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
  }, "Alertas"), alertas.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '11px 0'
    }
  }, "Nenhum alerta no momento."), alertas.map((a, i) => /*#__PURE__*/React.createElement("div", {
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
      background: corAlerta(a.tipo)
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
  }, a.detalhe, a.quando ? ` · ${timeAgo(a.quando)}` : ''))))), /*#__PURE__*/React.createElement("div", {
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
      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
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

// ── Impressão / PDF de lead(s) ────────────────────────────────────────────────
// Gera uma folha limpa (mesma info do painel) e abre o diálogo de impressão do
// navegador (permite "Salvar como PDF"). Serve pra 1 lead ou vários (1 por
// página). Sem dependência, sem servidor.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[c]);
}
function secaoLeadHtml(l) {
  const esc = escHtml;
  const cv = l.contato_validado || {};
  const sw = l.swot || {};
  const status = l.status || '';
  const listaHtml = arr => Array.isArray(arr) && arr.length ? '<ul>' + arr.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="vazio">—</p>';
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
    ${linha('Optante Simples', l.opcao_simples == null ? '' : l.opcao_simples ? 'Sim' : 'Não')}${linha('Endereço', l.endereco)}
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
    ${Array.isArray(sw.fatos_uteis) && sw.fatos_uteis.length ? `<div class="q"><h4>Fatos úteis pro contato</h4>${listaHtml(sw.fatos_uteis)}</div>` : ''}
    ${Array.isArray(sw.dores_provaveis) && sw.dores_provaveis.length ? `<div class="q"><h4>Dores prováveis</h4>${listaHtml(sw.dores_provaveis)}</div>` : ''}
    <div class="swot" style="margin-top:12px">
      ${quad('Forças', sw.swot?.forcas)}${quad('Fraquezas', sw.swot?.fraquezas)}
      ${quad('Oportunidades', sw.swot?.oportunidades)}${quad('Ameaças', sw.swot?.ameacas)}
    </div>
    ${sw.sinal_comercial || sw.gancho ? `<div class="callout" style="margin-top:12px"><b>Sinal comercial:</b> ${esc(sw.sinal_comercial || sw.gancho)}</div>` : ''}
  ` : ''}
  <div class="rod">Gerado pelo Hunter em ${esc(new Date().toLocaleString('pt-BR'))}</div>
</section>`;
}
function abrirImpressaoLeads(leads) {
  const lista = (Array.isArray(leads) ? leads : [leads]).filter(Boolean);
  if (!lista.length) return;
  const titulo = lista.length === 1 ? escHtml(lista[0].fantasia || lista[0].razao || lista[0].cnpj) + ' — Hunter' : `${lista.length} empresas — Hunter`;
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
  if (!w) {
    window.alert('Permita pop-ups para gerar o PDF/impressão.');
    return;
  }
  w.document.write(html);
  w.document.close();
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
  const [filterBusca, setFilterBusca] = useState('');
  const [filterLocal, setFilterLocal] = useState('');
  const [debouncedLocal, setDebouncedLocal] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [buscasOpts, setBuscasOpts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportIds, setExportIds] = useState(null);
  const [tick, setTick] = useState(0); // força recarregar a lista após ações em lote
  const debRef = useRef(null);
  const locRef = useRef(null);
  const PER_PAGE = 20;

  // Lista de buscas pra o filtro (mantém todas, aprovadas ou não).
  useEffect(() => {
    fetch('/api/buscas', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => setBuscasOpts(Array.isArray(d) ? d : d.buscas || [])).catch(() => {});
  }, []);
  const handleQ = e => {
    const v = e.target.value;
    setQ(v);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setDebouncedQ(v);
      setPage(1);
    }, 400);
  };
  const handleLocal = e => {
    const v = e.target.value;
    setFilterLocal(v);
    clearTimeout(locRef.current);
    locRef.current = setTimeout(() => {
      setDebouncedLocal(v);
      setPage(1);
    }, 400);
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
    fetch('/api/leads?' + params, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(d => {
      setLeads(d.leads || []);
      setTotal(d.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [debouncedQ, filterStatus, emailOnly, filterBusca, debouncedLocal, filterScore, page, refreshKey, tick]);
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
    setTick(t => t + 1); // recarrega a lista de fato (setPage no mesmo valor era no-op)
  };

  // Exclusão definitiva (com confirmação): remove os leads da base. Diferente de
  // "Descartar", que só muda o status e mantém a empresa na lista.
  const excluirLote = () => {
    if (!selected.length) return;
    const ok = window.confirm(`Excluir definitivamente ${selected.length} empresa${selected.length !== 1 ? 's' : ''} da lista de leads?\n\n` + `Esta ação não pode ser desfeita. As empresas excluídas ficam bloqueadas e NÃO reaparecem em buscas futuras.`);
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
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: selected,
          acao: 'reenriquecer'
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        window.alert(d.erro || 'Não foi possível re-enriquecer agora.');
        return;
      }
      setSelected([]);
      window.alert(`Re-enriquecimento iniciado para ${d.reenfileirados ?? selected.length} empresa(s). Os dados atualizam em alguns instantes — recarregue a lista ou abra o lead para ver.`);
    } finally {
      setReenriq(false);
    }
  };

  // PDF em lote: busca o detalhe completo de cada lead selecionado e gera uma
  // folha com todos (1 empresa por página), mesma info do PDF individual.
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const gerarPdfLote = async () => {
    if (!selected.length || gerandoPdf) return;
    setGerandoPdf(true);
    try {
      const detalhes = await Promise.all(selected.map(id => fetch('/api/leads/' + id, {
        credentials: 'same-origin'
      }).then(r => r.ok ? r.json() : null).catch(() => null)));
      abrirImpressaoLeads(detalhes.filter(Boolean));
    } finally {
      setGerandoPdf(false);
    }
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
    value: filterBusca,
    onChange: e => {
      setFilterBusca(e.target.value);
      setPage(1);
    },
    style: {
      height: 38,
      padding: '0 10px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      maxWidth: 220,
      background: 'var(--panel)',
      color: filterBusca ? 'var(--text)' : 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos os radares"), buscasOpts.map(b => /*#__PURE__*/React.createElement("option", {
    key: b.id,
    value: b.id
  }, b.nome))), /*#__PURE__*/React.createElement("select", {
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
  }, "Descartado")), /*#__PURE__*/React.createElement("input", {
    value: filterLocal,
    onChange: handleLocal,
    placeholder: "Local (cidade/UF)",
    style: {
      height: 38,
      width: 150,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 12.5,
      fontFamily: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: filterScore,
    onChange: e => {
      setFilterScore(e.target.value);
      setPage(1);
    },
    style: {
      height: 38,
      padding: '0 10px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: filterScore ? 'var(--text)' : 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Score"), /*#__PURE__*/React.createElement("option", {
    value: "90"
  }, "\u2265 90"), /*#__PURE__*/React.createElement("option", {
    value: "75"
  }, "\u2265 75"), /*#__PURE__*/React.createElement("option", {
    value: "60"
  }, "\u2265 60"), /*#__PURE__*/React.createElement("option", {
    value: "40"
  }, "\u2265 40")), /*#__PURE__*/React.createElement("div", {
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
    onClick: gerarPdfLote,
    disabled: gerandoPdf,
    style: selBtnStyle('normal')
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
    w: 14,
    h: 14,
    sw: 1.7
  }), gerandoPdf ? 'Gerando…' : 'Gerar PDF'), /*#__PURE__*/React.createElement("button", {
    onClick: reenriquecerLote,
    disabled: reenriq,
    style: selBtnStyle('normal')
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16",
    w: 14,
    h: 14,
    sw: 1.7
  }), reenriq ? 'Enviando…' : 'Re-enriquecer'), /*#__PURE__*/React.createElement("button", {
    onClick: () => batchAction('aprovar'),
    style: selBtnStyle('normal')
  }, "Aprovar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => batchAction('descartar'),
    style: selBtnStyle('dim')
  }, "Descartar"), /*#__PURE__*/React.createElement("button", {
    onClick: excluirLote,
    style: {
      height: 34,
      padding: '0 12px',
      borderRadius: 8,
      border: `1px solid ${C.red}`,
      background: 'transparent',
      color: C.red,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    color: C.red,
    w: 14,
    h: 14,
    sw: 1.7
  }), "Excluir"), /*#__PURE__*/React.createElement("div", {
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
    }), /*#__PURE__*/React.createElement(ContactCell, {
      leadId: l.id,
      emailVal: l.email_valor,
      phoneVal: l.telefone_valor,
      onSaved: () => setTick(t => t + 1)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(statusColors[l.status] || C.gray)
    }, l.status), l.contato_pendente && /*#__PURE__*/React.createElement("span", {
      title: "Sem WhatsApp/telefone \u2014 n\xE3o enviado ao CRM automaticamente",
      style: {
        ...badgeStyle(C.red),
        whiteSpace: 'nowrap'
      }
    }, "sem contato"), /*#__PURE__*/React.createElement(ForaDoPerfil, {
      leadId: l.id,
      compacto: true,
      marcado: l.contato_status === 'fora_do_perfil',
      onMudou: () => setTick(t => t + 1)
    })));
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
    if (!window.confirm(`Excluir o radar "${b.nome}"?\nOs leads dele serão removidos. As empresas continuam no histórico global.`)) return;
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
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .8fr .8fr .8fr 1fr 40px',
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
  }, /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", null, "Nome"), /*#__PURE__*/React.createElement("div", null, "Status"), /*#__PURE__*/React.createElement("div", null, "Criada por"), /*#__PURE__*/React.createElement("div", null, "Encontr."), /*#__PURE__*/React.createElement("div", null, "Qualif."), /*#__PURE__*/React.createElement("div", null, "CRM"), /*#__PURE__*/React.createElement("div", null, "Atividade"), /*#__PURE__*/React.createElement("div", null)), buscas === null && /*#__PURE__*/React.createElement("div", {
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
  }, "Nenhum radar encontrado."), buscas && buscas.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => onOpen(b.id),
    className: "row-hover",
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .8fr .8fr .8fr 1fr 40px',
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
    title: "Excluir radar",
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

// ── PerfilMedio: mostra o perfil destilado da lista (lookalike) ────────────────
function PerfilMedio({
  perfil
}) {
  const confCor = perfil.confianca === 'alta' ? C.green : perfil.confianca === 'média' ? C.gold : '#F59E0B';
  const cnaeNome = c => (_cnaeCache || []).find(x => x.c === c)?.d || c;
  const barra = (label, freq, extra) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, Math.round(freq * 100), "%", extra || '')), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      borderRadius: 3,
      background: 'var(--panel2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 3,
      width: `${Math.round(freq * 100)}%`,
      background: C.gold
    }
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 18,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: 0
    }
  }, "Perfil m\xE9dio detectado"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      padding: '2px 9px',
      borderRadius: 20,
      color: confCor,
      border: `1px solid ${confCor}`
    }
  }, "confian\xE7a ", perfil.confianca), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, perfil.amostra, " empresas analisadas")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "Atividades (CNAE)"), (perfil.cnaes || []).slice(0, 5).map(x => barra(cnaeNome(x.c), x.freq))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "UF"), (perfil.ufs || []).slice(0, 4).map(x => barra(x.uf, x.freq)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      margin: '12px 0 8px',
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "Porte"), (perfil.portes || []).slice(0, 3).map(x => barra(x.porte, x.freq)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      borderTop: '1px solid var(--border)',
      paddingTop: 14
    }
  }, perfil.capitais?.[0] && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      padding: '4px 10px',
      borderRadius: 7,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--dim)'
    }
  }, "Capital t\xEDpico: ", perfil.capitais[0].faixa), perfil.simples_prop != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      padding: '4px 10px',
      borderRadius: 7,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--dim)'
    }
  }, "Simples: ", Math.round(perfil.simples_prop * 100), "% optantes"), perfil.abertura?.de && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      padding: '4px 10px',
      borderRadius: 7,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--dim)'
    }
  }, "Abertura: ", String(perfil.abertura.de).slice(0, 4), "\u2013", String(perfil.abertura.ate).slice(0, 4))), perfil.diagnostico?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 14,
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: .4
    }
  }, "O que define esta lista"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Sua lista s\xF3 tem compradores, ent\xE3o o Hunter mede o quanto cada caracter\xEDstica \xE9 ", /*#__PURE__*/React.createElement("b", null, "concentrada"), " entre eles e ", /*#__PURE__*/React.createElement("b", null, "desproporcional"), " em rela\xE7\xE3o ao mercado. O que separa comprador de n\xE3o-comprador leva mais pontos no score; o que aparece espalhado pesa pouco."), [...perfil.diagnostico].sort((a, b) => b.peso - a.peso).map(d => {
    const rot = {
      CNAE: 'Atividade (CNAE)',
      UF: 'Estado (UF)',
      PORTE: 'Porte',
      CAPITAL: 'Capital',
      SIMPLES: 'Simples'
    }[d.dim] || d.dim;
    const forca = d.poder >= 0.5 ? 'define bem' : d.poder >= 0.2 ? 'ajuda a definir' : 'quase não define';
    const cor = d.poder >= 0.5 ? C.green : d.poder >= 0.2 ? C.gold : 'var(--faint)';
    return /*#__PURE__*/React.createElement("div", {
      key: d.dim,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--text)',
        width: 130
      }
    }, rot), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        background: 'var(--panel2)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        borderRadius: 3,
        width: `${Math.round(d.peso)}%`,
        background: cor
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: cor,
        width: 104,
        textAlign: 'right'
      }
    }, forca), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: 'var(--faint)',
        width: 52,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, Math.round(d.peso), " pts"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "Esse perfil alimenta a descoberta (busca semelhantes na nossa base) e o Score 1 \u2014 quanto mais parecida com o n\xFAcleo desta lista, maior a nota do lead. O ", /*#__PURE__*/React.createElement("b", null, "corte de score"), " do radar \xE9 o quanto de proximidade voc\xEA exige: 100 \xE9 a c\xF3pia do seu cliente t\xEDpico, e cada caracter\xEDstica fora do padr\xE3o desconta os pontos da tabela acima."));
}

// Joinha pra baixo: marca o lead como "fora do perfil". Além de descartar, vira
// CONTRAEXEMPLO na lista de semelhantes do radar — o motor passa a saber o que
// EVITAR, não só o que procurar.
function ForaDoPerfil({
  leadId,
  marcado,
  onMudou,
  compacto
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const clicar = async e => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/leads/' + leadId + '/fora-do-perfil', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          desfazer: !!marcado
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'erro');
      if (!marcado) {
        setMsg(d.aprendeu ? `Aprendido · ${d.negativos} exemplo(s) do que evitar` : 'Descartado (este radar não usa lista, então não há perfil a corrigir)');
        setTimeout(() => setMsg(null), 4000);
      }
      onMudou && onMudou();
    } catch (_) {
      setMsg('Falhou');
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: clicar,
    disabled: busy,
    title: marcado ? 'Marcado como fora do perfil — clique pra desfazer' : 'Fora do perfil: descarta e ensina o radar a evitar empresas assim',
    style: {
      height: compacto ? 28 : 30,
      width: compacto ? 28 : 30,
      borderRadius: 8,
      cursor: busy ? 'wait' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      border: '1px solid ' + (marcado ? C.red : 'var(--border)'),
      background: marcado ? 'color-mix(in srgb, ' + C.red + ' 14%, transparent)' : 'transparent',
      color: marcado ? C.red : 'var(--faint)'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z",
    w: 15,
    h: 15,
    sw: 1.7,
    color: "currentColor"
  })), msg && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, msg));
}

// ── BuscaDetail ───────────────────────────────────────────────────────────────
function BuscaDetail({
  buscaId,
  onBack,
  onOpenLead,
  onDuplicar
}) {
  const [data, setData] = useState(null);
  const [toggling, setToggling] = useState(false);
  const carregar = () => {
    fetch('/api/buscas/' + buscaId, {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setData).catch(() => {});
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
  const tags = Array.isArray(criterios.chips) && criterios.chips.length ? criterios.chips : Object.entries(criterios).filter(([k]) => !['params', 'cnaes_rotulos', 'texto', 'query', 'proposta_valor'].includes(k)).flatMap(([k, v]) => Array.isArray(v) ? v.map(x => k + ': ' + x) : typeof v === 'object' ? [] : [k + ': ' + v]).filter(Boolean);
  const proposta = criterios.params?.proposta_valor || criterios.proposta_valor || '';
  const rodarDeNovo = async () => {
    setToggling(true);
    await fetch('/api/buscas/' + buscaId, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Ativa'
      })
    }).catch(() => {});
    setToggling(false);
    carregar();
  };
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
  }, "\u2039 Voltar para radares"), /*#__PURE__*/React.createElement("div", {
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
  }, tag)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, (b.status === 'Ativa' || b.status === 'Pausada') && /*#__PURE__*/React.createElement("button", {
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
  }, toggling ? '…' : b.status === 'Ativa' ? 'Pausar' : 'Retomar'), (b.status === 'Esgotada' || b.status === 'Encerrada') && /*#__PURE__*/React.createElement("button", {
    onClick: rodarDeNovo,
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
      opacity: toggling ? .6 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16",
    w: 14,
    h: 14,
    sw: 1.7
  }), toggling ? '…' : 'Rodar de novo'), onDuplicar && /*#__PURE__*/React.createElement("button", {
    onClick: () => onDuplicar(b),
    style: {
      height: 38,
      padding: '0 15px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-2M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    w: 14,
    h: 14,
    sw: 1.7
  }), "Duplicar"))), proposta && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '12px 16px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: '.06em',
      color: 'var(--faint)',
      textTransform: 'uppercase',
      marginBottom: 5
    }
  }, "O que se vende (alimenta o SWOT)"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text)',
      lineHeight: 1.5
    }
  }, proposta)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6,1fr)',
      gap: 12,
      marginBottom: 18
    }
  }, [['Encontrados', fmtNum(b.enc), 'var(--text)'], ['Segmentadas (perfil)', fmtNum((b.qual || 0) + (b.sem_contato || 0)), C.blue], ['Qualificados', fmtNum(b.qual), C.green], ['Sem contato', fmtNum(b.sem_contato), C.red], ['Fora do perfil', fmtNum(b.fora), C.amber], ['Enviados ao CRM', fmtNum(b.crm), C.cyan]].map(([label, val, col]) => /*#__PURE__*/React.createElement("div", {
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
  }, "\xFAltimos 14 dias")), b.producao && b.producao.some(v => v > 0) ? /*#__PURE__*/React.createElement(MiniChart, {
    vals: b.producao,
    color: C.gold
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Sem produ\xE7\xE3o ainda \u2014 aguardando o motor.")), /*#__PURE__*/React.createElement("div", {
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
  }, "\xDAltima atividade: ", timeAgo(b.ultima_ativ), "."))), criterios.params?.perfil && /*#__PURE__*/React.createElement(PerfilMedio, {
    perfil: criterios.params.perfil
  }), /*#__PURE__*/React.createElement("div", {
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
  }, "Leads deste radar")), leads.length === 0 && /*#__PURE__*/React.createElement("div", {
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

// Reverte os filtros de abertura/capital pra a chave do preset na duplicação.
// Prefere a chave salva (abertura_preset/capital_preset); senão, aproxima.
function capitalInicial(p) {
  if (p?.capital_preset) return p.capital_preset;
  const gte = p?.equity_gte ?? null,
    lte = p?.equity_lte ?? null;
  if (gte == null && lte == null) return 'qualquer';
  const m = CAPITAL_OPCOES.find(o => (o.gte ?? null) === gte && (o.lte ?? null) === lte);
  return m ? m.k : 'qualquer';
}
function aberturaInicial(p) {
  if (p?.abertura_preset) return p.abertura_preset;
  const gte = p?.founded_gte,
    lte = p?.founded_lte;
  if (!gte && !lte) return 'qualquer';
  // Aproxima pela distância em meses (datas foram calculadas na criação).
  const mesesAte = iso => {
    try {
      return Math.round((Date.now() - new Date(iso).getTime()) / (30.44 * 864e5));
    } catch {
      return null;
    }
  };
  if (lte && !gte) return '+5a'; // só limite superior antigo = "mais de 5 anos"
  const m = mesesAte(gte);
  if (m == null) return 'qualquer';
  const alvo = [['6m', 6], ['1a', 12], ['2a', 24], ['5a', 60]];
  let melhor = 'qualquer',
    dif = Infinity;
  for (const [k, mm] of alvo) {
    const d = Math.abs(mm - m);
    if (d < dif) {
      dif = d;
      melhor = k;
    }
  }
  return melhor;
}

// Dropdown enxuto pra escolher UMA proposta salva na criação do radar. A gestão
// (criar/editar/excluir as até 5) vive na tela Propostas. `value` = texto da
// variação escolhida; `onChange(texto)` sobe pro NovaBusca.
function PropostaDropdown({
  value,
  onChange,
  inicial
}) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    fetch('/api/propostas', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(rows => {
      const arr = Array.isArray(rows) ? rows : [];
      setLista(arr);
      const alvo = (value || inicial || '').trim();
      if (alvo && !value) {
        const m = arr.find(p => (p.texto || '').trim() === alvo);
        if (m) onChange(m.texto);
      }
    }).catch(() => setLista([]));
  }, []);
  const arr = lista || [];
  const alvo = (value || '').trim();
  const sel = arr.find(p => (p.texto || '').trim() === alvo);
  const selId = sel ? String(sel.id) : '';
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "O que voc\xEA vende \u2014 proposta de valor ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(alimenta o agente SWOT)")), lista === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : arr.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      padding: '11px 12px',
      borderRadius: 10,
      border: '1px dashed var(--border)',
      background: 'var(--panel2)',
      lineHeight: 1.5
    }
  }, "Nenhuma varia\xE7\xE3o salva ainda. Cadastre suas propostas no menu ", /*#__PURE__*/React.createElement("b", null, "Propostas"), " e volte aqui pra escolher.") : /*#__PURE__*/React.createElement("select", {
    value: selId,
    onChange: e => {
      const p = arr.find(x => String(x.id) === e.target.value);
      onChange(p ? p.texto : '');
    },
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
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Nenhuma \u2014 o agente usa s\xF3 CNAE + site"), arr.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: String(p.id)
  }, p.rotulo || 'Variação — ' + (p.texto || '').slice(0, 45)))), sel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--dim)',
      lineHeight: 1.5,
      marginTop: 8,
      padding: '9px 11px',
      borderRadius: 9,
      background: 'var(--panel2)',
      border: '1px solid var(--border)'
    }
  }, sel.texto), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 8,
      lineHeight: 1.4
    }
  }, "Gerencie suas varia\xE7\xF5es no menu ", /*#__PURE__*/React.createElement("b", null, "Propostas"), " \u2014 salve at\xE9 5 e escolha a mais adequada a cada radar."));
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
  const [editNome, setEditNome] = useState(null); // chave da lista em renomeação
  const [editRotulo, setEditRotulo] = useState('');
  const arquivoRef = useRef();
  const carregar = () => {
    fetch('/api/listas', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : []).then(d => setListas(Array.isArray(d) ? d : [])).catch(() => setListas([]));
  };
  useEffect(() => {
    carregar();
  }, []);
  const cnpjs = useMemo(() => {
    const vistos = new Set(),
      out = [];
    for (const m of String(texto).matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) {
      const d = m[0].replace(/\D/g, '');
      if (d.length === 14 && !vistos.has(d)) {
        vistos.add(d);
        out.push(d);
      }
    }
    return out;
  }, [texto]);

  // O endpoint recebe o arquivo em base64 dentro de um JSON (não multipart).
  const importarArquivo = async file => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({
        ok: false,
        txt: 'Arquivo muito grande (máx. 10MB).'
      });
      return;
    }
    setUploadMsg({
      ok: true,
      txt: 'Lendo arquivo…'
    });
    try {
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('falha ao ler'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/cnpjs/extrair', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: file.name,
          base64
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'erro ao extrair');
      const achados = Array.isArray(d.cnpjs) ? d.cnpjs : [];
      if (!achados.length) {
        setUploadMsg({
          ok: false,
          txt: 'Nenhum CNPJ encontrado no arquivo. Se for PDF escaneado (imagem), use um .txt/.csv.'
        });
        return;
      }
      const jaTem = new Set(texto.split(/[\s,;]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length === 14));
      const novos = achados.filter(c => !jaTem.has(c));
      setTexto(prev => (prev.trim() ? prev.trim() + '\n' : '') + novos.join('\n'));
      setUploadMsg({
        ok: true,
        txt: `${achados.length} CNPJ(s) no arquivo · ${novos.length} novo(s) adicionado(s).`
      });
      if (!nome.trim()) setNome(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setUploadMsg({
        ok: false,
        txt: 'Não consegui ler este arquivo. Tente um .txt, .csv ou PDF com texto.'
      });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };
  const criar = async () => {
    if (!nome.trim()) {
      setErro('Dê um nome à lista.');
      return;
    }
    if (cnpjs.length < 3) {
      setErro(`Poucos CNPJs válidos (${cnpjs.length}). O mínimo são 3 — o recomendado é 15+.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch('/api/listas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: nome.trim(),
          cnpjs
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar a lista.');
      setCriando(false);
      setNome('');
      setTexto('');
      setUploadMsg(null);
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };
  const renomear = async l => {
    const novo = editRotulo.trim();
    if (!novo) return;
    const r = await fetch('/api/listas/' + encodeURIComponent(l.nome), {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rotulo: novo
      })
    });
    if (r.ok) {
      setEditNome(null);
      carregar();
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.erro || 'Erro ao renomear.');
    }
  };
  const excluir = async l => {
    if (!window.confirm(`Excluir a lista "${l.rotulo}" e suas ${l.n} empresas?`)) return;
    const r = await fetch('/api/listas/' + encodeURIComponent(l.nome), {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      carregar();
      return;
    }
    if (r.status === 409) {
      if (!window.confirm(`${d.erro}. Excluir mesmo assim? Esses radares param de se re-perfilar.`)) return;
      const r2 = await fetch('/api/listas/' + encodeURIComponent(l.nome) + '?forcar=1', {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (r2.ok) carregar();
      return;
    }
    alert(d.erro || 'Erro ao excluir.');
  };
  const arr = listas || [];
  const conf = n => n < 6 ? ['baixa', '#F59E0B'] : n < 15 ? ['média', C.gold] : ['alta', '#4ADE80'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 16,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      lineHeight: 1.5,
      maxWidth: 560
    }
  }, "Listas de clientes que j\xE1 compraram. O Hunter l\xEA a firmografia dessas empresas e monta o perfil de quem compra de voc\xEA \u2014 depois procura empresas parecidas. A mesma lista serve para v\xE1rios radares (regi\xF5es e cortes diferentes), e quanto maior, mais preciso o perfil."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setCriando(true);
      setErro(null);
    },
    disabled: criando,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: criando ? 'var(--panel2)' : 'var(--gold)',
      color: criando ? 'var(--faint)' : '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: criando ? 'default' : 'pointer',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 5v14M5 12h14",
    w: 15,
    h: 15,
    sw: 1.8
  }), " Nova lista")), criando && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: `1px solid ${C.gold}`,
      borderRadius: 13,
      padding: 18,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 12
    }
  }, "Nova lista"), /*#__PURE__*/React.createElement("input", {
    value: nome,
    onChange: e => setNome(e.target.value),
    autoFocus: true,
    placeholder: "Nome da lista (ex.: Clientes 2025, Compradores linha refrigera\xE7\xE3o)",
    style: {
      width: '100%',
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      marginBottom: 11,
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 12px',
      fontSize: 13,
      fontFamily: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: arquivoRef,
    type: "file",
    accept: ".txt,.csv,.pdf,text/plain,text/csv,application/pdf",
    onChange: e => importarArquivo(e.target.files?.[0]),
    style: {
      display: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => arquivoRef.current?.click(),
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 9,
      border: '1px dashed var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 3v12M7 8l5-5 5 5M5 21h14",
    w: 15,
    h: 15,
    sw: 1.7
  }), "Enviar arquivo (.txt, .csv, .pdf)"), uploadMsg && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: uploadMsg.ok ? 'var(--faint)' : '#F59E0B'
    }
  }, uploadMsg.txt)), /*#__PURE__*/React.createElement("textarea", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    placeholder: "Cole os CNPJs (um por linha ou separados por v\xEDrgula), ou envie um arquivo acima.",
    style: {
      width: '100%',
      minHeight: 110,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: 12,
      fontSize: 13,
      fontFamily: 'inherit',
      lineHeight: 1.6,
      resize: 'vertical'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 9,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: cnpjs.length >= 3 ? 'var(--text)' : '#F59E0B'
    }
  }, cnpjs.length, " CNPJ", cnpjs.length === 1 ? '' : 's', " v\xE1lido", cnpjs.length === 1 ? '' : 's'), cnpjs.length > 0 && (() => {
    const [rot, cor] = conf(cnpjs.length);
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        padding: '2px 9px',
        borderRadius: 20,
        color: cor,
        border: `1px solid ${cor}`
      }
    }, "confian\xE7a do perfil: ", rot);
  })()), erro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#F87171',
      marginTop: 9
    }
  }, erro), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: criar,
    disabled: salvando,
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, salvando ? 'Salvando…' : 'Salvar lista'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setCriando(false);
      setErro(null);
    },
    style: {
      height: 36,
      padding: '0 16px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Cancelar"))), listas === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : arr.length === 0 && !criando ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)',
      padding: '28px 18px',
      textAlign: 'center',
      border: '1px dashed var(--border)',
      borderRadius: 12
    }
  }, "Nenhuma lista ainda. Clique em ", /*#__PURE__*/React.createElement("b", null, "Nova lista"), " pra subir seus clientes.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, arr.map(l => {
    const [rot, cor] = conf(l.n);
    return /*#__PURE__*/React.createElement("div", {
      key: l.nome,
      style: {
        display: 'flex',
        gap: 13,
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--panel)',
        border: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: l.automatica ? 'M21 12a9 9 0 1 1-6.2-8.6M21 3v6h-6' : 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      color: l.automatica ? C.gold : 'var(--faint)',
      w: 18,
      h: 18,
      sw: 1.7,
      extra: {
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, editNome === l.nome ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: editRotulo,
      onChange: e => setEditRotulo(e.target.value),
      autoFocus: true,
      onKeyDown: e => {
        if (e.key === 'Enter') renomear(l);
        if (e.key === 'Escape') setEditNome(null);
      },
      style: {
        flex: 1,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${C.gold}`,
        background: 'var(--panel2)',
        color: 'var(--text)',
        padding: '0 10px',
        fontSize: 13,
        fontFamily: 'inherit'
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => renomear(l),
      style: {
        height: 32,
        padding: '0 12px',
        borderRadius: 8,
        border: 'none',
        background: 'var(--gold)',
        color: '#0E1936',
        fontWeight: 600,
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, "Salvar"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setEditNome(null),
      style: {
        height: 32,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--dim)',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, "Cancelar")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        marginBottom: 3
      }
    }, l.rotulo), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)'
      }
    }, l.n, " empresa", l.n === 1 ? '' : 's', " \xB7 confian\xE7a ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: cor
      }
    }, rot), l.automatica && ' · alimentada pelo CRM automaticamente'))), editNome !== l.nome && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 7,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => {
        setEditNome(l.nome);
        setEditRotulo(l.rotulo);
      },
      title: "Renomear",
      style: {
        height: 32,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--dim)',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, "Renomear"), !l.automatica && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => excluir(l),
      title: "Excluir",
      style: {
        height: 32,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: '#F87171',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, "Excluir")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginTop: 16,
      lineHeight: 1.55
    }
  }, "A lista marcada como ", /*#__PURE__*/React.createElement("b", null, "alimentada pelo CRM"), " cresce sozinha: cada cliente que o CRM marca como convertido entra nela, e os radares ligados a ela refazem o perfil automaticamente. Ela pode ser renomeada, mas n\xE3o exclu\xEDda. Para usar qualquer lista, crie um radar do tipo ", /*#__PURE__*/React.createElement("b", null, "Semelhantes"), " e escolha-a no menu suspenso."));
}

// Tela dedicada: gestão das até 5 propostas de valor (criar / editar / excluir).
function Propostas() {
  const [lista, setLista] = useState(null);
  const [editId, setEditId] = useState(null); // id em edição, 'novo', ou null
  const [rotulo, setRotulo] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const carregar = () => {
    fetch('/api/propostas', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(rows => setLista(Array.isArray(rows) ? rows : [])).catch(() => setLista([]));
  };
  useEffect(() => {
    carregar();
  }, []);
  const abrirNovo = () => {
    setEditId('novo');
    setRotulo('');
    setTexto('');
    setErro(null);
  };
  const abrirEdit = p => {
    setEditId(p.id);
    setRotulo(p.rotulo || '');
    setTexto(p.texto || '');
    setErro(null);
  };
  const salvar = async () => {
    const t = texto.trim();
    if (!t) {
      setErro('Escreva a proposta.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const novo = editId === 'novo';
      const r = await fetch(novo ? '/api/propostas' : '/api/propostas/' + editId, {
        method: novo ? 'POST' : 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rotulo: rotulo.trim(),
          texto: t
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar.');
      setEditId(null);
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };
  const excluir = async p => {
    if (!window.confirm('Excluir a variação "' + (p.rotulo || 'sem rótulo') + '"?')) return;
    const r = await fetch('/api/propostas/' + p.id, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    if (r.ok) carregar();
  };
  const arr = lista || [];
  const cheio = arr.length >= 5;
  const editando = editId != null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 16,
      gap: 12,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      lineHeight: 1.5,
      maxWidth: 560
    }
  }, "Cadastre at\xE9 5 varia\xE7\xF5es de \"o que voc\xEA vende\". Na cria\xE7\xE3o de cada radar voc\xEA escolhe uma \u2014 \xE9 o que o agente SWOT usa pra analisar cada empresa sob a \xF3tica da sua oferta."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: abrirNovo,
    disabled: cheio || editando,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: cheio || editando ? 'var(--panel2)' : 'var(--gold)',
      color: cheio || editando ? 'var(--faint)' : '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: cheio || editando ? 'default' : 'pointer',
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 5v14M5 12h14",
    w: 15,
    h: 15,
    sw: 1.8
  }), " Nova varia\xE7\xE3o")), cheio && !editando && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 12
    }
  }, "Limite de 5 atingido \u2014 exclua uma pra criar outra."), editId === 'novo' && /*#__PURE__*/React.createElement(PropostaForm, {
    rotulo: rotulo,
    setRotulo: setRotulo,
    texto: texto,
    setTexto: setTexto,
    erro: erro,
    salvando: salvando,
    onSalvar: salvar,
    onCancelar: () => setEditId(null),
    titulo: "Nova varia\xE7\xE3o"
  }), lista === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : arr.length === 0 && editId !== 'novo' ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)',
      padding: '28px 18px',
      textAlign: 'center',
      border: '1px dashed var(--border)',
      borderRadius: 12
    }
  }, "Nenhuma varia\xE7\xE3o ainda. Clique em ", /*#__PURE__*/React.createElement("b", null, "Nova varia\xE7\xE3o"), " pra criar a primeira.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, arr.map((p, i) => editId === p.id ? /*#__PURE__*/React.createElement(PropostaForm, {
    key: p.id,
    rotulo: rotulo,
    setRotulo: setRotulo,
    texto: texto,
    setTexto: setTexto,
    erro: erro,
    salvando: salvando,
    onSalvar: salvar,
    onCancelar: () => setEditId(null),
    titulo: "Editar varia\xE7\xE3o"
  }) : /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '14px 16px',
      borderRadius: 12,
      background: 'var(--panel)',
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 3
    }
  }, p.rotulo || 'Variação ' + (i + 1)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)',
      lineHeight: 1.5
    }
  }, p.texto)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => abrirEdit(p),
    title: "Editar",
    disabled: editando,
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: editando ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: editando ? .5 : 1
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    w: 15,
    h: 15,
    sw: 1.7
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => excluir(p),
    title: "Excluir",
    disabled: editando,
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: editando ? 'default' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: editando ? .5 : 1
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
    w: 15,
    h: 15,
    sw: 1.7
  })))))));
}
function PropostaForm({
  rotulo,
  setRotulo,
  texto,
  setTexto,
  erro,
  salvando,
  onSalvar,
  onCancelar,
  titulo
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: 12,
      border: '1px solid var(--gold)',
      background: 'var(--panel)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      marginBottom: 10
    }
  }, titulo), /*#__PURE__*/React.createElement("input", {
    value: rotulo,
    onChange: e => setRotulo(e.target.value),
    placeholder: "R\xF3tulo (opcional) \u2014 ex: Pitch cl\xEDnicas",
    style: {
      width: '100%',
      height: 36,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 10px',
      fontSize: 12.5,
      fontFamily: 'inherit',
      marginBottom: 9
    }
  }), /*#__PURE__*/React.createElement("textarea", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    placeholder: "Ex: software de gest\xE3o de agenda para cl\xEDnicas, que reduz faltas e lota hor\xE1rios ociosos",
    style: {
      width: '100%',
      minHeight: 80,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: 10,
      fontSize: 12.5,
      fontFamily: 'inherit',
      lineHeight: 1.5,
      resize: 'vertical'
    }
  }), erro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#F59E0B',
      marginTop: 6
    }
  }, erro), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSalvar,
    disabled: salvando,
    style: {
      height: 34,
      padding: '0 16px',
      borderRadius: 8,
      border: 'none',
      background: C.gold,
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: salvando ? 'default' : 'pointer',
      opacity: salvando ? .7 : 1
    }
  }, salvando ? 'Salvando…' : 'Salvar'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCancelar,
    style: {
      height: 34,
      padding: '0 14px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Cancelar")));
}

// Fichamento comercial do cliente (só master): calibra o agente SWOT sem mexer
// no treinamento técnico base. Preenchido na reunião de onboarding.
const SWOT_PERGUNTAS = [{
  k: 'icp',
  label: 'Cliente ideal (ICP)',
  ph: 'Que tipo de empresa é o seu melhor cliente? Setor, porte, região, características.'
}, {
  k: 'diferencial',
  label: 'Diferencial competitivo',
  ph: 'O que te diferencia? Por que os clientes fecham com você e não com o concorrente?'
}, {
  k: 'dores',
  label: 'Dores que você resolve',
  ph: 'Quais problemas do cliente o seu produto/serviço resolve na prática?'
}, {
  k: 'processo',
  label: 'Modelo de processo comercial',
  ph: 'Como é o seu processo de vendas? Etapas, ciclo médio, quem decide, quantas reuniões.'
}, {
  k: 'cadencia',
  label: 'Cadência de abordagem',
  ph: 'Como o time aborda? Canais (ligação, e-mail, WhatsApp, social), nº de toques, ritmo.'
}, {
  k: 'gatilhos',
  label: 'Gatilhos de bom timing',
  ph: 'Que sinais indicam que a empresa é uma boa hora pra abordar? (crescimento, contratação, etc.)'
}, {
  k: 'objecoes',
  label: 'Objeções comuns',
  ph: 'Principais objeções que você ouve e como o time costuma contornar.'
}, {
  k: 'desqualificadores',
  label: 'Desqualificadores (mau lead)',
  ph: 'O que torna uma empresa um MAU lead pra você? Quando descartar de cara.'
}, {
  k: 'concorrentes',
  label: 'Concorrentes / alternativas',
  ph: 'Com quem você concorre — incluindo "não fazer nada" ou solução interna do cliente.'
}, {
  k: 'tom',
  label: 'Tom desejado do briefing',
  ph: 'Como você quer o briefing? Mais direto e objetivo, mais consultivo, foco em dados…'
}, {
  k: 'observacoes',
  label: 'Observações adicionais',
  ph: 'Qualquer outra instrução que ajude o agente a entender o seu negócio.'
}];
function AgenteSwot() {
  const [perfil, setPerfil] = useState(null); // null = carregando
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    fetch('/api/config', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(c => setPerfil(c && typeof c.swot_perfil === 'object' && c.swot_perfil || {})).catch(() => setPerfil({}));
  }, []);
  const setCampo = (k, v) => {
    setPerfil(p => ({
      ...(p || {}),
      [k]: v
    }));
    setSalvo(false);
  };
  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      const r = await fetch('/api/config', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          swot_perfil: perfil || {}
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao salvar.');
      }
      setSalvo(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };
  const preenchidos = SWOT_PERGUNTAS.filter(q => String((perfil || {})[q.k] || '').trim()).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderRadius: 12,
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 6
    }
  }, "Treinamento t\xE9cnico (base \u2014 sempre ativo)"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--dim)',
      lineHeight: 1.55
    }
  }, "O agente j\xE1 vem treinado pra extrair fatos concretos de cada empresa (site + firmografia + motivo do match), montar um SWOT sob a \xF3tica da sua venda e entregar dados \xFAteis pro closer \u2014 sem inventar e sem escrever mensagem pronta. Isso \xE9 fixo e garante a qualidade. Abaixo voc\xEA ", /*#__PURE__*/React.createElement("b", null, "personaliza"), " esse agente pro cliente: quanto mais completo o fichamento, mais afiada a an\xE1lise.")), perfil === null ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--faint)'
    }
  }, "Carregando\u2026") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, SWOT_PERGUNTAS.map(q => /*#__PURE__*/React.createElement("div", {
    key: q.k
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12.5,
      fontWeight: 600,
      marginBottom: 6
    }
  }, q.label), /*#__PURE__*/React.createElement("textarea", {
    value: (perfil || {})[q.k] || '',
    onChange: e => setCampo(q.k, e.target.value),
    placeholder: q.ph,
    style: {
      width: '100%',
      minHeight: 64,
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: 11,
      fontSize: 12.5,
      fontFamily: 'inherit',
      lineHeight: 1.5,
      resize: 'vertical'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      position: 'sticky',
      bottom: 0,
      padding: '12px 0',
      background: 'linear-gradient(transparent, var(--bg) 30%)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: salvar,
    disabled: salvando,
    style: {
      height: 40,
      padding: '0 20px',
      borderRadius: 9,
      border: 'none',
      background: C.gold,
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: salvando ? 'default' : 'pointer',
      opacity: salvando ? .7 : 1
    }
  }, salvando ? 'Salvando…' : 'Salvar fichamento'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, preenchidos, "/", SWOT_PERGUNTAS.length, " campos preenchidos"), salvo && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: '#4ADE80'
    }
  }, "\u2713 Salvo \u2014 o agente j\xE1 usa isso nas pr\xF3ximas an\xE1lises."), erro && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: '#F59E0B'
    }
  }, erro))));
}
function NovaBusca({
  onSalvar,
  inicial
}) {
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
  const [cnaeSel, setCnaeSel] = useState(Array.isArray(iniP.cnaes_rotulos) ? iniP.cnaes_rotulos : Array.isArray(iniP.cnaes) ? iniP.cnaes.map(c => ({
    c: String(c),
    d: fmtCnae(c)
  })) : []);
  const [kwText, setKwText] = useState(Array.isArray(iniP.keywords) ? iniP.keywords.join(', ') : '');
  // cnpja | web. Com o modo web desligado, força 'cnpja' — inclusive ao duplicar
  // um radar web antigo, senão o formulário abriria sem os campos de CNAE/UF.
  const [modoDesc, setModoDesc] = useState(DESCOBERTA_WEB_HABILITADA ? iniP.modo_descoberta || 'cnpja' : 'cnpja');
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
  const [uploadMsg, setUploadMsg] = useState(null); // feedback do upload de arquivo
  // Listas de semelhantes salvas (menu Semelhantes). O radar só ESCOLHE uma —
  // criar/renomear/excluir vive na tela dedicada.
  const [listas, setListas] = useState([]);
  const [listaSel, setListaSel] = useState(inicial?.lista || '');
  const arquivoRef = useRef();
  const [iaCarregando, setIaCarregando] = useState(false);
  const [iaSug, setIaSug] = useState(null); // resultados da IA (ou null)
  const [iaErro, setIaErro] = useState(null);
  const nomeRef = useRef();
  const [propostaSel, setPropostaSel] = useState(iniProposta); // texto da variação de proposta escolhida

  // Listas salvas (manuais + a automática do CRM), pra escolher em vez de
  // re-subir o mesmo arquivo a cada radar novo.
  const carregarListas = () => {
    fetch('/api/listas', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : []).then(d => {
      const arr = Array.isArray(d) ? d : [];
      setListas(arr);
      // Uma lista só? já deixa escolhida — não faz sentido obrigar o clique.
      if (arr.length === 1 && !inicial?.lista) setListaSel(arr[0].nome);
    }).catch(() => {});
  };
  useEffect(() => {
    carregarListas();
  }, []);

  // CNPJs válidos (14 dígitos, sem repetição) colados na aba lista/lookalike.
  useEffect(() => {
    fetch('/api/crm/filas', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : {
      filas: []
    }).then(d => {
      setCrmFilas(Array.isArray(d.filas) ? d.filas : []);
      setCrmFilaPadrao(d.padrao != null ? String(d.padrao) : null);
    }).catch(() => {});
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
  const importarArquivo = async file => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({
        ok: false,
        txt: 'Arquivo muito grande (máx. 10MB).'
      });
      return;
    }
    setUploadMsg({
      ok: true,
      txt: 'Lendo arquivo…'
    });
    try {
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('falha ao ler'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/cnpjs/extrair', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: file.name,
          base64
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro ao extrair');
      if (!d.cnpjs?.length) {
        setUploadMsg({
          ok: false,
          txt: 'Nenhum CNPJ encontrado no arquivo. Se for PDF escaneado (imagem), use um .txt/.csv.'
        });
        return;
      }
      // Junta ao textarea sem duplicar com o que já foi digitado.
      const jaTem = new Set(listaCnpj.split(/[\s,;]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length === 14));
      const novos = d.cnpjs.filter(c => !jaTem.has(c));
      setListaCnpj(prev => (prev.trim() ? prev.trim() + '\n' : '') + novos.join('\n'));
      setUploadMsg({
        ok: true,
        txt: `${d.cnpjs.length} CNPJ(s) no arquivo · ${novos.length} novo(s) adicionado(s).`
      });
    } catch (e) {
      setUploadMsg({
        ok: false,
        txt: 'Não consegui ler este arquivo. Tente um .txt, .csv ou PDF com texto.'
      });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  // Palavra-chave no nome/fantasia. Vírgula = OU; dentro de um termo, espaço = E.
  // Removemos conectivos (de, da, e...) pra "Purificador de água" virar E("purificador","água").
  const KW_STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'a', 'o', 'os', 'as', 'em', 'no', 'na', 'ou']);
  const keywords = useMemo(() => kwText.split(/[,;]/).map(t => t.trim().split(/\s+/).filter(w => w && !KW_STOP.has(w.toLowerCase())).join(' ')).filter(Boolean), [kwText]);
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
    // Puxa os padrões da tela de Configurações como valores iniciais.
    fetch('/api/config', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(c => {
      if (c?.corte_padrao != null) setCorte(c.corte_padrao);
      if (c?.descoberta_modo_padrao) setModoDesc(c.descoberta_modo_padrao);
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

  // Busca local por PALAVRAS-CHAVE (token), não substring literal: "loja
  // purificador agua" acha CNAEs que contenham essas palavras, rankeado por
  // quantas casaram. Assim linguagem natural já funciona sem IA na maioria dos casos.
  const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'por', 'com', 'sem', 'que', 'os', 'as', 'um', 'uma', 'the', 'of']);
  const cnaeMatch = useMemo(() => {
    const q = semAcento(cnaeBusca.trim());
    if (q.length < 2) return {
      lista: [],
      coberturaBaixa: false
    };
    const qDig = q.replace(/\D/g, '');
    if (qDig.length >= 3 && qDig.length === q.replace(/\s/g, '').length) {
      // busca por código
      return {
        lista: cnaeData.filter(s => s.c.includes(qDig)).slice(0, 25),
        coberturaBaixa: false
      };
    }
    const tokens = q.split(/\s+/).filter(t => t.length >= 3 && !STOP.has(t));
    if (!tokens.length) return {
      lista: [],
      coberturaBaixa: false
    };
    const scored = [];
    for (const s of cnaeData) {
      const d = semAcento(s.d);
      let hits = 0,
        exatos = 0;
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
      if (hits > 0) scored.push({
        s,
        hits,
        exatos
      });
    }
    if (!scored.length) return {
      lista: [],
      coberturaBaixa: false
    };
    // Só considera quem casou MAIS termos. Antes, um CNAE que batia 1 de 3
    // aparecia lado a lado com um que batia os 3 — daí a lista sem sentido.
    const melhor = Math.max(...scored.map(x => x.hits));
    // Casou menos da METADE dos termos? Então é ruído — o termo comercial não
    // existe na CNAE ("purificador", "pet shop"). Nesse caso NÃO mostramos
    // lista nenhuma: exibir resultado errado é pior que não exibir nada, e a
    // busca por IA é o caminho certo. O limiar de metade evita falso positivo:
    // "clinica veterinaria" acha "Atividades veterinárias" casando 1 de 2, e
    // esse resultado está certo.
    if (melhor * 2 < tokens.length) return {
      lista: [],
      coberturaBaixa: true
    };
    return {
      lista: scored.filter(x => x.hits === melhor).sort((a, b) => b.exatos - a.exatos || a.s.d.length - b.s.d.length).slice(0, 25).map(x => x.s),
      coberturaBaixa: false
    };
  }, [cnaeBusca, cnaeData]);
  const cnaeResultados = cnaeMatch.lista;
  const cnaeCoberturaBaixa = cnaeMatch.coberturaBaixa;
  const addCnae = s => {
    setCnaeSel(prev => prev.find(x => x.c === s.c) ? prev : [...prev, s]);
    setCnaeBusca('');
    setIaSug(null);
    setIaErro(null);
  };
  const removeCnae = c => setCnaeSel(prev => prev.filter(x => x.c !== c));

  // Busca inteligente: manda a frase pro backend, que usa a IA pra mapear em CNAEs reais.
  const buscarComIA = async () => {
    const texto = cnaeBusca.trim();
    if (texto.length < 3) return;
    setIaCarregando(true);
    setIaErro(null);
    setIaSug(null);
    try {
      const r = await fetch('/api/cnae/sugerir', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texto
        })
      });
      const d = await r.json();
      if (d.erro === 'ia_inativa') {
        setIaErro('A busca inteligente não está disponível no momento. Tente palavras-chave mais simples.');
      } else if (!r.ok || d.erro) {
        setIaErro('Não consegui consultar a IA agora. Tente palavras-chave mais simples.');
      } else if (!d.sugestoes?.length) {
        setIaErro('A IA não encontrou CNAE para essa descrição. Tente reformular.');
      } else setIaSug(d.sugestoes);
    } catch (_) {
      setIaErro('Falha de conexão ao buscar com IA.');
    } finally {
      setIaCarregando(false);
    }
  };
  const tipos = [{
    key: 'icp',
    titulo: 'Por perfil (ICP)',
    desc: 'Defina CNAE, UF e porte do cliente ideal.',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 12h.01'
  }, {
    key: 'cnpj',
    titulo: 'Por CNPJ (um ou lista)',
    desc: 'Cole 1 ou mais CNPJs — cada um vira um lead.',
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
      alert('Informe o nome do radar.');
      return;
    }
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
      const ok = window.confirm('Nenhuma atividade, palavra-chave ou município.\n\nO radar vai trazer empresas de TODOS os ramos' + (ufs.length ? ' da(s) UF(s) escolhida(s)' : ' do Brasil') + '. Para mirar o alvo, escolha uma atividade OU use a "palavra-chave no nome" (ex.: purificador, filtro).\n\nContinuar mesmo assim?');
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
      const cap = isWeb ? {} : CAPITAL_OPCOES.find(o => o.k === capital) || {};
      const aberturaLabel = ABERTURA_OPCOES.find(o => o.k === abertura)?.label;
      const capitalLabel = CAPITAL_OPCOES.find(o => o.k === capital)?.label;
      const chips = [...(isWeb ? ['Descoberta: internet'] : []), ...(keywords.length ? [`${isWeb ? 'Busca' : 'Palavra-chave'}: ${keywords.join(', ')}`] : []), ...ufs.map(u => `UF: ${u}`), ...municSel.map(m => `Município: ${m.n}`), ...portes.map(p => `Porte: ${p}`), ...cnaesRot.map(s => `CNAE: ${s.d}`), ...(!isWeb && abertura !== 'qualquer' ? [`Abertura: ${aberturaLabel}`] : []), ...(!isWeb && capital !== 'qualquer' ? [`Capital: ${capitalLabel}`] : [])];
      const propostaValor = (propostaSel || '').trim();
      const criterios = tipo === 'icp' ? {
        chips,
        params: {
          ufs,
          portes,
          cnaes,
          cnaes_rotulos: cnaesRot,
          keywords,
          modo_descoberta: modoDesc,
          municipios_cod: municSel.map(m => m.c),
          municipios_rotulos: municSel,
          founded_gte: fnd.gte || null,
          founded_lte: fnd.lte || null,
          equity_gte: cap.gte ?? null,
          equity_lte: cap.lte ?? null,
          abertura_preset: abertura,
          capital_preset: capital,
          // guarda a chave pra duplicação reverter certinho
          proposta_valor: propostaValor
        },
        proposta_valor: propostaValor
      } : {
        cnpjs: cnpjsParsed,
        proposta_valor: propostaValor
      };

      // Semelhantes: a lista fica GRAVADA e o radar aponta pra ela. Assim ela
      // aparece na próxima vez e o radar re-perfila sozinho quando ela cresce.
      let listaRadar = null;
      if (tipo === 'lookalike') {
        listaRadar = listaSel;
        // Geografia escolhida na mão: onde procurar os semelhantes (a lista diz
        // O QUE procurar). Vazio = usa as UFs onde os clientes da lista estão.
        criterios.geo = {
          ufs,
          municipios_cod: municSel.map(m => m.c),
          municipios_rotulos: municSel
        };
      }
      const r = await fetch('/api/buscas', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome,
          tipo,
          corte_score: corte,
          crm_auto: crmAuto,
          crm_queue_id: crmQueue || null,
          lista: listaRadar,
          criterios
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao criar radar.');
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
        boxShadow: active ? `0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent)` : 'none'
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
  }, DESCOBERTA_WEB_HABILITADA && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Como descobrir as empresas", /*#__PURE__*/React.createElement(InfoTip, {
    text: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("b", null, "Por CNPJ:"), " filtra a base cadastral oficial por atividade, UF e palavra-chave no nome \u2014 econ\xF4mico e direto.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "Pela internet:"), " busca pelo que a empresa anuncia (como um cliente pesquisaria) e depois confirma os dados oficiais \u2014 pega nichos que a classifica\xE7\xE3o padr\xE3o n\xE3o cobre. Tende a ser mais caro.")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['cnpja', 'Por CNPJ'], ['web', 'Pela internet']].map(([k, t]) => {
    const on = modoDesc === k;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      onClick: () => setModoDesc(k),
      style: {
        flex: 1,
        cursor: 'pointer',
        padding: '11px 13px',
        borderRadius: 10,
        textAlign: 'center',
        border: on ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
        background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: on ? 'var(--text)' : 'var(--dim)'
      }
    }, t));
  }))), modoDesc === 'cnpja' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Atividade \u2014 descreva em palavras quem voc\xEA quer", /*#__PURE__*/React.createElement(InfoTip, {
    text: "A descri\xE7\xE3o vira uma atividade automaticamente. Se a busca n\xE3o achar nada parecido, use o bot\xE3o de busca inteligente que aparece logo abaixo do campo."
  })), /*#__PURE__*/React.createElement("input", {
    value: cnaeBusca,
    onChange: e => {
      setCnaeBusca(e.target.value);
      setIaSug(null);
      setIaErro(null);
    },
    onFocus: () => setCnaeFoco(true),
    onBlur: () => setTimeout(() => setCnaeFoco(false), 150),
    onKeyDown: e => {
      if (e.key === 'Enter' && cnaeResultados.length === 0) {
        e.preventDefault();
        buscarComIA();
      }
    },
    placeholder: "Ex: lojas de purificadores de \xE1gua, cl\xEDnicas de fisioterapia, transportadoras\u2026",
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
  }), cnaeFoco && cnaeBusca.trim().length >= 2 && cnaeResultados.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  }, cnaeResultados.map(s => /*#__PURE__*/React.createElement("div", {
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
  }, fmtCnae(s.c))))), cnaeBusca.trim().length >= 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9,
      padding: '11px 13px',
      borderRadius: 10,
      border: '1px dashed var(--border)',
      background: 'var(--panel2)'
    }
  }, !iaSug && !iaErro && !iaCarregando && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: cnaeCoberturaBaixa ? '#F59E0B' : 'var(--dim)'
    }
  }, cnaeCoberturaBaixa
  // Achamos só correspondências fracas e preferimos não
  // listá-las. Diz isso com todas as letras, em vez de um
  // "nenhuma atividade encontrada" que soa como erro.
  ? 'A CNAE não tem uma atividade com esse nome comercial. A IA traduz sua descrição nos códigos certos.' : cnaeResultados.length === 0 ? 'Nenhuma atividade encontrada por palavra. A IA mapeia a descrição para o CNAE certo.' : 'Não é bem isso? Deixe a IA encontrar o CNAE certo a partir da sua descrição.'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: buscarComIA,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      height: 34,
      padding: '0 14px',
      borderRadius: 9,
      border: 'none',
      background: C.gold,
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 3l1.9 5.8L20 10l-5.1 3.7L16.5 20 12 16.3 7.5 20l1.6-6.3L4 10l6.1-1.2z",
    color: "#0E1936",
    w: 15,
    h: 15,
    sw: 1.6
  }), "Buscar com IA")), iaCarregando && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "Consultando a IA\u2026"), iaErro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#F59E0B',
      lineHeight: 1.5
    }
  }, iaErro), iaSug && iaSug.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginBottom: 8
    }
  }, "Sugest\xF5es da IA \u2014 clique para adicionar:"), iaSug.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.c,
    onClick: () => addCnae(s),
    className: "row-hover",
    style: {
      padding: '8px 10px',
      fontSize: 12.5,
      cursor: 'pointer',
      borderRadius: 8,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: C.gold,
      border: `1px solid ${C.gold}`,
      borderRadius: 5,
      padding: '1px 5px',
      marginRight: 7
    }
  }, "IA"), s.d), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtCnae(s.c)))))), cnaeSel.length > 0 && /*#__PURE__*/React.createElement("div", {
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
      background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
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
  }, modoDesc === 'cnpja' ? /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Palavra-chave no nome ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      marginLeft: 4
    }
  }, "(opcional)"), /*#__PURE__*/React.createElement(InfoTip, {
    text: /*#__PURE__*/React.createElement(React.Fragment, null, "Busca no nome/raz\xE3o social da empresa \u2014 use quando o ramo n\xE3o tem uma atividade espec\xEDfica (ex.: purificadores).", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("b", null, "V\xEDrgula = OU"), " (purificador, filtro \u2192 tem um ou outro). ", /*#__PURE__*/React.createElement("b", null, "Espa\xE7o = E"), " (purificador \xE1gua \u2192 tem os dois no nome). Dica: uma palavra espec\xEDfica j\xE1 basta. Pode combinar com atividade/UF.")
  })) : /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "O que buscar na internet", /*#__PURE__*/React.createElement(InfoTip, {
    text: "Escreva como um cliente pesquisaria (ex.: purificadores de \xE1gua). \xC9 o termo da busca \u2014 UF e munic\xEDpio abaixo miram a regi\xE3o. Depois de achar, o sistema confirma os dados oficiais e segue a qualifica\xE7\xE3o normal."
  })), /*#__PURE__*/React.createElement("input", {
    value: kwText,
    onChange: e => setKwText(e.target.value),
    placeholder: modoDesc === 'cnpja' ? 'Ex: purificador, filtro, água — separe por vírgula' : 'Ex: purificadores de água, energia solar, clínicas de estética…',
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
  }), keywords.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 9
    }
  }, keywords.map((k, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '5px 10px',
      borderRadius: 7,
      fontSize: 11.5,
      border: `1px solid ${C.gold}`,
      background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
      color: C.gold
    }
  }, k)))), /*#__PURE__*/React.createElement("div", {
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
      background: ufs.includes(u) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
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
      background: portes.includes(p) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
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
      background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
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
  }, "\xD7"))))), modoDesc === 'cnpja' && /*#__PURE__*/React.createElement("div", {
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
  }, o.label))))), /*#__PURE__*/React.createElement(PropostaDropdown, {
    value: propostaSel,
    onChange: setPropostaSel,
    inicial: iniProposta
  })) : (() => {
    const n = cnpjsParsed.length;
    // Importação direta aceita a partir de 1 CNPJ (consulta grátis na Receita);
    // lookalike precisa de amostra pra traçar o perfil médio.
    const minimo = tipo === 'lookalike' ? MIN_LOOKALIKE : 1;
    const ok = n >= minimo;
    const conf = n < 6 ? 'baixa' : n < 15 ? 'média' : 'alta';
    const confCor = conf === 'alta' ? '#4ADE80' : conf === 'média' ? C.gold : '#F59E0B';
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 18
      }
    }, tipo === 'lookalike' && /*#__PURE__*/React.createElement("div", {
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
    }, "Lista de clientes ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--faint)'
      }
    }, "(quem j\xE1 compra de voc\xEA)")), listas.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--faint)',
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px dashed var(--border)',
        lineHeight: 1.5
      }
    }, "Nenhuma lista cadastrada ainda. Suba seus clientes no menu ", /*#__PURE__*/React.createElement("b", null, "Semelhantes"), " e volte aqui pra escolher.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("select", {
      value: listaSel,
      onChange: e => setListaSel(e.target.value),
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
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Escolha uma lista\u2026"), listas.map(l => /*#__PURE__*/React.createElement("option", {
      key: l.nome,
      value: l.nome
    }, l.rotulo, " \u2014 ", l.n, " empresa", l.n === 1 ? '' : 's', l.automatica ? ' (do CRM)' : ''))), (() => {
      const l = listas.find(x => x.nome === listaSel);
      if (!l) return null;
      const [rot, cor] = l.n < 6 ? ['baixa', '#F59E0B'] : l.n < 15 ? ['média', C.gold] : ['alta', '#4ADE80'];
      return /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11.5,
          color: 'var(--faint)',
          marginTop: 8,
          lineHeight: 1.5
        }
      }, "Confian\xE7a do perfil: ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: cor
        }
      }, rot), " (", l.n, " empresas).", l.automatica && ' Esta lista cresce sozinha a cada conversão recebida do CRM, e o radar refaz o perfil junto.');
    })(), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--faint)',
        marginTop: 8,
        lineHeight: 1.5
      }
    }, "Gerencie suas listas no menu ", /*#__PURE__*/React.createElement("b", null, "Semelhantes"), " \u2014 suba, renomeie e reaproveite em quantos radares quiser."))), tipo !== 'lookalike' && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 4
      }
    }, tipo === 'lookalike' ? 'Empresas desta lista' : 'Cole a lista de CNPJs a importar'), tipo !== 'lookalike' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)',
        marginBottom: 12,
        lineHeight: 1.45
      }
    }, tipo === 'lookalike' ? 'O sistema lê a firmografia dessas empresas (grátis), monta um perfil médio — CNAE, UF, porte, capital — e busca semelhantes na nossa base de empresas ativas. Quanto mais clientes, mais preciso o perfil.' : 'Cada CNPJ vira um lead e passa por todo o pipeline (contato, SWOT, CRM). Não expande para semelhantes.'), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("input", {
      ref: arquivoRef,
      type: "file",
      accept: ".txt,.csv,.pdf,text/plain,text/csv,application/pdf",
      onChange: e => importarArquivo(e.target.files?.[0]),
      style: {
        display: 'none'
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => arquivoRef.current?.click(),
      style: {
        height: 34,
        padding: '0 14px',
        borderRadius: 9,
        border: '1px dashed var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: 12.5,
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: "M12 3v12M7 8l5-5 5 5M5 21h14",
      w: 15,
      h: 15,
      sw: 1.7
    }), "Enviar arquivo (.txt, .csv, .pdf)"), uploadMsg && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: uploadMsg.ok ? 'var(--faint)' : '#F59E0B'
      }
    }, uploadMsg.txt)), /*#__PURE__*/React.createElement("textarea", {
      value: listaCnpj,
      onChange: e => setListaCnpj(e.target.value),
      placeholder: "Cole os CNPJs (um por linha, ou separados por v\xEDrgula), ou envie um arquivo acima. Ex: 12.345.678/0001-90",
      style: {
        width: '100%',
        minHeight: 110,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--panel2)',
        color: 'var(--text)',
        padding: 12,
        fontSize: 13,
        fontFamily: 'inherit',
        lineHeight: 1.6,
        resize: 'vertical'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 9,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: ok ? 'var(--text)' : '#F59E0B'
      }
    }, n, " CNPJ", n === 1 ? '' : 's', " v\xE1lido", n === 1 ? '' : 's'), n > 0 && tipo === 'lookalike' && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        padding: '2px 9px',
        borderRadius: 20,
        color: confCor,
        border: `1px solid ${confCor}`,
        background: 'transparent'
      }
    }, "confian\xE7a do perfil: ", conf), !ok && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: '#F59E0B'
      }
    }, "m\xEDnimo ", minimo, tipo === 'lookalike' ? ' · recomendado 15+' : ''))), tipo === 'lookalike' && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 18,
        borderTop: '1px solid var(--border)',
        paddingTop: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 4
      }
    }, "Onde procurar os semelhantes"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)',
        marginBottom: 12,
        lineHeight: 1.45
      }
    }, "A lista define ", /*#__PURE__*/React.createElement("b", null, "o que"), " procurar (atividade, porte, perfil). Aqui voc\xEA define ", /*#__PURE__*/React.createElement("b", null, "onde"), ". Deixe em branco para procurar nos mesmos estados onde os clientes da lista j\xE1 est\xE3o."), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--dim)',
        marginBottom: 7
      }
    }, "Estados ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--faint)'
      }
    }, "(opcional)")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 16
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
        background: ufs.includes(u) ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'transparent',
        color: ufs.includes(u) ? C.gold : 'var(--dim)'
      }
    }, u))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 12,
        color: 'var(--dim)',
        marginBottom: 7
      }
    }, "Cidades ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--faint)'
      }
    }, "(opcional", ufs.length ? ` — dentro de ${ufs.join('/')}` : '', ")")), /*#__PURE__*/React.createElement("input", {
      value: municBusca,
      onChange: e => setMunicBusca(e.target.value),
      onFocus: () => setMunicFoco(true),
      onBlur: () => setTimeout(() => setMunicFoco(false), 150),
      placeholder: "Ex: Curitiba, Joinville\u2026",
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
    }, "Nenhuma cidade encontrada", ufs.length ? ' nessa(s) UF(s)' : '', ".") : municResultados.map(m => /*#__PURE__*/React.createElement("div", {
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
        background: 'color-mix(in srgb, var(--accent) 13%, transparent)',
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
    }, "\xD7"))))), (ufs.length > 0 || municSel.length > 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--faint)',
        marginTop: 11,
        lineHeight: 1.5
      }
    }, "Como voc\xEA fixou a regi\xE3o, o estado deixa de valer pontos no score (todas as empresas encontradas j\xE1 estar\xE3o a\xED) e esses pontos v\xE3o para atividade, porte e capital \u2014 o que de fato diferencia uma empresa da outra.")), (tipo === 'lookalike' || tipo === 'cnpj') && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 18,
        borderTop: '1px solid var(--border)',
        paddingTop: 16
      }
    }, /*#__PURE__*/React.createElement(PropostaDropdown, {
      value: propostaSel,
      onChange: setPropostaSel,
      inicial: iniProposta
    })));
  })(), tipo === 'icp' && modoDesc === 'cnpja' && cnaeSel.length === 0 && keywords.length === 0 && municSel.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 11,
      padding: '13px 15px',
      marginBottom: 18,
      borderRadius: 12,
      background: 'color-mix(in srgb, var(--amber, #FBBF24) 12%, transparent)',
      border: '1px solid color-mix(in srgb, #FBBF24 45%, transparent)'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    color: "#FBBF24",
    w: 20,
    h: 20,
    sw: 1.7,
    extra: {
      flexShrink: 0,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("b", null, "Crit\xE9rio muito amplo."), " Sem atividade, palavra-chave ou munic\xEDpio, o radar varre ", ufs.length ? `todas as empresas de ${ufs.join('/')}` : 'o Brasil inteiro', " \u2014 isso traz nicho errado e ", /*#__PURE__*/React.createElement("b", null, "consome muito cr\xE9dito"), ". Escolha ao menos uma atividade, palavra-chave ou munic\xEDpio.")), /*#__PURE__*/React.createElement("div", {
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
  }, "Nome do Radar"), /*#__PURE__*/React.createElement("input", {
    ref: nomeRef,
    defaultValue: inicial?.nome ? inicial.nome + ' (cópia)' : '',
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
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("div", {
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
      accentColor: 'var(--accent)',
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
  }, /*#__PURE__*/React.createElement("span", null, "permissivo"), /*#__PURE__*/React.createElement("span", null, "rigoroso")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 8,
      lineHeight: 1.4
    }
  }, "O volume \xE9 controlado por um teto di\xE1rio geral (em Configura\xE7\xF5es), n\xE3o por radar \u2014 o Hunter faz v\xE1rias camadas de garimpo e qualifica\xE7\xE3o, ent\xE3o o limite di\xE1rio j\xE1 basta.")), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      borderTop: '1px solid var(--border)',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Envio ao CRM (webhook)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['manual', 'Manual — envio após triagem'], ['auto', 'Automático — envia ao concluir a análise']].map(([k, label]) => {
    const ativo = k === 'auto' === crmAuto;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      onClick: () => setCrmAuto(k === 'auto'),
      style: {
        flex: 1,
        cursor: 'pointer',
        padding: '11px 13px',
        borderRadius: 10,
        fontSize: 12.5,
        lineHeight: 1.35,
        border: ativo ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
        background: ativo ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
        color: ativo ? 'var(--text)' : 'var(--dim)'
      }
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 7,
      lineHeight: 1.4
    }
  }, "No autom\xE1tico, cada lead aprovado \xE9 enviado ao webhook ap\xF3s o SWOT. No manual, voc\xEA envia pela triagem. Configure a URL em Integra\xE7\xF5es."), crmFilas.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Fila do CRM para os leads deste radar"), /*#__PURE__*/React.createElement("select", {
    value: crmQueue,
    onChange: e => setCrmQueue(e.target.value),
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
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Usar a fila padr\xE3o das Integra\xE7\xF5es", crmFilaPadraoNome ? ` (${crmFilaPadraoNome})` : ''), crmFilas.map(q => /*#__PURE__*/React.createElement("option", {
    key: q.id,
    value: String(q.id)
  }, q.queue))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 7,
      lineHeight: 1.4
    }
  }, "Cada radar pode cair numa fila diferente do CRM. Deixe no padr\xE3o se n\xE3o quiser separar."))))), /*#__PURE__*/React.createElement("div", {
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
  }), saving ? 'Criando radar…' : 'Criar Radar')));
}

// ── Integrações ───────────────────────────────────────────────────────────────
const INTEGRACOES_META = {
  'descoberta|cnpja': {
    nome: 'Descoberta de empresas',
    provedor: 'CNPJá',
    icon: 'M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    editavel: true
  },
  'contato|google': {
    nome: 'Contato comercial (Google Meu Negócio)',
    provedor: 'Places API — telefone/WhatsApp + site → e-mail',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18',
    editavel: true,
    placeholder: 'Colar chave da Places API…'
  },
  'contato|econodata': {
    nome: 'Contato do decisor (premium)',
    provedor: 'Econodata (match por CNPJ) — opcional',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11l-3 3-1.5-1.5',
    editavel: true,
    placeholder: 'Colar x-api-token…'
  },
  'busca_web|tavily': {
    nome: 'Busca na web (enriquecimento)',
    provedor: 'Tavily — acha site/contexto na internet (sem ela: busca grátis)',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18',
    editavel: true,
    placeholder: 'Colar chave da Tavily (tvly-…)…'
  },
  'crm|gk': {
    nome: 'CRM GK SaaS (nativo)',
    provedor: 'Contato + ticket automático na fila',
    icon: 'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z',
    especial: 'gk'
  },
  'crm|webhook': {
    nome: 'CRM via Webhook',
    provedor: 'Qualquer CRM (URL de webhook / n8n)',
    icon: 'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z',
    editavel: true,
    placeholder: 'Colar URL do webhook…',
    temSegredo: true
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
  'ia|openai': {
    nome: 'Inteligência (IA) — agente SWOT',
    provedor: 'OpenAI (gpt-4o-mini)',
    icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17',
    editavel: true,
    temModelo: true,
    modeloPlaceholder: 'modelo (padrão gpt-4o-mini)'
  },
  'ia|openrouter': {
    nome: 'Inteligência (IA) — OpenRouter',
    provedor: 'OpenRouter — preferida quando ativa; sem crédito, cai na OpenAI',
    icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17',
    editavel: true,
    placeholder: 'Colar chave da OpenRouter (sk-or-…)…',
    temModelo: true,
    modeloPlaceholder: 'modelo (ex.: meta-llama/llama-3.3-70b-instruct:free)'
  }
};
const INTEGRACOES_ORDEM = ['descoberta|cnpja', 'contato|google', 'contato|econodata', 'busca_web|tavily', 'ia|openrouter', 'ia|openai', 'crm|gk', 'crm|webhook'];

// Card especial do CRM GK: fluxo em etapas (conexão → empresas → filas → salvar).
function IntegracaoGK({
  row,
  meta,
  onSaved
}) {
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
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ativo: false
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao desconectar.');
      }
      onSaved();
    } catch (e) {
      setErro(e.message);
    } finally {
      setDesconectando(false);
    }
  };
  const conectar = async () => {
    setErro(null);
    setMsg(null);
    setConectando(true);
    try {
      const r = await fetch('/api/integracoes/gk/conectar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backend: backend.trim(),
          token: token.trim()
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao conectar.');
      setEmpresas(d.empresas || []);
      setFilas(d.filas || []);
      if ((d.empresas || []).length === 1) setCompanyId(d.empresas[0].id);
      setMsg('Conexão OK — selecione empresa e fila e salve.');
    } catch (e) {
      setErro(e.message);
    } finally {
      setConectando(false);
    }
  };
  const salvar = async () => {
    if (!backend.trim() || !token.trim()) {
      setErro('Informe Backend e Token.');
      return;
    }
    // A empresa só é exigida quando o token dá acesso a VÁRIAS (aí é preciso
    // escolher qual). Token com escopo de uma única empresa não lista nenhuma —
    // o próprio CRM já sabe a empresa, e exigir a escolha travava o salvamento.
    if (empresas.length > 0 && !companyId) {
      setErro('Selecione a empresa (o token dá acesso a mais de uma).');
      return;
    }
    if (!queueId) {
      setErro('Selecione a fila padrão.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch('/api/integracoes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          categoria: 'crm',
          provedor: 'gk',
          ativo: true,
          key: token.trim(),
          config: {
            backend: backend.trim(),
            companyId: companyId || null,
            queueId,
            status: 'pending'
          }
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao salvar.');
      }
      setToken('');
      onSaved();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };
  const inputStyle = {
    width: '100%',
    height: 38,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--panel2)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 12.5,
    fontFamily: 'inherit'
  };
  const selStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };
  return /*#__PURE__*/React.createElement("div", {
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
      gap: 16,
      marginBottom: 16
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
  }), conectado ? 'conectado' : 'desconectado')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      marginTop: 3
    }
  }, meta.provedor, conectado ? ' · ' + cfg.backend : ''))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--dim)',
      marginBottom: 5
    }
  }, "Backend (URL da API)"), /*#__PURE__*/React.createElement("input", {
    value: backend,
    onChange: e => setBackend(e.target.value),
    placeholder: "https://api.gktechai.info",
    style: inputStyle
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--dim)',
      marginBottom: 5
    }
  }, "Token Bearer ", row?.chave_mascarada && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "\xB7 salvo ", row.chave_mascarada)), /*#__PURE__*/React.createElement("input", {
    value: token,
    onChange: e => setToken(e.target.value),
    placeholder: "API.GKPADRAO.xxxxxxxx",
    style: inputStyle
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: empresas.length || filas.length ? 12 : 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: conectar,
    disabled: conectando,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: conectando ? 'default' : 'pointer',
      opacity: conectando ? .6 : 1
    }
  }, conectando ? 'Conectando…' : 'Conectar e buscar empresas/filas')), filas.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: empresas.length > 0 ? '1fr 1fr' : '1fr',
      gap: 12,
      marginBottom: 12
    }
  }, empresas.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--dim)',
      marginBottom: 5
    }
  }, "Empresa"), /*#__PURE__*/React.createElement("select", {
    value: companyId,
    onChange: e => setCompanyId(e.target.value),
    style: selStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Selecione\u2026"), empresas.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--dim)',
      marginBottom: 5
    }
  }, "Fila padr\xE3o para novos leads"), /*#__PURE__*/React.createElement("select", {
    value: queueId,
    onChange: e => setQueueId(e.target.value),
    style: selStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Selecione\u2026"), filas.map(q => /*#__PURE__*/React.createElement("option", {
    key: q.id,
    value: q.id
  }, q.queue))))), erro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.red,
      marginBottom: 8
    }
  }, erro), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.green,
      marginBottom: 8
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: salvando ? 'default' : 'pointer',
      opacity: salvando ? .6 : 1
    }
  }, salvando ? 'Salvando…' : 'Salvar configuração'), row?.ativo && /*#__PURE__*/React.createElement("button", {
    onClick: desconectar,
    disabled: desconectando,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: desconectando ? 'default' : 'pointer',
      opacity: desconectando ? .6 : 1
    }
  }, desconectando ? 'Desconectando…' : 'Desconectar')));
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
    const segredo = (segredoRefs.current[chave]?.value || '').trim();
    const modelo = (modeloRefs.current[chave]?.value || '').trim();
    const existente = porChave[chave];
    setSalvando(chave);
    try {
      const cfgExtra = {};
      if (segredo) cfgExtra.secret = segredo;
      if (modelo) cfgExtra.modelo = modelo;
      const corpoConfig = Object.keys(cfgExtra).length ? {
        config: {
          ...(existente?.config || {}),
          ...cfgExtra
        }
      } : {};
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
            } : {}),
            ...corpoConfig
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
            key,
            ...corpoConfig
          })
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
    if (meta.especial === 'gk') {
      return /*#__PURE__*/React.createElement(IntegracaoGK, {
        key: chave,
        row: row,
        meta: meta,
        onSaved: carregar
      });
    }
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
    }, meta.provedor, row?.chave_mascarada ? ' · ' + row.chave_mascarada : '', meta.temSegredo ? row?.config?.secret ? ' · segredo configurado' : ' · sem segredo (assinatura desativada)' : '', meta.temModelo && row?.config?.modelo ? ' · modelo: ' + row.config.modelo : '')), meta.editavel ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
      ref: el => chaveRefs.current[chave] = el,
      placeholder: meta.placeholder || 'Colar chave da API…',
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
    }), meta.temSegredo && /*#__PURE__*/React.createElement("input", {
      ref: el => segredoRefs.current[chave] = el,
      placeholder: "Colar segredo (HMAC, opcional)\u2026",
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
    }), meta.temModelo && /*#__PURE__*/React.createElement("input", {
      ref: el => modeloRefs.current[chave] = el,
      defaultValue: row?.config?.modelo || '',
      placeholder: meta.modeloPlaceholder || 'modelo (opcional)',
      style: {
        width: 200,
        height: 38,
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'var(--panel2)',
        color: 'var(--dim)',
        padding: '0 12px',
        fontSize: 12,
        fontFamily: 'inherit'
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
function Usuarios({
  user
}) {
  const [users, setUsers] = useState(null);
  const [erro, setErro] = useState(null);
  const [novaCred, setNovaCred] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const isMaster = !!user?.master;
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
  const toggleMaster = async u => {
    const virar = !u.master;
    if (!window.confirm(virar ? `Tornar ${u.nome} MASTER? Ele passará a ver Integrações, Configurações e Monitoramento (dados sigilosos da Hunter).` : `Remover o MASTER de ${u.nome}? Ele deixa de ver as telas sigilosas.`)) return;
    const r = await fetch('/api/usuarios/' + u.id, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        master: virar
      })
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.erro || 'Erro ao alterar master.');
      return;
    }
    carregar();
  };
  const redefinirSenha = async u => {
    const nova = window.prompt(`Nova senha para ${u.nome} (mín. 6 caracteres).\nEle poderá trocá-la depois no menu do perfil.`);
    if (nova == null) return;
    if (nova.trim().length < 6) {
      window.alert('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    const r = await fetch('/api/usuarios/' + u.id, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        senha: nova.trim()
      })
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.erro || 'Erro ao redefinir senha.');
      return;
    }
    window.alert(`Senha de ${u.nome} redefinida.\n\nE-mail: ${u.email}\nNova senha: ${nova.trim()}\n\nRepasse com segurança — ele pode trocá-la depois.`);
  };
  const cols = '1.7fr 1.3fr 1.2fr 1fr 84px 84px';
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
    }, u.email), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: badgeStyle(papelColors[u.papel] || C.gray)
    }, u.papel), u.master ? /*#__PURE__*/React.createElement("span", {
      onClick: isMaster ? () => toggleMaster(u) : undefined,
      title: isMaster ? 'Login MASTER — clique para remover' : 'Login MASTER da Hunter',
      style: {
        ...badgeStyle(C.gold),
        cursor: isMaster ? 'pointer' : 'default'
      }
    }, "Master") : isMaster ? /*#__PURE__*/React.createElement("span", {
      onClick: () => toggleMaster(u),
      title: "Tornar master",
      style: {
        ...badgeStyle(C.gray),
        cursor: 'pointer',
        opacity: .6
      }
    }, "+ master") : null), /*#__PURE__*/React.createElement("div", {
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
    }, u.ativo ? 'Ativo' : 'Inativo')), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => redefinirSenha(u),
      title: "Redefinir senha",
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
      d: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z"
    }))), /*#__PURE__*/React.createElement("button", {
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
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sementes, setSementes] = useState(null);
  const [rotacionando, setRotacionando] = useState(false);
  const [demo, setDemo] = useState(null);
  const [limpandoDemo, setLimpandoDemo] = useState(false);
  const [base, setBase] = useState(null);
  const [limpandoTudo, setLimpandoTudo] = useState(false);
  const carregarSementes = () => fetch('/api/sementes/status', {
    credentials: 'same-origin'
  }).then(r => r.json()).then(setSementes).catch(() => {});
  const carregarDemo = () => fetch('/api/admin/demo', {
    credentials: 'same-origin'
  }).then(r => r.json()).then(setDemo).catch(() => {});
  const carregarBase = () => fetch('/api/admin/base', {
    credentials: 'same-origin'
  }).then(r => r.json()).then(setBase).catch(() => {});
  useEffect(() => {
    fetch('/api/config', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setCfg).catch(() => setCfg({}));
    carregarSementes();
    carregarDemo();
    carregarBase();
  }, []);
  const limparTudo = async () => {
    const total = (base?.buscas || 0) + (base?.leads || 0);
    if (!window.confirm(`ATENÇÃO: isso apaga TODA a base operacional — ${base?.buscas || 0} radar(es), ${base?.leads || 0} lead(s) e ` + `${base?.empresas || 0} empresa(s) do cache. Mantém usuários, integrações e configurações. NÃO dá pra desfazer.\n\n` + `Digite OK na próxima janela para confirmar.`)) return;
    const conf = window.prompt('Para confirmar a exclusão total, digite: APAGAR TUDO');
    if (conf !== 'APAGAR TUDO') {
      setMsg({
        ok: false,
        txt: 'Exclusão cancelada.'
      });
      return;
    }
    setLimpandoTudo(true);
    try {
      const r = await fetch('/api/admin/limpar-tudo', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao limpar.');
      setMsg({
        ok: true,
        txt: 'Base operacional zerada. O painel agora está limpo.'
      });
      carregarBase();
      carregarDemo();
      carregarSementes();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setLimpandoTudo(false);
    }
  };
  const limparDemo = async () => {
    if (!window.confirm(`Isso vai remover os radares de demonstração e ${demo?.leads || 0} lead(s) que eles geraram ` + `(inclui os leads-exemplo e o que os radares demo descobriram com critério amplo). ` + `As empresas ficam no cache. Não dá pra desfazer. Continuar?`)) return;
    setLimpandoDemo(true);
    try {
      const r = await fetch('/api/admin/limpar-demo', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falha ao limpar.');
      setMsg({
        ok: true,
        txt: `Removidos ${d.buscas_removidas} radar(es) e ${d.leads_removidos} lead(s) de demonstração.`
      });
      carregarDemo();
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setLimpandoDemo(false);
    }
  };
  const rotacionarSecret = async () => {
    setRotacionando(true);
    try {
      const r = await fetch('/api/webhooks/rotacionar-secret', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const d = await r.json();
      if (r.ok) set('webhook_entrada_secret', d.secret);
    } catch (_) {} finally {
      setRotacionando(false);
    }
  };
  const set = (k, v) => {
    setCfg(c => ({
      ...c,
      [k]: v
    }));
    setMsg(null);
  };
  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limite_diario: cfg.limite_diario,
          corte_padrao: cfg.corte_padrao,
          descoberta_modo_padrao: cfg.descoberta_modo_padrao,
          web_paid_lookup_ativo: cfg.web_paid_lookup_ativo,
          web_paid_lookup_limite: cfg.web_paid_lookup_limite,
          ttl_cache_dias: cfg.ttl_cache_dias,
          parada_min: cfg.parada_min,
          janela_inicio: cfg.janela_inicio,
          janela_fim: cfg.janela_fim,
          janela_tz: cfg.janela_tz,
          alerta_email: cfg.alerta_email,
          crm_auto_global: cfg.crm_auto_global,
          crm_lookalike_auto: cfg.crm_lookalike_auto,
          crm_conversao_tags: cfg.crm_conversao_tags
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao salvar (apenas Admin).');
      setCfg(d);
      setMsg({
        ok: true,
        txt: 'Configurações salvas.'
      });
    } catch (e) {
      setMsg({
        ok: false,
        txt: e.message
      });
    } finally {
      setSalvando(false);
    }
  };
  if (!cfg) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 13
    }
  }, "Carregando\u2026");
  const inp = {
    width: '100%',
    height: 38,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--panel2)',
    color: 'var(--text)',
    padding: '0 12px',
    fontSize: 13,
    fontFamily: 'inherit'
  };
  const numField = (label, key, suf) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: cfg[key] ?? '',
    onChange: e => set(key, e.target.value === '' ? '' : +e.target.value),
    style: inp
  }), suf && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 12,
      top: 10,
      fontSize: 12,
      color: 'var(--faint)',
      pointerEvents: 'none'
    }
  }, suf)));
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
  }, "Valores iniciais aplicados a novos radares e ao motor."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 16
    }
  }, numField('Limite diário de leads', 'limite_diario', 'leads/dia'), numField('Corte de score', 'corte_padrao', 'pts'), numField('TTL de cache', 'ttl_cache_dias', 'dias')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "O ", /*#__PURE__*/React.createElement("b", null, "limite di\xE1rio"), " \xE9 o teto de leads novos que o motor capta por dia somando todos os radares \u2014 protege o or\xE7amento. Cada lead captado consome uma vaga ", /*#__PURE__*/React.createElement("b", null, "na hora em que nasce"), ": se ele for descartado depois (por exemplo, quando o enriquecimento n\xE3o acha telefone), a vaga ", /*#__PURE__*/React.createElement("b", null, "n\xE3o"), " volta \u2014 a consulta paga j\xE1 foi feita. Ao atingir o teto, a capta\xE7\xE3o pausa e retoma no dia seguinte. 0 = sem teto."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 16,
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Hor\xE1rio de funcionamento ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(o motor s\xF3 capta dentro da janela)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: cfg.janela_inicio ?? 0,
    onChange: e => set('janela_inicio', +e.target.value),
    style: {
      ...inp,
      width: 'auto',
      minWidth: 100
    }
  }, Array.from({
    length: 24
  }, (_, h) => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }, String(h).padStart(2, '0'), ":00"))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "at\xE9"), /*#__PURE__*/React.createElement("select", {
    value: cfg.janela_fim ?? 24,
    onChange: e => set('janela_fim', +e.target.value),
    style: {
      ...inp,
      width: 'auto',
      minWidth: 100
    }
  }, Array.from({
    length: 24
  }, (_, i) => i + 1).map(h => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }, String(h).padStart(2, '0'), ":00"))), /*#__PURE__*/React.createElement("select", {
    value: cfg.janela_tz || 'America/Sao_Paulo',
    onChange: e => set('janela_tz', e.target.value),
    style: {
      ...inp,
      width: 'auto',
      minWidth: 170
    }
  }, [['America/Sao_Paulo', 'Brasília (GMT-3)'], ['America/Manaus', 'Manaus (GMT-4)'], ['America/Cuiaba', 'Cuiabá (GMT-4)'], ['America/Campo_Grande', 'Campo Grande (GMT-4)'], ['America/Belem', 'Belém (GMT-3)'], ['America/Fortaleza', 'Fortaleza (GMT-3)'], ['America/Recife', 'Recife (GMT-3)'], ['America/Bahia', 'Salvador (GMT-3)'], ['America/Porto_Velho', 'Porto Velho (GMT-4)'], ['America/Boa_Vista', 'Boa Vista (GMT-4)'], ['America/Rio_Branco', 'Rio Branco (GMT-5)'], ['America/Noronha', 'F. de Noronha (GMT-2)'], ['UTC', 'UTC (GMT-0)']].map(([v, t]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, t)))), (() => {
    const ini = cfg.janela_inicio ?? 0,
      fim = cfg.janela_fim ?? 24;
    const horas = ini === 0 && fim >= 24 ? 24 : fim > ini ? fim - ini : 24 - ini + fim;
    const lim = +cfg.limite_diario || 0;
    const porHora = lim ? Math.max(1, Math.ceil(lim / horas)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--faint)',
        marginTop: 10,
        lineHeight: 1.5
      }
    }, ini === 0 && fim >= 24 ? /*#__PURE__*/React.createElement(React.Fragment, null, "O motor est\xE1 trabalhando ", /*#__PURE__*/React.createElement("b", null, "24 horas por dia"), ". Defina uma janela pra concentrar a capta\xE7\xE3o no hor\xE1rio comercial.") : /*#__PURE__*/React.createElement(React.Fragment, null, "O motor trabalha ", /*#__PURE__*/React.createElement("b", null, horas, "h por dia"), " (", String(ini).padStart(2, '0'), ":00 \xE0s ", String(fim).padStart(2, '0'), ":00", fim <= ini ? ' do dia seguinte' : '', ") e fica parado fora desse per\xEDodo."), lim > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " O teto de ", lim, " leads/dia \xE9 dividido pelas horas da janela: ", /*#__PURE__*/React.createElement("b", null, "~", porHora, " leads por hora"), ". Sobra de um dia n\xE3o acumula pro dia seguinte."));
  })()), DESCOBERTA_WEB_HABILITADA && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 16,
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Modo de descoberta padr\xE3o ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(cada radar pode trocar)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['cnpja', 'Por CNPJ', 'econômico'], ['web', 'Pela internet', 'pega nichos, mais caro']].map(([k, t, d]) => {
    const on = (cfg.descoberta_modo_padrao || 'cnpja') === k;
    return /*#__PURE__*/React.createElement("div", {
      key: k,
      onClick: () => set('descoberta_modo_padrao', k),
      style: {
        flex: 1,
        cursor: 'pointer',
        padding: '11px 13px',
        borderRadius: 10,
        border: on ? `1.5px solid ${C.gold}` : '1.5px solid var(--border)',
        background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: on ? 'var(--text)' : 'var(--dim)'
      }
    }, t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--faint)',
        marginTop: 2
      }
    }, d));
  }))), DESCOBERTA_WEB_HABILITADA && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      marginTop: 16,
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Confirma\xE7\xE3o paga na descoberta pela internet"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      margin: '0 0 12px',
      lineHeight: 1.5
    }
  }, "Quando o site da empresa n\xE3o traz o CNPJ, confirmar o cadastro custa 1 consulta paga por empresa \u2014 bem mais caro que o modo Por CNPJ (~1 cr\xE9dito a cada 100 empresas). Controle esse gasto aqui. Ao atingir o limite, o motor para de confirmar por essa via e segue s\xF3 com o que acha de gra\xE7a no pr\xF3prio site \u2014 tamb\xE9m dividido por hora, igual ao limite di\xE1rio de leads."), /*#__PURE__*/React.createElement("div", {
    onClick: () => set('web_paid_lookup_ativo', !cfg.web_paid_lookup_ativo),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      cursor: 'pointer',
      marginBottom: 14,
      background: 'var(--panel2)',
      border: '1px solid ' + (cfg.web_paid_lookup_ativo ? C.gold : 'var(--border)'),
      borderRadius: 11,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 24,
      borderRadius: 12,
      flexShrink: 0,
      position: 'relative',
      background: cfg.web_paid_lookup_ativo ? C.gold : 'var(--border)',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 2,
      left: cfg.web_paid_lookup_ativo ? 20 : 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .15s'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500
    }
  }, cfg.web_paid_lookup_ativo ? 'Confirmação paga ativada' : 'Confirmação paga desativada — só usa o CNPJ do site (grátis)')), cfg.web_paid_lookup_ativo && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 220
    }
  }, numField('Limite diário de confirmações pagas', 'web_paid_lookup_limite', 'empresas/dia')))), /*#__PURE__*/React.createElement("div", {
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
  }, "Automa\xE7\xE3o de envio ao CRM"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 16px'
    }
  }, "Envia ao CRM conectado, automaticamente, os leads que passaram por todo o processo (captados, limpos, pontuados e analisados)."), /*#__PURE__*/React.createElement("div", {
    onClick: () => set('crm_auto_global', !cfg.crm_auto_global),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      cursor: 'pointer',
      background: 'var(--panel2)',
      border: '1px solid ' + (cfg.crm_auto_global ? C.gold : 'var(--border)'),
      borderRadius: 11,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 24,
      borderRadius: 12,
      flexShrink: 0,
      position: 'relative',
      background: cfg.crm_auto_global ? C.gold : 'var(--border)',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 2,
      left: cfg.crm_auto_global ? 20 : 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .15s'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 500
    }
  }, cfg.crm_auto_global ? 'Envio automático ativado' : 'Envio automático desativado'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      marginTop: 2
    }
  }, cfg.crm_auto_global ? 'Cada lead pronto é enviado ao CRM sem intervenção.' : 'Os leads ficam para envio manual (botão "Enviar ao CRM" na triagem).'))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)',
      marginTop: 10,
      lineHeight: 1.4
    }
  }, "Vale para todos os radares. Cada radar tamb\xE9m pode for\xE7ar o envio autom\xE1tico na sua pr\xF3pria configura\xE7\xE3o.")), /*#__PURE__*/React.createElement("div", {
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
  }, "Aprendizado com o CRM (lista de semelhantes)"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 16px',
      lineHeight: 1.5
    }
  }, "Quando o closer marca um lead como fechado/comprou/qualificado no CRM, ele avisa o Hunter e esse CNPJ entra na lista de semelhantes. O motor re-tra\xE7a o perfil m\xE9dio e passa a buscar mais empresas parecidas com quem realmente compra \u2014 o sistema fica mais preciso sozinho."), /*#__PURE__*/React.createElement("div", {
    onClick: () => set('crm_lookalike_auto', !cfg.crm_lookalike_auto),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      cursor: 'pointer',
      background: 'var(--panel2)',
      border: '1px solid ' + (cfg.crm_lookalike_auto ? C.gold : 'var(--border)'),
      borderRadius: 11,
      padding: '14px 16px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 24,
      borderRadius: 12,
      flexShrink: 0,
      position: 'relative',
      background: cfg.crm_lookalike_auto ? C.gold : 'var(--border)',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 2,
      left: cfg.crm_lookalike_auto ? 20 : 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left .15s'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 500
    }
  }, cfg.crm_lookalike_auto ? 'Radar "Semelhantes — clientes do CRM" ativo' : 'Aprendizado automático desativado'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      marginTop: 2
    }
  }, cfg.crm_lookalike_auto ? 'A cada conversão recebida, o Hunter cria/atualiza um radar lookalike com esses clientes.' : 'As conversões são guardadas, mas não geram radar automático.'))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Tags que contam como convers\xE3o ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(separadas por v\xEDrgula)")), /*#__PURE__*/React.createElement("input", {
    value: Array.isArray(cfg.crm_conversao_tags) ? cfg.crm_conversao_tags.join(', ') : cfg.crm_conversao_tags || '',
    onChange: e => set('crm_conversao_tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean)),
    placeholder: "fechado, comprou, cliente, qualificado, won",
    style: {
      ...inp,
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "URL do webhook ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(configure no seu CRM para chamar no evento de convers\xE3o)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    readOnly: true,
    value: (typeof window !== 'undefined' ? window.location.origin : '') + '/api/webhooks/crm/conversao',
    onFocus: e => e.target.select(),
    style: {
      ...inp,
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12
    }
  })), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Segredo ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "(envie no header ", /*#__PURE__*/React.createElement("code", null, "x-hunter-token"), ")")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    readOnly: true,
    value: cfg.webhook_entrada_secret || '— ainda não gerado —',
    onFocus: e => e.target.select(),
    style: {
      ...inp,
      fontFamily: 'ui-monospace, monospace',
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: rotacionarSecret,
    disabled: rotacionando,
    style: {
      height: 38,
      padding: '0 14px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, rotacionando ? '…' : cfg.webhook_entrada_secret ? 'Rotacionar' : 'Gerar')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      padding: '12px 14px',
      background: 'var(--panel2)',
      borderRadius: 10,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 600,
      color: C.gold,
      fontVariantNumeric: 'tabular-nums'
    }
  }, sementes?.total ?? 0), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      lineHeight: 1.4
    }
  }, "clientes j\xE1 na lista de semelhantes", sementes?.busca ? ` · radar ${sementes.busca.status}` : '', ".", sementes?.total > 0 && sementes?.ultimas?.[0] && ` Último: ${String(sementes.ultimas[0].cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}.`)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      marginTop: 10,
      lineHeight: 1.5
    }
  }, "No ", /*#__PURE__*/React.createElement("b", null, "GK SaaS"), ", aponte o webhook de sa\xEDda (evento de mudan\xE7a de tag/etapa) para a URL acima. O Hunter detecta o CNPJ e a tag em qualquer lugar do payload \u2014 n\xE3o precisa de formato fixo. Se o CRM n\xE3o deixar adicionar o header, mande o segredo na pr\xF3pria URL: ", /*#__PURE__*/React.createElement("code", null, "\u2026/conversao?token=SEGREDO"), ".")), /*#__PURE__*/React.createElement("div", {
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
  }, "Quando considerar um radar parado, e para quem avisar."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, numField('Parada considerada após', 'parada_min', 'min'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Destinat\xE1rio dos alertas"), /*#__PURE__*/React.createElement("input", {
    value: cfg.alerta_email || '',
    onChange: e => set('alerta_email', e.target.value),
    placeholder: "ops@empresa.com.br",
    style: inp
  })))), demo && (demo.buscas > 0 || demo.leads > 0) && /*#__PURE__*/React.createElement("div", {
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
  }, "Manuten\xE7\xE3o \u2014 dados de demonstra\xE7\xE3o"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 16px',
      lineHeight: 1.5
    }
  }, "Detectei ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text)'
    }
  }, demo.buscas, " radar(es)"), " de demonstra\xE7\xE3o e", ' ', /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text)'
    }
  }, demo.leads, " lead(s)"), " gerados por eles (dados de exemplo do primeiro boot + o que esses radares descobriram com crit\xE9rio amplo). Remova para o painel refletir s\xF3 o seu trabalho real. As empresas ficam no cache (gr\xE1tis)."), /*#__PURE__*/React.createElement("button", {
    onClick: limparDemo,
    disabled: limpandoDemo,
    style: {
      height: 40,
      padding: '0 18px',
      borderRadius: 10,
      border: '1px solid ' + C.red,
      background: 'transparent',
      color: C.red,
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: limpandoDemo ? 'default' : 'pointer',
      opacity: limpandoDemo ? .6 : 1
    }
  }, limpandoDemo ? 'Removendo…' : 'Limpar dados de demonstração')), base && (base.buscas > 0 || base.leads > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid color-mix(in srgb, ' + C.red + ' 40%, var(--border))',
      borderRadius: 14,
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      margin: '0 0 4px',
      color: C.red
    }
  }, "Zona de perigo \u2014 apagar tudo"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 16px',
      lineHeight: 1.5
    }
  }, "Remove ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text)'
    }
  }, "toda"), " a base operacional: ", fmtNum(base.buscas), " radar(es),", ' ', fmtNum(base.leads), " lead(s) e ", fmtNum(base.empresas), " empresa(s) do cache. Usu\xE1rios, integra\xE7\xF5es (chaves) e configura\xE7\xF5es s\xE3o mantidos. Use para come\xE7ar do zero. ", /*#__PURE__*/React.createElement("b", null, "Irrevers\xEDvel.")), /*#__PURE__*/React.createElement("button", {
    onClick: limparTudo,
    disabled: limpandoTudo,
    style: {
      height: 40,
      padding: '0 18px',
      borderRadius: 10,
      border: 'none',
      background: C.red,
      color: '#fff',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: limpandoTudo ? 'default' : 'pointer',
      opacity: limpandoTudo ? .6 : 1
    }
  }, limpandoTudo ? 'Apagando…' : 'Zerar toda a base operacional')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
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
      cursor: salvando ? 'default' : 'pointer',
      opacity: salvando ? .6 : 1
    }
  }, salvando ? 'Salvando…' : 'Salvar alterações'), msg && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: msg.ok ? C.green : C.red
    }
  }, msg.txt)));
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
  }, {
    key: 'validacao',
    label: '5. Validação de contato'
  }, {
    key: 'swot',
    label: '6. Agente SWOT (OpenAI)'
  }, {
    key: 'crm',
    label: '7. Envio ao CRM'
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
  }, "Radares ativos"), /*#__PURE__*/React.createElement("span", {
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
  const [editandoContato, setEditandoContato] = useState(false);
  const [contatoForm, setContatoForm] = useState({
    telefone: '',
    email: '',
    website: ''
  });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [erroCarga, setErroCarga] = useState(null);
  useEffect(() => {
    if (!leadId) return;
    setLead(null);
    setDisplayStatus(null);
    setEditandoContato(false);
    setErroCarga(null);
    fetch('/api/leads/' + leadId, {
      credentials: 'same-origin'
    }).then(async r => {
      // Sem checar o r.ok, um 404 virava "lead" = {erro:'não encontrado'} e o
      // painel abria com TODOS os campos vazios — parecia que os dados da
      // Receita tinham sumido, quando na verdade o lead não existia mais.
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(r.status === 404 ? 'Este lead não existe mais (pode ter sido excluído ou descartado pelo motor).' : d.erro || 'Não foi possível carregar o lead.');
      }
      return r.json();
    }).then(l => {
      setLead(l);
      setDisplayStatus(l.status);
      const cv = l.contato_validado || {};
      setContatoForm({
        telefone: cv.telefone || '',
        email: cv.email || '',
        website: cv.website || ''
      });
    }).catch(e => setErroCarga(e.message));
  }, [leadId]);
  const salvarContato = async () => {
    setSalvandoContato(true);
    try {
      const r = await fetch(`/api/leads/${leadId}/contato`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contatoForm)
      });
      const d = await r.json();
      if (r.ok) {
        setLead(l => ({
          ...l,
          contato_validado: d.contato_validado,
          contato_pendente: !d.completo
        }));
        setEditandoContato(false);
        onStatusChange && onStatusChange();
      }
    } catch (_) {} finally {
      setSalvandoContato(false);
    }
  };
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: 'var(--faint)',
        fontSize: 13,
        padding: 30,
        textAlign: 'center'
      }
    }, erroCarga ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text)'
      }
    }, "Lead indispon\xEDvel"), /*#__PURE__*/React.createElement("div", {
      style: {
        lineHeight: 1.5,
        maxWidth: 340
      }
    }, erroCarga), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      style: {
        height: 36,
        padding: '0 18px',
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, "Fechar")) : 'Carregando…'));
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
    k: 'Setor',
    v: l.setor
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
    k: 'Cidade/UF',
    v: [l.cidade, l.uf].filter(Boolean).join('/')
  }, {
    k: 'Natureza jurídica',
    v: l.natureza_juridica
  }, {
    k: 'Optante Simples',
    v: l.opcao_simples == null ? null : l.opcao_simples ? 'Sim' : 'Não'
  }, {
    k: 'Endereço',
    v: l.endereco
  }];

  // Abre a folha de impressão/PDF deste lead (usa o gerador compartilhado).
  const imprimirLead = () => abrirImpressaoLeads([{
    ...l,
    status
  }]);
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
    onClick: imprimirLead,
    title: "Imprimir ou salvar em PDF",
    style: {
      flexShrink: 0,
      height: 32,
      padding: '0 11px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
    w: 15,
    h: 15,
    sw: 1.7
  }), "PDF"), /*#__PURE__*/React.createElement("button", {
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
  }, "Decisor"), l.decisor ? /*#__PURE__*/React.createElement("div", {
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
  }, l.cargo || 'Sócio(a)')), /*#__PURE__*/React.createElement("div", {
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
  })), "Receita Federal")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      lineHeight: 1.5,
      background: 'var(--panel2)',
      border: '1px dashed var(--border)',
      borderRadius: 10,
      padding: '11px 13px'
    }
  }, "Decisor n\xE3o identificado no quadro societ\xE1rio \u2014 comum em MEI e empresas com s\xF3cio \xFAnico pessoa jur\xEDdica. Use o contato comercial validado abaixo, quando houver.")), (() => {
    const cvv = l.contato_validado || {};
    const temContato = !!(cvv.telefone || cvv.email);
    return /*#__PURE__*/React.createElement("section", {
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
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.08em',
        color: temContato ? C.green : C.red,
        textTransform: 'uppercase',
        flex: 1
      }
    }, temContato ? 'Contato do decisor · validado' : 'Contato · pendente'), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditandoContato(v => !v),
      style: {
        height: 26,
        padding: '0 10px',
        borderRadius: 7,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--dim)',
        fontSize: 11.5,
        fontFamily: 'inherit',
        cursor: 'pointer'
      }
    }, editandoContato ? 'Cancelar' : 'Editar')), editandoContato && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 12,
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 11,
        padding: '12px 13px'
      }
    }, [['telefone', 'Telefone / WhatsApp', '(11) 99999-9999'], ['email', 'E-mail', 'contato@empresa.com.br'], ['website', 'Site', 'https://empresa.com.br']].map(([k, lbl, ph]) => /*#__PURE__*/React.createElement("div", {
      key: k
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'block',
        fontSize: 10.5,
        color: 'var(--faint)',
        marginBottom: 3
      }
    }, lbl), /*#__PURE__*/React.createElement("input", {
      value: contatoForm[k],
      onChange: e => setContatoForm(f => ({
        ...f,
        [k]: e.target.value
      })),
      placeholder: ph,
      style: {
        width: '100%',
        height: 34,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        color: 'var(--text)',
        padding: '0 10px',
        fontSize: 12.5,
        fontFamily: 'inherit'
      }
    }))), /*#__PURE__*/React.createElement("button", {
      onClick: salvarContato,
      disabled: salvandoContato,
      style: {
        height: 34,
        borderRadius: 8,
        border: 'none',
        background: 'var(--gold)',
        color: '#0E1936',
        fontWeight: 600,
        fontSize: 12.5,
        fontFamily: 'inherit',
        cursor: 'pointer',
        marginTop: 2
      }
    }, salvandoContato ? 'Salvando…' : 'Salvar contato')), !temContato && !editandoContato && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--faint)',
        lineHeight: 1.5,
        marginBottom: 12
      }
    }, "O enriquecimento n\xE3o achou telefone/e-mail v\xE1lidos. Use \"Editar\" pra inserir manualmente."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, l.contato_validado?.telefone && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'rgba(74,222,128,.08)',
        border: '1px solid rgba(74,222,128,.25)',
        borderRadius: 10,
        padding: '11px 13px'
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z",
      color: C.green,
      w: 16,
      h: 16,
      sw: 1.8
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        flex: 1
      }
    }, l.contato_validado.telefone), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: C.green
      }
    }, "\u2713 validado")), l.contato_validado?.email && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'rgba(74,222,128,.08)',
        border: '1px solid rgba(74,222,128,.25)',
        borderRadius: 10,
        padding: '11px 13px'
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: "M3 5h18v14H3zM3 7l9 6 9-6",
      color: C.green,
      w: 16,
      h: 16,
      sw: 1.8
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        flex: 1,
        wordBreak: 'break-all'
      }
    }, l.contato_validado.email), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: C.green
      }
    }, "\u2713 validado")), l.contato_validado?.website && /*#__PURE__*/React.createElement("a", {
      href: l.contato_validado.website,
      target: "_blank",
      rel: "noopener noreferrer",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '11px 13px',
        textDecoration: 'none'
      }
    }, /*#__PURE__*/React.createElement(Svg, {
      d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18M3 12h18",
      color: "var(--dim)",
      w: 16,
      h: 16,
      sw: 1.8
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        flex: 1,
        color: 'var(--text)',
        wordBreak: 'break-all'
      }
    }, l.contato_validado.website)), l.contato_validado?.resumo_site && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--dim)',
        lineHeight: 1.5,
        background: 'var(--panel2)',
        borderRadius: 10,
        padding: '10px 13px',
        fontStyle: 'italic'
      }
    }, "\"", l.contato_validado.resumo_site, "\"", /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: 'var(--faint)',
        marginTop: 5,
        fontStyle: 'normal'
      }
    }, "Extra\xEDdo do site \u2014 usado como contexto pelo agente SWOT"))));
  })(), contatos.length > 0 && /*#__PURE__*/React.createElement("section", {
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
  }, c.selo || (c.validado ? 'verificado' : 'não verif.')))))), l.swot && /*#__PURE__*/React.createElement("section", {
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
      textTransform: 'uppercase',
      flex: 1
    }
  }, "Briefing SWOT \xB7 IA")), l.swot.resumo && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: 1.6,
      margin: '0 0 14px',
      color: 'var(--text)'
    }
  }, l.swot.resumo), Array.isArray(l.swot.fatos_uteis) && l.swot.fatos_uteis.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'color-mix(in srgb, ' + C.green + ' 9%, transparent)',
      border: '1px solid color-mix(in srgb, ' + C.green + ' 28%, transparent)',
      borderRadius: 11,
      padding: '12px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: C.green,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Fatos \xFAteis pro contato"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: '0 0 0 16px',
      fontSize: 12.5,
      lineHeight: 1.6,
      color: 'var(--text)'
    }
  }, l.swot.fatos_uteis.map((f, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, f)))), Array.isArray(l.swot.dores_provaveis) && l.swot.dores_provaveis.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'color-mix(in srgb, ' + C.amber + ' 9%, transparent)',
      border: '1px solid color-mix(in srgb, ' + C.amber + ' 28%, transparent)',
      borderRadius: 11,
      padding: '12px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: C.amber,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Dores prov\xE1veis"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: '0 0 0 16px',
      fontSize: 12.5,
      lineHeight: 1.6,
      color: 'var(--text)'
    }
  }, l.swot.dores_provaveis.map((d, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 14
    }
  }, [['Forças', l.swot.swot?.forcas, C.green], ['Fraquezas', l.swot.swot?.fraquezas, C.red], ['Oportunidades', l.swot.swot?.oportunidades, C.blue], ['Ameaças', l.swot.swot?.ameacas, C.amber]].map(([titulo, itens, cor]) => /*#__PURE__*/React.createElement("div", {
    key: titulo,
    style: {
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '11px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: cor,
      marginBottom: 6
    }
  }, titulo), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: '0 0 0 15px',
      fontSize: 12,
      lineHeight: 1.5,
      color: 'var(--dim)'
    }
  }, (Array.isArray(itens) ? itens : []).map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, it)), (!itens || !itens.length) && /*#__PURE__*/React.createElement("li", {
    style: {
      color: 'var(--faint)',
      listStyle: 'none',
      marginLeft: -15
    }
  }, "\u2014"))))), (l.swot.sinal_comercial || l.swot.gancho) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(58,142,255,.07)',
      border: '1px solid rgba(58,142,255,.22)',
      borderRadius: 11,
      padding: 14,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: C.blue,
      marginBottom: 5,
      textTransform: 'uppercase',
      letterSpacing: '.06em'
    }
  }, "Sinal comercial"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: 1.55,
      margin: 0,
      color: 'var(--text)'
    }
  }, l.swot.sinal_comercial || l.swot.gancho)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => navigator.clipboard?.writeText([l.swot.resumo, l.swot.fatos_uteis?.length ? 'Fatos úteis:\n- ' + l.swot.fatos_uteis.join('\n- ') : '', l.swot.dores_provaveis?.length ? 'Dores prováveis:\n- ' + l.swot.dores_provaveis.join('\n- ') : '', l.swot.sinal_comercial || l.swot.gancho ? 'Sinal comercial: ' + (l.swot.sinal_comercial || l.swot.gancho) : ''].filter(Boolean).join('\n\n')).catch(() => {}),
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
  }, "Copiar briefing"))), breakdown.length > 0 && /*#__PURE__*/React.createElement("section", {
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
  const [crm, setCrm] = useState(null); // null=carregando

  useEffect(() => {
    fetch('/api/crm/status', {
      credentials: 'same-origin'
    }).then(r => r.json()).then(setCrm).catch(() => setCrm({
      ativo: false
    }));
  }, []);
  const confirmar = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leads/acoes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids,
          acao: 'enviar_crm'
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || 'Erro ao enviar ao CRM.');
      }
      onConfirm();
    } catch (e) {
      alert(e.message || 'Erro ao enviar ao CRM.');
    } finally {
      setLoading(false);
    }
  };
  const semCrm = crm && !crm.ativo;
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
      padding: '0 14px',
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("span", null, crm === null ? 'Carregando…' : semCrm ? 'Nenhum CRM ativo' : crm.nome))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      background: semCrm ? 'rgba(248,113,113,.08)' : 'var(--panel2)',
      border: '1px solid ' + (semCrm ? 'rgba(248,113,113,.25)' : 'var(--border)'),
      borderRadius: 10,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 17,
    h: 17,
    sw: 1.8,
    color: semCrm ? C.red : C.cyan
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 10
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: semCrm ? C.red : 'var(--dim)',
      lineHeight: 1.45
    }
  }, semCrm ? 'Nenhum CRM conectado no momento. Fale com o administrador do sistema.' : crm?.detalhe || 'Os dados do lead serão enviados ao CRM configurado.'))), /*#__PURE__*/React.createElement("div", {
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
    disabled: loading || semCrm || crm === null,
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
      cursor: loading || semCrm || crm === null ? 'default' : 'pointer',
      opacity: loading || semCrm || crm === null ? .6 : 1
    }
  }, loading ? 'Enviando…' : 'Confirmar envio'))));
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('hunter_theme') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });
  const [screen, setScreen] = useState('dashboard');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [crmIds, setCrmIds] = useState(null);
  const [buscaDetailId, setBuscaDetailId] = useState(null);
  const [user, setUser] = useState(null);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);
  const [decisao, setDecisao] = useState(null); // leads aguardando decisão manual
  const [duplicarDe, setDuplicarDe] = useState(null); // busca a duplicar (pré-preenche Nova busca)

  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : null).then(u => {
      if (u) setUser(u);
    }).catch(() => {});
    // Popup do próximo login: leads que acharam só telefone (sem e-mail).
    fetch('/api/leads/decisao-pendente', {
      credentials: 'same-origin'
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.leads?.length) setDecisao(d.leads);
    }).catch(() => {});
  }, []);
  const navTo = s => {
    setScreen(s);
    setOpenLeadId(null);
    setCrmIds(null);
    if (s !== 'nova') setDuplicarDe(null);
  };
  const duplicarBusca = b => {
    setDuplicarDe(b);
    setScreen('nova');
    setOpenLeadId(null);
  };
  // Persiste o tema escolhido: só muda quando o usuário clica (sobrevive ao reload).
  const toggleTheme = () => setTheme(t => {
    const novo = t === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('hunter_theme', novo);
    } catch (_) {}
    return novo;
  });
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
    // Guarda: telas sigilosas (Integrações/Config/Monitoramento) só para o MASTER.
    if (TELAS_MASTER.has(screen) && !user?.master) return /*#__PURE__*/React.createElement(Dashboard, {
      onOpenBusca: openBusca
    });
    if (screen === 'usuarios' && !(user?.master || user?.papel === 'Admin')) return /*#__PURE__*/React.createElement(Dashboard, {
      onOpenBusca: openBusca
    });
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
          onOpenLead: setOpenLeadId,
          onDuplicar: duplicarBusca
        });
      case 'nova':
        return /*#__PURE__*/React.createElement(NovaBusca, {
          key: duplicarDe ? 'dup-' + duplicarDe.id : 'nova',
          inicial: duplicarDe,
          onSalvar: () => navTo('buscas')
        });
      case 'propostas':
        return /*#__PURE__*/React.createElement(Propostas, null);
      case 'semelhantes':
        return /*#__PURE__*/React.createElement(Semelhantes, null);
      case 'agente':
        return /*#__PURE__*/React.createElement(AgenteSwot, null);
      case 'integracoes':
        return /*#__PURE__*/React.createElement(Integracoes, null);
      case 'usuarios':
        return /*#__PURE__*/React.createElement(Usuarios, {
          user: user
        });
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
  }), decisao && decisao.length > 0 && /*#__PURE__*/React.createElement(DecisaoModal, {
    leads: decisao,
    onClose: () => setDecisao(null),
    onAbrirLead: id => {
      setDecisao(null);
      setOpenLeadId(id);
    },
    onResolvido: () => setLeadsRefreshKey(k => k + 1)
  }));
}

// Popup do próximo login: leads que acharam SÓ telefone (sem e-mail). Para cada
// um: enviar mesmo assim ao CRM / achar manualmente / marcar não qualificado.
function DecisaoModal({
  leads,
  onClose,
  onAbrirLead,
  onResolvido
}) {
  const [lista, setLista] = useState(leads);
  const [busy, setBusy] = useState(null);
  const resolver = async (id, acao) => {
    setBusy(id);
    try {
      await fetch(`/api/leads/${id}/decisao`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acao
        })
      });
      onResolvido && onResolvido();
      const resto = lista.filter(l => l.id !== id);
      setLista(resto);
      if (!resto.length) onClose();
    } catch (_) {} finally {
      setBusy(null);
    }
  };
  // O joinha já resolveu o lead pelo seu próprio endpoint — aqui é só tirar da
  // fila do popup (chamar /decisao de novo mandaria uma ação inválida).
  const removerDaLista = id => {
    onResolvido && onResolvido();
    const resto = lista.filter(l => l.id !== id);
    setLista(resto);
    if (!resto.length) onClose();
  };
  const acharManual = async id => {
    try {
      await fetch(`/api/leads/${id}/decisao`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acao: 'manual'
        })
      });
    } catch (_) {}
    onResolvido && onResolvido();
    onAbrirLead(id); // abre o lead pra editar o contato à mão
  };
  const btn = (cor, bg) => ({
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: `1px solid ${cor}`,
    background: bg || 'transparent',
    color: bg ? '#0E1936' : cor,
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 95,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
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
      width: 640,
      maxWidth: '96vw',
      maxHeight: '86vh',
      overflowY: 'auto',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '22px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      margin: 0
    }
  }, "Leads aguardando decis\xE3o"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '4px 0 0',
      lineHeight: 1.5
    }
  }, "Estes leads t\xEAm telefone mas o enriquecimento n\xE3o achou e-mail. Escolha o que fazer com cada um.")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      cursor: 'pointer',
      fontSize: 15
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 14
    }
  }, lista.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      border: '1px solid var(--border)',
      borderRadius: 11,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, l.fantasia || l.razao), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--faint)'
    }
  }, l.cidade, "/", l.uf, " \xB7 tel ", l.telefone || '—', " \xB7 sem e-mail")), /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(C.gold)
  }, "score ", l.score)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    disabled: busy === l.id,
    onClick: () => resolver(l.id, 'enviar'),
    style: btn(C.gold, C.gold)
  }, "Enviar assim mesmo"), /*#__PURE__*/React.createElement("button", {
    disabled: busy === l.id,
    onClick: () => acharManual(l.id),
    style: btn('var(--border)')
  }, "Achar manualmente"), /*#__PURE__*/React.createElement("button", {
    disabled: busy === l.id,
    onClick: () => resolver(l.id, 'descartar'),
    style: btn(C.red)
  }, "N\xE3o qualificado"), /*#__PURE__*/React.createElement(ForaDoPerfil, {
    leadId: l.id,
    marcado: false,
    onMudou: () => removerDaLista(l.id)
  })))))));
}

// Sem isto, QUALQUER erro de render em QUALQUER componente (um bug pontual,
// um dado inesperado da API) derruba a árvore inteira e vira tela branca —
// sem mensagem nenhuma pro usuário. Com o boundary, mostra uma tela de erro
// com botão de recarregar, e imprime o erro completo no console (F12) pra
// dar pra diagnosticar a causa em vez de só "ficou branco".
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      erro: null
    };
  }
  static getDerivedStateFromError(erro) {
    return {
      erro
    };
  }
  componentDidCatch(erro, info) {
    console.error('[Hunter] erro de render capturado:', erro, info?.componentStack);
  }
  render() {
    if (this.state.erro) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E1936',
          color: '#ECEFF7',
          fontFamily: 'Inter,system-ui,sans-serif',
          padding: 24
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          maxWidth: 440,
          textAlign: 'center'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 17,
          fontWeight: 600,
          marginBottom: 10
        }
      }, "Algo deu errado nesta tela"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: '#8A95B4',
          marginBottom: 18,
          lineHeight: 1.5
        }
      }, "A tela travou por um erro inesperado. Recarregar costuma resolver. Se continuar, avise o suporte com um print do console (tecla F12 \u2192 aba Console)."), /*#__PURE__*/React.createElement("button", {
        onClick: () => window.location.reload(),
        style: {
          height: 40,
          padding: '0 20px',
          borderRadius: 9,
          border: 'none',
          background: '#FBE49A',
          color: '#0E1936',
          fontWeight: 600,
          fontSize: 13.5,
          fontFamily: 'inherit',
          cursor: 'pointer'
        }
      }, "Recarregar")));
    }
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(App, null)));
