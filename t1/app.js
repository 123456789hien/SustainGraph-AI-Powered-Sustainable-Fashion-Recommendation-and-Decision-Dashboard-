/* app.js - Scientific Version
   Core logic for SustainGraph with:
   1. Entropy Weight Method for objective weighting (with Data Quality Validation)
   2. K-Means Clustering with Elbow Method validation (with detailed interpretation)
   3. Multi-Objective Optimization (Pareto Frontier)
   4. Data-driven Sustainability Index Score (SIS)
   5. Optional MLP Predictor for missing attributes
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

/* ========== STATISTICAL HELPERS ========== */

function calculateVariance(values) {
  const clean = values.filter((v) => isFinite(v));
  if (clean.length === 0) return 0;
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  const variance = clean.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / clean.length;
  return variance;
}

function calculateCV(values) {
  const clean = values.filter((v) => isFinite(v));
  if (clean.length === 0) return 0;
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  if (mean === 0) return 0;
  const variance = clean.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / clean.length;
  const std = Math.sqrt(variance);
  return std / mean;
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

  const epsilon = 1e-10;
  const cols = [envScores, policyScores].map((col) =>
    col.map((v) => (isFinite(v) && v > 0 ? v : epsilon))
  );

  const sums = cols.map((col) => col.reduce((s, v) => s + v, 0));
  const proportions = cols.map((col, j) => {
    const sum = sums[j];
    if (sum === 0) {
      const uniform = 1 / n;
      return col.map(() => uniform);
    }
    return col.map((v) => v / sum);
  });

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

  const diversity = entropy.map((E) => 1 - E);

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

/* ========== COMPUTE ENVIRONMENTAL AND POLICY SCORES (ENHANCED) ========== */

/**
 * Compute environmental_score and policy_score from raw data
 * Environmental: Carbon, Water, Waste (inverted - lower is better)
 * Policy: Sustainability_Rating, Recycling (higher is better)
 */
function computeComponentScores(rows) {
  const carbon = rows.map((r) => toNumber(r.Carbon_Footprint_MT));
  const water = rows.map((r) => toNumber(r.Water_Usage_Liters));
  const waste = rows.map((r) => toNumber(r.Waste_Production_KG));
  
  const sustRating = rows.map((r) => ratingLetterToScore(r.Sustainability_Rating)); 
  const recycling = rows.map((r) => yesNoScore(r.Recycling_Programs));
  
  // Calculate variance and CV for validation
  const carbonVar = calculateVariance(carbon);
  const waterVar = calculateVariance(water);
  const wasteVar = calculateVariance(waste);
  const carbonCV = calculateCV(carbon);
  const waterCV = calculateCV(water);
  const wasteCV = calculateCV(waste);

  const carbonNorm = normalizeMinMax(carbon);
  const waterNorm = normalizeMinMax(water);
  const wasteNorm = normalizeMinMax(waste);
  const sustRatingNorm = normalizeMinMax(sustRating);
  const recyclingNorm = normalizeMinMax(recycling);

  const envScores = rows.map((r, i) => {
    // Invert for environmental scores (lower is better)
    const carbonScore = 1 - carbonNorm.norm[i];
    const waterScore = 1 - waterNorm.norm[i];
    const wasteScore = 1 - wasteNorm.norm[i];
    return (carbonScore + waterScore + wasteScore) / 3;
  });

  const policyScores = rows.map((r, i) => {
    // Higher is better for policy scores
    return (sustRatingNorm.norm[i] + recyclingNorm.norm[i]) / 2;
  });

  return {
    environmental_score: envScores,
    policy_score: policyScores,
    carbonNorm: carbonNorm.norm,
    waterNorm: waterNorm.norm,
    wasteNorm: wasteNorm.norm,
    // NEW: Return variance and CV for validation
    dataQuality: {
      carbon: { variance: carbonVar, cv: carbonCV, min: carbonNorm.min, max: carbonNorm.max },
      water: { variance: waterVar, cv: waterCV, min: waterNorm.min, max: waterNorm.max },
      waste: { variance: wasteVar, cv: wasteCV, min: wasteNorm.min, max: wasteNorm.max },
    },
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
      dataQuality: null,
    };
  }

  const scores = computeComponentScores(rows);
  const envScores = scores.environmental_score;
  const policyScores = scores.policy_score;

  // Normalize component scores for Entropy Weight Method
  const envNorm = normalizeMinMax(envScores);
  const policyNorm = normalizeMinMax(policyScores);

  const entropyResults = computeEntropyWeights(envNorm.norm, policyNorm.norm);
  const w_env = entropyResults.weights[0];
  const w_policy = entropyResults.weights[1];

  const rowsWithSIS = rows.map((r, i) => ({
    ...r,
    environmental_score: envScores[i],
    policy_score: policyScores[i],
    environmental_score_norm: envNorm.norm[i],
    policy_score_norm: policyNorm.norm[i],
    SIS: w_env * envScores[i] + w_policy * policyScores[i],
    Carbon_Footprint_MT: toNumber(r.Carbon_Footprint_MT),
    Water_Usage_Liters: toNumber(r.Water_Usage_Liters),
    Waste_Production_KG: toNumber(r.Waste_Production_KG),
    Average_Price_USD: toNumber(r.Average_Price_USD),
    Year: toNumber(r.Year),
  }));

  const stats = computeStats(rowsWithSIS);
  const materialAgg = aggregateByMaterial(rowsWithSIS);

  return {
    rowsWithSIS,
    stats,
    materialAgg,
    entropyWeights: {
      env: w_env,
      policy: w_policy,
      envEntropy: entropyResults.entropy[0],
      policyEntropy: entropyResults.entropy[1],
      envDiversity: entropyResults.diversity[0],
      policyDiversity: entropyResults.diversity[1],
    },
    dataQuality: scores.dataQuality,
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
    "environmental_score",
    "policy_score",
  ];

  const stats = {};

  fields.forEach((field) => {
    const values = rows.map((r) => r[field]).filter((v) => isFinite(v));
    if (values.length === 0) {
      stats[field] = { mean: 0, median: 0, std: 0, min: 0, max: 0 };
      return;
    }

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    stats[field] = { mean, median, std, min, max };
  });

  return stats;
}

/* ========== AGGREGATION ========== */

function aggregateByMaterial(rows) {
  const materialMap = rows.reduce((acc, r) => {
    const material = r.Material_Type;
    if (!acc[material]) {
      acc[material] = {
        count: 0,
        sumSIS: 0,
        sumPrice: 0,
        sumEnv: 0,
        sumPolicy: 0,
        sumEnvNorm: 0,
        sumPolicyNorm: 0,
        sumCarbon: 0,
        sumWater: 0,
        sumWaste: 0,
        sumRating: 0,
        sumRecycling: 0,
      };
    }
    acc[material].count += 1;
    acc[material].sumSIS += r.SIS;
    acc[material].sumPrice += r.Average_Price_USD;
    acc[material].sumEnv += r.environmental_score;
    acc[material].sumPolicy += r.policy_score;
    acc[material].sumEnvNorm += r.environmental_score_norm;
    acc[material].sumPolicyNorm += r.policy_score_norm;
    acc[material].sumCarbon += r.Carbon_Footprint_MT;
    acc[material].sumWater += r.Water_Usage_Liters;
    acc[material].sumWaste += r.Waste_Production_KG;
    acc[material].sumRating += ratingLetterToScore(r.Sustainability_Rating);
    acc[material].sumRecycling += yesNoScore(r.Recycling_Programs);
    return acc;
  }, {});

  return Object.entries(materialMap).map(([material, data]) => ({
    Material_Type: material,
    count: data.count,
    meanSIS: data.sumSIS / data.count,
    meanPrice: data.sumPrice / data.count,
    meanEnv: data.sumEnv / data.count,
    meanPolicy: data.sumPolicy / data.count,
    meanEnvNorm: data.sumEnvNorm / data.count,
    meanPolicyNorm: data.sumPolicyNorm / data.count,
    meanCarbon: data.sumCarbon / data.count,
    meanWater: data.sumWater / data.count,
    meanWaste: data.sumWaste / data.count,
    meanRating: data.sumRating / data.count,
    meanRecycling: data.sumRecycling / data.count,
    // Features for K-Means: Normalized Environmental and Policy Scores
    features: [data.sumEnvNorm / data.count, data.sumPolicyNorm / data.count],
  }));
}

/* ========== K-MEANS CLUSTERING ========== */

function runKMeans(data, k, maxIter = 50) {
  if (k <= 0 || data.length === 0) return { centroids: [], assignments: [], inertia: 0 };
  k = Math.min(k, data.length);
  const dim = data[0].length;
  let centroids = [];

  // 1. Initialization: K-Means++ (simplified random selection)
  const indices = new Set();
  while (indices.size < k) {
    indices.add(Math.floor(Math.random() * data.length));
  }
  centroids = Array.from(indices).map(i => [...data[i]]);

  let assignments = new Array(data.length).fill(-1);
  let inertia = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    let newAssignments = new Array(data.length);
    let clusterSums = new Array(k).fill(0).map(() => new Array(dim).fill(0));
    let clusterCounts = new Array(k).fill(0);
    let currentInertia = 0;

    // 2. Assignment Step
    for (let i = 0; i < data.length; i++) {
      let minDistance = Infinity;
      let bestCluster = -1;
      for (let j = 0; j < k; j++) {
        let distance = 0;
        for (let d = 0; d < dim; d++) {
          distance += Math.pow(data[i][d] - centroids[j][d], 2);
        }
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = j;
        }
      }
      newAssignments[i] = bestCluster;
      currentInertia += minDistance;
      clusterCounts[bestCluster]++;
      for (let d = 0; d < dim; d++) {
        clusterSums[bestCluster][d] += data[i][d];
      }
    }

    // Check for convergence
    if (assignments.every((val, i) => val === newAssignments[i])) {
      inertia = currentInertia;
      assignments = newAssignments;
      break;
    }

    assignments = newAssignments;
    inertia = currentInertia;

    // 3. Update Step
    let newCentroids = [];
    for (let j = 0; j < k; j++) {
      if (clusterCounts[j] > 0) {
        newCentroids.push(clusterSums[j].map(sum => sum / clusterCounts[j]));
      } else {
        // Handle empty cluster by re-initializing it to a random point
        newCentroids.push([...data[Math.floor(Math.random() * data.length)]]);
      }
    }
    centroids = newCentroids;
  }

  return { centroids, assignments, inertia };
}

/* ========== ELBOW METHOD ========== */

function chooseKByElbow(data, maxK = 10, maxIter = 50) {
  const inertias = [];
  const kLimit = Math.min(maxK, data.length);

  for (let k = 1; k <= kLimit; k++) {
    const { inertia } = runKMeans(data, k, maxIter);
    inertias.push({ k, inertia });
  }

  let bestK = kLimit > 0 ? 2 : 0; // Default to 2 as a safe minimum

  if (kLimit > 1) {
    // Simple elbow detection: find the point where the decrease rate drops significantly
    for (let i = 1; i < inertias.length - 1; i++) {
      const prevInertia = inertias[i - 1].inertia;
      const currentInertia = inertias[i].inertia;
      const nextInertia = inertias[i + 1].inertia;

      const decreaseRate = (prevInertia - currentInertia) / prevInertia;
      const nextDecreaseRate = (currentInertia - nextInertia) / currentInertia;

      // Look for the first point where the rate of decrease slows down
      if (decreaseRate > 0.1 && nextDecreaseRate < 0.05) {
        bestK = inertias[i].k;
        break;
      }
    }
  }

  if (bestK === 0 && kLimit > 0) bestK = Math.min(3, kLimit); // Fallback to 3 if no clear elbow

  return { inertias, bestK };
}

/* ========== PARETO FRONTIER (Multi-Objective Optimization) ========== */

/**
 * Compute Pareto frontier for multi-objective optimization
 * A point is Pareto-optimal if no other point dominates it
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
      // 'other' is better or equal in both objectives
      const sisBetterOrEqual = other.SIS >= item.SIS;
      const priceBetterOrEqual = other.Average_Price_USD <= item.Average_Price_USD;
      
      // 'other' is strictly better in at least one objective
      const strictlyBetter =
        other.SIS > item.SIS || other.Average_Price_USD < item.Average_Price_USD;

      if (sisBetterOrEqual && priceBetterOrEqual && strictlyBetter) {
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

/* ========== RECOMMENDATION ENGINE (FIXED - Teacher's Feedback) ========== */

/**
 * Build recommendations using Multi-Objective Optimization
 * Categorizes Pareto items into 3 groups: Max Sustainability, Best Value, and Balanced Trade-off.
 */
function buildRecommendations(rowsWithSIS, topN = 5) {
  if (!rowsWithSIS.length) return { maxSustainability: [], bestValue: [], balanced: [] };

  const baseItems = rowsWithSIS.map((r) => ({ ...r }));

  const paretoFlags = computeParetoFlags(baseItems);
  baseItems.forEach((item, idx) => {
    item.isPareto = paretoFlags[idx];
  });

  const paretoItems = baseItems.filter(item => item.isPareto);

  if (paretoItems.length === 0) {
    return { maxSustainability: [], bestValue: [], balanced: [] };
  }

  // 1. Max Sustainability: Top SIS in Pareto set
  const maxSustainability = [...paretoItems]
    .sort((a, b) => b.SIS - a.SIS)
    .slice(0, topN);

  // 2. Best Value: Lowest price in Pareto set
  const bestValue = [...paretoItems]
    .sort((a, b) => a.Average_Price_USD - b.Average_Price_USD)
    .slice(0, topN);

  // 3. Balanced Trade-off: Items near the center of Pareto frontier
  // Calculate normalized distance from ideal point (high SIS, low price)
  const sisValues = paretoItems.map(item => item.SIS);
  const priceValues = paretoItems.map(item => item.Average_Price_USD);
  const sisNorm = normalizeMinMax(sisValues);
  const priceNormLocal = normalizeMinMax(priceValues);

  paretoItems.forEach((item, i) => {
    // Find the index of the current item in the original paretoItems array
    const originalIndex = paretoItems.findIndex(p => p === item);
    
    // Find the normalized scores for the current item
    const sisScore = sisNorm.norm[originalIndex];
    const priceScore = 1 - priceNormLocal.norm[originalIndex]; // Invert: lower price is better
    
    // Simple balance score (Euclidean distance from ideal point (1, 1) in normalized space)
    item.balanceScore = Math.sqrt(Math.pow(1 - sisScore, 2) + Math.pow(1 - priceScore, 2));
  });

  // Sort by balance score (lower is better, closer to ideal point)
  const balanced = [...paretoItems]
    .sort((a, b) => a.balanceScore - b.balanceScore)
    .slice(0, topN);

  return { maxSustainability, bestValue, balanced };
}

/* ========== MLP PREDICTOR (NEW - Optional Extension) ========== */

/**
 * Simple MLP model for predicting sustainability rating
 * Uses TensorFlow.js for client-side training
 */
let mlpModel = null;

async function trainMLPPredictor(rows) {
  if (!window.tf) {
    console.error("TensorFlow.js not loaded");
    return null;
  }

  // Prepare training data
  const features = rows.map(r => [
    toNumber(r.Carbon_Footprint_MT) || 0,
    toNumber(r.Water_Usage_Liters) || 0,
    toNumber(r.Waste_Production_KG) || 0,
    yesNoScore(r.Recycling_Programs) || 0,
  ]).filter(f => f.every(v => isFinite(v)));

  const labels = rows.map(r => ratingLetterToScore(r.Sustainability_Rating))
    .filter((_, i) => rows[i].Carbon_Footprint_MT && rows[i].Water_Usage_Liters && rows[i].Waste_Production_KG && rows[i].Recycling_Programs);

  if (features.length < 10) {
      console.error("Not enough data to train the model.");
      return null;
  }

  // Normalize features
  const featureTensor = tf.tensor2d(features);
  const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

  const { mean, variance } = tf.moments(featureTensor, 0);
  const std = variance.sqrt();
  const normalizedFeatures = featureTensor.sub(mean).div(std.add(1e-7));

  // Build model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [4], units: 16, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  // Train model
  await model.fit(normalizedFeatures, labelTensor, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    verbose: 0,
  });

  mlpModel = { model, mean, std };

  // Cleanup
  featureTensor.dispose();
  labelTensor.dispose();
  normalizedFeatures.dispose();

  return mlpModel;
}

function predictSustainabilityRating(carbon, water, waste, recycling) {
  if (!mlpModel) {
    console.error("Model not trained yet");
    return null;
  }

  const { model, mean, std } = mlpModel;

  const input = tf.tensor2d([[carbon, water, waste, recycling]]);
  const normalized = input.sub(mean).div(std.add(1e-7));
  const prediction = model.predict(normalized);
  const value = prediction.dataSync()[0];

  input.dispose();
  normalized.dispose();
  prediction.dispose();

  // Convert back to letter grade
  const score = value * 4;
  if (score >= 3.5) return 'A';
  if (score >= 2.5) return 'B';
  if (score >= 1.5) return 'C';
  return 'D';
}

/* ========== EXPORT MAIN PROCESSING FUNCTION ========== */

window.processData = function(rows) {
  const { rowsWithSIS, stats, materialAgg, entropyWeights, dataQuality } = normalizeAndComputeSIS(rows);

  const kmeansData = materialAgg.map(m => m.features);

  const { inertias, bestK } = chooseKByElbow(kmeansData);

  const clusters = runKMeans(kmeansData, bestK);

  materialAgg.forEach((m, i) => {
    m.cluster = clusters.assignments[i];
    m.envScoreNorm = m.meanEnvNorm;
    m.policyScoreNorm = m.meanPolicyNorm;
  });

  return {
    rowsWithSIS,
    stats,
    materialAgg,
    entropyWeights,
    dataQuality,
    elbowInfo: {
      bestK: bestK,
      elbowData: inertias,
    },
  };
};

window.trainMLPPredictor = trainMLPPredictor;
window.predictSustainabilityRating = predictSustainabilityRating;
window.buildRecommendations = buildRecommendations;
window.parseCSVFile = parseCSVFile;
window.parseCSVText = parseCSVText;
window.toNumber = toNumber;
window.ratingLetterToScore = ratingLetterToScore;
window.yesNoScore = yesNoScore;
window.normalizeMinMax = normalizeMinMax;
window.calculateVariance = calculateVariance;
window.calculateCV = calculateCV;
window.computeStats = computeStats;
window.aggregateByMaterial = aggregateByMaterial;
window.runKMeans = runKMeans;
window.chooseKByElbow = chooseKByElbow;
window.computeParetoFlags = computeParetoFlags;
