/* app.js - Scientific Version (Refactored for UI/UX)
   Core logic for SustainGraph with:
   1. Entropy Weight Method for objective weighting
   2. K-Means Clustering with Elbow Method validation
   3. Multi-Objective Optimization (Pareto Frontier)
   4. Data-driven Sustainability Index Score (SIS)
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

/* ========== BASIC HELPERS ========== */

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  const x = Number(s);
  return isNaN(x) ? NaN : x;
}

function ratingLetterToScore(r) {
  const x = String(r || "").trim().toUpperCase();
  let base;
  if (x === "A") base = 4;
  else if (x === "B") base = 3;
  else if (x === "C") base = 2;
  else if (x === "D") base = 1;
  else base = 2.5;
  return base / 4;
}

function yesNoScore(val) {
  const x = String(val || "").trim().toLowerCase();
  if (x === "yes" || x === "y" || x === "true") return 1.0;
  if (x === "no" || x === "n" || x === "false") return 0.0;
  return 0.5;
}

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
    norm: values.map((v) => (!isFinite(v) ? 0.5 : (v - min) / range)),
  };
}

/* ========== ENTROPY WEIGHT METHOD (Scientific) ========== */

/**
 * Calculate entropy-based weights for environmental and policy scores
 * Following the methodology from Zhao et al. (2021)
 */
function computeEntropyWeights(envScores, policyScores) {
  const n = envScores.length;
  if (!n) {
    return {
      weights: [0.5, 0.5],
      entropy: [0, 0],
      diversity: [0, 0],
    };
  }

  // Ensure positive values (add small epsilon to avoid log(0))
  const epsilon = 1e-10;
  const cols = [envScores, policyScores].map((col) =>
    col.map((v) => (isFinite(v) && v > 0 ? v : epsilon))
  );

  // Step 1: Calculate proportions p_ij = x_ij / sum(x_i)
  const sums = cols.map((col) => col.reduce((s, v) => s + v, 0));
  const proportions = cols.map((col, j) => {
    const sum = sums[j];
    if (sum === 0) {
      const uniform = 1 / n;
      return col.map(() => uniform);
    }
    return col.map((v) => v / sum);
  });

  // Step 2: Calculate entropy E_j = -k * sum(p_ij * ln(p_ij))
  const k = 1 / Math.log(n);
  const entropy = proportions.map((props) => {
    let E = 0;
    for (let i = 0; i < n; i++) {
      const p = props[i];
      if (p > 0) {
        E += p * Math.log(p);
      }
    }
    return -k * E;
  });

  // Step 3: Calculate diversity d_j = 1 - E_j
  const diversity = entropy.map((E) => 1 - E);

  // Step 4: Calculate weights w_j = d_j / sum(d_j)
  const diversitySum = diversity.reduce((s, d) => s + d, 0);
  let weights = [0.5, 0.5];
  if (diversitySum > 0) {
    weights = diversity.map((d) => d / diversitySum);
  }

  return {
    weights: weights,
    entropy: entropy,
    diversity: diversity,
  };
}

/* ========== COMPUTE ENVIRONMENTAL AND POLICY SCORES ========== */

/**
 * Compute environmental_score and policy_score from raw data
 * Environmental: Carbon, Water, Waste (inverted - lower is better)
 * Policy: Certifications, Recycling, Transparency (higher is better)
 */
function computeComponentScores(rows) {
  // Extract raw values
  const carbon = rows.map((r) => toNumber(r.Carbon_Footprint_MT));
  const water = rows.map((r) => toNumber(r.Water_Usage_Liters));
  const waste = rows.map((r) => toNumber(r.Waste_Production_KG));
  const cert = rows.map((r) => ratingLetterToScore(r.Certifications));
  const recycling = rows.map((r) => yesNoScore(r.Recycling_Programs));
  const transparency = rows.map((r) => ratingLetterToScore(r.Transparency_Score));

  // Normalize all to [0, 1]
  const carbonNorm = normalizeMinMax(carbon);
  const waterNorm = normalizeMinMax(water);
  const wasteNorm = normalizeMinMax(waste);
  const certNorm = normalizeMinMax(cert);
  const recyclingNorm = normalizeMinMax(recycling);
  const transparencyNorm = normalizeMinMax(transparency);

  // Environmental score: INVERTED (1 - norm) because lower is better
  const envScores = rows.map((r, i) => {
    const carbonScore = 1 - carbonNorm.norm[i];
    const waterScore = 1 - waterNorm.norm[i];
    const wasteScore = 1 - wasteNorm.norm[i];
    return (carbonScore + waterScore + wasteScore) / 3;
  });

  // Policy score: DIRECT (higher is better)
  const policyScores = rows.map((r, i) => {
    return (certNorm.norm[i] + recyclingNorm.norm[i] + transparencyNorm.norm[i]) / 3;
  });

  return {
    environmental_score: envScores,
    policy_score: policyScores,
    carbonNorm: carbonNorm.norm,
    waterNorm: waterNorm.norm,
    wasteNorm: wasteNorm.norm,
  };
}

/* ========== NORMALIZE AND COMPUTE SIS (Scientific) ========== */

/**
 * Main function to compute SIS using Entropy Weight Method
 * Returns rows with SIS and all intermediate calculations
 */
function normalizeAndComputeSIS(rows) {
  if (!rows.length) {
    return {
      rowsWithSIS: [],
      stats: null,
      materialAgg: [],
      entropyWeights: null,
    };
  }

  // Step 1: Compute environmental_score and policy_score (un-normalized)
  const scores = computeComponentScores(rows);
  const envScores = scores.environmental_score;
  const policyScores = scores.policy_score;

  // Step 2: Normalize environmental_score and policy_score to [0, 1]
  const envNorm = normalizeMinMax(envScores);
  const policyNorm = normalizeMinMax(policyScores);

  // Step 3: Calculate entropy weights (data-driven, objective)
  const entropyWeights = computeEntropyWeights(envNorm.norm, policyNorm.norm);
  const w_env = entropyWeights.weights[0];
  const w_policy = entropyWeights.weights[1];

  console.log("=== Entropy Weight Method Results ===");
  console.log(`Environmental Weight: ${w_env.toFixed(4)}`);
  console.log(`Policy Weight: ${w_policy.toFixed(4)}`);

  // Step 4: Calculate SIS using entropy weights
  const rowsWithSIS = rows.map((r, i) => ({
    ...r,
    // Un-normalized component scores
    environmental_score: envScores[i],
    policy_score: policyScores[i],
    // Normalized component scores (used for K-Means plot axes)
    environmental_score_norm: envNorm.norm[i],
    policy_score_norm: policyNorm.norm[i],
    // Final SIS (Entropy-weighted)
    SIS: w_env * envScores[i] + w_policy * policyScores[i],
    // Raw metrics (for EDA/Pareto)
    Carbon_Footprint_MT: toNumber(r.Carbon_Footprint_MT),
    Water_Usage_Liters: toNumber(r.Water_Usage_Liters),
    Waste_Production_KG: toNumber(r.Waste_Production_KG),
    Average_Price_USD: toNumber(r.Average_Price_USD),
  }));

  // Compute statistics
  const stats = computeStats(rowsWithSIS);

  // Aggregate by material
  const materialAgg = aggregateByMaterial(rowsWithSIS);

  return {
    rowsWithSIS,
    stats,
    materialAgg,
    entropyWeights,
  };
}

/* ========== STATISTICS ========== */

function computeStats(rows) {
  const fields = [
    "SIS",
    "Carbon_Footprint_MT",
    "Water_Usage_Liters",
    "Waste_Production_KG",
    "Average_Price_USD",
  ];

  const mean = {};
  const median = {};
  const std = {};

  fields.forEach((field) => {
    const values = rows.map((r) => r[field]).filter((v) => isFinite(v));
    if (!values.length) {
      mean[field] = 0;
      median[field] = 0;
      std[field] = 0;
      return;
    }

    const sum = values.reduce((s, v) => s + v, 0);
    mean[field] = sum / values.length;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    median[field] =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    const variance =
      values.reduce((s, v) => s + Math.pow(v - mean[field], 2), 0) /
      values.length;
    std[field] = Math.sqrt(variance);
  });

  return { mean, median, std };
}

/* ========== MATERIAL AGGREGATION (Updated) ========== */

function aggregateByMaterial(rows) {
  const map = new Map();

  rows.forEach((r) => {
    const mat = r.Material_Type || "Unknown";
    if (!map.has(mat)) {
      map.set(mat, {
        Material_Type: mat,
        sumCarbon: 0,
        sumWater: 0,
        sumWaste: 0,
        sumSIS: 0,
        sumPrice: 0,
        sumEnvNorm: 0, // NEW: Sum of normalized environmental score
        sumPolicyNorm: 0, // NEW: Sum of normalized policy score
        count: 0,
      });
    }
    const m = map.get(mat);
    m.sumCarbon += r.Carbon_Footprint_MT || 0;
    m.sumWater += r.Water_Usage_Liters || 0;
    m.sumWaste += r.Waste_Production_KG || 0;
    m.sumSIS += r.SIS || 0;
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumEnvNorm += r.environmental_score_norm || 0; // NEW
    m.sumPolicyNorm += r.policy_score_norm || 0; // NEW
    m.count += 1;
  });

  return Array.from(map.values()).map((m) => ({
    Material_Type: m.Material_Type,
    meanCarbon: m.sumCarbon / m.count,
    meanWater: m.sumWater / m.count,
    meanWaste: m.sumWaste / m.count,
    meanSIS: m.sumSIS / m.count,
    meanPrice: m.sumPrice / m.count,
    meanEnvNorm: m.sumEnvNorm / m.count, // NEW
    meanPolicyNorm: m.sumPolicyNorm / m.count, // NEW
    count: m.count,
  }));
}

/* ========== K-MEANS CLUSTERING ========== */

function runKMeans(data, k, maxIter = 50) {
  const n = data.length;
  const dim = data[0].length;

  // Initialize centroids randomly
  let centroids = [];
  const indices = new Set();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * n);
    if (!indices.has(idx)) {
      indices.add(idx);
      centroids.push([...data[idx]]);
    }
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign points to nearest centroid
    const newAssignments = data.map((point) => {
      let minDist = Infinity;
      let bestCluster = 0;
      centroids.forEach((centroid, c) => {
        const dist = Math.sqrt(
          point.reduce((sum, val, i) => sum + Math.pow(val - centroid[i], 2), 0)
        );
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      });
      return bestCluster;
    });

    // Check convergence
    if (newAssignments.every((a, i) => a === assignments[i])) {
      break;
    }
    assignments = newAssignments;

    // Update centroids
    const newCentroids = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);

    data.forEach((point, i) => {
      const cluster = assignments[i];
      counts[cluster]++;
      point.forEach((val, d) => {
        newCentroids[cluster][d] += val;
      });
    });

    newCentroids.forEach((centroid, c) => {
      if (counts[c] > 0) {
        centroid.forEach((val, d) => {
          centroid[d] = val / counts[c];
        });
      }
    });

    centroids = newCentroids;
  }

  // Calculate inertia (within-cluster sum of squares)
  let inertia = 0;
  data.forEach((point, i) => {
    const centroid = centroids[assignments[i]];
    inertia += point.reduce(
      (sum, val, d) => sum + Math.pow(val - centroid[d], 2),
      0
    );
  });

  return { centroids, assignments, inertia };
}

/* ========== ELBOW METHOD ========== */

function chooseKByElbow(data, maxK = 10, maxIter = 50) {
  const inertias = [];

  for (let k = 1; k <= maxK; k++) {
    const { inertia } = runKMeans(data, k, maxIter);
    inertias.push({ k, inertia });
  }

  // Find elbow using rate of change
  let bestK = 3; // default
  let maxDelta = 0;

  for (let i = 1; i < inertias.length - 1; i++) {
    const delta1 = inertias[i - 1].inertia - inertias[i].inertia;
    const delta2 = inertias[i].inertia - inertias[i + 1].inertia;
    const deltaDiff = Math.abs(delta1 - delta2);

    if (deltaDiff > maxDelta) {
      maxDelta = deltaDiff;
      bestK = inertias[i].k;
    }
  }

  return { inertias, bestK };
}

/* ========== PARETO FRONTIER (Multi-Objective Optimization) ========== */

/**
 * Compute Pareto frontier for multi-objective optimization
 * A point is Pareto-optimal if no other point dominates it
 * (i.e., better in all objectives)
 * 
 * For sustainability: maximize SIS, minimize Price
 */
function computeParetoFlags(items) {
  const n = items.length;
  const paretoFlags = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const item = items[i];
    let isDominated = false;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const other = items[j];

      // Check if 'other' dominates 'item'
      // Domination: other.SIS >= item.SIS AND other.price <= item.price
      // AND at least one is strictly better
      const sisBetter = other.SIS >= item.SIS;
      const priceBetter = other.Average_Price_USD <= item.Average_Price_USD;
      const strictlyBetter =
        other.SIS > item.SIS || other.Average_Price_USD < item.Average_Price_USD;

      if (sisBetter && priceBetter && strictlyBetter) {
        isDominated = true;
        break;
      }
    }

    if (!isDominated) {
      paretoFlags[i] = true;
    }
  }

  return paretoFlags;
}

/* ========== RECOMMENDATION ENGINE (MOO-based) ========== */

/**
 * Build recommendations using Multi-Objective Optimization
 * Priority weight is still used for final ranking, but Pareto-optimal items are highlighted
 */
function buildRecommendations(rowsWithSIS, topN = 8) {
  if (!rowsWithSIS.length) return [];

  // Normalize price for scoring
  const prices = rowsWithSIS.map((r) => r.Average_Price_USD);
  const pNorm = normalizeMinMax(prices);

  const baseItems = rowsWithSIS.map((r, i) => {
    const SIS = r.SIS || 0;
    const priceNorm = pNorm.norm[i];
    const sustainabilityTerm = SIS;
    const priceTerm = 1 - priceNorm;
        // Final Score is now a simple balanced combination of SIS and Price for deterministic ranking
    // This score is used for sorting items within the Pareto/non-Pareto groups
    const finalScore = 0.5 * SIS + 0.5 * (1 - priceNorm);

    return {
      ...r,
      priceNorm,
      finalScore,
    };
  });

  // Mark Pareto-optimal items
  const paretoFlags = computeParetoFlags(baseItems);
  baseItems.forEach((item, idx) => {
    item.isPareto = paretoFlags[idx];
  });

  // NEW LOGIC: Prioritize Pareto-optimal items
  const paretoItems = baseItems.filter(item => item.isPareto);
  const nonParetoItems = baseItems.filter(item => !item.isPareto);

  // Sort both groups by the balanced finalScore
  paretoItems.sort((a, b) => b.finalScore - a.finalScore);
  nonParetoItems.sort((a, b) => b.finalScore - a.finalScore);

  // Combine the lists: all Pareto items first, then fill with the best non-Pareto items
  const combined = [...paretoItems, ...nonParetoItems];

  return combined.slice(0, topN);
}
