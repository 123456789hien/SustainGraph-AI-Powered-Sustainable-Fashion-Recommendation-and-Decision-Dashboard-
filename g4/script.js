/* script.js
   Wires DOM to logic in app.js.
   No imports. Needs app.js loaded before this file.
*/

const fileInput = document.getElementById("fileUpload");
const btnSample = document.getElementById("load-sample");
const btnAuto = document.getElementById("auto-upload");
const btnRun = document.getElementById("run-pipeline");
const statusEl = document.getElementById("load-status");

const brandFilter = document.getElementById("brand-filter");
const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const prioritySelect = document.getElementById("priority");

const kpiRow = document.getElementById("kpi-row");
const pcaDiv = document.getElementById("pca-plot");
const clusterLegend = document.getElementById("material-clusters");
const recoList = document.getElementById("recommendations-list");

// ML Regression card
const mlBtn = document.getElementById("train-sis-ml");
const mlStatus = document.getElementById("ml-status");
const mlMetrics = document.getElementById("ml-metrics");

// EDA + forecast containers
const edaMaterialDiv = document.getElementById("eda-material-chart");
const edaMaterialNote = document.getElementById("eda-material-note");
const edaCountryDiv = document.getElementById("eda-country-chart");
const edaCountryNote = document.getElementById("eda-country-note");
const edaYearDiv = document.getElementById("eda-year-chart");
const edaYearNote = document.getElementById("eda-year-note");
const forecastDiv = document.getElementById("forecast-chart");
const forecastNote = document.getElementById("forecast-note");

// state
let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let PCA_POINTS = [];
let SIS_MODEL = null;
let SIS_MODEL_INPUT_DIM = null;

// IMPORTANT: Auto-load URL — giữ nguyên như repo của bạn
const AUTOLOAD_URL =
  "https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/g4/Kaggle_sust_dataset.csv";

/* ========== LOAD HANDLERS ========== */

fileInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const rows = await parseCSVFile(f);
    onDataLoaded(rows, `✅ Loaded from file: ${f.name}`);
  } catch (err) {
    console.error(err);
    statusEl.innerText = "❌ Error reading file";
  }
});

btnSample.addEventListener("click", async () => {
  try {
    const resp = await fetch("Kaggle_sust_dataset.csv");
    if (!resp.ok) throw new Error("Cannot fetch Kaggle_sust_dataset.csv");
    const txt = await resp.text();
    const rows = parseCSVText(txt);
    onDataLoaded(rows, "✅ Loaded local Kaggle_sust_dataset.csv");
  } catch (err) {
    console.error(err);
    statusEl.innerText =
      "❌ Could not load Kaggle_sust_dataset.csv (place it next to index.html)";
  }
});

btnAuto.addEventListener("click", async () => {
  try {
    const resp = await fetch(AUTOLOAD_URL);
    if (!resp.ok) throw new Error("Auto-load URL not reachable");
    const txt = await resp.text();
    const rows = parseCSVText(txt);
    onDataLoaded(rows, "✅ Auto-loaded dataset from GitHub");
  } catch (err) {
    console.error(err);
    statusEl.innerText = "❌ Auto-load failed (check AUTOLOAD_URL in script.js)";
  }
});

function onDataLoaded(rows, message) {
  RAW_ROWS = rows;
  PROCESSED_ROWS = [];
  STATS = null;
  MATERIAL_AGG = [];
  PCA_POINTS = [];
  SIS_MODEL = null;
  SIS_MODEL_INPUT_DIM = null;
  statusEl.innerText = message + ` — rows: ${rows.length}`;
  populateFilters(rows);
  clearResults();
}

/* ========== FILTERS ========== */

function populateFilters(rows) {
  const brands = uniqueSorted(rows.map((r) => r.Brand_Name || r.Brand));
  const countries = uniqueSorted(rows.map((r) => r.Country));
  const mats = uniqueSorted(rows.map((r) => r.Material_Type));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt(r.Year || r.year || "", 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => r.Certifications));
  const trends = uniqueSorted(rows.map((r) => r.Market_Trend));

  fillSelect(brandFilter, brands);
  fillSelect(countryFilter, countries);
  fillSelect(materialFilter, mats);
  fillSelect(yearFilter, years.map(String));
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function fillSelect(sel, values) {
  sel.innerHTML = '<option value="__all">All</option>';
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

/* ========== RUN PIPELINE ========== */

btnRun.addEventListener("click", () => {
  if (!RAW_ROWS.length) {
    alert("Please upload or auto-load the dataset first.");
    return;
  }
  btnRun.disabled = true;
  btnRun.textContent = "Processing...";

  try {
    const filtered = RAW_ROWS.filter((r) => {
      const brand = r.Brand_Name || r.Brand;
      const mat = r.Material_Type;
      const country = r.Country;
      const year = parseInt(r.Year || r.year || "", 10);
      const cert = r.Certifications;
      const trend = r.Market_Trend;

      if (brandFilter.value !== "__all" && brand !== brandFilter.value)
        return false;
      if (countryFilter.value !== "__all" && country !== countryFilter.value)
        return false;
      if (materialFilter.value !== "__all" && mat !== materialFilter.value)
        return false;
      if (yearFilter.value !== "__all" && year !== +yearFilter.value)
        return false;
      if (certFilter.value !== "__all" && cert !== certFilter.value)
        return false;
      if (trendFilter.value !== "__all" && trend !== trendFilter.value)
        return false;
      return true;
    });

    if (!filtered.length) {
      alert("No rows match current filters.");
      return;
    }

    const { rowsWithSIS, stats, materialAgg } =
      normalizeAndComputeSIS(filtered);
    PROCESSED_ROWS = rowsWithSIS;
    STATS = stats;
    MATERIAL_AGG = materialAgg;
    SIS_MODEL = null;
    SIS_MODEL_INPUT_DIM = null;
    if (mlStatus) mlStatus.innerText = "Model not trained yet for this filter set.";
    if (mlMetrics) mlMetrics.innerHTML = "";

    renderKPIs();
    clusterAndRenderMaterials();
    buildAndRenderRecommendations();
    renderAllEDAAndForecast();
  } catch (err) {
    console.error(err);
    alert("Pipeline error (see console).");
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = "🚀 Run Analysis & Recommendations";
  }
});

/* ========== KPI RENDER ========== */

function renderKPIs() {
  if (!PROCESSED_ROWS.length || !STATS) {
    kpiRow.innerHTML = "";
    return;
  }
  const mean = STATS.mean;
  const avgSIS = mean.SIS || 0;

  kpiRow.innerHTML = `
    <div class="kpi-card" title="Average SIS across the filtered dataset">
      <div class="kpi-title">Avg Sustainability Index (SIS)</div>
      <div class="kpi-value">${avgSIS.toFixed(2)}</div>
      <div class="kpi-sub">Higher is better</div>
    </div>
    <div class="kpi-card" title="Average carbon footprint per record">
      <div class="kpi-title">Avg Carbon Footprint</div>
      <div class="kpi-value">${(mean.Carbon_Footprint_MT || 0).toFixed(
        1
      )}<span class="kpi-sub"> MT</span></div>
      <div class="kpi-sub">Production emissions</div>
    </div>
    <div class="kpi-card" title="Average water usage per record">
      <div class="kpi-title">Avg Water Usage</div>
      <div class="kpi-value">${(mean.Water_Usage_Liters || 0).toFixed(
        0
      )}<span class="kpi-sub"> L</span></div>
      <div class="kpi-sub">Water intensity</div>
    </div>
    <div class="kpi-card" title="Average waste generation per record">
      <div class="kpi-title">Avg Waste</div>
      <div class="kpi-value">${(mean.Waste_Production_KG || 0).toFixed(
        1
      )}<span class="kpi-sub"> Kg</span></div>
      <div class="kpi-sub">Waste generation</div>
    </div>
  `;
}

/* ========== MATERIAL CLUSTER + PCA MAP ========== */

function clusterAndRenderMaterials() {
  const agg = MATERIAL_AGG;
  if (!agg.length) {
    pcaDiv.innerHTML = "";
    clusterLegend.innerHTML = "";
    return;
  }
  const featureMatrix = agg.map((m) => [
    m.meanCarbon,
    m.meanWater,
    m.meanWaste,
  ]);
  const { assignments } = runKMeans(featureMatrix, 3, 40);
  const withCluster = agg.map((m, i) => ({
    ...m,
    cluster: assignments[i] || 0,
  }));

  MATERIAL_AGG = withCluster;
  PCA_POINTS = computePcaLikeCoords(withCluster);

  renderPcaScatter();
  renderClusterLegend();
}

function renderPcaScatter() {
  pcaDiv.innerHTML = "";
  const width = pcaDiv.clientWidth || 600;
  const height = pcaDiv.clientHeight || 320;

  const data = PCA_POINTS.map((p, i) => ({
    ...p,
    cluster: MATERIAL_AGG[i].cluster,
    meanSIS: MATERIAL_AGG[i].meanSIS,
    count: MATERIAL_AGG[i].count,
  }));

  const svg = d3
    .select(pcaDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const padding = 30;
  const xScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([padding, width - padding]);
  const yScale = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding, padding]);

  const colorScale = d3
    .scaleOrdinal()
    .domain([0, 1, 2])
    .range(["#4ade80", "#a3e635", "#facc15"]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(4));
  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Normalized CO₂ vs Water usage per material");

  svg
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("r", (d) => 6 + Math.min(8, d.count / 5))
    .attr("fill", (d) => colorScale(d.cluster))
    .attr("opacity", 0.85)
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nSIS: ${d.meanSIS.toFixed(
          2
        )}\nBrands: ${d.count}`
    );
}

function renderClusterLegend() {
  clusterLegend.innerHTML = "";
  const clusters = [
    { id: 0, label: "Low-impact cluster" },
    { id: 1, label: "Medium-impact cluster" },
    { id: 2, label: "High-impact cluster" },
  ];
  const colors = ["#4ade80", "#a3e635", "#facc15"];

  clusters.forEach((c, i) => {
    const pill = document.createElement("div");
    pill.className = "cluster-pill";
    pill.innerHTML = `
      <span class="cluster-dot" style="background:${colors[i]}"></span>
      <span>${c.label}</span>
    `;
    clusterLegend.appendChild(pill);
  });
}

/* ========== RECOMMENDATIONS RENDER ========== */

function buildAndRenderRecommendations() {
  const w = parseFloat(prioritySelect.value || "0.5");
  const recs = buildRecommendations(PROCESSED_ROWS, w, 10);
  renderRecommendations(recs);
}

function renderRecommendations(items) {
  recoList.innerHTML = "";
  if (!items.length) {
    recoList.textContent = "No recommendations for current filters.";
    return;
  }

  items.forEach((item, idx) => {
    const band =
      item.SIS >= 0.75 ? "reco-high" : item.SIS >= 0.55 ? "reco-mid" : "reco-low";

    const div = document.createElement("div");
    div.className = `reco-item ${band}`;
    div.innerHTML = `
      <div class="reco-rank-badge" title="Top ranked item under current priority">🔥 Top ${
        idx + 1
      }</div>
      <div class="reco-header">
        <div>
          <div class="reco-brand">${item.Brand_Name || item.Brand_ID}</div>
          <div class="reco-tagline">
            ${item.Material_Type || "Unknown material"} • ${
      item.Country || "Unknown country"
    }
          </div>
        </div>
        <div class="reco-metrics">
          <span><strong>SIS</strong> ${item.SIS.toFixed(2)}</span>
          <span><strong>CO₂</strong> ${(item.Carbon_Footprint_MT || 0).toFixed(
            1
          )} MT</span>
          <span><strong>Water</strong> ${(item.Water_Usage_Liters || 0).toFixed(
            0
          )} L</span>
          <span><strong>Waste</strong> ${(item.Waste_Production_KG || 0).toFixed(
            1
          )} Kg</span>
          <span><strong>Price</strong> $${
            item.Average_Price_USD
              ? item.Average_Price_USD.toFixed(2)
              : "N/A"
          }</span>
        </div>
      </div>
      <div class="reco-pill-row">
        ${
          item.Sustainability_Rating
            ? `<span class="reco-pill" title="Declared sustainability rating">Rating: ${item.Sustainability_Rating}</span>`
            : ""
        }
        ${
          item.Eco_Friendly_Manufacturing
            ? `<span class="reco-pill" title="Eco-friendly manufacturing flag">Eco-friendly: ${item.Eco_Friendly_Manufacturing}</span>`
            : ""
        }
        ${
          item.Recycling_Programs
            ? `<span class="reco-pill" title="Recycling programs in place">Recycling: ${item.Recycling_Programs}</span>`
            : ""
        }
        ${
          item.Market_Trend
            ? `<span class="reco-pill" title="Market trend segment">Trend: ${item.Market_Trend}</span>`
            : ""
        }
        ${
          item.Certifications
            ? `<span class="reco-pill" title="Key sustainability certifications">Cert: ${item.Certifications}</span>`
            : ""
        }
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== ML REGRESSION: TRAIN BUTTON FIRST, THEN PREDICT ========== */

if (mlBtn) {
  mlBtn.addEventListener("click", async () => {
    if (!PROCESSED_ROWS.length) {
      alert("Please run the analysis pipeline first (Step 2 button).");
      return;
    }
    if (typeof tf === "undefined") {
      alert("TensorFlow.js is not available. Cannot train ML regression.");
      return;
    }
    await trainSISRegressionModel();
  });
}

async function trainSISRegressionModel() {
  try {
    mlBtn.disabled = true;
    mlStatus.innerText = "⏳ Training SIS regression model on current records...";
    mlMetrics.innerHTML = "";

    const { X, y } = buildSISRegressionData(PROCESSED_ROWS);
    const n = X.length;
    if (!n || n < 20) {
      mlStatus.innerText =
        "⚠️ Not enough records to train a reliable model (need at least ~20).";
      mlBtn.disabled = false;
      return;
    }

    const inputDim = X[0].length;
    SIS_MODEL_INPUT_DIM = inputDim;

    const xs = tf.tensor2d(X, [n, inputDim]);
    const ys = tf.tensor2d(y.map((v) => [v]), [n, 1]);

    const model = tf.sequential();
    model.add(
      tf.layers.dense({
        units: 16,
        activation: "relu",
        inputShape: [inputDim],
      })
    );
    model.add(
      tf.layers.dense({
        units: 8,
        activation: "relu",
      })
    );
    model.add(
      tf.layers.dense({
        units: 1,
        activation: "linear",
      })
    );

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "meanSquaredError",
    });

    await model.fit(xs, ys, {
      epochs: 120,
      batchSize: Math.min(64, n),
      verbose: 0,
    });

    // Predict back on training data to compute metrics
    const predsTensor = model.predict(xs);
    const preds = Array.from(await predsTensor.data());

    const mse =
      preds.reduce((acc, p, i) => {
        const d = p - y[i];
        return acc + d * d;
      }, 0) / n;

    const mae =
      preds.reduce((acc, p, i) => acc + Math.abs(p - y[i]), 0) / n;

    const meanY =
      y.reduce((acc, v) => acc + v, 0) / (n || 1);
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const dRes = y[i] - preds[i];
      const dTot = y[i] - meanY;
      ssRes += dRes * dRes;
      ssTot += dTot * dTot;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    xs.dispose();
    ys.dispose();
    predsTensor.dispose();

    SIS_MODEL = model;

    mlStatus.innerText = "✅ SIS regression model trained. Ready for scenario analysis.";
    mlMetrics.innerHTML = `
      <div><strong>Trained on:</strong> ${n} records</div>
      <div><strong>MSE:</strong> ${mse.toFixed(4)}</div>
      <div><strong>MAE:</strong> ${mae.toFixed(4)}</div>
      <div><strong>R²:</strong> ${r2.toFixed(3)}</div>
      <div style="margin-top:4px;">
        Model approximates SIS from carbon, water, waste, policy scores and price.
        Use it conceptually for “what-if” analysis on material and pricing strategies.
      </div>
    `;
  } catch (err) {
    console.error(err);
    mlStatus.innerText = "❌ Error training SIS regression model (see console).";
  } finally {
    mlBtn.disabled = false;
  }
}

/* ========== EDA + FORECAST ========== */

function renderAllEDAAndForecast() {
  renderMaterialEda();
  const yearAggFromCountry = renderCountryEda();
  const yearAggFromYear = renderYearEda();
  const yearAggBase =
    yearAggFromYear && yearAggFromYear.length
      ? yearAggFromYear
      : yearAggFromCountry;
  if (yearAggBase && yearAggBase.length) {
    renderLstmForecast(yearAggBase);
  } else {
    forecastDiv.innerHTML = "";
    forecastNote.innerText =
      "Not enough year-level data to build a forecast.";
  }
}

/* --- EDA Materials --- */

function renderMaterialEda() {
  edaMaterialDiv.innerHTML = "";
  edaMaterialNote.innerText = "";
  if (!MATERIAL_AGG.length) return;

  const data = MATERIAL_AGG.slice().sort(
    (a, b) => b.meanSIS - a.meanSIS
  );

  const width = edaMaterialDiv.clientWidth || 600;
  const height = edaMaterialDiv.clientHeight || 260;
  const padding = 40;

  const svg = d3
    .select(edaMaterialDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Material_Type))
    .range([padding, width - padding])
    .padding(0.25);

  const maxPrice = d3.max(data, (d) => d.meanPrice || 0) || 1;
  const yLeft = d3
    .scaleLinear()
    .domain([0, maxPrice * 1.1])
    .range([height - padding, padding]);

  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding, padding]);

  // Bars: price
  svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.Material_Type))
    .attr("y", (d) => yLeft(d.meanPrice || 0))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding - yLeft(d.meanPrice || 0))
    .attr("fill", "var(--eda-bar)")
    .attr("opacity", 0.8);

  // Line: SIS
  const line = d3
    .line()
    .x((d) => xScale(d.Material_Type) + xScale.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS || 0));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "var(--eda-line)")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".sis-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "sis-point")
    .attr("cx", (d) => xScale(d.Material_Type) + xScale.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.meanSIS || 0))
    .attr("r", 4)
    .attr("fill", "var(--eda-line)")
    .append("title")
    .text(
      (d) =>
        `${d.Material_Type}\nSIS: ${d.meanSIS.toFixed(
          2
        )}\nAvg price: $${(d.meanPrice || 0).toFixed(2)}`
    );

  // Axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - padding},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Material-level tradeoff between Price (bars) and SIS (line)");

  const best = data.reduce((a, b) =>
    b.meanSIS > a.meanSIS ? b : a
  );
  const worst = data.reduce((a, b) =>
    b.meanSIS < a.meanSIS ? b : a
  );

  edaMaterialNote.innerText =
    `Materials EDA insight: “${best.Material_Type}” shows the highest average SIS ` +
    `≈ ${best.meanSIS.toFixed(2)} with price around $${(best.meanPrice || 0).toFixed(
      2
    )}. ` +
    `In contrast, “${worst.Material_Type}” is at the bottom with SIS ≈ ${worst.meanSIS.toFixed(
      2
    )}. ` +
    `For a sustainability-first strategy you can prioritise high-SIS materials while checking ` +
    `whether the price premium is acceptable for your target segment.`;
}

/* --- EDA Countries --- */

function renderCountryEda() {
  edaCountryDiv.innerHTML = "";
  edaCountryNote.innerText = "";
  if (!PROCESSED_ROWS.length) return [];

  const map = new Map();
  PROCESSED_ROWS.forEach((r) => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) {
      map.set(c, {
        country: c,
        sumSIS: 0,
        sumPrice: 0,
        count: 0,
      });
    }
    const m = map.get(c);
    m.sumSIS += r.SIS || 0;
    m.sumPrice += r.Average_Price_USD || 0;
    m.count += 1;
  });

  let data = Array.from(map.values()).map((m) => ({
    country: m.country,
    meanSIS: m.sumSIS / m.count,
    meanPrice: m.sumPrice / m.count,
    count: m.count,
  }));

  data = data
    .filter((d) => d.count > 0)
    .sort((a, b) => b.meanPrice - a.meanPrice)
    .slice(0, 10);

  if (!data.length) return [];

  const width = edaCountryDiv.clientWidth || 600;
  const height = edaCountryDiv.clientHeight || 260;
  const padding = 40;

  const svg = d3
    .select(edaCountryDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.country))
    .range([padding, width - padding])
    .padding(0.25);

  const maxPrice = d3.max(data, (d) => d.meanPrice || 0) || 1;
  const yLeft = d3
    .scaleLinear()
    .domain([0, maxPrice * 1.1])
    .range([height - padding, padding]);

  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding, padding]);

  svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.country))
    .attr("y", (d) => yLeft(d.meanPrice || 0))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding - yLeft(d.meanPrice || 0))
    .attr("fill", "var(--eda-bar-alt)")
    .attr("opacity", 0.85);

  const line = d3
    .line()
    .x((d) => xScale(d.country) + xScale.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS || 0));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "var(--eda-line-alt)")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".sis-country-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "sis-country-point")
    .attr("cx", (d) => xScale(d.country) + xScale.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.meanSIS || 0))
    .attr("r", 4)
    .attr("fill", "var(--eda-line-alt)")
    .append("title")
    .text(
      (d) =>
        `${d.country}\nSIS: ${d.meanSIS.toFixed(
          2
        )}\nAvg price: $${(d.meanPrice || 0).toFixed(2)}`
    );

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - padding},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Top countries by average price (bars) with SIS line overlay");

  const bestSIS = data.reduce((a, b) =>
    b.meanSIS > a.meanSIS ? b : a
  );
  const bestPrice = data.reduce((a, b) =>
    b.meanPrice > a.meanPrice ? b : a
  );

  edaCountryNote.innerText =
    `Country EDA insight: among the top price markets, “${bestPrice.country}” has the ` +
    `highest average price ≈ $${bestPrice.meanPrice.toFixed(
      2
    )}, while “${bestSIS.country}” leads in SIS ≈ ${bestSIS.meanSIS.toFixed(
      2
    )}. ` +
    `This shows where premium sustainable assortments can be positioned and which markets ` +
    `should be targeted for SIS improvement.`;

  return data;
}

/* --- EDA Years --- */

function renderYearEda() {
  edaYearDiv.innerHTML = "";
  edaYearNote.innerText = "";
  if (!PROCESSED_ROWS.length) return [];

  const map = new Map();
  PROCESSED_ROWS.forEach((r) => {
    const y = r.Year;
    if (!y || !isFinite(y)) return;
    if (!map.has(y)) {
      map.set(y, {
        year: y,
        sumSIS: 0,
        sumPrice: 0,
        count: 0,
      });
    }
    const m = map.get(y);
    m.sumSIS += r.SIS || 0;
    m.sumPrice += r.Average_Price_USD || 0;
    m.count += 1;
  });

  let data = Array.from(map.values()).map((m) => ({
    year: m.year,
    meanSIS: m.sumSIS / m.count,
    meanPrice: m.sumPrice / m.count,
    count: m.count,
  }));

  data = data
    .filter((d) => d.count > 0)
    .sort((a, b) => a.year - b.year);

  if (!data.length) return [];

  const width = edaYearDiv.clientWidth || 600;
  const height = edaYearDiv.clientHeight || 260;
  const padding = 40;

  const svg = d3
    .select(edaYearDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.year))
    .range([padding, width - padding])
    .padding(0.25);

  const maxPrice = d3.max(data, (d) => d.meanPrice || 0) || 1;
  const yLeft = d3
    .scaleLinear()
    .domain([0, maxPrice * 1.1])
    .range([height - padding, padding]);

  const yRight = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - padding, padding]);

  svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.year))
    .attr("y", (d) => yLeft(d.meanPrice || 0))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - padding - yLeft(d.meanPrice || 0))
    .attr("fill", "var(--eda-bar)")
    .attr("opacity", 0.85);

  const line = d3
    .line()
    .x((d) => xScale(d.year) + xScale.bandwidth() / 2)
    .y((d) => yRight(d.meanSIS || 0));

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "var(--eda-line)")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .selectAll(".sis-year-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "sis-year-point")
    .attr("cx", (d) => xScale(d.year) + xScale.bandwidth() / 2)
    .attr("cy", (d) => yRight(d.meanSIS || 0))
    .attr("r", 4)
    .attr("fill", "var(--eda-line)")
    .append("title")
    .text(
      (d) =>
        `${d.year}\nSIS: ${d.meanSIS.toFixed(
          2
        )}\nAvg price: $${(d.meanPrice || 0).toFixed(2)}`
    );

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yLeft).ticks(4));

  svg
    .append("g")
    .attr("transform", `translate(${width - padding},0)`)
    .call(d3.axisRight(yRight).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("Yearly evolution of Avg Price (bars) and SIS (line)");

  const first = data[0];
  const last = data[data.length - 1];
  const trend =
    last.meanSIS > first.meanSIS + 0.02
      ? "upward"
      : last.meanSIS < first.meanSIS - 0.02
      ? "downward"
      : "flat";

  let trendText = "";
  if (trend === "upward") {
    trendText =
      "SIS has been improving over the years, which suggests effective sustainability actions or cleaner materials.";
  } else if (trend === "downward") {
    trendText =
      "SIS has been declining, which may signal cost pressure or a shift to less sustainable inputs.";
  } else {
    trendText =
      "SIS is relatively stable across years, so most variation might be driven by pricing and mix rather than sustainability levels.";
  }

  edaYearNote.innerText =
    `Year EDA insight: from ${first.year} to ${last.year}, average SIS moved ` +
    `from ${first.meanSIS.toFixed(2)} to ${last.meanSIS.toFixed(2)}, while price ` +
    `changed from $${first.meanPrice.toFixed(2)} to $${last.meanPrice.toFixed(
      2
    )}. ` +
    trendText;

  return data;
}

/* --- LSTM Forecast --- */

async function renderLstmForecast(yearAgg) {
  forecastDiv.innerHTML = "";
  forecastNote.innerText = "";

  if (!yearAgg || yearAgg.length < 3) {
    forecastNote.innerText =
      "Not enough historical years to train an LSTM forecast (need at least 3 points).";
    return;
  }

  if (typeof tf === "undefined") {
    forecastNote.innerText =
      "TensorFlow.js not available. Forecast cannot be computed.";
    return;
  }

  const data = yearAgg
    .slice()
    .filter((d) => isFinite(d.year) && isFinite(d.meanSIS))
    .sort((a, b) => a.year - b.year);

  const years = data.map((d) => d.year);
  const sisVals = data.map((d) => d.meanSIS);

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const yearNorm = years.map((y) =>
    minYear === maxYear ? 0.5 : (y - minYear) / (maxYear - minYear)
  );

  const xs = tf.tensor3d(yearNorm.map((v) => [[v]]));
  const ys = tf.tensor2d(sisVals.map((v) => [v]));

  const model = tf.sequential();
  model.add(
    tf.layers.lstm({
      units: 8,
      inputShape: [1, 1],
      activation: "tanh",
    })
  );
  model.add(tf.layers.dense({ units: 1 }));

  model.compile({
    optimizer: tf.train.adam(0.05),
    loss: "meanSquaredError",
  });

  await model.fit(xs, ys, {
    epochs: 80,
    verbose: 0,
  });

  const futureYears = [];
  const lastYear = maxYear;
  for (let i = 1; i <= 3; i++) {
    futureYears.push(lastYear + i);
  }

  const allYears = years.concat(futureYears);
  const allYearNorm = allYears.map((y) =>
    minYear === maxYear ? 0.5 : (y - minYear) / (maxYear - minYear)
  );

  const allXs = tf.tensor3d(allYearNorm.map((v) => [[v]]));
  const predAll = model.predict(allXs);
  const predVals = Array.from(await predAll.data());

  xs.dispose();
  ys.dispose();
  allXs.dispose();
  predAll.dispose();

  const actualPoints = data.map((d, i) => ({
    year: years[i],
    sis: sisVals[i],
  }));
  const forecastPoints = futureYears.map((y, idx) => ({
    year: y,
    sis: predVals[years.length + idx],
  }));

  const width = forecastDiv.clientWidth || 600;
  const height = forecastDiv.clientHeight || 260;
  const padding = 40;

  const svg = d3
    .select(forecastDiv)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const xScale = d3
    .scaleLinear()
    .domain([minYear, lastYear + 3])
    .range([padding, width - padding]);

  const yScale = d3
    .scaleLinear()
    .domain([
      0,
      Math.max(
        1,
        d3.max(actualPoints, (d) => d.sis),
        d3.max(forecastPoints, (d) => d.sis || 0)
      ) * 1.05,
    ])
    .range([height - padding, padding]);

  const actualLine = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.sis));

  const forecastLine = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.sis));

  svg
    .append("path")
    .datum(actualPoints)
    .attr("fill", "none")
    .attr("stroke", "#15803d")
    .attr("stroke-width", 2)
    .attr("d", actualLine);

  svg
    .selectAll(".actual-sis-point")
    .data(actualPoints)
    .enter()
    .append("circle")
    .attr("class", "actual-sis-point")
    .attr("cx", (d) => xScale(d.year))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 4)
    .attr("fill", "#15803d")
    .append("title")
    .text((d) => `${d.year} — SIS: ${d.sis.toFixed(2)}`);

  svg
    .append("path")
    .datum(forecastPoints)
    .attr("fill", "none")
    .attr("stroke", "#22c55e")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6 4")
    .attr("d", forecastLine);

  svg
    .selectAll(".forecast-sis-point")
    .data(forecastPoints)
    .enter()
    .append("circle")
    .attr("class", "forecast-sis-point")
    .attr("cx", (d) => xScale(d.year))
    .attr("cy", (d) => yScale(d.sis))
    .attr("r", 4)
    .attr("fill", "#22c55e")
    .append("title")
    .text((d) => `${d.year} (forecast) — SIS: ${d.sis.toFixed(2)}`);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - padding})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  svg
    .append("g")
    .attr("transform", `translate(${padding},0)`)
    .call(d3.axisLeft(yScale).ticks(4));

  svg
    .append("text")
    .attr("x", padding)
    .attr("y", padding - 10)
    .attr("fill", "#4b5563")
    .attr("font-size", 11)
    .text("LSTM forecast of SIS by year (solid = history, dashed = forecast)");

  const lastActual = actualPoints[actualPoints.length - 1].sis;
  const lastForecast = forecastPoints[forecastPoints.length - 1].sis;
  const diff = lastForecast - lastActual;

  let comment = "";
  if (diff > 0.02) {
    comment =
      "The LSTM forecast suggests SIS will continue to improve over the next 3 years if current patterns persist. This is a good moment to scale high-SIS materials.";
  } else if (diff < -0.02) {
    comment =
      "The LSTM forecast indicates a mild decline in SIS, which may reflect cost pressure or a drift towards less sustainable suppliers. It is a warning for sustainability teams.";
  } else {
    comment =
      "The forecast is roughly flat, meaning SIS will likely stay close to current levels unless new initiatives are introduced.";
  }

  forecastNote.innerText =
    `LSTM forecast view: historical years from ${minYear} to ${maxYear} show SIS ` +
    `in the range ${d3.min(sisVals).toFixed(2)}–${d3
      .max(sisVals)
      .toFixed(2)}. ` +
    `The model projects SIS around ${lastForecast.toFixed(
      2
    )} by ${lastYear + 3}. ` +
    comment;
}

/* ========== UTIL ========== */

function clearResults() {
  kpiRow.innerHTML = "";
  pcaDiv.innerHTML = "";
  clusterLegend.innerHTML = "";
  recoList.innerHTML = "";
  if (edaMaterialDiv) edaMaterialDiv.innerHTML = "";
  if (edaMaterialNote) edaMaterialNote.innerText = "";
  if (edaCountryDiv) edaCountryDiv.innerHTML = "";
  if (edaCountryNote) edaCountryNote.innerText = "";
  if (edaYearDiv) edaYearDiv.innerHTML = "";
  if (edaYearNote) edaYearNote.innerText = "";
  if (forecastDiv) forecastDiv.innerHTML = "";
  if (forecastNote) forecastNote.innerText = "";
  if (mlStatus) mlStatus.innerText = "";
  if (mlMetrics) mlMetrics.innerHTML = "";
}
