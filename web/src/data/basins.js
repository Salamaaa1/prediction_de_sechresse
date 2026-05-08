function mkF(name, spi, level, area_km2, ring) {
  return {
    type: 'Feature',
    properties: { name, spi, level, area_km2 },
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
  };
}

// Morocco's 9 official hydraulic basins — approximate GeoJSON polygons
// Ordered largest → smallest so smaller basins render on top in Leaflet
export const BASINS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    mkF('Drâa-Ziz-Guir', -1.7, 'Sévère', 111000, [
      [-17.0, 27.5], [-1.5, 27.5], [-1.5, 32.0],
      [-4.2, 32.0],  [-4.2, 28.5], [-10.5, 28.5],
    ]),
    mkF('Moulouya', -1.8, 'Sévère', 51600, [
      [-4.2, 32.0], [-1.5, 32.0], [-1.7, 36.0], [-4.2, 36.0],
    ]),
    mkF('Sebou', -1.1, 'Modéré', 40000, [
      [-7.8, 33.0], [-4.2, 33.0], [-4.2, 35.2], [-7.8, 35.0],
    ]),
    mkF('Souss-Massa', -2.4, 'Extrême', 25400, [
      [-10.5, 28.5], [-4.2, 28.5], [-4.2, 30.0], [-10.5, 30.0],
    ]),
    mkF('Oum Er-Rbia', -1.9, 'Sévère', 35000, [
      [-9.5, 31.0], [-4.2, 31.0], [-4.2, 32.0], [-9.5, 32.0],
    ]),
    mkF('Tensift', -2.2, 'Extrême', 19800, [
      [-9.5, 30.0], [-4.2, 30.0], [-4.2, 31.0], [-9.5, 31.0],
    ]),
    mkF('Bouregreg', -1.6, 'Sévère', 9950, [
      [-9.5, 32.0], [-4.2, 32.0], [-4.2, 33.0], [-7.8, 33.0], [-9.5, 32.5],
    ]),
    mkF('Loukkos', 0.2, 'Normal', 3620, [
      [-7.2, 34.4], [-5.9, 34.4], [-5.9, 35.1], [-6.6, 35.2], [-7.2, 35.0],
    ]),
    mkF('Tangérois', -0.4, 'Normal', 1380, [
      [-5.9, 35.1], [-4.2, 35.2], [-4.3, 36.0], [-5.2, 36.0], [-5.9, 35.9],
    ]),
  ],
};

export const BASIN_META = [
  { name: 'Souss-Massa',   spi: -2.4, level: 'Extrême', trend: 'down' },
  { name: 'Tensift',        spi: -2.2, level: 'Extrême', trend: 'down' },
  { name: 'Oum Er-Rbia',   spi: -1.9, level: 'Sévère',  trend: 'down' },
  { name: 'Moulouya',       spi: -1.8, level: 'Sévère',  trend: 'down' },
  { name: 'Drâa-Ziz',      spi: -1.7, level: 'Sévère',  trend: 'down' },
  { name: 'Bouregreg',      spi: -1.6, level: 'Sévère',  trend: 'stable' },
  { name: 'Sebou',          spi: -1.1, level: 'Modéré',  trend: 'up' },
  { name: 'Loukkos',        spi:  0.2, level: 'Normal',  trend: 'up' },
];

export function spiColor(spi) {
  if (spi >=  1.0) return '#145A32';   // extremely wet
  if (spi >=  0.0) return '#1E8449';   // normal/wet
  if (spi >= -1.0) return '#1A5276';   // near-normal dry
  if (spi >= -1.5) return '#B7950B';   // moderate drought
  if (spi >= -2.0) return '#A04000';   // severe drought
  return '#7B241C';                    // extreme drought
}

export function spiColorLight(spi) {
  if (spi >=  1.0) return '#27AE60';
  if (spi >=  0.0) return '#52BE80';
  if (spi >= -1.0) return '#5DADE2';
  if (spi >= -1.5) return '#D4AC0D';
  if (spi >= -2.0) return '#E67E22';
  return '#C0392B';
}

export function levelChipClass(level) {
  switch (level) {
    case 'Normal':  return 'chip-n';
    case 'Modéré':  return 'chip-m';
    case 'Sévère':  return 'chip-s';
    case 'Extrême': return 'chip-e';
    default:        return 'chip-n';
  }
}
