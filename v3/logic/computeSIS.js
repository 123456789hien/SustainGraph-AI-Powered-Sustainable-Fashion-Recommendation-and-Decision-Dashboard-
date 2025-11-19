export function computeSIS(rows) {
  // Tính Sustainability Index Score (SIS) cho mỗi sản phẩm
  return rows.map(r => {
    const scoreNorm =
      Number.isFinite(r.Overall_Sustainability_Score)
        ? r.Overall_Sustainability_Score / 5
        : 0.5;

    const co2n = r.Carbon_Footprint_norm || 0;
    const watern = r.Water_Usage_norm || 0;
    const wastn = r.Waste_Generation_norm || 0;

    // Công thức tính SIS
    r.SIS = (scoreNorm + (1 - co2n) + (1 - watern) + (1 - wastn)) / 4;
    return r;
  });
}
