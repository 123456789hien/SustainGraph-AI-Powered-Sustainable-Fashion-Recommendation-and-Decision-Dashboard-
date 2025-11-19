export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data),
      error: err => reject(err),
    });
  });
}

// Hàm chuẩn hóa cột dữ liệu
export function normalizeCols(rows, numericCols) {
  const cleaned = rows.map(r => ({ ...r }));
  const stats = { min: {}, max: {}, mean: {} };

  numericCols.forEach(col => {
    const vals = cleaned
      .map(r => (Number.isFinite(r[col]) ? r[col] : NaN))
      .filter(v => !Number.isNaN(v));

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);

    stats.min[col] = min;
    stats.max[col] = max;
    stats.mean[col] = mean;

    cleaned.forEach(r => {
      const v = Number.isFinite(r[col]) ? r[col] : mean;
      r[col] = v;
      r[`${col}_norm`] = (v - min) / (max - min || 1);
    });
  });

  return { cleaned, stats };
}
