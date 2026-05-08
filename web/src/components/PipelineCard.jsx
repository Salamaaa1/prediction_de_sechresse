import { motion } from 'framer-motion';

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stepV = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STEPS = [
  {
    bg: 'rgba(41,128,185,0.15)', iconColor: '#5DADE2',
    title: 'Collecte des Données', sub: 'NASA POWER · CHIRPS 0.05° · SPI-OMM', badge: 'Auto',
    icon: (
      <svg viewBox="0 0 20 20" fill="#5DADE2" width="14" height="14">
        <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
        <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
        <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
      </svg>
    ),
  },
  {
    bg: 'rgba(142,68,173,0.15)', iconColor: '#A569BD',
    title: 'Feature Engineering', sub: 'Lags 1-12 · Moyennes mobiles · Anomalies normalisées', badge: null,
    icon: (
      <svg viewBox="0 0 20 20" fill="#A569BD" width="14" height="14">
        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    bg: 'rgba(41,128,185,0.15)', iconColor: '#5DADE2',
    title: 'Modèles Base', sub: 'XGBoost · LightGBM · LSTM bidirectionnel', badge: null,
    icon: (
      <svg viewBox="0 0 20 20" fill="#5DADE2" width="14" height="14">
        <path d="M13 7H7v6h6V7z" />
        <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    bg: 'rgba(39,174,96,0.15)', iconColor: '#27AE60',
    title: 'Méta-Modèle (Stacking)', sub: 'Ridge Regression · R²=0.94 · RMSE=0.31', badge: 'PROD',
    icon: (
      <svg viewBox="0 0 20 20" fill="#27AE60" width="14" height="14">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function PipelineCard() {
  return (
    <motion.div variants={itemV} className="b-info card p-4 flex flex-col">
      <div className="slabel mb-3">Architecture du Pipeline</div>

      <motion.div
        className="flex flex-col gap-2 mb-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      >
        {STEPS.map(({ bg, title, sub, badge, icon }, i) => (
          <div key={title}>
            <motion.div variants={stepV} className="pipe-step">
              <div className="pipe-icon" style={{ background: bg }}>
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: '0.67rem', color: 'var(--text2)' }}>{sub}</div>
              </div>
              {badge && <span className="bdg">{badge}</span>}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div style={{ marginLeft: 14, height: 14, borderLeft: '1px dashed rgba(41,128,185,0.2)' }} />
            )}
          </div>
        ))}
      </motion.div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 mt-auto">
        {[
          { label: 'Features', value: '47', color: '#5DADE2' },
          { label: 'Données', value: '22 ans', color: '#27AE60' },
          { label: 'CV Folds', value: '5-TS', color: '#D4AC0D' },
        ].map(({ label, value, color }) => (
          <div key={label} className="pipe-step flex-col items-center text-center" style={{ gap: 2 }}>
            <div className="font-mono font-bold" style={{ fontSize: '0.95rem', color }}>{value}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text2)' }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
