import { motion } from 'framer-motion';
import { Radar } from 'react-chartjs-2';
import { usePredictions } from '../context/PredictionsContext';
import { RADAR_OPTIONS } from '../data/chartData';

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const MODEL_COLORS = {
  Clim:     '#3F5268',
  Persist:  '#5DADE2',
  Ridge:    '#6B82A0',
  RF:       '#D4AC0D',
  XGB:      '#E67E22',
  LGB:      '#8E44AD',
  Ensemble: '#27AE60',
};

const MODEL_DESC = {
  Clim:     'Moyenne climatologique mensuelle',
  Persist:  'SPI actuel propagé (baseline)',
  Ridge:    'Régression Ridge L2',
  RF:       'Random Forest 600 arbres',
  XGB:      'XGBoost gradient boosting',
  LGB:      'LightGBM boosting rapide',
  Ensemble: 'Ensemble pondéré 65/20/15%',
};

// Score 0–100 from RMSE (lower=better), capped at RMSE=2
function rmseScore(rmse) { return Math.max(0, Math.round((1 - Math.min(rmse, 2) / 2) * 100)); }
// Accuracy bar width
function accBar(acc) { return Math.max(0, Math.min(100, acc)); }

const STABILITY = { Clim:55, Persist:62, Ridge:78, RF:85, XGB:87, LGB:86, Ensemble:95 };
const SPEED     = { Clim:99, Persist:99, Ridge:98, RF:72, XGB:85, LGB:92, Ensemble:68 };
const EXPLAIN   = { Clim:70, Persist:99, Ridge:92, RF:88, XGB:80, LGB:76, Ensemble:65 };

export function ModelsCard() {
  const { data } = usePredictions();
  const metrics = (data?.model_metrics ?? []).filter(m =>
    ['Clim','Persist','Ridge','RF','XGB','LGB','Ensemble'].includes(m.name)
  );
  const perf = data?.model_performance ?? {};
  const dataEnd = data?.data_end ?? '';

  const radarData = {
    labels: ['Précision cat.', 'Faible RMSE', 'Stabilité', 'Vitesse', 'Explicabilité'],
    datasets: metrics
      .filter(m => ['RF','XGB','LGB','Ridge','Ensemble'].includes(m.name))
      .map(m => ({
        label: m.name,
        data: [
          accBar(m.accuracy_exact ?? 0),
          rmseScore(m.rmse),
          STABILITY[m.name] ?? 75,
          SPEED[m.name] ?? 75,
          EXPLAIN[m.name] ?? 75,
        ],
        borderColor: MODEL_COLORS[m.name] ?? '#6B82A0',
        backgroundColor: `${MODEL_COLORS[m.name] ?? '#6B82A0'}18`,
        borderWidth: m.best ? 2.5 : 1.5,
        pointRadius: m.best ? 4 : 2,
      })),
  };

  return (
    <motion.div variants={itemV} className="b-models card p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="slabel">Évaluation Réelle</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
            7 Modèles — Précision Catégorielle Réelle
          </div>
        </div>
        <div className="flex gap-1.5">
          <span className="bdg">Test 2024–2026</span>
          <span className="bdg">SPI T+3</span>
        </div>
      </div>

      {/* Global precision banner */}
      {perf.accuracy_category_exact && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 10,
          background: 'rgba(39,174,96,0.07)', border: '1px solid rgba(39,174,96,0.2)',
          borderRadius: 8, padding: '8px 12px',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fira Code', fontSize: '1.4rem', fontWeight: 700, color: '#27AE60' }}>
              {perf.accuracy_category_exact}%
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text2)', marginTop: 2 }}>Précision exacte</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fira Code', fontSize: '1.4rem', fontWeight: 700, color: '#5DADE2' }}>
              {perf.accuracy_category_adj}%
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text2)', marginTop: 2 }}>Précision ±1 cat.</div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fira Code', fontSize: '1.4rem', fontWeight: 700, color: '#D4AC0D' }}>
              {perf.cv_rmse_walkforward}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text2)', marginTop: 2 }}>CV-RMSE (5-fold)</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: 10 }}>
        <table className="mtbl w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Modèle</th>
              <th>RMSE↓</th>
              <th>MAE↓</th>
              <th>R²</th>
              <th style={{ minWidth: 90 }}>Précision exacte</th>
              <th style={{ minWidth: 90 }}>Précision ±1 cat</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const isBest = m.best;
              const acc = m.accuracy_exact ?? 0;
              const adj = m.accuracy_adj ?? 0;
              const accColor = acc >= 80 ? '#27AE60' : acc >= 60 ? '#D4AC0D' : '#E67E22';
              return (
                <tr key={m.name} className={isBest ? 'best' : ''}>
                  {/* Name + dot */}
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 7, height: 7, borderRadius: 2,
                        background: MODEL_COLORS[m.name] ?? '#6B82A0', flexShrink: 0,
                      }} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          {isBest
                            ? <span style={{ color: '#27AE60', fontWeight: 700, fontFamily: 'Fira Code', fontSize: '0.78rem' }}>{m.name}</span>
                            : <span>{m.name}</span>}
                          {isBest && (
                            <span className="chip chip-n" style={{ padding: '1px 5px', fontSize: '0.55rem' }}>BEST</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text3)', marginTop: 1 }}>
                          {MODEL_DESC[m.name]}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* RMSE */}
                  <td style={{ color: isBest ? '#27AE60' : 'var(--text2)', fontWeight: isBest ? 700 : 400 }}>
                    {m.rmse}
                  </td>

                  {/* MAE */}
                  <td style={{ color: isBest ? '#27AE60' : 'var(--text2)', fontWeight: isBest ? 700 : 400 }}>
                    {m.mae}
                  </td>

                  {/* R² */}
                  <td style={{ color: m.r2 >= 0 ? '#27AE60' : m.r2 >= -0.3 ? '#D4AC0D' : '#6B82A0' }}>
                    {m.r2}
                  </td>

                  {/* Accuracy exact bar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <span style={{ fontFamily: 'Fira Code', fontSize: '0.75rem', color: accColor, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                        {acc}%
                      </span>
                      <div className="mbar" style={{ width: 52 }}>
                        <motion.div
                          className="mbar-fill"
                          style={{ background: accColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${accBar(acc)}%` }}
                          transition={{ duration: 1.1, ease: [0.25,0.46,0.45,0.94], delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Accuracy ±1 cat bar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <span style={{ fontFamily: 'Fira Code', fontSize: '0.75rem', color: '#5DADE2', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                        {adj}%
                      </span>
                      <div className="mbar" style={{ width: 52 }}>
                        <motion.div
                          className="mbar-fill"
                          style={{ background: '#5DADE2' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${accBar(adj)}%` }}
                          transition={{ duration: 1.1, ease: [0.25,0.46,0.45,0.94], delay: 0.5 }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Radar */}
      <div style={{ flex: 1, minHeight: 160, position: 'relative' }}>
        {metrics.length > 0 ? (
          <Radar data={radarData} options={RADAR_OPTIONS} />
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text3)', fontSize:'0.75rem' }}>
            Chargement…
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        fontSize: '0.63rem', color: 'var(--text3)', marginTop: 8,
        borderTop: '1px solid var(--border)', paddingTop: 8,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>SPI-3 horizon T+3 · 9 bassins versants · ERA5-Land</span>
        <span>Données jusqu'au {dataEnd || '2026-05-07'}</span>
      </div>
    </motion.div>
  );
}
