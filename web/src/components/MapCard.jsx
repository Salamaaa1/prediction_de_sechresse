import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { spiColor, spiColorLight } from '../data/basins';
import { usePredictions } from '../context/PredictionsContext';

// Loukkos fallback — small polygon in northwest Morocco not captured by HydroSHEDS level-4
const LOUKKOS_FALLBACK = {
  type: 'Feature',
  properties: { basin_name: 'Loukkos', spi: 0.2, fr_level: 'Normal', area_km2: 3620 },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-5.5, 34.8], [-5.9, 34.8], [-6.3, 35.0], [-6.5, 35.3],
      [-6.2, 35.6], [-5.7, 35.8], [-5.2, 35.7], [-5.1, 35.4],
      [-5.3, 35.1], [-5.5, 34.8],
    ]],
  },
};

const FR_LEVEL = {
  Normal:  'Normal',
  Modere:  'Modéré',
  Severe:  'Sévère',
  Extreme: 'Extrême',
};

const itemV = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function basinStyle(feature) {
  const { spi } = feature.properties;
  return {
    fillColor: spiColor(spi),
    fillOpacity: 0.55,
    color: spiColorLight(spi),
    weight: 1.2,
    opacity: 0.8,
  };
}

function onEachFeature(feature, layer) {
  const { basin_name, spi, fr_level, area_km2 } = feature.properties;
  const displayLevel = FR_LEVEL[fr_level] ?? fr_level;
  layer.bindTooltip(
    `<div class="basin-tip">
      <div class="tip-name">${basin_name}</div>
      <div class="tip-row"><span class="tip-label">SPI T+3</span><span class="tip-val" style="color:${spiColorLight(spi)}">${spi >= 0 ? '+' : ''}${spi.toFixed(1)}</span></div>
      <div class="tip-row"><span class="tip-label">Alerte</span><span class="tip-val">${displayLevel}</span></div>
      <div class="tip-row"><span class="tip-label">Surface</span><span class="tip-val">${area_km2.toLocaleString('fr-FR')} km²</span></div>
    </div>`,
    { sticky: true, opacity: 1, className: '' }
  );
  layer.on({
    mouseover(e) { e.target.setStyle({ fillOpacity: 0.75, weight: 2 }); },
    mouseout(e)  { e.target.setStyle(basinStyle(feature)); },
  });
}

const LEGEND = [
  { label: 'Humide (>+1)',      color: '#145A32' },
  { label: 'Normal (0→+1)',     color: '#1E8449' },
  { label: 'Sécheresse mod.',   color: '#B7950B' },
  { label: 'Sécheresse sév.',   color: '#922B21' },
];

export function MapCard() {
  const [geojson, setGeojson] = useState(null);
  const { data: predictions } = usePredictions();

  useEffect(() => {
    fetch('/bassins.geojson')
      .then(r => r.json())
      .then(data => {
        const names = new Set(data.features.map(f => f.properties.basin_name));
        if (!names.has('Loukkos')) data.features.push(LOUKKOS_FALLBACK);
        setGeojson(data);
      })
      .catch(() => {});
  }, []);

  // Merge real predictions.json SPI values onto GeoJSON features
  const mergedGeojson = useMemo(() => {
    if (!geojson) return null;
    if (!predictions?.basins) return geojson;

    const basinMap = {};
    predictions.basins.forEach(b => { basinMap[b.name] = b; });

    // Also try matching by basin_name field variants
    const nameMap = {
      'Loukkos': 'Loukkos', 'Tangerois': 'Tangerois', 'Moulouya': 'Moulouya',
      'Sebou': 'Sebou', 'Bouregreg': 'Bouregreg', 'Oum Er-Rbia': 'Oum Er-Rbia',
      'Tensift': 'Tensift', 'Souss-Massa': 'Souss-Massa', 'Draa-Ziz-Guir': 'Draa-Ziz-Guir',
    };

    const features = geojson.features.map(f => {
      const geoName = f.properties.basin_name;
      const predName = nameMap[geoName] ?? geoName;
      const pred = basinMap[predName];
      if (!pred) return f;
      return {
        ...f,
        properties: {
          ...f.properties,
          spi:      pred.spi_now,
          fr_level: pred.level_now,
          area_km2: pred.area_km2,
        },
      };
    });
    return { ...geojson, features };
  }, [geojson, predictions]);

  return (
    <motion.div variants={itemV} className="b-map card p-4 flex flex-col" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="slabel">Carte Hydrographique</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>
            Maroc — Bassins Versants &amp; Indice SPI
          </div>
        </div>
        <div className="flex gap-1.5">
          <span className="bdg">HydroSHEDS L4</span>
          <span className="bdg">CHIRPS 0.05°</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.8, flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 400, borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer
          center={[30.8, -7.0]}
          zoom={6}
          scrollWheelZoom={false}
          style={{ width: '100%', height: '100%', minHeight: 400 }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />
          {mergedGeojson && (
            <GeoJSON
              key={`basins-${predictions?.generated_at ?? 'static'}`}
              data={mergedGeojson}
              style={basinStyle}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
      </div>
    </motion.div>
  );
}
