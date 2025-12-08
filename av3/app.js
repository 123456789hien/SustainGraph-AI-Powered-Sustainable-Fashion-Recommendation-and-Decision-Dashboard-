/* app.js
   Core logic for SustainGraph: parsing CSV, computing SIS (Entropy weights),
   K-Means + Elbow, Pareto frontier, recommendation, and EDA aggregations.
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

/* ========== BASIC HELPERS ========== */

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  const x = Number(s);
  return isNaN(x) ? NaN : x;
}

/**
 * Map letter rating to numeric [0,1] with A=4, B=3, C=2, D=1.
 * Then scale by /4 to bring into [0.25, 1].
 */
function ratingLetterToScore(r) {
  const x = String(r || "").trim().toUpperCase();
  let base;
  if (x === "A") base = 4;
  else if (x === "B") base = 3;
  else if (x === "C") base = 2;
  else if (x === "D") base = 1;
  else base = 2.5; // fallback around midpoint
  return base / 4; // 1.00, 0.75, 0.50, 0.25
}

/**
 * Strict yes/no mapping to [0,1].
 * Unknown → 0.5 to avoid dropping rows.
 */
function yesNoScore(val) {
  const x = String(val || "").trim().toLowerCase();
  if (x === "yes" || x === "y" || x === "true") return 1.0;
  if (x === "no" || x === "n" || x === "false") return 0.0;
  return 0.5;
}

/**
 * Standard min–max normalization for a numeric array.
 * Missing/NaN → 0.5 by default (neutral).
 */
function normalizeMinMax(values) {
  const clean = values.filter((v) => isFinite(v));
  if (!clean.length) {
    return { min: 0, max: 1, norm: values.map(() => 0.5) };
  }
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

/* ========== ENTROPY WEIGHT METHOD (2 indicators: Env, Policy) ========== */

/**
 * Compute entropy-based weights for two indicator columns:
 *   col1 = environmental_score array
 *   col2 = policy_score array
 * Returns { weights: [w_env, w_policy], entropy: [E_env, E_policy] }
 *
 * Standard formula:
 * 1) Normalize each column: f_ij = x_ij / sum_i x_ij
 * 2) E_j = -k * Σ_i f_ij * ln(f_ij),   k = 1 / ln(m)
 * 3) d_j = 1 - E_j
 * 4) w_j = d_j / Σ_j d_j
 */
function computeEntropyWeightsTwo(envScores, policyScores) {
  const m = envScores.length;
  const n = 2;
  if (!m) {
    return {
      weights: [0.5, 0.5],
      entropy: [0, 0],
    };
  }

  const cols = [envScores, policyScores].map((col) =>
    col.map((v) => (isFinite(v) && v > 0 ? v : 0))
  );

  // Column sums
  const sums = cols.map((col) =>
    col.reduce((s, v) => s + v, 0)
  );

  const f = cols.map((col, j) => {
    const sum = sums[j];
    if (sum === 0) {
      const uniform = 1 / m;
      return col.map(() => uniform);
    }
    return col.map((v) => v / sum);
  });

  const kConst = 1 / Math.log(m);
  const entropy = [];

  for (let j = 0; j < n; j++) {
    let Ej = 0;
    for (let i = 0; i < m; i++) {
      const fij = f[j][i];
      if (fij > 0) {
        Ej += fij * Math.log(fij);
      }
    }
    Ej = -kConst * Ej;
    entropy.push(Ej);
  }

  const d = entropy.map((Ej) => 1 - Ej);
  const dSum = d.reduce((s, v) => s + v, 0);

  let w_env = 0.5;
  let w_policy = 0.5;
  if (dSum > 0) {
    w_env = d[0] / dSum;
    w_policy = d[1] / dSum;
  }

  return {
    weights: [w_env, w_policy],
    entropy,
  };
}

/* ========== PREPROCESS + SIS (Entropy-based) ========== */

function preprocessRows(rawRows) {
  return rawRows.map((r) => {
    const Brand_ID = r.Brand_ID || r["Brand_ID"] || "";
    const Brand_Name = r.Brand_Name || r["Brand_Name"] || "";
    const Country = r.Country || "";
    const Year = parseInt(r.Year || r[" Year"] || r.year || "", 10);
    const Sustainability_Rating =
      r.Sustainability_Rating || r["Sustainability_Rating"] || "";
    const Material_Type =
      r.Material_Type || r["Material_Type"] || r.material || "";
    const Eco_Friendly_Manufacturing =
      r.Eco_Friendly_Manufacturing || r["Eco_Friendly_Manufacturing"] || "";
    const Carbon_Footprint_MT = toNumber(
      r.Carbon_Footprint_MT ||
        r["Carbon_Footprint_MT"] ||
        r.Carbon ||
        ""
    );
    const Water_Usage_Liters = toNumber(
      r.Water_Usage_Liters ||
        r["Water_Usage_Liters"] ||
        r.Water ||
        ""
    );
    const Waste_Production_KG = toNumber(
      r.Waste_Production_KG ||
        r["Waste_Production_KG"] ||
        r.Waste ||
        ""
    );
    const Recycling_Programs =
      r.Recycling_Programs || r["Recycling_Programs"] || "";
    const Product_Lines = toNumber(
      r.Product_Lines || r["Product_Lines"] || ""
    );
    const Average_Price_USD = toNumber(
      r.Average_Price_USD ||
        r["Average_Price_USD"] ||
        r.Price ||
        ""
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

/**
 * Main pipeline step:
 * - preprocess rows
 * - normalize CO₂, water, waste, price
 * - compute environmental_score & policy_score per row
 * - compute entropy weights w_env, w_policy
 * - compute SIS = w_env * env + w_policy * policy
 * - aggregate by material
 */
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

  const envScores = [];
  const policyScores = [];

  // First pass: compute environmental_score & policy_score for each row
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const co2n = co2Norm.norm[i];
    const watern = waterNorm.norm[i];
    const wasten = wasteNorm.norm[i];

    const envScore =
      (1 - co2n + 1 - watern + 1 - wasten) / 3;

    const ratingScore = ratingLetterToScore(
      r.Sustainability_Rating
    );
    const ecoScore = yesNoScore(r.Eco_Friendly_Manufacturing);
    const recScore = yesNoScore(r.Recycling_Programs);

    const policyScore =
      (ratingScore + ecoScore + recScore) / 3;

    envScores.push(envScore);
    policyScores.push(policyScore);
  }

  // Entropy-based weights for Environmental vs Policy
  const ew = computeEntropyWeightsTwo(envScores, policyScores);
  const w_env = ew.weights[0];
  const w_policy = ew.weights[1];

  // Second pass: construct rows with SIS + normalized fields
  const rowsWithSIS = rows.map((r, i) => {
    const co2n = co2Norm.norm[i];
    const watern = waterNorm.norm[i];
    const wasten = wasteNorm.norm[i];

    const environmental_score = envScores[i];
    const policy_score = policyScores[i];

    const SIS =
      w_env * environmental_score +
      w_policy * policy_score;

    return {
      ...r,
      Carbon_Footprint_norm: co2n,
      Water_Usage_norm: watern,
      Waste_Production_norm: wasten,
      Price_norm: priceNorm.norm[i],
      environmental_score,
      policy_score,
      SIS,
    };
  });

  // Basic statistics for KPIs
  const finite = (arr) => arr.filter((v) => isFinite(v));
  const meanOf = (arr) => {
    const c = finite(arr);
    return c.length
      ? c.reduce((s, v) => s + v, 0) / c.length
      : 0;
  };

  const stats = {
    mean: {
      Carbon_Footprint_MT: meanOf(co2Arr),
      Water_Usage_Liters: meanOf(waterArr),
      Waste_Production_KG: meanOf(wasteArr),
      Average_Price_USD: meanOf(priceArr),
      SIS: meanOf(rowsWithSIS.map((r) => r.SIS || 0)),
    },
    entropy: {
      env: ew.entropy[0],
      policy: ew.entropy[1],
    },
    weights: {
      w_env,
      w_policy,
    },
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

/* ========== K-MEANS + ELBOW METHOD ========== */

function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * Standard K-Means for given k.
 */
function runKMeans(X, k, maxIter = 40) {
  const n = X.length;
  if (!n) return { centroids: [], assignments: [] };
  const dim = X[0].length;
  const kEff = Math.min(Math.max(1, k), n);

  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  const centroids = [];
  for (let i = 0; i < kEff; i++) {
    centroids.push(X[indices[i]].slice());
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Assignment
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestd = euclid(X[i], centroids[0]);
      for (let c = 1; c < kEff; c++) {
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

    // Update centroids
    const sums = Array(kEff)
      .fill(0)
      .map(() => Array(dim).fill(0));
    const counts = Array(kEff).fill(0);

    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) {
        sums[c][j] += X[i][j];
      }
    }

    for (let c = 0; c < kEff; c++) {
      if (!counts[c]) continue;
      for (let j = 0; j < dim; j++) {
        centroids[c][j] = sums[c][j] / counts[c];
      }
    }

    if (!changed) break;
  }

  return { centroids, assignments };
}

/**
 * Compute total within-cluster sum of squares (inertia).
 */
function computeInertia(X, centroids, assignments) {
  let inertia = 0;
  for (let i = 0; i < X.length; i++) {
    const c = assignments[i];
    const d = euclid(X[i], centroids[c]);
    inertia += d * d;
  }
  return inertia;
}

/**
 * Elbow Method:
 * - For k = 1..maxK, run K-Means
 * - Compute inertia for each k
 * - Choose bestK by "knee" (max distance from line between k=1 and k=maxK)
 *
 * Returns: { bestK, inertias: [{k, inertia}] }
 */
function chooseKByElbow(X, maxK = 6, maxIter = 30) {
  const n = X.length;
  if (!n) {
    return { bestK: 1, inertias: [] };
  }
  const Kmax = Math.min(maxK, n);
  const inertias = [];

  for (let k = 1; k <= Kmax; k++) {
    const { centroids, assignments } = runKMeans(X, k, maxIter);
    const inertia = computeInertia(X, centroids, assignments);
    inertias.push({ k, inertia });
  }

  if (inertias.length <= 2) {
    const last = inertias[inertias.length - 1];
    return { bestK: last.k, inertias };
  }

  const first = inertias[0];
  const last = inertias[inertias.length - 1];
  const x1 = first.k;
  const y1 = first.inertia;
  const x2 = last.k;
  const y2 = last.inertia;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const denom = Math.sqrt(dx * dx + dy * dy) || 1;

  let bestK = first.k;
  let maxDist = -Infinity;

  for (let i = 1; i < inertias.length - 1; i++) {
    const { k, inertia } = inertias[i];
    const x0 = k;
    const y0 = inertia;
    const dist =
      Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / denom;
    if (dist > maxDist) {
      maxDist = dist;
      bestK = k;
    }
  }

  return { bestK, inertias };
}

/* ========== "PCA" PROJECTION (Carbon + Water + Waste) ========== */

function computePcaLikeCoords(materialAgg) {
  const co2 = materialAgg.map((m) => m.meanCarbon);
  const water = materialAgg.map((m) => m.meanWater);
  const waste = materialAgg.map((m) => m.meanWaste);

  const co2Norm = normalizeMinMax(co2);
  const waterNorm = normalizeMinMax(water);
  const wasteNorm = normalizeMinMax(waste);

  return materialAgg.map((m, i) => ({
    Material_Type: m.Material_Type,
    x: co2Norm.norm[i],
    y: (waterNorm.norm[i] + wasteNorm.norm[i]) / 2,
  }));
}

/* ========== PARETO FRONTIER (SIS vs Price) ========== */

/**
 * Compute Pareto flags for list items based on:
 * - maximize SIS
 * - minimize Average_Price_USD
 *
 * Returns an array of booleans same length as items.
 */
function computeParetoFlags(items) {
  const points = items.map((item, idx) => ({
    idx,
    price: isFinite(item.Average_Price_USD)
      ? item.Average_Price_USD
      : Infinity,
    sis: isFinite(item.SIS) ? item.SIS : -Infinity,
  }));

  points.sort((a, b) => a.price - b.price);

  const flags = new Array(items.length).fill(false);
  let bestSis = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.sis >= bestSis) {
      bestSis = p.sis;
      flags[p.idx] = true; // on Pareto frontier
    }
  }

  return flags;
}

/* ========== RECOMMENDER (with Pareto flag) ========== */

/**
 * Build recommendations based on SIS, price, and user priority weight.
 *
 * priorityWeight (w):
 *  - 0.7: Max sustainability
 *  - 0.5: Balanced
 *  - 0.3: Budget-friendly
 *
 * Final score:
 *  finalScore = w * SIS + (1 - w) * (1 - Price_norm)
 *
 * Additionally, mark items on the global Pareto frontier (SIS vs Price).
 */
function buildRecommendations(rowsWithSIS, priorityWeight, topN = 10) {
  if (!rowsWithSIS.length) return [];

  const prices = rowsWithSIS.map((r) => r.Average_Price_USD);
  const pNorm = normalizeMinMax(prices);

  const baseItems = rowsWithSIS.map((r, i) => {
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

  const paretoFlags = computeParetoFlags(baseItems);
  baseItems.forEach((item, idx) => {
    item.isPareto = paretoFlags[idx];
  });

  return baseItems
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);
}

/* ========== EDA HELPERS ========== */

function computeCountryAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) {
      map.set(c, {
        Country: c,
        sumPrice: 0,
        sumSIS: 0,
        count: 0,
      });
    }
    const m = map.get(c);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map((m) => ({
    Country: m.Country,
    meanPrice: m.sumPrice / m.count,
    meanSIS: m.sumSIS / m.count,
    count: m.count,
  }));
}

function computeTrendAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const t = r.Market_Trend || "Unknown";
    if (!map.has(t)) {
      map.set(t, {
        Trend: t,
        sumCount: 0,
        sumSIS: 0,
        sumPrice: 0,
      });
    }
    const m = map.get(t);
    m.sumCount += 1;
    m.sumSIS += r.SIS || 0;
    m.sumPrice += r.Average_Price_USD || 0;
  });

  return Array.from(map.values()).map((m) => ({
    Trend: m.Trend,
    count: m.sumCount,
    meanSIS: m.sumSIS / m.sumCount,
    meanPrice: m.sumPrice / m.sumCount,
  }));
}

function computeYearAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const y = r.Year;
    if (y === null || y === undefined || isNaN(y)) return;
    if (!map.has(y)) {
      map.set(y, {
        Year: y,
        sumPrice: 0,
        sumSIS: 0,
        count: 0,
      });
    }
    const m = map.get(y);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => a.Year - b.Year)
    .map((m) => ({
      Year: m.Year,
      meanPrice: m.sumPrice / m.count,
      meanSIS: m.sumSIS / m.count,
      count: m.count,
    }));
}
