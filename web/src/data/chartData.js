// ── SPI Time Series ─────────────────────────────────────────────────────────
const MONTHS = [
  'Jan 24','Fév 24','Mar 24','Avr 24','Mai 24','Jun 24',
  'Jul 24','Aoû 24','Sep 24','Oct 24','Nov 24','Déc 24',
  'Jan 25','Fév 25','Mar 25','Avr 25','Mai 25',
];
const SPI_OBS = [-0.4,-0.7,-1.1,-1.4,-1.6,-1.5,-1.8,-2.0,-2.1,-2.2,-2.3,-2.1,-2.0,-2.2,-2.3,-2.1,null];
const SPI_T3  = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,-2.1,-2.4];
const SPI_T6  = [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,-2.1,-2.1];

export function buildSpiData(mode) {
  const datasets = [
    {
      label: 'SPI Observé',
      data: SPI_OBS,
      borderColor: '#2980B9',
      backgroundColor: 'rgba(41,128,185,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: false,
      spanGaps: false,
    },
  ];
  if (mode !== 't6') {
    datasets.push({
      label: 'Prévision T+3',
      data: SPI_T3,
      borderColor: '#27AE60',
      borderDash: [5, 4],
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    });
  }
  if (mode !== 't3') {
    datasets.push({
      label: 'Prévision T+6',
      data: SPI_T6,
      borderColor: '#D4AC0D',
      borderDash: [5, 4],
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    });
  }
  return { labels: MONTHS, datasets };
}

export const SPI_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 800, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(11,20,34,0.97)',
      borderColor: 'rgba(41,128,185,0.3)',
      borderWidth: 1,
      titleColor: '#C8D8EA',
      bodyColor: '#6B82A0',
      padding: 10,
      callbacks: {
        label: (ctx) => ` SPI ${ctx.parsed.y?.toFixed(2) ?? '—'}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#3F5268', font: { family: 'Fira Code', size: 10 }, maxRotation: 45 },
      border: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#3F5268', font: { family: 'Fira Code', size: 10 } },
      border: { color: 'rgba(255,255,255,0.06)' },
      min: -3,
      max: 3,
    },
  },
};

// ── SHAP Horizontal Bar ──────────────────────────────────────────────────────
export const SHAP_DATA = {
  labels: [
    'Préc. CHIRPS (L1)',
    'Préc. CHIRPS (L3)',
    'NDVI Anomalie',
    'Temp. NASA (L1)',
    'SPI-3 (L6)',
    'Préc. (L6)',
    'Evapotransp.',
    'PDO Index',
  ],
  datasets: [{
    label: 'SHAP moyen',
    data: [0.42, 0.28, 0.15, 0.12, 0.09, 0.07, 0.05, 0.03],
    backgroundColor: [
      'rgba(41,128,185,0.7)',
      'rgba(41,128,185,0.6)',
      'rgba(39,174,96,0.6)',
      'rgba(212,172,13,0.6)',
      'rgba(160,64,0,0.6)',
      'rgba(41,128,185,0.45)',
      'rgba(39,174,96,0.45)',
      'rgba(93,173,226,0.45)',
    ],
    borderColor: 'transparent',
    borderRadius: 4,
  }],
};

export const SHAP_OPTIONS = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(11,20,34,0.97)',
      borderColor: 'rgba(41,128,185,0.3)',
      borderWidth: 1,
      titleColor: '#C8D8EA',
      bodyColor: '#6B82A0',
      padding: 10,
      callbacks: { label: (c) => ` ${(c.parsed.x * 100).toFixed(0)}% du poids` },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#3F5268', font: { family: 'Fira Code', size: 9 } },
      border: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#6B82A0', font: { size: 10 } },
      border: { display: false },
    },
  },
};

// ── Radar ────────────────────────────────────────────────────────────────────
export const RADAR_DATA = {
  labels: ['R²', 'RMSE', 'MAE', 'Stabilité', 'Vitesse', 'Explicabilité'],
  datasets: [
    {
      label: 'Ensemble',
      data: [94, 88, 90, 97, 75, 72],
      borderColor: '#27AE60',
      backgroundColor: 'rgba(39,174,96,0.1)',
      borderWidth: 2,
      pointRadius: 3,
    },
    {
      label: 'LSTM',
      data: [91, 82, 85, 90, 60, 55],
      borderColor: '#2980B9',
      backgroundColor: 'rgba(41,128,185,0.07)',
      borderWidth: 1.5,
      pointRadius: 2,
    },
    {
      label: 'XGBoost',
      data: [87, 78, 80, 82, 95, 90],
      borderColor: '#D4AC0D',
      backgroundColor: 'rgba(212,172,13,0.06)',
      borderWidth: 1.5,
      pointRadius: 2,
    },
  ],
};

export const RADAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900 },
  plugins: {
    legend: {
      labels: { color: '#6B82A0', font: { size: 10, family: 'Fira Code' }, boxWidth: 10, padding: 12 },
    },
  },
  scales: {
    r: {
      min: 0, max: 100,
      grid: { color: 'rgba(255,255,255,0.06)' },
      angleLines: { color: 'rgba(255,255,255,0.06)' },
      pointLabels: { color: '#6B82A0', font: { size: 9.5 } },
      ticks: { display: false },
    },
  },
};

// ── Alert Doughnut ───────────────────────────────────────────────────────────
export const ALERT_DONUT_DATA = {
  labels: ['Extrême', 'Sévère', 'Modéré', 'Normal'],
  datasets: [{
    data: [2, 4, 1, 1],
    backgroundColor: [
      'rgba(123,36,28,0.75)',
      'rgba(160,64,0,0.65)',
      'rgba(183,149,11,0.65)',
      'rgba(30,132,73,0.55)',
    ],
    borderColor: ['#7B241C','#A04000','#B7950B','#1E8449'],
    borderWidth: 1,
    hoverOffset: 6,
  }],
};

export const ALERT_DONUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900 },
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(11,20,34,0.97)',
      borderColor: 'rgba(41,128,185,0.3)',
      borderWidth: 1,
      titleColor: '#C8D8EA',
      bodyColor: '#6B82A0',
      padding: 8,
    },
  },
};
