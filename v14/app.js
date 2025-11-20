export const normalizeAndComputeSIS = (rows) => {
  const stats = { min: {}, max: {}, mean: {} };
  const cleaned = rows.map((r) => ({ ...r }));

  ['Carbon_Footprint', 'Water_Usage', 'Waste_Production_KG', 'Sustainability_Rating'].forEach((col) => {
    const vals = cleaned.map((r) => (Number.isFinite(r[col]) ? r[col] : NaN)).filter((v) => !Number.isNaN(v));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);

    stats.min[col] = min;
    stats.max[col] = max;
    stats.mean[col] = mean;

    cleaned.forEach((r) => {
      const v = Number.isFinite(r[col]) ? r[col] : mean;
      r[col] = v;
      r[`${col}_norm`] = (v - min) / (max - min || 1);
    });
  });

  const rowsWithSIS = cleaned.map((r) => {
    const scoreNorm = r.Sustainability_Rating === "A" ? 1 : (r.Sustainability_Rating === "B" ? 0.8 : 0.5);
    const co2n = r.Carbon_Footprint_norm || 0;
    const watern = r.Water_Usage_norm || 0;
    const wastn = r.Waste_Production_KG_norm || 0;
    r.SIS = (scoreNorm + (1 - co2n) + (1 - watern) + (1 - wastn)) / 4;
    return r;
  });

  return { rowsWithSIS, stats };
};
