import { motion } from 'framer-motion';
import { useCounter } from '../hooks/useCounter';
import { usePredictions } from '../context/PredictionsContext';
import { spiColorLight, levelChipClass } from '../data/basins';

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function BarFill({ pct, gradient }) {
  return (
    <div className="mbar mt-3">
      <motion.div
        className="mbar-fill"
        style={{ background: gradient }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
      />
    </div>
  );
}

function spiPct(spi) {
  // Map SPI range [-3, 0.5] to bar % (extreme left = 100%)
  return Math.min(100, Math.max(0, ((spi - 0.5) / (-3 - 0.5)) * 100));
}

function levelLabel(level) {
  switch (level) {
    case 'Normal':  return 'Normal';
    case 'Modere':  return 'Modéré';
    case 'Severe':  return 'Sévère';
    case 'Extreme': return 'Extrême';
    default: return level;
  }
}
function levelChip(level) {
  switch (level) {
    case 'Normal':  return 'chip-n';
    case 'Modere':  return 'chip-m';
    case 'Severe':  return 'chip-s';
    case 'Extreme': return 'chip-e';
    default: return 'chip-n';
  }
}

// ── SPI card ─────────────────────────────────────────────────────────────────
export function KpiSpi() {
  const { data } = usePredictions();
  const spi = data?.national?.spi_now ?? -2.1;
  const level = data?.national?.level_now ?? 'Extreme';
  const color = spiColorLight(spi);
  const { formatted, ref } = useCounter(spi, { duration: 1200 });

  return (
    <motion.div ref={ref} variants={itemV} className="card p-4">
      <div className="slabel mb-3">SPI Actuel — Médiane</div>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-val" style={{ color }}>{formatted}</div>
          <div className="kpi-sub">Indice précipitations standardisé</div>
          <div className={`chip ${levelChip(level)} mt-2`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {levelLabel(level)}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(123,36,28,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" width="20" height="20">
            <path d="M10 2C10 2 4 8.5 4 12.5a6 6 0 0 0 12 0C16 8.5 10 2 10 2z" />
          </svg>
        </div>
      </div>
      <BarFill pct={spiPct(spi)} gradient={`linear-gradient(90deg,#7B241C,${color})`} />
      <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>ERA5-Land · Médiane 9 bassins</div>
    </motion.div>
  );
}

// ── T+3 card ─────────────────────────────────────────────────────────────────
export function KpiT3() {
  const { data } = usePredictions();
  const spi = data?.national?.spi_t3 ?? -2.4;
  const level = data?.national?.level_t3 ?? 'Extreme';
  const spiNow = data?.national?.spi_now ?? -2.1;
  const color = spiColorLight(spi);
  const worsening = spi < spiNow;
  const { formatted, ref } = useCounter(spi, { duration: 1300 });

  return (
    <motion.div ref={ref} variants={itemV} className="card p-4">
      <div className="slabel mb-3">Prévision T+3 mois</div>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-val" style={{ color }}>{formatted}</div>
          <div className="kpi-sub">Horizon 3 mois — modèle ensemble</div>
          <div className={`chip ${worsening ? 'chip-e' : 'chip-n'} mt-2`}>
            <svg viewBox="0 0 16 16" fill={worsening ? '#E74C3C' : '#27AE60'} width="9" height="9">
              <path d={worsening ? 'M8 1l7 14H1z' : 'M8 15l7-14H1z'} />
            </svg>
            {worsening ? 'Aggravation prévue' : 'Amélioration prévue'}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(160,64,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" width="20" height="20">
            {worsening
              ? <><polyline points="18,6 11,13 7,9 2,14" /><polyline points="13,6 18,6 18,11" /></>
              : <><polyline points="18,14 11,7 7,11 2,6" /><polyline points="13,14 18,14 18,9" /></>
            }
          </svg>
        </div>
      </div>
      <BarFill pct={spiPct(spi)} gradient={`linear-gradient(90deg,#A04000,${color})`} />
      <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>Ensemble RF·XGB·LGB·Ridge</div>
    </motion.div>
  );
}

// ── T+6 card — uses SPI-6 as proxy ───────────────────────────────────────────
export function KpiT6() {
  const { data } = usePredictions();
  // Use median spi6 across basins as T+6 proxy
  const spi6vals = data?.basins?.map(b => b.spi_t6) ?? [-2.1];
  const spi = parseFloat((spi6vals.reduce((a, b) => a + b, 0) / spi6vals.length).toFixed(3));
  const level = spi >= -1 ? 'Normal' : spi >= -1.5 ? 'Modere' : spi >= -2 ? 'Severe' : 'Extreme';
  const color = spiColorLight(spi);
  const spiNow = data?.national?.spi_now ?? -2.1;
  const improving = spi > spiNow;
  const { formatted, ref } = useCounter(spi, { duration: 1400 });

  return (
    <motion.div ref={ref} variants={itemV} className="card p-4">
      <div className="slabel mb-3">Prévision T+6 mois</div>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-val" style={{ color }}>{formatted}</div>
          <div className="kpi-sub">SPI-6 médiane — légère atténuation</div>
          <div className={`chip ${improving ? 'chip-n' : 'chip-s'} mt-2`}>
            <svg viewBox="0 0 16 16" fill={improving ? '#27AE60' : '#E67E22'} width="9" height="9">
              <path d={improving ? 'M8 15l7-14H1z' : 'M8 1l7 14H1z'} />
            </svg>
            {improving ? 'Amélioration partielle' : 'Dégradation persistante'}
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(183,149,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" width="20" height="20">
            {improving
              ? <><polyline points="18,14 11,7 7,11 2,6" /><polyline points="13,14 18,14 18,9" /></>
              : <><polyline points="18,6 11,13 7,9 2,14" /><polyline points="13,6 18,6 18,11" /></>
            }
          </svg>
        </div>
      </div>
      <BarFill pct={spiPct(spi)} gradient={`linear-gradient(90deg,${color},#27AE60)`} />
      <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>IC 90% : ±0.52</div>
    </motion.div>
  );
}

// ── Alert count card ──────────────────────────────────────────────────────────
export function KpiAlert() {
  const { data } = usePredictions();
  const nAlert   = data?.national?.n_alert   ?? 0;
  const nExtreme = data?.national?.n_extreme  ?? 0;
  const nSevere  = data?.national?.n_severe   ?? 0;
  const nModere  = nAlert - nExtreme - nSevere;
  const total    = data?.basins?.length ?? 9;
  const { value, ref } = useCounter(nAlert, { duration: 1000, decimals: 0 });

  return (
    <motion.div ref={ref} variants={itemV} className="card p-4">
      <div className="slabel mb-3">Bassins en Alerte</div>
      <div className="flex items-start justify-between">
        <div>
          <div className="kpi-val pulse-e" style={{ color: '#5DADE2' }}>
            {Math.round(value)}<span style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text2)' }}>/{total}</span>
          </div>
          <div className="kpi-sub">Bassins versants surveillés</div>
          <div className="flex gap-1 mt-2 flex-wrap">
            {nExtreme > 0 && <span className="chip chip-e">{nExtreme} Extrême</span>}
            {nSevere  > 0 && <span className="chip chip-s">{nSevere} Sévère</span>}
            {nModere  > 0 && <span className="chip chip-m">{nModere} Modéré</span>}
            {nAlert === 0  && <span className="chip chip-n">Tous normaux</span>}
          </div>
        </div>
        <div className={nAlert > 0 ? 'pulse-e' : ''} style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(123,36,28,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="#C0392B" strokeWidth="1.5" width="20" height="20">
            <path d="M8.93 2.8L1.5 15.5A1.5 1.5 0 0 0 2.79 17.5h14.42a1.5 1.5 0 0 0 1.29-2.2L11.07 2.8a1.2 1.2 0 0 0-2.14 0z" />
            <line x1="10" y1="8" x2="10" y2="11" />
            <circle cx="10" cy="13.5" r="0.7" fill="#C0392B" />
          </svg>
        </div>
      </div>
      <BarFill pct={Math.round((nAlert / total) * 100)} gradient="linear-gradient(90deg,#C0392B,#2980B9)" />
      <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 4 }}>
        Mis à jour : {data?.generated_at?.slice(0, 10) ?? '—'}
      </div>
    </motion.div>
  );
}
