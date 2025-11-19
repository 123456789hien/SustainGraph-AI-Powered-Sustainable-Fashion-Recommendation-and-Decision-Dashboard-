import React from 'react';

function KPIBar({ rows, stats }) {
  if (!rows.length) return null;

  const avgSIS = rows.reduce((acc, r) => acc + (r.SIS || 0), 0) / rows.length;
  const avgCO2 = stats?.mean?.Carbon_Footprint || 0;
  const avgWater = stats?.mean?.Water_Usage || 0;
  const avgWaste = stats?.mean?.Waste_Generation || 0;

  return (
    <div className="card">
      <h2>Key Performance Indicators</h2>
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-title">Avg SIS</div>
          <div className="kpi-value">{avgSIS.toFixed(2)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Avg CO₂</div>
          <div className="kpi-value">{avgCO2.toFixed(2)} MT</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Avg Water</div>
          <div className="kpi-value">{avgWater.toFixed(0)} L</div>
        </div>
        <div className="kpi">
          <div className="kpi-title">Avg Waste</div>
          <div className="kpi-value">{avgWaste.toFixed(2)} KG</div>
        </div>
      </div>
    </div>
  );
}

export default KPIBar;
