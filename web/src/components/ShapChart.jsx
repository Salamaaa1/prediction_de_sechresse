import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar } from 'react-chartjs-2';
import { usePredictions } from '../context/PredictionsContext';
import { SHAP_OPTIONS } from '../data/chartData';

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const FEAT_LABELS = {
  precip_std12:  'Préc. variabilité 12m',
  precip_roll12: 'Préc. moy. 12m',
  spi3_lag12:    'SPI-3 (lag 12)',
  spi3_lag3:     'SPI-3 (lag 3)',
  spi6:          'SPI-6 actuel',
  spi3_lag6:     'SPI-3 (lag 6)',
  precip_roll6:  'Préc. moy. 6m',
  precip_lag1:   'Préc. (lag 1m)',
  temp_roll3:    'Temp. moy. 3m',
  et0_roll3:     'ET₀ moy. 3m',
  spi3_lag1:     'SPI-3 (lag 1)',
  spi3_lag2:     'SPI-3 (lag 2)',
  sin_month:     'Saisonnalité (sin)',
  cos_month:     'Saisonnalité (cos)',
  precip_anomaly:'Anomalie préc.',
};

const BAR_COLORS = [
  'rgba(41,128,185,0.75)',
  'rgba(41,128,185,0.65)',
  'rgba(39,174,96,0.65)',
  'rgba(212,172,13,0.65)',
  'rgba(160,64,0,0.65)',
  'rgba(41,128,185,0.5)',
  'rgba(39,174,96,0.5)',
  'rgba(93,173,226,0.5)',
  'rgba(160,64,0,0.45)',
  'rgba(183,149,11,0.45)',
];

export function ShapChart() {
  const { data } = usePredictions();

  const chartData = useMemo(() => {
    const fi = data?.feature_importance ?? [];
    const top = fi.slice(0, 8);
    return {
      labels: top.map(f => FEAT_LABELS[f.feature] ?? f.feature),
      datasets: [{
        label: 'Importance RF',
        data: top.map(f => parseFloat(f.importance.toFixed(4))),
        backgroundColor: BAR_COLORS.slice(0, top.length),
        borderColor: 'transparent',
        borderRadius: 4,
      }],
    };
  }, [data]);

  const topPct = data?.feature_importance?.[0]
    ? Math.round(data.feature_importance[0].importance * 100)
    : 42;
  const topName = data?.feature_importance?.[0]
    ? (FEAT_LABELS[data.feature_importance[0].feature] ?? data.feature_importance[0].feature)
    : 'Préc. CHIRPS';

  return (
    <motion.div variants={itemV} className="b-shap card p-4 flex flex-col">
      <div className="slabel mb-1">Explicabilité — Importance Variables</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        Importance des Features (Random Forest)
      </div>
      <div style={{ flex: 1, minHeight: 200, position: 'relative' }}>
        {data ? (
          <Bar data={chartData} options={SHAP_OPTIONS} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: '0.75rem' }}>
            Chargement…
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10, fontSize: '0.68rem', color: 'var(--text2)', lineHeight: 1.6 }}>
        Importance moyenne sur les 9 bassins — Random Forest 300 arbres.
        {' '}<span style={{ color: 'var(--text)' }}>{topName}</span>{' '}représente{' '}
        <span className="font-mono" style={{ color: '#27AE60' }}>{topPct}%</span> du poids total.
      </div>
    </motion.div>
  );
}
