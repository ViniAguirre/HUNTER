const {
  useState,
  useRef,
  useEffect
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

// ── raw data ──────────────────────────────────────────────────────────────────
const RAW_LEADS = [{
  id: 1,
  fantasia: 'Pulse Marketing',
  razao: 'Pulse Marketing Digital LTDA',
  cnpj: '18.402.551/0001-09',
  setor: 'Agência de publicidade',
  cnae: '7311-4/00',
  porte: 'Médio',
  cidade: 'Curitiba',
  uf: 'PR',
  decisor: 'Ricardo Menezes',
  cargo: 'Sócio-administrador',
  score: 88,
  email: true,
  phone: true,
  status: 'Qualificado',
  situacao: 'Ativa',
  abertura: '12/03/2015',
  capital: 'R$ 240.000',
  endereco: 'R. Comendador Araújo, 499 — Batel'
}, {
  id: 2,
  fantasia: 'NovaTech Sistemas',
  razao: 'NovaTech Soluções em Software LTDA',
  cnpj: '27.918.330/0001-44',
  setor: 'Desenvolvimento de software',
  cnae: '6201-5/01',
  porte: 'Médio',
  cidade: 'São Paulo',
  uf: 'SP',
  decisor: 'Fernanda Lima',
  cargo: 'Diretora de operações',
  score: 81,
  email: true,
  phone: true,
  status: 'Novo',
  situacao: 'Ativa',
  abertura: '04/08/2017',
  capital: 'R$ 500.000',
  endereco: 'Av. Faria Lima, 2232 — Itaim'
}, {
  id: 3,
  fantasia: 'Verde Vale Alimentos',
  razao: 'Verde Vale Indústria de Alimentos S.A.',
  cnpj: '09.221.764/0001-72',
  setor: 'Indústria alimentícia',
  cnae: '1091-1/02',
  porte: 'Grande',
  cidade: 'Goiânia',
  uf: 'GO',
  decisor: 'Marcos Tavares',
  cargo: 'Gerente comercial',
  score: 64,
  email: true,
  phone: false,
  status: 'Novo',
  situacao: 'Ativa',
  abertura: '19/06/2009',
  capital: 'R$ 3.200.000',
  endereco: 'Rod. BR-153, km 12 — Distrito Ind.'
}, {
  id: 4,
  fantasia: 'Atlas Logística',
  razao: 'Atlas Transportes e Logística LTDA',
  cnpj: '31.556.092/0001-18',
  setor: 'Transporte rodoviário',
  cnae: '4930-2/02',
  porte: 'Médio',
  cidade: 'Joinville',
  uf: 'SC',
  decisor: 'Paulo Reis',
  cargo: 'Diretor',
  score: 73,
  email: true,
  phone: true,
  status: 'Qualificado',
  situacao: 'Ativa',
  abertura: '30/01/2013',
  capital: 'R$ 850.000',
  endereco: 'R. Otto Boehm, 1100 — América'
}, {
  id: 5,
  fantasia: 'Clínica Bem Estar',
  razao: 'Bem Estar Serviços Médicos LTDA',
  cnpj: '22.044.871/0001-05',
  setor: 'Atividades de saúde',
  cnae: '8630-5/03',
  porte: 'Pequeno',
  cidade: 'Recife',
  uf: 'PE',
  decisor: 'Dra. Camila Souza',
  cargo: 'Sócia-proprietária',
  score: 46,
  email: false,
  phone: true,
  status: 'Incompleto',
  situacao: 'Ativa',
  abertura: '22/11/2019',
  capital: 'R$ 120.000',
  endereco: 'Av. Boa Viagem, 3344 — Boa Viagem'
}, {
  id: 6,
  fantasia: 'Forte Construções',
  razao: 'Forte Engenharia e Construções LTDA',
  cnpj: '14.880.213/0001-66',
  setor: 'Construção de edifícios',
  cnae: '4120-4/00',
  porte: 'Grande',
  cidade: 'Belo Horizonte',
  uf: 'MG',
  decisor: 'Henrique Dias',
  cargo: 'Diretor de obras',
  score: 79,
  email: true,
  phone: true,
  status: 'Enviado',
  situacao: 'Ativa',
  abertura: '08/05/2008',
  capital: 'R$ 5.000.000',
  endereco: 'Av. do Contorno, 6061 — Funcionários'
}, {
  id: 7,
  fantasia: 'EcoSolar Energia',
  razao: 'EcoSolar Energia Renovável LTDA',
  cnpj: '35.112.908/0001-30',
  setor: 'Geração de energia solar',
  cnae: '3511-5/01',
  porte: 'Médio',
  cidade: 'Fortaleza',
  uf: 'CE',
  decisor: 'Juliana Castro',
  cargo: 'CEO',
  score: 91,
  email: true,
  phone: true,
  status: 'Qualificado',
  situacao: 'Ativa',
  abertura: '15/02/2018',
  capital: 'R$ 1.100.000',
  endereco: 'Av. Washington Soares, 909 — Edson Q.'
}, {
  id: 8,
  fantasia: 'Sabor & Cia',
  razao: 'Sabor e Companhia Restaurantes LTDA',
  cnpj: '40.337.115/0001-92',
  setor: 'Restaurantes',
  cnae: '5611-2/01',
  porte: 'Pequeno',
  cidade: 'Porto Alegre',
  uf: 'RS',
  decisor: 'André Klein',
  cargo: 'Proprietário',
  score: 52,
  email: false,
  phone: true,
  status: 'Novo',
  situacao: 'Ativa',
  abertura: '03/09/2021',
  capital: 'R$ 80.000',
  endereco: 'R. Padre Chagas, 415 — Moinhos'
}, {
  id: 9,
  fantasia: 'Mendes Advocacia',
  razao: 'Mendes & Associados Advocacia',
  cnpj: '19.770.844/0001-51',
  setor: 'Atividades jurídicas',
  cnae: '6911-7/01',
  porte: 'Pequeno',
  cidade: 'Brasília',
  uf: 'DF',
  decisor: 'Dr. Rafael Mendes',
  cargo: 'Sócio-fundador',
  score: 68,
  email: true,
  phone: false,
  status: 'Novo',
  situacao: 'Ativa',
  abertura: '27/07/2014',
  capital: 'R$ 150.000',
  endereco: 'SCS Quadra 9, Bloco C — Asa Sul'
}, {
  id: 10,
  fantasia: 'TechFix Assistência',
  razao: 'TechFix Assistência Técnica LTDA',
  cnpj: '28.901.556/0001-23',
  setor: 'Reparo de equipamentos',
  cnae: '9511-8/00',
  porte: 'Pequeno',
  cidade: 'Campinas',
  uf: 'SP',
  decisor: 'Bruno Almeida',
  cargo: 'Gerente',
  score: 41,
  email: true,
  phone: false,
  status: 'Descartado',
  situacao: 'Ativa',
  abertura: '11/04/2020',
  capital: 'R$ 60.000',
  endereco: 'Av. Norte-Sul, 1500 — Cambuí'
}];
const BUSCAS_RAW = [{
  id: 1,
  nome: 'Agências de marketing — Sul',
  status: 'Ativa',
  criador: 'Vinícius A.',
  ritmo: 120,
  enc: 342,
  qual: 128,
  crm: 64,
  ultima: 'há 2 min',
  health: 'green'
}, {
  id: 2,
  nome: 'Indústrias alimentícias — GO/MG',
  status: 'Ativa',
  criador: 'Marina C.',
  ritmo: 80,
  enc: 198,
  qual: 74,
  crm: 31,
  ultima: 'há 6 min',
  health: 'green'
}, {
  id: 3,
  nome: 'Clínicas médicas — capitais NE',
  status: 'Ativa',
  criador: 'Vinícius A.',
  ritmo: 40,
  enc: 87,
  qual: 29,
  crm: 12,
  ultima: 'há 18 min',
  health: 'amber'
}, {
  id: 4,
  nome: 'Construtoras porte grande — SP',
  status: 'Pausada',
  criador: 'Rafael M.',
  ritmo: 0,
  enc: 412,
  qual: 163,
  crm: 88,
  ultima: 'há 2h',
  health: 'red'
}, {
  id: 5,
  nome: 'Escritórios de advocacia — DF',
  status: 'Esgotada',
  criador: 'Marina C.',
  ritmo: 60,
  enc: 540,
  qual: 201,
  crm: 140,
  ultima: 'há 1 dia',
  health: 'amber'
}, {
  id: 6,
  nome: 'Startups SaaS — semelhantes',
  status: 'Ativa',
  criador: 'Vinícius A.',
  ritmo: 100,
  enc: 233,
  qual: 97,
  crm: 41,
  ultima: 'há 1 min',
  health: 'green'
}, {
  id: 7,
  nome: 'Restaurantes — POA',
  status: 'Encerrada',
  criador: 'Rafael M.',
  ritmo: 0,
  enc: 128,
  qual: 44,
  crm: 20,
  ultima: 'há 1 dia',
  health: 'gray'
}];
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
function leadDetail(l) {
  const dom = (l.fantasia || '').toLowerCase().replace(/[^a-z]/g, '');
  const dd = l.uf === 'SP' ? '11' : l.uf === 'PR' ? '41' : '31';
  const seloVerif = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 7px',
    borderRadius: 6,
    background: C.green + '1f',
    color: C.green,
    whiteSpace: 'nowrap'
  };
  const seloAmber = {
    ...seloVerif,
    background: C.amber + '1f',
    color: C.amber
  };
  const contatos = [];
  if (l.email) contatos.push({
    type: 'email',
    color: C.blue,
    valor: 'contato@' + dom + '.com.br',
    fonte: 'Validação SMTP',
    recencia: 'verificado há 3 dias',
    seloStyle: seloVerif,
    seloLabel: 'verificado'
  });
  if (l.phone) contatos.push({
    type: 'phone',
    color: C.green,
    valor: '+55 (' + dd + ') 9 8842-' + (3000 + l.id),
    fonte: 'Receita / operadora',
    recencia: 'WhatsApp ativo',
    seloStyle: seloVerif,
    seloLabel: 'WhatsApp'
  });
  contatos.push({
    type: 'web',
    color: C.cyan,
    valor: 'www.' + dom + '.com.br',
    fonte: 'Web crawl',
    recencia: l.score > 70 ? 'online' : 'sem resposta',
    seloStyle: l.score > 70 ? seloVerif : seloAmber,
    seloLabel: l.score > 70 ? 'online' : 'não verif.'
  });
  const abordMap = {
    1: 'A Pulse Marketing escala campanhas para clientes de médio porte e provavelmente sente o gargalo de prospecção qualificada. Aborde Ricardo destacando como o Hunter automatiza a entrada de leads B2B sem perder curadoria — alinhado ao posicionamento premium da agência.'
  };
  const abordagem = abordMap[l.id] || `A ${l.fantasia} (${l.setor.toLowerCase()}, porte ${l.porte.toLowerCase()}) é um alvo aderente ao ICP. Aborde ${l.decisor.split(' ')[0]} reforçando ganho de eficiência comercial e dados de contato já validados, reduzindo o tempo até a primeira conversa.`;
  const breakdown = [{
    campo: 'CNPJ ativo na Receita',
    delta: '+30',
    up: true
  }, {
    campo: 'E-mail verificado (SMTP)',
    delta: l.email ? '+22' : '—',
    up: l.email
  }, {
    campo: 'Telefone com WhatsApp',
    delta: l.phone ? '+18' : '—',
    up: l.phone
  }, {
    campo: 'Decisor identificado',
    delta: '+15',
    up: true
  }, {
    campo: 'Aderência ao setor do ICP',
    delta: l.score > 70 ? '+12' : '+6',
    up: true
  }, {
    campo: 'Idade da empresa < 2 anos',
    delta: l.score < 55 ? '−10' : '0',
    up: false
  }].map(b => ({
    ...b,
    color: b.delta === '—' ? C.gray : b.delta.startsWith('−') ? C.red : b.up ? C.green : C.gray
  }));
  const decisorIni = l.decisor.replace(/^(Dr|Dra)\.?\s*/, '').split(' ').slice(0, 2).map(w => w[0]).join('');
  return {
    ...l,
    contatos,
    abordagem,
    breakdown,
    decisorIni
  };
}

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
  onLogout
}) {
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
  }, "VA"), /*#__PURE__*/React.createElement("div", {
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
  }, "Vin\xEDcius Aguirre"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, "Admin \xB7 sair"))));
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
function Topbar({
  screen,
  theme,
  onTheme,
  onNova
}) {
  const [title, sub] = TITLES[screen] || ['', ''];
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
  }), /*#__PURE__*/React.createElement("button", {
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
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 7,
      right: 8,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: C.red,
      border: '1.5px solid var(--panel)'
    }
  })), /*#__PURE__*/React.createElement("div", {
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
  }, "VA")));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({
  onOpenBusca,
  onNova
}) {
  const metrics = [{
    label: 'Buscas ativas',
    value: '7',
    icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
    iColor: C.blue,
    trend: '+2',
    trendSub: 'esta semana',
    tColor: C.green
  }, {
    label: 'Leads encontrados',
    value: '1.284',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v3M12 18v3M3 12h3M18 12h3',
    iColor: C.gold,
    trend: '+312',
    trendSub: 'últimos 7 dias',
    tColor: C.green
  }, {
    label: 'Leads qualificados',
    value: '498',
    icon: 'M20 6L9 17l-5-5',
    iColor: C.green,
    trend: '38,8%',
    trendSub: 'taxa de qualificação',
    tColor: 'var(--dim)'
  }, {
    label: 'Enviados ao CRM',
    value: '176',
    icon: 'M5 12h14M13 5l7 7-7 7',
    iColor: C.cyan,
    trend: '+24',
    trendSub: 'hoje',
    tColor: C.green
  }];
  const buscasAtivas = [{
    id: 1,
    nome: 'Agências de marketing — Sul',
    ritmo: 120,
    encontrados: 342,
    health: 'green'
  }, {
    id: 2,
    nome: 'Indústrias alimentícias — GO/MG',
    ritmo: 80,
    encontrados: 198,
    health: 'green'
  }, {
    id: 3,
    nome: 'Clínicas médicas — capitais NE',
    ritmo: 40,
    encontrados: 87,
    health: 'amber'
  }, {
    id: 4,
    nome: 'Construtoras porte grande — SP',
    ritmo: 0,
    encontrados: 412,
    health: 'red'
  }];
  const healthLabel = {
    green: 'produzindo',
    amber: 'ritmo lento',
    red: 'parada'
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
  const atividade = RAW_LEADS.slice(0, 5).map(l => ({
    empresa: l.fantasia,
    cidade: l.cidade + '/' + l.uf,
    tempo: 'há ' + l.id * 3 + ' min',
    score: l.score
  }));
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
  }, /*#__PURE__*/React.createElement("span", null, m.trend), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, m.trendSub))))), /*#__PURE__*/React.createElement("div", {
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
  }, "Ver todas")), buscasAtivas.map(b => /*#__PURE__*/React.createElement("div", {
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
  }, b.ritmo, " leads/h \xB7 ", healthLabel[b.health])), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, b.encontrados), /*#__PURE__*/React.createElement("div", {
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
  }, a.empresa), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--faint)'
    }
  }, a.cidade, " \xB7 ", a.tempo)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: scoreColor(a.score)
    }
  }, a.score)))))));
}

// ── Leads ─────────────────────────────────────────────────────────────────────
function Leads({
  selected,
  onSelect,
  onToggleAll,
  onClearSel,
  onOpenLead,
  onOpenCrm,
  onOpenExport,
  emailOnly,
  onToggleEmailOnly
}) {
  const allSel = selected.length === RAW_LEADS.length && selected.length > 0;
  const filtered = emailOnly ? RAW_LEADS.filter(l => l.email) : RAW_LEADS;
  const filters = ['Status', 'Score', 'Região', 'Busca'];
  const emailToggleStyle = {
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
  };
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
  })), filters.map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    style: {
      height: 38,
      padding: '0 13px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, f, /*#__PURE__*/React.createElement(Svg, {
    d: "M6 9l6 6 6-6",
    w: 13,
    h: 13,
    sw: 2
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleEmailOnly,
    style: emailToggleStyle
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
  }, selected.length, " selecionados"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 20,
      background: 'var(--border)'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenCrm,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      height: 34,
      padding: '0 14px',
      borderRadius: 8,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M5 12h14M13 5l7 7-7 7",
    color: "#0E1936",
    w: 14,
    h: 14,
    sw: 2
  }), "Enviar ao CRM"), /*#__PURE__*/React.createElement("button", {
    onClick: onOpenExport,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      height: 34,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Exportar CSV"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 34,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Aprovar"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 34,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Descartar"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClearSel,
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
    onClick: onToggleAll,
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: allSel
  })), /*#__PURE__*/React.createElement("div", null, "Empresa"), /*#__PURE__*/React.createElement("div", null, "Setor \xB7 porte"), /*#__PURE__*/React.createElement("div", null, "Local"), /*#__PURE__*/React.createElement("div", null, "Decisor"), /*#__PURE__*/React.createElement("div", null, "Score"), /*#__PURE__*/React.createElement("div", null, "Contato"), /*#__PURE__*/React.createElement("div", null, "Status")), filtered.map(l => {
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
        onSelect(l.id);
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
      email: l.email,
      phone: l.phone
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
  }, /*#__PURE__*/React.createElement("span", null, "Mostrando ", filtered.length, " de 1.284 leads"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, ['‹', '›'].map(ch => /*#__PURE__*/React.createElement("button", {
    key: ch,
    style: {
      height: 30,
      width: 30,
      borderRadius: 7,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      cursor: 'pointer'
    }
  }, ch)))));
}

// ── Buscas ────────────────────────────────────────────────────────────────────
function Buscas({
  onOpen
}) {
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
  })), ['Status', 'Criador'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    style: {
      height: 38,
      padding: '0 13px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel)',
      color: 'var(--dim)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, f))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr',
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
  }, /*#__PURE__*/React.createElement("div", null), /*#__PURE__*/React.createElement("div", null, "Nome"), /*#__PURE__*/React.createElement("div", null, "Status"), /*#__PURE__*/React.createElement("div", null, "Criada por"), /*#__PURE__*/React.createElement("div", null, "Ritmo"), /*#__PURE__*/React.createElement("div", null, "Encontr."), /*#__PURE__*/React.createElement("div", null, "Qualif."), /*#__PURE__*/React.createElement("div", null, "CRM"), /*#__PURE__*/React.createElement("div", null, "Atividade")), BUSCAS_RAW.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => onOpen(b.id),
    className: "row-hover",
    style: {
      display: 'grid',
      gridTemplateColumns: '24px 2.2fr 1fr 1fr .7fr .8fr .8fr .8fr 1fr',
      alignItems: 'center',
      gap: 10,
      padding: '14px 18px',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatusDot, {
    color: healthColors[b.health],
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
  }, b.criador), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, b.ritmo ? b.ritmo + '/h' : '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, b.enc), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--dim)'
    }
  }, b.qual), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.cyan
    }
  }, b.crm), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, b.ultima)))));
}

// ── BuscaDetail ───────────────────────────────────────────────────────────────
function BuscaDetail({
  buscaId,
  onBack,
  onOpenLead
}) {
  const b = BUSCAS_RAW.find(x => x.id === buscaId) || BUSCAS_RAW[0];
  const leads = RAW_LEADS.slice(0, 5);
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
    color: healthColors[b.health],
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
  }, b.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 10
    }
  }, ['Agências de publicidade', 'PR · Sul', 'Porte médio'].map(tag => /*#__PURE__*/React.createElement("span", {
    key: tag,
    style: {
      fontSize: 12,
      padding: '5px 10px',
      borderRadius: 7,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--dim)'
    }
  }, tag)))), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 38,
      padding: '0 15px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Pausar"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 38,
      padding: '0 15px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Editar ritmo")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 12,
      marginBottom: 18
    }
  }, [['Encontrados', '342', 'var(--text)'], ['Qualificados', '128', C.green], ['Incompletos', '61', C.amber], ['Descartados', '89', 'var(--dim)'], ['Enviados ao CRM', '64', C.cyan]].map(([label, val, col]) => /*#__PURE__*/React.createElement("div", {
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
  }, "Esgotamento do universo"), /*#__PURE__*/React.createElement("div", {
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
  }, "38%"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, "varrido")), /*#__PURE__*/React.createElement(ProgressBar, {
    pct: 38,
    color: C.gold
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)',
      marginTop: 12,
      lineHeight: 1.5
    }
  }, "~890 de 2.340 empresas avaliadas. Ritmo atual de 120 leads/h."))), /*#__PURE__*/React.createElement("div", {
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
  }, "Leads desta busca")), leads.map(l => /*#__PURE__*/React.createElement("div", {
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
function NovaBusca({
  tipo,
  onTipo,
  ritmo,
  onRitmo,
  onLigar
}) {
  const tipos = [{
    key: 'icp',
    titulo: 'Por perfil (ICP)',
    desc: 'Descreva o cliente ideal e refine os critérios.',
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
  const chips = ['Setor: Agências de publicidade', 'UF: PR', 'Cidade: Curitiba', 'Porte: Médio'];
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
      onClick: () => onTipo(t.key),
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
  })), tipo === 'icp' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 9
    }
  }, "Descreva quem voc\xEA quer encontrar"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    defaultValue: "ag\xEAncias de marketing em Curitiba, porte m\xE9dio, com time comercial estruturado",
    style: {
      width: '100%',
      minHeight: 84,
      borderRadius: 12,
      border: `1px solid ${C.blue}`,
      background: 'var(--panel)',
      color: 'var(--text)',
      padding: 14,
      fontSize: 14,
      fontFamily: 'inherit',
      lineHeight: 1.5,
      resize: 'vertical'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 11
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 14,
    h: 14,
    sw: 1.8,
    color: C.blue
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 4
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v2M12 19v2M5 12H3M21 12h-2"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.06em',
      color: C.blue,
      textTransform: 'uppercase'
    }
  }, "Crit\xE9rios inferidos do texto \u2014 edite se precisar")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24
    }
  }, chips.map(ch => /*#__PURE__*/React.createElement("span", {
    key: ch,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 12.5,
      padding: '7px 12px',
      borderRadius: 8,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      color: 'var(--text)'
    }
  }, ch, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)',
      cursor: 'pointer'
    }
  }, "\u2715"))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12.5,
      padding: '7px 12px',
      borderRadius: 8,
      border: '1px dashed var(--border)',
      color: 'var(--faint)',
      cursor: 'pointer'
    }
  }, "+ crit\xE9rio"))) : /*#__PURE__*/React.createElement("div", {
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
  }, "Uma coluna de CNPJ, ou cole a lista no campo abaixo")), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Nome da busca"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "Ag\xEAncias de marketing \u2014 Sul",
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
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Corte m\xEDnimo de confidence score"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "60",
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
  }, "Ritmo da torneira \u2014 controla a velocidade da busca"), /*#__PURE__*/React.createElement("span", {
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
    onChange: e => onRitmo(+e.target.value),
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
  }, /*#__PURE__*/React.createElement("span", null, "econ\xF4mico"), /*#__PURE__*/React.createElement("span", null, "agressivo"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      background: 'var(--panel2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '15px 18px',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: 'rgba(122,217,255,.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 18,
    h: 18,
    sw: 1.8,
    color: C.cyan
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 11,
    cy: 11,
    r: 7
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, "~2.340 empresas batem com esse filtro"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "universo estimado \xB7 calibre os crit\xE9rios antes de ligar"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onLigar,
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
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Svg, {
    d: "M5 12h14M13 5l7 7-7 7",
    color: "#0E1936",
    w: 16,
    h: 16,
    sw: 2
  }), "Ligar busca"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 46,
      padding: '0 20px',
      borderRadius: 11,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 14,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Salvar rascunho")));
}

// ── Integrações ───────────────────────────────────────────────────────────────
function Integracoes() {
  const items = [{
    nome: 'API de CNPJ',
    provedor: 'ReceitaWS · CNPJá',
    conectado: true,
    cred: '••••••••••3f2a',
    icon: 'M14 2v6h6M14 2l6 6v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'
  }, {
    nome: 'CRM',
    provedor: 'RD Station',
    conectado: true,
    cred: '••••••••••a91c',
    icon: 'M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z'
  }, {
    nome: 'Validação de e-mail',
    provedor: 'NeverBounce',
    conectado: true,
    cred: '••••••••••77de',
    icon: 'M3 5h18v14H3zM3 7l9 6 9-6'
  }, {
    nome: 'Validação de telefone',
    provedor: 'Twilio Lookup',
    conectado: false,
    cred: '',
    icon: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z'
  }, {
    nome: 'Inteligência (IA)',
    provedor: 'Claude · Anthropic',
    conectado: true,
    cred: '••••••••••be40',
    icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M7 7L5.5 5.5M18.5 18.5L17 17M17 7l1.5-1.5M5.5 18.5L7 17'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 840,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, items.map(ig => /*#__PURE__*/React.createElement("div", {
    key: ig.nome,
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
    d: ig.icon,
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
  }, ig.nome), /*#__PURE__*/React.createElement("span", {
    style: badgeStyle(ig.conectado ? C.green : C.gray)
  }, /*#__PURE__*/React.createElement(StatusDot, {
    color: ig.conectado ? C.green : C.gray,
    pulse: false
  }), ig.conectado ? 'conectado' : 'desconectado')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      marginTop: 3
    }
  }, ig.provedor)), /*#__PURE__*/React.createElement("input", {
    defaultValue: ig.cred,
    placeholder: "Adicionar credencial\u2026",
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
    style: {
      height: 38,
      padding: '0 15px',
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 12.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, "Testar conex\xE3o"))));
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
    window.alert('Usuário criado!\n\nSenha provisória: ' + data.senha_provisoria + '\n\nAnote e repasse com segurança.');
    carregar();
  };
  const alternar = async u => {
    if (u.ativo) {
      if (!window.confirm('Desativar ' + u.nome + '?')) return;
      const r = await fetch('/api/usuarios/' + u.id, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        window.alert(d.erro || 'Erro.');
        return;
      }
    } else {
      await fetch('/api/usuarios/' + u.id, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ativo: true
        })
      });
    }
    carregar();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 980
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
      gridTemplateColumns: '2fr 1.3fr 1fr 1fr 110px',
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
  }, /*#__PURE__*/React.createElement("div", null, "Usu\xE1rio"), /*#__PURE__*/React.createElement("div", null, "E-mail"), /*#__PURE__*/React.createElement("div", null, "Papel"), /*#__PURE__*/React.createElement("div", null, "\xDAltimo acesso"), /*#__PURE__*/React.createElement("div", null, "Status")), users === null ? /*#__PURE__*/React.createElement("div", {
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
        gridTemplateColumns: '2fr 1.3fr 1fr 1fr 110px',
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
      title: "Clique para alternar",
      style: {
        ...badgeStyle(u.ativo ? C.green : C.gray),
        cursor: 'pointer'
      }
    }, u.ativo ? 'Ativo' : 'Inativo')));
  })));
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
  }, "Marca \xB7 white-label"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      margin: '0 0 18px'
    }
  }, "Para parceiros que revendem o Hunter."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 12,
      background: 'var(--panel2)',
      border: '1px dashed var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--faint)',
      fontSize: 11,
      flexShrink: 0
    }
  }, "logo"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Nome exibido"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "Hunter",
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
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
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
  const queues = [{
    label: 'Jobs ativos',
    v: '42',
    color: C.blue
  }, {
    label: 'Em espera',
    v: '1.205',
    color: C.amber
  }, {
    label: 'Concluídos · 24h',
    v: '18,4 mil',
    color: C.green
  }, {
    label: 'Falhos',
    v: '7',
    color: C.red
  }];
  const dlq = [{
    job: 'enrich:cnpj',
    ref: '18.402.551/0001-09',
    motivo: 'Timeout API CNPJ · 3 tentativas',
    quando: 'há 14 min'
  }, {
    job: 'validate:email',
    ref: 'contato@verdevale.com.br',
    motivo: 'Provedor retornou 502',
    quando: 'há 38 min'
  }, {
    job: 'enrich:decisor',
    ref: '31.556.092/0001-18',
    motivo: 'Sócio não encontrado',
    quando: 'há 1h'
  }];
  const logs = [{
    nivel: 'ERRO',
    cor: C.red,
    txt: 'heartbeat timeout — busca #4 marcada como parada',
    t: '14:32:08'
  }, {
    nivel: 'AVISO',
    cor: C.amber,
    txt: 'universo de "Clínicas NE" 82% varrido',
    t: '14:21:55'
  }, {
    nivel: 'INFO',
    cor: C.blue,
    txt: 'validação de e-mail reconectada (NeverBounce)',
    t: '13:48:12'
  }, {
    nivel: 'INFO',
    cor: C.blue,
    txt: 'lote de 120 leads enriquecido — busca #1',
    t: '13:40:01'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14,
      marginBottom: 18
    }
  }, queues.map(q => /*#__PURE__*/React.createElement("div", {
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
      color: C.red
    }
  }, "3 jobs falharam todas as tentativas")), dlq.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.job,
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
  }, d.quando), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 30,
      padding: '0 12px',
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--text)',
      fontSize: 11.5,
      fontFamily: 'inherit',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, "Reprocessar")))), /*#__PURE__*/React.createElement("div", {
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
      margin: '0 0 6px'
    }
  }, "Consumo de API \xB7 CNPJ"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26,
      fontWeight: 600
    }
  }, "12.840"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--faint)'
    }
  }, "consultas \xB7 7 dias")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: C.gold,
      marginBottom: 14
    }
  }, "custo estimado R$ 642,00"), /*#__PURE__*/React.createElement(MiniChart, {
    vals: [320, 410, 380, 520, 610, 540, 690, 720],
    color: C.cyan
  }))), /*#__PURE__*/React.createElement("div", {
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
  }, "Logs de erro recentes")), logs.map((lg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 18px',
      borderBottom: '1px solid var(--border)',
      fontFamily: 'ui-monospace,monospace'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      fontWeight: 600,
      color: lg.cor,
      minWidth: 42
    }
  }, lg.nivel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--faint)',
      minWidth: 64
    }
  }, lg.t), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text)'
    }
  }, lg.txt)))));
}

// ── Lead Detail Slideover ─────────────────────────────────────────────────────
function LeadDetailPanel({
  leadId,
  onClose,
  onCrm
}) {
  const l = leadId ? leadDetail(RAW_LEADS.find(x => x.id === leadId)) : null;
  if (!l) return null;
  const mailPath = 'M3 5h18v14H3zM3 7l9 6 9-6';
  const telPath = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z';
  const webPath = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18';
  const contactIcon = type => {
    if (type === 'email') return /*#__PURE__*/React.createElement(Svg, {
      d: mailPath,
      color: C.blue,
      w: 16,
      h: 16,
      sw: 1.8
    });
    if (type === 'phone') return /*#__PURE__*/React.createElement(Svg, {
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
  const cadastrais = [{
    k: 'CNAE principal',
    v: l.cnae
  }, {
    k: 'Porte',
    v: l.porte
  }, {
    k: 'Situação',
    v: l.situacao,
    ok: true
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
    style: badgeStyle(statusColors[l.status] || C.gray)
  }, l.status), /*#__PURE__*/React.createElement("span", {
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
  }), /*#__PURE__*/React.createElement("span", null, c.v)))))), /*#__PURE__*/React.createElement("section", {
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
  }, l.decisorIni), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  })), "Receita Federal"))), /*#__PURE__*/React.createElement("section", {
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
  }, l.contatos.map((c, i) => /*#__PURE__*/React.createElement("div", {
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
  }, contactIcon(c.type), /*#__PURE__*/React.createElement("div", {
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
    style: c.seloStyle
  }, c.seloLabel))))), /*#__PURE__*/React.createElement("section", {
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
  }, "Copiar"), /*#__PURE__*/React.createElement("button", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 31,
      padding: '0 12px',
      borderRadius: 7,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 12,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Regenerar")))), /*#__PURE__*/React.createElement("section", {
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
  }, l.breakdown.map((b, i) => /*#__PURE__*/React.createElement("div", {
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
      color: b.color,
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
    onClick: onCrm,
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
  }, "Aprovar"), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 42,
      padding: '0 16px',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'transparent',
      color: 'var(--dim)',
      fontSize: 13,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Descartar"))));
}

// ── Modals ────────────────────────────────────────────────────────────────────
function CrmModal({
  count,
  onClose
}) {
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
  }, count, " leads ser\xE3o enviados \u2014 a\xE7\xE3o deliberada, sem automa\xE7\xE3o.")), /*#__PURE__*/React.createElement("div", {
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
    onClick: onClose,
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
      cursor: 'pointer'
    }
  }, "Confirmar envio"))));
}
function ExportModal({
  count,
  onClose
}) {
  const CheckOn = () => /*#__PURE__*/React.createElement("span", {
    style: {
      width: 17,
      height: 17,
      borderRadius: 5,
      background: C.blue,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgMulti, {
    w: 10,
    h: 10,
    sw: 3,
    color: "#fff"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  })));
  const CheckOff = () => /*#__PURE__*/React.createElement("span", {
    style: {
      width: 17,
      height: 17,
      borderRadius: 5,
      border: '1.5px solid var(--border)',
      flexShrink: 0
    }
  });
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
  }, count, " leads selecionados.")), /*#__PURE__*/React.createElement("div", {
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
  }, "CSV"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 40,
      borderRadius: 9,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      color: 'var(--dim)',
      cursor: 'pointer'
    }
  }, "XLSX"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 9
    }
  }, "Campos inclu\xEDdos"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, [['on', 'Razão social e CNPJ'], ['on', 'Decisor e cargo'], ['on', 'Contatos validados'], ['off', 'Confidence score e breakdown']].map(([state, label]) => /*#__PURE__*/React.createElement("label", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      fontSize: 13,
      cursor: 'pointer',
      color: state === 'off' ? 'var(--dim)' : 'var(--text)'
    }
  }, state === 'on' ? /*#__PURE__*/React.createElement(CheckOn, null) : /*#__PURE__*/React.createElement(CheckOff, null), label))))), /*#__PURE__*/React.createElement("div", {
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
    onClick: onClose,
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
      cursor: 'pointer'
    }
  }, "Gerar e baixar"))));
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({
  theme,
  onLogin,
  onTheme
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg)',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      opacity: .5,
      pointerEvents: 'none',
      backgroundImage: 'radial-gradient(circle at 50% 42%, var(--vignette,rgba(58,142,255,.10)), transparent 55%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 520,
      height: 520,
      opacity: .06,
      color: C.gold
    }
  }, /*#__PURE__*/React.createElement(CrosshairBig, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 380,
      maxWidth: '90vw'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 38
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "hunter_logo_icon.png",
    alt: "Hunter",
    style: {
      width: 46,
      height: 46
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 21,
      fontWeight: 600,
      letterSpacing: '.22em'
    }
  }, "HUNTER"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: C.gold,
      letterSpacing: '.16em',
      marginTop: 5
    }
  }, "PRECIS\xC3O EM ESCALA"))), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 24,
      fontWeight: 600,
      margin: '0 0 6px'
    }
  }, "Entrar"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: 'var(--dim)',
      margin: '0 0 28px'
    }
  }, "Acesse o motor de atra\xE7\xE3o de leads."), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "E-mail"), /*#__PURE__*/React.createElement("input", {
    defaultValue: "vendas@empresa.com.br",
    style: {
      width: '100%',
      height: 44,
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 14px',
      fontSize: 14,
      fontFamily: 'inherit',
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      color: 'var(--dim)',
      marginBottom: 7
    }
  }, "Senha"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    defaultValue: "123456789",
    style: {
      width: '100%',
      height: 44,
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'var(--panel2)',
      color: 'var(--text)',
      padding: '0 14px',
      fontSize: 14,
      fontFamily: 'inherit',
      marginBottom: 22
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onLogin,
    style: {
      width: '100%',
      height: 46,
      borderRadius: 10,
      border: 'none',
      background: 'var(--gold)',
      color: '#0E1936',
      fontWeight: 600,
      fontSize: 14,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "Entrar"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: 12,
      color: C.blue,
      textDecoration: 'none'
    }
  }, "Esqueci minha senha"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 24,
      right: 24
    }
  }, /*#__PURE__*/React.createElement(ThemeToggle, {
    theme: theme,
    onToggle: onTheme
  })));
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState('dark');
  const [screen, setScreen] = useState('dashboard');
  const [selected, setSelected] = useState([]);
  const [leadDetail, setLeadDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const [buscaDetail, setBuscaDetail] = useState(null);
  const [novaTipo, setNovaTipo] = useState('icp');
  const [ritmo, setRitmo] = useState(120);
  const [emailOnly, setEmailOnly] = useState(false);
  const navTo = s => {
    setScreen(s);
    setLeadDetail(null);
    setModal(null);
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
  const toggleSel = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(prev => prev.length ? [] : RAW_LEADS.map(l => l.id));
  const openBusca = id => {
    if (id) {
      setBuscaDetail(id);
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
          onOpenBusca: openBusca,
          onNova: () => navTo('nova')
        });
      case 'leads':
        return /*#__PURE__*/React.createElement(Leads, {
          selected: selected,
          onSelect: toggleSel,
          onToggleAll: toggleAll,
          onClearSel: () => setSelected([]),
          onOpenLead: id => setLeadDetail(id),
          onOpenCrm: () => setModal('crm'),
          onOpenExport: () => setModal('export'),
          emailOnly: emailOnly,
          onToggleEmailOnly: () => setEmailOnly(e => !e)
        });
      case 'buscas':
        return /*#__PURE__*/React.createElement(Buscas, {
          onOpen: id => openBusca(id)
        });
      case 'buscaDetail':
        return /*#__PURE__*/React.createElement(BuscaDetail, {
          buscaId: buscaDetail,
          onBack: () => setScreen('buscas'),
          onOpenLead: id => setLeadDetail(id)
        });
      case 'nova':
        return /*#__PURE__*/React.createElement(NovaBusca, {
          tipo: novaTipo,
          onTipo: setNovaTipo,
          ritmo: ritmo,
          onRitmo: setRitmo,
          onLigar: () => navTo('buscas')
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
  if (screen === 'login') {
    return /*#__PURE__*/React.createElement("div", {
      style: rootStyle
    }, /*#__PURE__*/React.createElement(Login, {
      theme: theme,
      onLogin: () => setScreen('dashboard'),
      onTheme: toggleTheme
    }));
  }
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
    onLogout: logout
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
    onNova: () => navTo('nova')
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 28
    }
  }, renderScreen()))), leadDetail && /*#__PURE__*/React.createElement(LeadDetailPanel, {
    leadId: leadDetail,
    onClose: () => setLeadDetail(null),
    onCrm: () => setModal('crm')
  }), modal === 'crm' && /*#__PURE__*/React.createElement(CrmModal, {
    count: Math.max(selected.length, 12),
    onClose: () => setModal(null)
  }), modal === 'export' && /*#__PURE__*/React.createElement(ExportModal, {
    count: Math.max(selected.length, 12),
    onClose: () => setModal(null)
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
