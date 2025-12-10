/*
   script.js - Enhanced Version
   UI rendering and visualization for SustainGraph
   Implements scientific methodology display with enhanced UI/UX
   
   NEW FEATURES:
   1. Data Quality Validation section
   2. Detailed Cluster Interpretation table
   3. Three Pareto recommendation categories
   4. MLP Prediction interface
*/

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let ELBOW_INFO = null;
let ENTROPY_WEIGHTS = null;
let DATA_QUALITY = null;

/* ========== DOM ELEMENTS ========== */

const fileUpload = document.getElementById("fileUpload");
const loadSampleBtn = document.getElementById("load-sample");
const autoUploadBtn = document.getElementById("auto-upload");
const loadStatus = document.getElementById("load-status");

const countryFilter = document.getElementById("country-filter");
const materialFilter = document.getElementById("material-filter");
const yearFilter = document.getElementById("year-filter");
const certFilter = document.getElementById("cert-filter");
const trendFilter = document.getElementById("trend-filter");
const btnRun = document.getElementById("run-pipeline");

const kpiRow = document.getElementById("kpi-row");
const clusterLegend = document.getElementById("cluster-legend");
const paretoInsightDiv = document.getElementById("pareto-insight");
const dataQualityDiv = document.getElementById("data-quality-validation");

// Prediction elements
const trainModelBtn = document.getElementById("train-model-btn");
const predictionStatus = document.getElementById("prediction-status");
const predictionForm = document.getElementById("prediction-form");
const predictBtn = document.getElementById("predict-btn");
const predictionResultDiv = document.getElementById("prediction-result");

/* ========== TOOLTIP HELPER (Unified Professional Style) ========== */

function createTooltip(className) {
  return d3
    .select("body")
    .append("div")
    .attr("class", `tooltip-custom ${className}`)
    .style("visibility", "hidden");
}

/* ========== FILE UPLOAD ========== */

fileUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  parseCsv(file);
});

loadSampleBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/c1/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file);
    });
});

autoUploadBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/c1/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file);
    });
});

function parseCsv(file) {
  loadStatus.textContent = `Parsing ${file.name}...`;
  window.parseCSVFile(file).then((rows) => {
    RAW_ROWS = rows;
    loadStatus.textContent = `Loaded ${rows.length} rows from ${file.name}.`;
    initializeFilters(rows);
    btnRun.disabled = false;
  });
}

/* ========== FILTERING & INITIALIZATION ========== */

function initializeFilters(rows) {
  const unique = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();

  const countries = unique("Country");
  const materials = unique("Material_Type");
  const years = unique("Year");
  const certs = unique("Certification");
  const trends = unique("Market_Trend");

  populateSelect(countryFilter, countries);
  populateSelect(materialFilter, materials);
  populateSelect(yearFilter, years);
  populateSelect(certFilter, certs);
  populateSelect(trendFilter, trends);
}

function populateSelect(selectElement, options) {
  selectElement.innerHTML = '<option value="">All</option>';
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    selectElement.appendChild(opt);
  });
}

function getFilters() {
  return {
    Country: countryFilter.value,
    Material_Type: materialFilter.value,
    Year: yearFilter.value,
    Certification: certFilter.value,
    Market_Trend: trendFilter.value,
  };
}

function applyFilters(rows, filters) {
  return rows.filter((row) => {
    for (const key in filters) {
      if (filters[key] && row[key] !== filters[key]) {
        return false;
      }
    }
    return true;
  });
}

/* ========== MAIN PIPELINE ========== */

btnRun.addEventListener("click", () => {
  runPipeline();
});

function runPipeline() {
  if (!RAW_ROWS.length) {
    loadStatus.textContent = "Please load a dataset first.";
    return;
  }

  loadStatus.textContent = "Running scientific analysis pipeline...";
  btnRun.disabled = true;

  const filteredRows = applyFilters(RAW_ROWS, getFilters());

  if (filteredRows.length === 0) {
    loadStatus.textContent = "No data matches the current filters.";
    btnRun.disabled = false;
    return;
  }

  const result = window.processData(filteredRows);

  PROCESSED_ROWS = result.rowsWithSIS;
  STATS = result.stats;
  MATERIAL_AGG = result.materialAgg;
  ELBOW_INFO = result.elbowInfo;
  ENTROPY_WEIGHTS = result.entropyWeights;
  DATA_QUALITY = result.dataQuality;

  renderKPIs();
  renderDataQualityValidation();
  renderEDA();
  clusterAndRenderMaterials();
  renderParetoFrontier();
  renderRecommendations();

  loadStatus.textContent = `Analysis complete. ${PROCESSED_ROWS.length} records processed.`;
  btnRun.disabled = false;
}

/* ========== RENDERING COMPONENTS ========== */

function renderKPIs() {
  if (!STATS) return;

  const sisMean = STATS.SIS.mean;
  const priceMean = STATS.Average_Price_USD.mean;
  const envMean = STATS.environmental_score.mean;
  const policyMean = STATS.policy_score.mean;

  const kpis = [
    { label: "Avg. SIS", value: sisMean.toFixed(3), sub: "Sustainability Index Score" },
    { label: "Avg. Price", value: `$${priceMean.toFixed(2)}`, sub: "USD" },
    { label: "Env. Score", value: envMean.toFixed(3), sub: "Environmental" },
    { label: "Policy Score", value: policyMean.toFixed(3), sub: "Policy & Compliance" },
  ];

  const kpiHtml = kpis.map(kpi => `
    <div class="kpi-item">
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-label">${kpi.label}</div>
      <div class="kpi-sublabel">${kpi.sub}</div>
    </div>
  `).join("");

  kpiRow.innerHTML = kpiHtml;
}

/* ========== DATA QUALITY VALIDATION (Section 4) ========== */

function renderDataQualityValidation() {
  if (!DATA_QUALITY || !ENTROPY_WEIGHTS) return;

  const { carbon, water, waste } = DATA_QUALITY;

  dataQualityDiv.innerHTML = `
    <table class="validation-table">
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Min</th>
          <th>Max</th>
          <th>Variance</th>
          <th>CV (Coefficient of Variation)</th>
          <th>Interpretation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Carbon Footprint (MT)</strong></td>
          <td>${carbon.min.toFixed(2)}</td>
          <td>${carbon.max.toFixed(2)}</td>
          <td>${carbon.variance.toFixed(4)}</td>
          <td>${carbon.cv.toFixed(4)}</td>
          <td>${carbon.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
        <tr>
          <td><strong>Water Usage (Liters)</strong></td>
          <td>${water.min.toFixed(0)}</td>
          <td>${water.max.toFixed(0)}</td>
          <td>${water.variance.toFixed(2)}</td>
          <td>${water.cv.toFixed(4)}</td>
          <td>${water.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
        <tr>
          <td><strong>Waste Production (KG)</strong></td>
          <td>${waste.min.toFixed(2)}</td>
          <td>${waste.max.toFixed(2)}</td>
          <td>${waste.variance.toFixed(4)}</td>
          <td>${waste.cv.toFixed(4)}</td>
          <td>${waste.cv < 0.3 ? 'Low variance (uniform distribution)' : 'High variance'}</td>
        </tr>
      </tbody>
    </table>

    <div class="validation-insight">
      <strong>Academic Defense & Scientific Justification:</strong><br>
      The Entropy Weight Method is employed to objectively determine the weight of each component score. The results show:
      <ul>
        <li>Environmental indicators (Carbon, Water, Waste) exhibit <strong>low variance</strong> (low CV) in this dataset, suggesting a <strong>simulated uniform distribution</strong>.</li>
        <li>Low variance leads to <strong>high entropy</strong> (low information content) for the environmental score, resulting in a <strong>low weight (${ENTROPY_WEIGHTS.env.toFixed(4)})</strong>.</li>
        <li>Policy indicators (Sustainability Rating, Recycling) exhibit <strong>higher variance</strong>, leading to <strong>low entropy</strong> (high information content) and a <strong>high weight (${ENTROPY_WEIGHTS.policy.toFixed(4)})</strong>.</li>
      </ul>
      <strong>Warning on Generalization:</strong> The resulting SIS is <strong>data-driven</strong>. The low weight for environmental factors is a direct consequence of the <strong>data quality</strong> (lack of discrimination) in the input dataset, not a methodological flaw. Generalization of this specific weighting to other datasets is not recommended without re-validation.
    </div>
  `;
}

/* ========== EDA CHARTS (Section 5) ========== */

function renderEDA() {
  renderEDAMaterial();
  renderEDACountry();
  renderEDATrend();
  renderEDAYear();
}

function aggregateEDA(rows, key) {
  const dataMap = rows.reduce((acc, r) => {
    const k = r[key];
    if (!k) return acc;
    if (!acc[k]) {
      acc[k] = { count: 0, sumSIS: 0, sumPrice: 0 };
    }
    acc[k].count++;
    acc[k].sumSIS += r.SIS;
    acc[k].sumPrice += r.Average_Price_USD;
    return acc;
  }, {});

  return Object.entries(dataMap).map(([k, v]) => ({
    key: k,
    count: v.count,
    meanSIS: v.sumSIS / v.count,
    meanPrice: v.sumPrice / v.count,
  })).sort((a, b) => b.count - a.count);
}

// Dual-Axis Chart Renderer
function renderDualAxisChart(selector, data, xKey, y1Key, y2Key, y1Label, y2Label, y1Color, y2Color, y1Type, y2Type, xLabelRotation = 0) {
  const container = d3.select(selector);
  container.html(''); // Clear previous chart

  const margin = { top: 20, right: 50, bottom: 60, left: 50 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // X scale
  const x = d3.scaleBand()
    .range([0, width])
    .domain(data.map(d => d[xKey]))
    .padding(0.2);

  // Y1 scale (Left Axis - Price/Count)
  const y1 = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[y1Key]) * 1.1])
    .range([height, 0]);

  // Y2 scale (Right Axis - SIS)
  const y2 = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[y2Key]) * 1.1])
    .range([height, 0]);

  // X Axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", `translate(0,0)rotate(${xLabelRotation})`)
    .style("text-anchor", xLabelRotation === 0 ? "middle" : "end")
    .style("font-size", "10px");

  // Y1 Axis (Left)
  svg.append("g")
    .call(d3.axisLeft(y1).ticks(5))
    .style("font-size", "10px")
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .attr("fill", y1Color)
    .style("font-weight", "bold")
    .text(y1Label);

  // Y2 Axis (Right)
  svg.append("g")
    .attr("transform", `translate(${width}, 0)`)
    .call(d3.axisRight(y2).ticks(5))
    .style("font-size", "10px")
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", margin.right - 10)
    .attr("dy", "-0.71em")
    .attr("text-anchor", "end")
    .attr("fill", y2Color)
    .style("font-weight", "bold")
    .text(y2Label);

  // Data Series 1 (Bars or Line)
  if (y1Type === 'bar') {
    svg.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d[xKey]))
      .attr("y", d => y1(d[y1Key]))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y1(d[y1Key]))
      .attr("fill", y1Color)
      .attr("opacity", 0.8);
  } else if (y1Type === 'line') {
    const line1 = d3.line()
      .x(d => x(d[xKey]) + x.bandwidth() / 2)
      .y(d => y1(d[y1Key]));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", y1Color)
      .attr("stroke-width", 2)
      .attr("d", line1);
  }

  // Data Series 2 (Dots or Dashed Line)
  if (y2Type === 'dot') {
    svg.selectAll(".dot")
      .data(data)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d[xKey]) + x.bandwidth() / 2)
      .attr("cy", d => y2(d[y2Key]))
      .attr("r", 4)
      .attr("fill", y2Color);
  } else if (y2Type === 'dashed-line') {
    const line2 = d3.line()
      .x(d => x(d[xKey]) + x.bandwidth() / 2)
      .y(d => y2(d[y2Key]));

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", y2Color)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .attr("d", line2);
  }

  // Legend
  const legendData = [
    { label: y1Label, color: y1Color, type: y1Type },
    { label: y2Label, color: y2Color, type: y2Type }
  ];

  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 100}, ${-10})`);

  legend.selectAll("g")
    .data(legendData)
    .enter().append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
    .each(function(d) {
      const g = d3.select(this);
      
      if (d.type === 'bar') {
        g.append("rect")
          .attr("width", 10)
          .attr("height", 10)
          .attr("fill", d.color);
      } else if (d.type === 'line') {
        g.append("line")
          .attr("x1", 0)
          .attr("y1", 5)
          .attr("x2", 10)
          .attr("y2", 5)
          .attr("stroke", d.color)
          .attr("stroke-width", 2);
      } else if (d.type === 'dot') {
        g.append("circle")
          .attr("cx", 5)
          .attr("cy", 5)
          .attr("r", 4)
          .attr("fill", d.color);
      } else if (d.type === 'dashed-line') {
        g.append("line")
          .attr("x1", 0)
          .attr("y1", 5)
          .attr("x2", 10)
          .attr("y2", 5)
          .attr("stroke", d.color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");
      }

      g.append("text")
        .attr("x", 15)
        .attr("y", 9)
        .attr("dy", "0.35em")
        .style("text-anchor", "start")
        .style("font-size", "10px")
        .text(d.label);
    });
}

function renderEDAMaterial() {
  const materialData = aggregateEDA(PROCESSED_ROWS, "Material_Type").slice(0, 10);
  renderDualAxisChart(
    "#eda-material",
    materialData,
    "key",
    "meanPrice",
    "meanSIS",
    "Avg. Price (USD)",
    "Avg. SIS",
    "#3b82f6", // Blue
    "#10b981", // Green
    "bar",
    "dot",
    -45 // Rotate x-axis labels for material names
  );
}

function renderEDACountry() {
  const countryData = aggregateEDA(PROCESSED_ROWS, "Country").slice(0, 10);
  renderDualAxisChart(
    "#eda-country",
    countryData,
    "key",
    "meanPrice",
    "meanSIS",
    "Avg. Price (USD)",
    "Avg. SIS",
    "#3b82f6", // Blue
    "#10b981", // Green
    "bar",
    "dot"
  );
}

function renderEDATrend() {
  const trendData = aggregateEDA(PROCESSED_ROWS, "Market_Trend");
  renderDualAxisChart(
    "#eda-trend",
    trendData,
    "key",
    "count",
    "meanSIS",
    "Count (Items)",
    "Avg. SIS",
    "#facc15", // Yellow
    "#10b981", // Green
    "bar",
    "dot"
  );
}

function renderEDAYear() {
  const yearData = aggregateEDA(PROCESSED_ROWS, "Year").sort((a, b) => a.key - b.key);
  renderDualAxisChart(
    "#eda-year",
    yearData,
    "key",
    "meanPrice",
    "meanSIS",
    "Avg. Price (USD)",
    "Avg. SIS",
    "#3b82f6", // Blue
    "#10b981", // Green
    "line",
    "dashed-line"
  );
}

/* ========== K-MEANS CLUSTERING (Section 6) ========== */

function renderElbowChart(kUsed) {
  const data = ELBOW_INFO.elbowData;
  const container = d3.select("#elbow-chart");
  container.html('');

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([1, d3.max(data, d => d.k)])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.inertia) * 1.1])
    .range([height, 0]);

  const line = d3.line()
    .x(d => x(d.k))
    .y(d => y(d.inertia));

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")))
    .append("text")
    .attr("y", 25)
    .attr("x", width / 2)
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Number of Clusters (k)");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Inertia (WCSS)");

  svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#3b82f6")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.selectAll(".dot")
    .data(data)
    .enter().append("circle")
    .attr("cx", d => x(d.k))
    .attr("cy", d => y(d.inertia))
    .attr("r", 4)
    .attr("fill", d => d.k === kUsed ? "#ef4444" : "#3b82f6");

  // Highlight elbow point
  svg.append("circle")
    .attr("cx", x(kUsed))
    .attr("cy", y(data.find(d => d.k === kUsed).inertia))
    .attr("r", 6)
    .attr("fill", "none")
    .attr("stroke", "#ef4444")
    .attr("stroke-width", 2);
}

function renderElbowInsight(kUsed) {
  const insightDiv = document.getElementById("elbow-insight");
  if (!insightDiv) return;
  insightDiv.innerHTML = `
    <p><strong>Elbow Method Validation:</strong> The optimal number of clusters is <strong>k=${kUsed}</strong>, determined by analyzing the rate of change in inertia (WCSS). This validates the clustering approach and ensures the chosen k is data-driven, not arbitrary.</p>
    <p><strong>Interpretation:</strong> The elbow point indicates the best trade-off between minimizing within-cluster variance and minimizing the number of clusters. For k=${kUsed}, the clustering effectively separates materials based on their sustainability profiles.</p>
  `;
}

function renderClusterScatter(kUsed) {
  const data = MATERIAL_AGG;
  const container = d3.select("#cluster-scatter");
  container.html('');

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(d3.range(kUsed));

  // X Axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1f")))
    .append("text")
    .attr("y", 35)
    .attr("x", width / 2)
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Environmental Score (Normalized)");

  // Y Axis
  svg.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Policy Score (Normalized)");

  // Tooltip
  const tooltip = createTooltip("cluster-tooltip");

  // Dots
  svg.selectAll(".dot")
    .data(data)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.meanEnvNorm))
    .attr("cy", d => y(d.meanPolicyNorm))
    .attr("r", 6)
    .attr("fill", d => color(d.cluster))
    .attr("opacity", 0.8)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 8).attr("opacity", 1.0);
      tooltip.style("visibility", "visible")
        .html(`
          <div class="tooltip-header">${d.Material_Type}</div>
          <div class="tooltip-body">
            <strong>Cluster:</strong> <span style="color: ${color(d.cluster)};">${d.cluster !== undefined ? d.cluster : 'N/A'}</span><br>
            <strong>Avg. SIS:</strong> ${d.meanSIS.toFixed(3)}<br>
            <strong>Env. Score:</strong> ${d.meanEnvNorm.toFixed(3)}<br>
            <strong>Policy Score:</strong> ${d.meanPolicyNorm.toFixed(3)}
          </div>
        `);
    })
    .on("mousemove", function(event) {
      tooltip.style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 6).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterLegend(kUsed) {
  const legendDiv = document.getElementById("cluster-legend");
  if (!legendDiv) return;

  const color = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(d3.range(kUsed));

  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    if (cluster === undefined) return acc; // Skip if cluster is undefined
    acc[cluster] = acc[cluster] || { count: 0, sumSIS: 0 };
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    return acc;
  }, {});

  const meanSISByCluster = Object.entries(clusterStats).map(([cluster, data]) => ({
      cluster: parseInt(cluster),
      meanSIS: data.sumSIS / data.count,
      count: data.count,
  })).sort((a, b) => b.meanSIS - a.meanSIS);

  const clusterNames = {};
  if (meanSISByCluster.length > 0) {
      clusterNames[meanSISByCluster[0].cluster] = "High-Impact (Most Sustainable)";
  }
  if (meanSISByCluster.length > 1) {
      clusterNames[meanSISByCluster[meanSISByCluster.length - 1].cluster] = "Low-Impact (Least Sustainable)";
  }
  if (meanSISByCluster.length > 2) {
      for (let i = 1; i < meanSISByCluster.length - 1; i++) {
          clusterNames[meanSISByCluster[i].cluster] = `Medium-Impact ${i}`;
      }
  }

  const legendHtml = meanSISByCluster.map(d => `
    <div class="cluster-pill">
      <div class="cluster-dot" style="background-color: ${color(d.cluster)};"></div>
      <strong>Cluster ${d.cluster}</strong>: ${clusterNames[d.cluster]} (Avg. SIS: ${d.meanSIS.toFixed(3)})
    </div>
  `).join("");

  legendDiv.innerHTML = legendHtml;
}

function renderClusterScatterInsight(kUsed) {
  const insightDiv = document.getElementById("cluster-scatter-insight");
  if (!insightDiv) return;
  
  if (MATERIAL_AGG.length === 0) {
      insightDiv.innerHTML = `<p>No data available for cluster analysis.</p>`;
      return;
  }
  
  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    if (cluster === undefined) return acc; // Skip if cluster is undefined
    acc[cluster] = acc[cluster] || { count: 0, sumSIS: 0, materials: [] };
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    acc[cluster].materials.push(m.Material_Type);
    return acc;
  }, {});

  const meanSISByCluster = Object.entries(clusterStats).map(([cluster, data]) => ({
      cluster: parseInt(cluster),
      meanSIS: data.sumSIS / data.count,
      count: data.count,
      materials: data.materials
  })).sort((a, b) => b.meanSIS - a.meanSIS);

  if (meanSISByCluster.length === 0) {
      insightDiv.innerHTML = `<p>Clustering could not be performed on the filtered data.</p>`;
      return;
  }

  const bestCluster = meanSISByCluster[0];
  const worstCluster = meanSISByCluster[meanSISByCluster.length - 1];
  
  const largestCluster = meanSISByCluster.sort((a, b) => b.count - a.count)[0];
  
  const bestClusterName = `Cluster ${bestCluster.cluster}`;
  const worstClusterName = `Cluster ${worstCluster.cluster}`;

  insightDiv.innerHTML = `
    <p><strong>Clustering Visualization:</strong> Materials are grouped into <strong>${kUsed} clusters</strong> (validated by Elbow Method). The plot visualizes the trade-off between Environmental Score (X) and Policy Score (Y).</p>
    <p><strong>Key Finding:</strong> 
        The <strong>${bestClusterName}</strong> has the highest average SIS (${bestCluster.meanSIS.toFixed(3)}), indicating the most sustainable materials.
        ${meanSISByCluster.length > 1 ? `The <strong>${worstClusterName}</strong> has the lowest average SIS (${worstCluster.meanSIS.toFixed(3)}).` : ''}
        The largest cluster is <strong>Cluster ${largestCluster.cluster}</strong> with ${largestCluster.count} materials.
    </p>
    <p><strong>Interpretation Note:</strong> Cluster separation is primarily driven by <strong>policy scores</strong> (Sustainability Rating, Recycling Programs) rather than environmental scores (Carbon, Water, Waste), because environmental variance is low in this dataset (see Data Quality Validation). Cluster ${bestCluster.cluster} has higher policy compliance, while Cluster ${worstCluster.cluster} has lower policy compliance.</p>
    <p><strong>Recommendation:</strong> Focus on materials in the <strong>${bestClusterName}</strong> for the most sustainable sourcing options.</p>
  `;
}

function renderClusterInterpretationTable(kUsed) {
  const tableDiv = document.getElementById("cluster-interpretation-table");
  if (!tableDiv || !MATERIAL_AGG) return;

  const clusterStats = MATERIAL_AGG.reduce((acc, m) => {
    const cluster = m.cluster;
    if (cluster === undefined) return acc; // Skip if cluster is undefined
    if (!acc[cluster]) {
      acc[cluster] = {
        count: 0,
        sumSIS: 0,
        sumEnv: 0,
        sumPolicy: 0,
        sumRating: 0,
        sumRecycling: 0,
        sumPrice: 0, // ADDED: Sum Price
        materials: []
      };
    }
    acc[cluster].count += 1;
    acc[cluster].sumSIS += m.meanSIS;
    acc[cluster].sumEnv += m.meanEnv;
    acc[cluster].sumPolicy += m.meanPolicy;
    acc[cluster].sumRating += m.meanRating;
    acc[cluster].sumRecycling += m.meanRecycling;
    acc[cluster].sumPrice += m.meanPrice; // ADDED: Sum Price
    acc[cluster].materials.push(m.Material_Type);
    return acc;
  }, {});

  const tableData = Object.entries(clusterStats).map(([cluster, data]) => ({
    cluster: parseInt(cluster),
    count: data.count,
    avgSIS: data.sumSIS / data.count,
    avgEnv: data.sumEnv / data.count,
    avgPolicy: data.sumPolicy / data.count,
    avgRating: data.sumRating / data.count,
    avgRecycling: data.sumRecycling / data.count,
    avgPrice: data.sumPrice / data.count, // ADDED: Avg Price
    materials: data.materials.join(", ")
  })).sort((a, b) => a.cluster - b.cluster);

  const tableHtml = `
    <div class="cluster-table">
      <table>
        <thead>
          <tr>
            <th>Cluster</th>
            <th>Count</th>
            <th>Avg. SIS</th>
            <th>Avg. Env. Score</th>
            <th>Avg. Policy Score</th>
            <th>Avg. Rating Score</th>
            <th>Avg. Recycling Compliance</th>
            <th>Avg. Price (USD)</th>
            <th>Materials</th>
          </tr>
        </thead>
        <tbody>
          ${tableData.map(d => `
            <tr>
              <td class="cluster-name">Cluster ${d.cluster}</td>
              <td>${d.count}</td>
              <td>${d.avgSIS.toFixed(3)}</td>
              <td>${d.avgEnv.toFixed(3)}</td>
              <td>${d.avgPolicy.toFixed(3)}</td>
              <td>${d.avgRating.toFixed(3)}</td>
              <td>${d.avgRecycling.toFixed(3)}</td>
              <td>$${d.avgPrice.toFixed(2)}</td>
              <td>${d.materials}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="validation-insight" style="margin-top: 10px;">
      <strong>Cluster Interpretation:</strong>
      <ul>
        <li><strong>Cluster Separation:</strong> The primary driver for cluster separation is the <strong>Policy Score</strong> (Sustainability Rating and Recycling Compliance), which aligns with the Entropy Weighting results.</li>
        <li><strong>High-Impact Clusters:</strong> Clusters with higher average SIS generally show higher average Policy Scores.</li>
        <li><strong>Low-Impact Clusters:</strong> Clusters with lower average SIS generally show lower average Policy Scores.</li>
      </ul>
      <p style="font-style: italic; font-weight: 600;">Interpretation Note: "Cluster separation is primarily driven by policy scores"</p>
    </div>
  `;

  tableDiv.innerHTML = tableHtml;
}

function clusterAndRenderMaterials() {
  if (!MATERIAL_AGG || !ELBOW_INFO) return;
  const bestK = ELBOW_INFO.bestK;

  renderClusteringValidation(bestK);
}

/* ========== PARETO FRONTIER (Section 7) ========== */

function renderParetoFrontier() {
  renderParetoMaterial();
  renderParetoBrand();
  renderParetoInsight();
}

function renderParetoChart(selector, data, xKey, yKey, title) {
  const container = d3.select(selector);
  container.html('');

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const width = container.node().clientWidth - margin.left - margin.right;
  const height = container.node().clientHeight - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[xKey]) * 1.1])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d[yKey]) * 1.1])
    .range([height, 0]);

  // X Axis (Price)
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("$.0f")))
    .append("text")
    .attr("y", 35)
    .attr("x", width / 2)
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Average Price (USD) - Minimize");

  // Y Axis (SIS)
  svg.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2f")))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 10)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .attr("fill", "#000")
    .style("font-size", "11px")
    .text("Sustainability Index Score (SIS) - Maximize");

  // Tooltip
  const tooltip = createTooltip("pareto-tooltip");

  // Pareto Frontier Line (Convex Hull approximation is complex, just highlight points)
  const paretoPoints = data.filter(d => d.isPareto);

  // Non-Pareto Points
  svg.selectAll(".non-pareto-dot")
    .data(data.filter(d => !d.isPareto))
    .enter().append("circle")
    .attr("class", "non-pareto-dot")
    .attr("cx", d => x(d[xKey]))
    .attr("cy", d => y(d[yKey]))
    .attr("r", 4)
    .attr("fill", "#9ca3af")
    .attr("opacity", 0.5);

  // Pareto Points
  svg.selectAll(".pareto-dot")
    .data(paretoPoints)
    .enter().append("circle")
    .attr("class", "pareto-dot")
    .attr("cx", d => x(d[xKey]))
    .attr("cy", d => y(d[yKey]))
    .attr("r", 6)
    .attr("fill", "#f97316") // Orange
    .attr("stroke", "#ea580c")
    .attr("stroke-width", 1.5)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("r", 8);
      tooltip.style("visibility", "visible")
        .html(`
          <div class="tooltip-header">${d.key}</div>
          <div class="tooltip-body">
            <strong>SIS:</strong> ${d.SIS.toFixed(3)}<br>
            <strong>Price:</strong> $${d.Average_Price_USD.toFixed(2)}
          </div>
          <div class="tooltip-footer tooltip-pareto">Pareto-Optimal</div>
        `);
    })
    .on("mousemove", function(event) {
      tooltip.style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("r", 6);
      tooltip.style("visibility", "hidden");
    });
}

function renderParetoMaterial() {
  const materialData = MATERIAL_AGG.map(m => ({
    key: m.Material_Type,
    SIS: m.meanSIS,
    Average_Price_USD: m.meanPrice,
  }));
  const paretoFlags = window.computeParetoFlags(materialData);
  materialData.forEach((d, i) => d.isPareto = paretoFlags[i]);

  renderParetoChart("#pareto-material", materialData, "Average_Price_USD", "SIS", "Material Pareto Frontier");
}

function renderParetoBrand() {
  const brandMap = PROCESSED_ROWS.reduce((acc, r) => {
    const brand = r.Brand;
    if (!brand) return acc;
    if (!acc[brand]) {
      acc[brand] = { count: 0, sumSIS: 0, sumPrice: 0 };
    }
    acc[brand].count++;
    acc[brand].sumSIS += r.SIS;
    acc[brand].sumPrice += r.Average_Price_USD;
    return acc;
  }, {});

  const brandData = Object.entries(brandMap).map(([brand, v]) => ({
    key: brand,
    SIS: v.sumSIS / v.count,
    Average_Price_USD: v.sumPrice / v.count,
  }));

  const paretoFlags = window.computeParetoFlags(brandData);
  brandData.forEach((d, i) => d.isPareto = paretoFlags[i]);

  renderParetoChart("#pareto-brand", brandData, "Average_Price_USD", "SIS", "Brand Pareto Frontier");
}

function renderParetoInsight() {
  const insightDiv = document.getElementById("pareto-insight");
  if (!insightDiv) return;

  const brandMap = PROCESSED_ROWS.reduce((acc, r) => {
    const brand = r.Brand;
    if (!brand) return acc;
    if (!acc[brand]) {
      acc[brand] = { count: 0, sumSIS: 0, sumPrice: 0 };
    }
    acc[brand].count++;
    acc[brand].sumSIS += r.SIS;
    acc[brand].sumPrice += r.Average_Price_USD;
    return acc;
  }, {});

  const brandData = Object.entries(brandMap).map(([brand, v]) => ({
    key: brand,
    SIS: v.sumSIS / v.count,
    Average_Price_USD: v.sumPrice / v.count,
  }));

  const paretoFlags = window.computeParetoFlags(brandData);
  const paretoCount = paretoFlags.filter(Boolean).length;

  insightDiv.innerHTML = `
    <p><strong>Multi-Objective Optimization (MOO):</strong> The Pareto Frontier identifies the set of non-dominated solutions, representing the optimal trade-off between maximizing Sustainability Index Score (SIS) and minimizing Average Price (USD).</p>
    <p><strong>Key Finding:</strong> Out of ${brandData.length} brands, <strong>${paretoCount}</strong> are Pareto-optimal. These brands offer the best possible SIS for a given price point, or the lowest possible price for a given SIS level.</p>
    <p><strong>Recommendation:</strong> Brands and materials on the Pareto Frontier should be prioritized for sourcing and purchasing decisions, as they represent the most efficient use of resources (cost vs. sustainability).</p>
  `;
}

/* ========== RECOMMENDATIONS (Section 8) ========== */

function renderRecommendations() {
  const recommendations = window.buildRecommendations(PROCESSED_ROWS, 5);
  
  const renderList = (selector, list) => {
    const listDiv = document.querySelector(selector + " .reco-list");
    if (!listDiv) return;

    const listHtml = list.map(item => {
      const sisBand = item.SIS > 0.75 ? 'reco-high' : item.SIS > 0.5 ? 'reco-mid' : 'reco-low';
      const pills = [
        `<span class="reco-pill reco-pill-pareto">Pareto-Optimal</span>`,
        `<span class="reco-pill">Material: ${item.Material_Type}</span>`,
        `<span class="reco-pill">Country: ${item.Country}</span>`,
        `<span class="reco-pill">Cluster: ${item.cluster !== undefined ? item.cluster : 'N/A'}</span>`,
      ].join("");

      return `
        <div class="reco-item ${sisBand}">
          <div class="reco-header">
            <div class="reco-brand">${item.Brand}</div>
            <div class="reco-score">SIS: ${item.SIS.toFixed(3)}</div>
          </div>
          <div class="reco-metrics">
            <span>Price: <strong>$${item.Average_Price_USD.toFixed(2)}</strong></span>
            <span>Rating: <strong>${item.Sustainability_Rating}</strong></span>
          </div>
          <div class="reco-pill-row">${pills}</div>
        </div>
      `;
    }).join("");

    listDiv.innerHTML = listHtml || `<p style="font-style: italic; color: #6b7280;">No Pareto-optimal recommendations found for this category.</p>`;
  };

  renderList("#reco-max-sustainability", recommendations.maxSustainability);
  renderList("#reco-best-value", recommendations.bestValue);
  renderList("#reco-balanced", recommendations.balanced);

  // Note for Recommendations
  const recoContent = document.querySelector(".recommendations-content");
  if (recoContent) {
    const existingNote = recoContent.querySelector(".reco-note");
    if (existingNote) existingNote.remove();

    const note = document.createElement("p");
    note.className = "reco-note";
    note.style.fontSize = "12px";
    note.style.color = "#ef4444";
    note.style.marginTop = "10px";
    note.style.fontWeight = "600";
    note.innerHTML = 'Note: "Pareto-optimal solutions are not ranked"';
    recoContent.appendChild(note);
  }
}

// Tab switching logic
document.querySelectorAll(".tab-btn").forEach(button => {
  button.addEventListener("click", function() {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    this.classList.add("active");

    const tab = this.getAttribute("data-tab");
    document.querySelectorAll(".reco-tab-content").forEach(content => {
      content.classList.remove("active");
    });
    document.getElementById(`reco-${tab}`).classList.add("active");
  });
});

/* ========== PREDICTION (Section 9) ========== */

trainModelBtn.addEventListener("click", async () => {
  predictionStatus.textContent = "Training MLP model (50 epochs)... This may take a moment.";
  trainModelBtn.disabled = true;
  
  const model = await window.trainMLPPredictor(RAW_ROWS);
  
  if (model) {
    predictionStatus.textContent = "MLP Model Trained Successfully. Ready for prediction.";
    predictionStatus.style.backgroundColor = "#dcfce7";
    predictionStatus.style.borderColor = "#10b981";
    predictionForm.style.display = "block";
    predictBtn.disabled = false; // Enable predict button after training
  } else {
    predictionStatus.textContent = "Model training failed. Check console for details.";
    predictionStatus.style.backgroundColor = "#fee2e2";
    predictionStatus.style.borderColor = "#ef4444";
    predictBtn.disabled = true;
  }
  trainModelBtn.disabled = false;
});

predictBtn.addEventListener("click", () => {
  const carbon = parseFloat(document.getElementById("pred-carbon").value);
  const water = parseFloat(document.getElementById("pred-water").value);
  const waste = parseFloat(document.getElementById("pred-waste").value);
  const recyclingSelect = document.getElementById("pred-recycling");
  const recycling = recyclingSelect.value === "yes" ? 1.0 : recyclingSelect.value === "no" ? 0.0 : 0.5;

  if (isNaN(carbon) || isNaN(water) || isNaN(waste)) {
    predictionResultDiv.innerHTML = "Please enter valid numerical values for all environmental metrics.";
    predictionResultDiv.style.backgroundColor = "#fee2e2";
    predictionResultDiv.style.borderColor = "#ef4444";
    return;
  }

  // Check if model is trained
  if (!window.predictSustainabilityRating(1, 1, 1, 1)) { // Dummy call to check if model is loaded
      predictionResultDiv.innerHTML = "Model not trained. Please click 'Train Prediction Model' first.";
      predictionResultDiv.style.backgroundColor = "#fee2e2";
      predictionResultDiv.style.borderColor = "#ef4444";
      return;
  }

  const prediction = window.predictSustainabilityRating(carbon, water, waste, recycling);

  if (prediction) {
    predictionResultDiv.innerHTML = `Predicted Sustainability Rating: <strong>${prediction}</strong>`;
    predictionResultDiv.style.backgroundColor = "#dcfce7";
    predictionResultDiv.style.borderColor = "#10b981";
  } else {
    predictionResultDiv.innerHTML = "Prediction failed. Model may not be trained.";
    predictionResultDiv.style.backgroundColor = "#fee2e2";
    predictionResultDiv.style.borderColor = "#ef4444";
  }
});

// Initial state for predict button
predictBtn.disabled = true;

// Initial run on load (optional, depends on if sample data is auto-loaded)
// runPipeline(); // Commented out to wait for user action
