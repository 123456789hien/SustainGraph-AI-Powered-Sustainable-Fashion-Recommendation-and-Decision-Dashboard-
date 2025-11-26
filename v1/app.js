/* app.js
   Core logic for SustainGraph: parsing CSV, computing SIS, clustering, recommendation.
   No imports, everything is global so script.js can call these functions.
*/

/* ========== CSV PARSER (simple, no PapaParse) ========== */

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const parts = line.split(delim);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = parts[i] !== undefined ? parts[i].trim() : "";
    });
    return obj;
  });
  return rows;
}

function parseCSVFile(file) {
  return file.text().then((txt) => parseCSVText(txt));
}

/* ========== HELPERS ========== */

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  const x = Number(s);
  return isNaN(x) ? NaN : x;
}

function ratingLetterToScore(r) {
  const x = String(r || "").trim().toUpperCase();
  if (x === "A") return 1.0;
  if (x === "B") return 0.85;
  if (x === "C") return 0.65;
  if (x === "D") return 0.45;
  return 0.55; // fallback
}

function yesNoScore(val) {
  const x = String(val || "").trim().toLowerCase();
  if (x === "yes" || x === "y" || x === "true") return 1.0;
  if (x === "no" || x === "n" || x === "false") return 0.5;
  return 0.75;
}

function normalizeMinMax(values) {
  const clean = values.filter((v) => isFinite(v));
  if (!clean.length) return { min: 0, max: 1, norm: values.map(() => 0.5) };
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  return {
    min,
    max,
    norm: values.map((v) =>
      !isFinite(v) ? 0.5 : (v - min) / range
    ),
  };
}

/* ===== PCA-based weights for 3 impact features: CO2, Water, Waste ===== */

function computePcaWeights3(co2Arr, waterArr, wasteArr) {
  const triples = [];
  for (let i = 0; i < co2Arr.length; i++) {
    const c = co2Arr[i];
    const w = waterArr[i];
    const t = wasteArr[i];
    if (isFinite(c) && isFinite(w) && isFinite(t)) {
      triples.push([c, w, t]);
    }
  }
  if (triples.length < 3) {
    // fallback: equal weights
    return [1 / 3, 1 / 3, 1 / 3];
  }

  const n = triples.length;
  const mean = [0, 0, 0];
  const std = [0, 0, 0];

  // mean
  for (let i = 0; i < n; i++) {
    mean[0] += triples[i][0];
    mean[1] += triples[i][1];
    mean[2] += triples[i][2];
  }
  mean[0] /= n;
  mean[1] /= n;
  mean[2] /= n;

  // std
  for (let i = 0; i < n; i++) {
    std[0] += Math.pow(triples[i][0] - mean[0], 2);
    std[1] += Math.pow(triples[i][1] - mean[1], 2);
    std[2] += Math.pow(triples[i][2] - mean[2], 2);
  }
  std[0] = Math.sqrt(std[0] / (n - 1 || 1)) || 1;
  std[1] = Math.sqrt(std[1] / (n - 1 || 1)) || 1;
  std[2] = Math.sqrt(std[2] / (n - 1 || 1)) || 1;

  // build standardized data Z
  const Z = triples.map((row) => [
    (row[0] - mean[0]) / std[0],
    (row[1] - mean[1]) / std[1],
    (row[2] - mean[2]) / std[2],
  ]);

  // covariance matrix 3x3
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < n; i++) {
    const z = Z[i];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        C[a][b] += z[a] * z[b];
      }
    }
  }
  const denom = n - 1 || 1;
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      C[a][b] /= denom;
    }
  }

  // power iteration for principal eigenvector
  let v = [1, 1, 1];
  for (let iter = 0; iter < 30; iter++) {
    const w = [
      C[0][0] * v[0] + C[0][1] * v[1] + C[0][2] * v[2],
      C[1][0] * v[0] + C[1][1] * v[1] + C[1][2] * v[2],
      C[2][0] * v[0] + C[2][1] * v[1] + C[2][2] * v[2],
    ];
    const norm =
      Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]) || 1;
    v = [w[0] / norm, w[1] / norm, w[2] / norm];
  }

  const absV = v.map((x) => Math.abs(x));
  const sumAbs = absV[0] + absV[1] + absV[2] || 1;
  return [absV[0] / sumAbs, absV[1] / sumAbs, absV[2] / sumAbs];
}

/* ========== PREPROCESS + SIS (CO2 + WATER + WASTE + policy) ========== */

function preprocessRows(rawRows) {
  return rawRows.map((r) => {
    const Brand_ID = r.Brand_ID || r["Brand_ID"] || "";
    const Brand_Name = r.Brand_Name || r["Brand_Name"] || "";
    const Country = r.Country || "";
    const Year = parseInt(r.Year || r[" Year"] || r.year || "", 10);
    const Sustainability_Rating =
      r.Sustainability_Rating || r["Sustainability_Rating"] || "";
    const Material_Type =
      (r.Material_Type || r["Material_Type"] || r.material || "").trim();
    const Eco_Friendly_Manufacturing =
      r.Eco_Friendly_Manufacturing || r["Eco_Friendly_Manufacturing"] || "";
    const Carbon_Footprint_MT = toNumber(
      r.Carbon_Footprint_MT || r["Carbon_Footprint_MT"] || r.Carbon || ""
    );
    const Water_Usage_Liters = toNumber(
      r.Water_Usage_Liters || r["Water_Usage_Liters"] || r.Water || ""
    );
    const Waste_Production_KG = toNumber(
      r.Waste_Production_KG || r["Waste_Production_KG"] || r.Waste || ""
    );
    const Recycling_Programs =
      r.Recycling_Programs || r["Recycling_Programs"] || "";
    const Product_Lines = toNumber(r.Product_Lines || r["Product_Lines"] || "");
    const Average_Price_USD = toNumber(
      r.Average_Price_USD || r["Average_Price_USD"] || r.Price || ""
    );
    const Market_Trend = r.Market_Trend || r["Market_Trend"] || "";
    const Certifications = r.Certifications || r["Certifications"] || "";

    return {
      Brand_ID,
      Brand_Name,
      Country,
      Year: isNaN(Year) ? null : Year,
      Sustainability_Rating,
      Material_Type,
      Eco_Friendly_Manufacturing,
      Carbon_Footprint_MT,
      Water_Usage_Liters,
      Waste_Production_KG,
      Recycling_Programs,
      Product_Lines: isNaN(Product_Lines) ? null : Product_Lines,
      Average_Price_USD: isNaN(Average_Price_USD) ? null : Average_Price_USD,
      Market_Trend,
      Certifications,
    };
  });
}

function normalizeAndComputeSIS(rawRows) {
  const rows = preprocessRows(rawRows);

  const co2Arr = rows.map((r) => r.Carbon_Footprint_MT);
  const waterArr = rows.map((r) => r.Water_Usage_Liters);
  const wasteArr = rows.map((r) => r.Waste_Production_KG);
  const priceArr = rows.map((r) => r.Average_Price_USD);

  const co2Norm = normalizeMinMax(co2Arr);
  const waterNorm = normalizeMinMax(waterArr);
  const wasteNorm = normalizeMinMax(wasteArr);
  const priceNorm = normalizeMinMax(priceArr);

  // PCA-based weights for three environmental impacts
  const [wCO2, wWater, wWaste] = computePcaWeights3(
    co2Arr,
    waterArr,
    wasteArr
  );

  const rowsWithSIS = rows.map((r, i) => {
    const ratingScore = ratingLetterToScore(r.Sustainability_Rating);
    const ecoScore = yesNoScore(r.Eco_Friendly_Manufacturing);
    const recScore = yesNoScore(r.Recycling_Programs);

    const co2n = co2Norm.norm[i];
    const watern = waterNorm.norm[i];
    const wasten = wasteNorm.norm[i];

    // 3 environmental components, each reversed (lower impact => higher score)
    const envScore =
      wCO2 * (1 - co2n) +
      wWater * (1 - watern) +
      wWaste * (1 - wasten);

    // Governance / policy / management side
    const policyScore = (ratingScore + ecoScore + recScore) / 3;

    // Final SIS: 60% environment, 40% policy (khoa học hơn 0.7/0.3 cũ)
    const SIS = (envScore * 0.6 + policyScore * 0.4).toFixed(4) * 1;

    return {
      ...r,
      Carbon_Footprint_norm: co2n,
      Water_Usage_norm: watern,
      Waste_Production_norm: wasten,
      Price_norm: priceNorm.norm[i],
      SIS,
    };
  });

  const stats = {
    mean: {
      Carbon_Footprint_MT:
        co2Arr.filter(isFinite).reduce((s, v) => s + v, 0) /
          (co2Arr.filter(isFinite).length || 1),
      Water_Usage_Liters:
        waterArr.filter(isFinite).reduce((s, v) => s + v, 0) /
          (waterArr.filter(isFinite).length || 1),
      Waste_Production_KG:
        wasteArr.filter(isFinite).reduce((s, v) => s + v, 0) /
          (wasteArr.filter(isFinite).length || 1),
      Average_Price_USD:
        priceArr.filter(isFinite).reduce((s, v) => s + v, 0) /
          (priceArr.filter(isFinite).length || 1),
      SIS:
        rowsWithSIS.reduce((s, r) => s + (r.SIS || 0), 0) /
        (rowsWithSIS.length || 1),
    },
    envWeights: { wCO2, wWater, wWaste },
  };

  const materialAgg = computeMaterialAgg(rowsWithSIS);

  return { rowsWithSIS, stats, materialAgg };
}

/* ========== MATERIAL AGGREGATION ========== */

function computeMaterialAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const key = r.Material_Type || "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        Material_Type: key,
        sumCO2: 0,
        sumWater: 0,
        sumWaste: 0,
        sumSIS: 0,
        sumPrice: 0,
        count: 0,
      });
    }
    const m = map.get(key);
    m.sumCO2 += r.Carbon_Footprint_MT || 0;
    m.sumWater += r.Water_Usage_Liters || 0;
    m.sumWaste += r.Waste_Production_KG || 0;
    m.sumSIS += r.SIS || 0;
    m.sumPrice += r.Average_Price_USD || 0;
    m.count += 1;
  });

  return Array.from(map.values()).map((m) => ({
    Material_Type: m.Material_Type,
    meanCarbon: m.sumCO2 / m.count,
    meanWater: m.sumWater / m.count,
    meanWaste: m.sumWaste / m.count,
    meanSIS: m.sumSIS / m.count,
    meanPrice: m.sumPrice / m.count,
    count: m.count,
  }));
}

/* ========== SIMPLE KMEANS (3 CLUSTERS) ========== */

function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function runKMeans(X, k = 3, maxIter = 40) {
  const n = X.length;
  if (!n) return { centroids: [], assignments: [] };
  const dim = X[0].length;

  const centroids = [];
  const used = new Set();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * n);
    if (!used.has(idx)) {
      centroids.push(X[idx].slice());
      used.add(idx);
    }
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestd = euclid(X[i], centroids[0]);
      for (let c = 1; c < k; c++) {
        const d = euclid(X[i], centroids[c]);
        if (d < bestd) {
          bestd = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    const sums = Array(k)
      .fill(0)
      .map(() => Array(dim).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) sums[c][j] += X[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (!counts[c]) continue;
      for (let j = 0; j < dim; j++) {
        centroids[c][j] = sums[c][j] / counts[c];
      }
    }

    if (!changed) break;
  }

  return { centroids, assignments };
}

/* ========== "PCA" PROJECTION (USE CO2 vs WATER NORMALIZED) ========== */

function computePcaLikeCoords(materialAgg) {
  const co2 = materialAgg.map((m) => m.meanCarbon);
  const water = materialAgg.map((m) => m.meanWater);
  const co2Norm = normalizeMinMax(co2);
  const waterNorm = normalizeMinMax(water);

  return materialAgg.map((m, i) => ({
    Material_Type: m.Material_Type,
    x: co2Norm.norm[i],
    y: waterNorm.norm[i],
  }));
}

/* ========== RECOMMENDER ========== */

function buildRecommendations(rowsWithSIS, priorityWeight, topN = 10) {
  const prices = rowsWithSIS.map((r) => r.Average_Price_USD);
  const pNorm = normalizeMinMax(prices);

  const items = rowsWithSIS.map((r, i) => {
    const SIS = r.SIS || 0;
    const priceNorm = pNorm.norm[i];
    const sustainabilityTerm = SIS;
    const priceTerm = 1 - priceNorm;

    const finalScore =
      priorityWeight * sustainabilityTerm +
      (1 - priorityWeight) * priceTerm;

    return {
      ...r,
      priceNorm,
      finalScore,
    };
  });

  return items
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);
}
