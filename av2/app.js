/* app.js
   Core logic for SustainGraph:
   - CSV parsing
   - Preprocessing & normalization
   - SIS with Entropy Weight Method (group-level: Environmental vs Policy)
   - Material aggregation + PCA-like projection
   - KMeans + Elbow curves
   - Pareto frontier (materials & brands)
   - Recommendation scoring
   All functions are in global scope so script.js can call them.
*/

/* ========== CSV PARSER ========== */

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

/* ========== GENERIC HELPERS ========== */

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  const x = Number(s);
  return isNaN(x) ? NaN : x;
}

/**
 * Min–Max normalization helper.
 * Returns { min, max, norm } where norm is an array in [0,1].
 */
function normalizeMinMax(values) {
  const clean = values.filter((v) => isFinite(v));
  if (!clean.length) {
    return { min: 0, max: 1, norm: values.map(() => 0.5) };
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const norm = values.map((v) =>
    !isFinite(v) ? 0.5 : (v - min) / range
  );
  return { min, max, norm };
}

/**
 * Map rating letters to numeric scale.
 * A=4, B=3, C=2, D=1, else fallback 2.5
 */
function ratingLetterToNumeric(r) {
  const x = String(r || "").trim().toUpperCase();
  if (x === "A") return 4;
  if (x === "B") return 3;
  if (x === "C") return 2;
  if (x === "D") return 1;
  return 2.5;
}

/**
 * Map Yes/No to 0–1 numeric.
 * yes → 1, no → 0, unknown → 0.5
 */
function yesNo01(val) {
  const x = String(val || "").trim().toLowerCase();
  if (x === "yes" || x === "y" || x === "true") return 1;
  if (x === "no" || x === "n" || x === "false") return 0;
  return 0.5;
}

/* ========== PREPROCESSING ========== */

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

    const Product_Lines = toNumber(
      r.Product_Lines || r["Product_Lines"] || ""
    );
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

/* ========== ENTROPY WEIGHT METHOD (GROUP LEVEL) ========== */

/**
 * Compute entropy-based weights for 2 indicators:
 * - indicator 1: Environmental group score
 * - indicator 2: Policy group score
 * Returns { wEnv, wPolicy }
 */
function computeEntropyWeightsTwo(envScores, policyScores) {
  const n = envScores.length;
  if (!n) {
    return { wEnv: 0.5, wPolicy: 0.5 };
  }

  // Ensure non-negative values
  function makePositive(arr) {
    const clean = arr.map((v) => (isFinite(v) ? v : 0));
    const minVal = Math.min(...clean);
    const shift = minVal < 0 ? -minVal + 1e-9 : 0;
    const shifted = clean.map((v) => v + shift + 1e-9);
    const sum = shifted.reduce((s, v) => s + v, 0);
    if (!sum) {
      return shifted.map(() => 1 / n);
    }
    return shifted.map((v) => v / sum);
  }

  const pEnv = makePositive(envScores);
  const pPol = makePositive(policyScores);

  const k = 1 / Math.log(n);
  const eps = 1e-12;

  function entropy(pArr) {
    let e = 0;
    for (let i = 0; i < pArr.length; i++) {
      const p = pArr[i] > 0 ? pArr[i] : eps;
      e += p * Math.log(p);
    }
    return -k * e;
  }

  const eEnv = entropy(pEnv);
  const ePol = entropy(pPol);

  const dEnv = 1 - eEnv;
  const dPol = 1 - ePol;
  const denom = dEnv + dPol || 1;

  const wEnv = dEnv / denom;
  const wPolicy = dPol / denom;

  return { wEnv, wPolicy };
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

/* ========== SIS PIPELINE (ENTROPY GROUP-LEVEL) ========== */

function normalizeAndComputeSIS(rawRows) {
  const rows = preprocessRows(rawRows);

  // Raw numeric arrays
  const co2Arr = rows.map((r) => r.Carbon_Footprint_MT);
  const waterArr = rows.map((r) => r.Water_Usage_Liters);
  const wasteArr = rows.map((r) => r.Waste_Production_KG);
  const priceArr = rows.map((r) => r.Average_Price_USD);

  // Normalize environmental factors (higher = worse)
  const co2Norm = normalizeMinMax(co2Arr);
  const waterNorm = normalizeMinMax(waterArr);
  const wasteNorm = normalizeMinMax(wasteArr);

  // Policy raw numeric
  const ratingNumArr = rows.map((r) =>
    ratingLetterToNumeric(r.Sustainability_Rating)
  ); // 1–4
  const eco01Arr = rows.map((r) =>
    yesNo01(r.Eco_Friendly_Manufacturing)
  );
  const rec01Arr = rows.map((r) =>
    yesNo01(r.Recycling_Programs)
  );

  // Normalize rating into [0,1] by /4
  const ratingNormArr = ratingNumArr.map((v) =>
    isFinite(v) ? v / 4 : 0.5
  );

  // Build environmental_score & policy_score per brand
  const envScores = [];
  const policyScores = [];

  for (let i = 0; i < rows.length; i++) {
    const co2n = co2Norm.norm[i];
    const watern = waterNorm.norm[i];
    const wasten = wasteNorm.norm[i];

    // Env: lower CO₂/Water/Waste → higher score
    const envScore =
      (1 - co2n + 1 - watern + 1 - wasten) / 3;

    const ratingN = ratingNormArr[i];
    const ecoN = eco01Arr[i];
    const recN = rec01Arr[i];

    const policyScore = (ratingN + ecoN + recN) / 3;

    envScores.push(envScore);
    policyScores.push(policyScore);
  }

  // Entropy weighting at group level
  const { wEnv, wPolicy } = computeEntropyWeightsTwo(
    envScores,
    policyScores
  );

  // Normalize price for later (recommendation, Pareto viz)
  const priceNorm = normalizeMinMax(priceArr);

  // Attach SIS and all normalized fields
  const rowsWithSIS = rows.map((r, i) => {
    const envScore = envScores[i];
    const policyScore = policyScores[i];

    const SIS = wEnv * envScore + wPolicy * policyScore;

    return {
      ...r,
      // normalized environmental metrics (0–1, higher = worse)
      Carbon_Footprint_norm: co2Norm.norm[i],
      Water_Usage_norm: waterNorm.norm[i],
      Waste_Production_norm: wasteNorm.norm[i],
      // policy pieces
      Sustainability_Rating_Num: ratingNumArr[i],
      Sustainability_Rating_norm: ratingNormArr[i],
      Eco_Friendly_Manufacturing_01: eco01Arr[i],
      Recycling_Programs_01: rec01Arr[i],
      // group scores
      envScore,
      policyScore,
      // normalized price
      Price_norm: priceNorm.norm[i],
      // final SIS
      SIS,
    };
  });

  // Basic means
  const safeMean = (arr) => {
    const c = arr.filter((v) => isFinite(v));
    if (!c.length) return 0;
    return c.reduce((s, v) => s + v, 0) / c.length;
  };

  const stats = {
    mean: {
      Carbon_Footprint_MT: safeMean(co2Arr),
      Water_Usage_Liters: safeMean(waterArr),
      Waste_Production_KG: safeMean(wasteArr),
      Average_Price_USD: safeMean(priceArr),
      SIS: safeMean(rowsWithSIS.map((r) => r.SIS)),
      envScore: safeMean(envScores),
      policyScore: safeMean(policyScores),
    },
    entropyWeights: {
      wEnv,
      wPolicy,
    },
  };

  const materialAgg = computeMaterialAgg(rowsWithSIS);

  return {
    rowsWithSIS,
    stats,
    materialAgg,
  };
}

/* ========== K-MEANS & PCA-LIKE PROJECTION ========== */

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

  const kEff = Math.min(k, n);

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

    // assignment
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

    // update
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
 * PCA-like 2D projection for materials:
 * x = normalized meanCarbon
 * y = average of normalized meanWater & meanWaste
 */
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

/* ========== EDA AGGREGATION HELPERS ========== */

function computeCountryAgg(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) {
      map.set(c, { Country: c, sumPrice: 0, sumSIS: 0, count: 0 });
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
      map.set(y, { Year: y, sumPrice: 0, sumSIS: 0, count: 0 });
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

/* ========== PARETO FRONTIER (PRICE vs SIS) ========== */

/**
 * Generic Pareto frontier for minimizing price and maximizing score.
 * scoreKey: e.g. "SIS" or "meanSIS"
 * priceKey: e.g. "Average_Price_USD" or "meanPrice"
 */
function computeParetoFrontier(items, scoreKey, priceKey) {
  const valid = items.filter(
    (it) => isFinite(it[scoreKey]) && isFinite(it[priceKey])
  );
  if (!valid.length) return [];

  const sorted = valid.slice().sort(
    (a, b) => a[priceKey] - b[priceKey]
  );

  const frontier = [];
  let bestScore = -Infinity;

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    const score = it[scoreKey];
    if (score > bestScore + 1e-9) {
      frontier.push(it);
      bestScore = score;
    }
  }
  return frontier;
}

function computeMaterialPareto(materialAgg) {
  return computeParetoFrontier(
    materialAgg,
    "meanSIS",
    "meanPrice"
  );
}

function computeBrandPareto(rowsWithSIS) {
  return computeParetoFrontier(
    rowsWithSIS,
    "SIS",
    "Average_Price_USD"
  );
}

/* ========== ELBOW METHOD (MATERIALS & BRANDS) ========== */

function computeSSE(X, centroids, assignments) {
  let sse = 0;
  for (let i = 0; i < X.length; i++) {
    const c = assignments[i];
    const d = euclid(X[i], centroids[c]);
    sse += d * d;
  }
  return sse;
}

/**
 * Compute elbow curve for a given feature matrix X.
 * Returns array [{k, sse}, ...]
 */
function computeElbowCurve(X, kMin, kMax, maxIter) {
  const curves = [];
  for (let k = kMin; k <= kMax; k++) {
    const { centroids, assignments } = runKMeans(
      X,
      k,
      maxIter
    );
    const sse = computeSSE(X, centroids, assignments);
    curves.push({ k, sse });
  }
  return curves;
}

/**
 * Elbow for materials using [meanCarbon, meanWater, meanWaste]
 */
function computeElbowForMaterials(materialAgg, kMin, kMax) {
  if (!materialAgg.length) return [];
  const X = materialAgg.map((m) => [
    m.meanCarbon,
    m.meanWater,
    m.meanWaste,
  ]);
  return computeElbowCurve(X, kMin, kMax, 40);
}

/**
 * Elbow for brands using sampled brands and normalized features.
 * Features: [CO2, Water, Waste, Price, SIS]
 */
function computeElbowForBrands(rowsWithSIS, kMin, kMax, maxRows) {
  const rows = rowsWithSIS || [];
  if (!rows.length) return [];

  const limit = maxRows || 800;
  const sampled =
    rows.length <= limit
      ? rows
      : rows.filter((_, i) => i % Math.ceil(rows.length / limit) === 0);

  const co2 = sampled.map((r) => r.Carbon_Footprint_MT);
  const water = sampled.map((r) => r.Water_Usage_Liters);
  const waste = sampled.map((r) => r.Waste_Production_KG);
  const price = sampled.map((r) => r.Average_Price_USD);
  const sis = sampled.map((r) => r.SIS);

  const co2N = normalizeMinMax(co2).norm;
  const waterN = normalizeMinMax(water).norm;
  const wasteN = normalizeMinMax(waste).norm;
  const priceN = normalizeMinMax(price).norm;
  const sisN = normalizeMinMax(sis).norm;

  const X = sampled.map((_, i) => [
    co2N[i],
    waterN[i],
    wasteN[i],
    priceN[i],
    sisN[i],
  ]);

  return computeElbowCurve(X, kMin, kMax, 40);
}

/* ========== RECOMMENDATION ENGINE ========== */

/**
 * Build recommendations based on SIS + price, with user priority weight.
 * finalScore = w * SIS + (1 - w) * (1 - price_norm)
 */
function buildRecommendations(rowsWithSIS, priorityWeight, topN) {
  const rows = rowsWithSIS || [];
  if (!rows.length) return [];

  const prices = rows.map((r) => r.Average_Price_USD);
  const pNorm = normalizeMinMax(prices).norm;

  const w = isFinite(priorityWeight) ? priorityWeight : 0.5;

  const items = rows.map((r, i) => {
    const SIS = r.SIS || 0;
    const priceNorm = pNorm[i];

    const sustainabilityTerm = SIS;
    const priceTerm = 1 - priceNorm;

    const finalScore =
      w * sustainabilityTerm + (1 - w) * priceTerm;

    return {
      ...r,
      priceNorm,
      finalScore,
    };
  });

  const N = topN || 10;
  return items
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, N);
}
