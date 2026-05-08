import { motion, AnimatePresence } from 'framer-motion';
import { Doughnut } from 'react-chartjs-2';
import { usePredictions } from '../context/PredictionsContext';
import { spiColorLight } from '../data/basins';
import { ALERT_DONUT_OPTIONS } from '../data/chartData';

const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rowV = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};
const cardV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const LEVEL_FR = { Normal: 'Normal', Modere: 'Modéré', Severe: 'Sévère', Extreme: 'Extrême' };
const CHIP_CLS = { Normal: 'chip-n', Modere: 'chip-m', Severe: 'chip-s', Extreme: 'chip-e' };

function LevelDot({ level, spi }) {
  const color = spiColorLight(spi);
  return (
    <span
      className={level === 'Extreme' ? 'pulse-e' : ''}
      style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }}
    />
  );
}

export function AlertList() {
  const { data } = usePredictions();

  // Sort basins by SPI ascending (worst first)
  const basins = data?.basins
    ? [...data.basins].sort((a, b) => a.spi_now - b.spi_now)
    : [];

  // Counts for doughnut
  const counts = { Extreme: 0, Severe: 0, Modere: 0, Normal: 0 };
  basins.forEach(b => { counts[b.level_now] = (counts[b.level_now] || 0) + 1; });

  const donutData = {
    labels: ['Extrême', 'Sévère', 'Modéré', 'Normal'],
    datasets: [{
      data: [counts.Extreme, counts.Severe, counts.Modere, counts.Normal],
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

  return (
    <motion.div variants={cardV} className="b-alert card p-4 flex flex-col">
      <div className="slabel mb-1">Système d'Alerte</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
        Bassins — SPI Actuel
      </div>

      <motion.div
        className="flex flex-col gap-1.5 flex-1"
        style={{ overflowY: 'auto', maxHeight: 260 }}
        variants={containerV}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence>
          {basins.map(({ name, spi_now, level_now }) => (
            <motion.div key={name} variants={rowV} className="arow">
              <LevelDot level={level_now} spi={spi_now} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </div>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: spiColorLight(spi_now) }}>
                  SPI {spi_now >= 0 ? '+' : ''}{spi_now.toFixed(2)}
                </div>
              </div>
              <span className={`chip ${CHIP_CLS[level_now] ?? 'chip-n'}`}>
                {LEVEL_FR[level_now] ?? level_now}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <div style={{ marginTop: 12, height: 110, position: 'relative' }}>
        <Doughnut data={donutData} options={ALERT_DONUT_OPTIONS} />
      </div>
    </motion.div>
  );
}
