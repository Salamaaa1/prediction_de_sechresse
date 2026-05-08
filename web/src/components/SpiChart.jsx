import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { usePredictions } from '../context/PredictionsContext';
import { SPI_CHART_OPTIONS } from '../data/chartData';

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const LEGEND_ITEMS = [
  { color: '#2980B9', label: 'SPI Obs.', dashed: false },
  { color: '#27AE60', label: 'Prév. T+3', dashed: true },
  { color: '#D4AC0D', label: 'Prév. T+6', dashed: true },
  { color: 'rgba(192,57,43,0.12)', label: 'Zone critique', bar: true },
];

// Month labels: 'Jan 24' format
function fmtDate(dateStr) {
  const [y, m] = dateStr.split('-');
  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  return `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function SpiChart() {
  const { data } = usePredictions();
  const [mode, setMode] = useState('t3');
  const [selectedBasin, setSelectedBasin] = useState('national');

  const chartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };

    // Build national average series or per-basin
    let series;
    if (selectedBasin === 'national') {
      // Average SPI3 across all basins per date
      const allSeries = Object.values(data.spi_series);
      const dateMap = {};
      allSeries.forEach(s => {
        s.forEach(({ date, spi3, spi6 }) => {
          if (!dateMap[date]) dateMap[date] = { spi3s: [], spi6s: [] };
          if (spi3 != null) dateMap[date].spi3s.push(spi3);
          if (spi6 != null) dateMap[date].spi6s.push(spi6);
        });
      });
      series = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { spi3s, spi6s }]) => ({
          date,
          spi3: spi3s.length ? parseFloat((spi3s.reduce((a, b) => a + b, 0) / spi3s.length).toFixed(3)) : null,
          spi6: spi6s.length ? parseFloat((spi6s.reduce((a, b) => a + b, 0) / spi6s.length).toFixed(3)) : null,
        }));
    } else {
      series = (data.spi_series[selectedBasin] || []).sort((a, b) => a.date.localeCompare(b.date));
    }

    const labels = series.map(s => fmtDate(s.date));
    const obs3   = series.map(s => s.spi3);
    const obs6   = series.map(s => s.spi6);

    // Add T+3 and T+6 forecast points (from basins or national)
    const basinRef = selectedBasin === 'national'
      ? data.national
      : data.basins?.find(b => b.name === selectedBasin) ?? data.national;

    const lastObs = labels.length - 1;
    const t3Labels = [...labels, 'T+1', 'T+2', 'T+3'];
    const t3Obs   = [...obs3, null, null, null];
    const forecasts = basinRef.forecasts ?? [basinRef.spi_t3, basinRef.spi_t3, basinRef.spi_t3];
    const t3Prev = [...obs3.map(() => null), forecasts[0], forecasts[1], forecasts[2]];
    // Bridge last point
    t3Prev[lastObs] = obs3[lastObs];

    const t6Labels = [...labels, 'SPI-6'];
    const t6Prev  = [...obs6.map(() => null), basinRef.spi_t6 ?? null];
    t6Prev[lastObs] = obs6[lastObs];

    const datasets = [
      {
        label: 'SPI-3 Observé',
        data: mode === 't6' ? obs6 : obs3,
        borderColor: '#2980B9',
        backgroundColor: 'rgba(41,128,185,0.08)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: false,
      },
    ];

    if (mode !== 't6') {
      datasets.push({
        label: 'Prévision T+3',
        data: [...obs3.map(() => null), forecasts[0], forecasts[1], forecasts[2]].map((v, i) =>
          i === lastObs ? obs3[lastObs] : v
        ),
        borderColor: '#27AE60',
        borderDash: [5, 4],
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
      });
    }

    if (mode !== 't3') {
      datasets.push({
        label: 'SPI-6 Observé',
        data: obs6,
        borderColor: '#D4AC0D',
        borderDash: [5, 4],
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.4,
        fill: false,
      });
    }

    const finalLabels = mode === 't3' ? [...labels, 'T+1', 'T+2', 'T+3'] : labels;
    // Pad datasets to match labels length
    datasets.forEach(d => {
      while (d.data.length < finalLabels.length) d.data.push(null);
    });

    return { labels: finalLabels, datasets };
  }, [data, mode, selectedBasin]);

  const basinOptions = ['national', ...(data?.basins?.map(b => b.name) ?? [])];

  return (
    <motion.div variants={itemV} className="b-spi card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="slabel">Série Temporelle — ERA5-Land</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
            SPI — Historique Réel &amp; Prévisions Ensemble
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={selectedBasin}
            onChange={e => setSelectedBasin(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text2)', fontFamily: 'Fira Code',
              fontSize: '0.68rem', padding: '3px 8px', cursor: 'pointer',
            }}
          >
            <option value="national">National (médiane)</option>
            {data?.basins?.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
          <div className="htog">
            {['t3', 't6', 'both'].map((m) => (
              <button key={m} className={`htbtn${mode === m ? ' on' : ''}`} onClick={() => setMode(m)}>
                {m === 'both' ? 'Les deux' : m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-5 mb-3 flex-wrap" style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>
        {LEGEND_ITEMS.map(({ color, label, dashed, bar }) => (
          <div key={label} className="flex items-center gap-2">
            {bar
              ? <div style={{ width: 20, height: 8, background: color, borderRadius: 2 }} />
              : <div style={{ width: 20, height: 2, background: color, borderRadius: 1,
                  borderBottom: dashed ? `2px dashed ${color}` : undefined }} />
            }
            {label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 230, position: 'relative' }}>
        {data ? (
          <Line data={chartData} options={SPI_CHART_OPTIONS} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: '0.75rem' }}>
            Chargement des données ERA5-Land…
          </div>
        )}
      </div>
    </motion.div>
  );
}
