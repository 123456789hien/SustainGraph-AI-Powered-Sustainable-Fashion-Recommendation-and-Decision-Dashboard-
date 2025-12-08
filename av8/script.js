/*
   script.js - Final Version
   UI rendering and visualization for SustainGraph
   Implements scientific methodology display with enhanced UI/UX
*/

/* ========== GLOBAL STATE ========== */

let RAW_ROWS = [];
let PROCESSED_ROWS = [];
let STATS = null;
let MATERIAL_AGG = [];
let ELBOW_INFO = null;
let ENTROPY_WEIGHTS = null;

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
// const prioritySelect = document.getElementById("priority"); // Removed as per user request
const btnRun = document.getElementById("run-pipeline");

const kpiRow = document.getElementById("kpi-row");
const clusterLegend = document.getElementById("cluster-legend");
const recoList = document.getElementById("recommendations-list");

const paretoInsightDiv = document.getElementById("pareto-insight");

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
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/av8/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file);
    });
});

autoUploadBtn.addEventListener("click", () => {
  loadStatus.textContent = "Loading sample data...";
  fetch("https://raw.githubusercontent.com/123456789hien/SustainGraph-AI-Powered-Sustainable-Fashion-Recommendation-and-Decision-Dashboard-/refs/heads/main/av8/Kaggle_sust_dataset.csv")
    .then((res) => res.text())
    .then((csv) => {
      const file = new File([csv], "sample.csv", { type: "text/csv" });
      parseCsv(file, true);
    });
});

function parseCsv(file, autoRun = false) {
  loadStatus.textContent = `Loading ${file.name}...`;
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      RAW_ROWS = results.data;
      loadStatus.textContent = `Loaded ${RAW_ROWS.length} rows from ${file.name}. Ready to run analysis.`;
      populateFilters(RAW_ROWS);
      if (autoRun) {
        btnRun.click();
      }
    },
    error: (err) => {
      loadStatus.textContent = `Error: ${err.message}`;
    },
  });
}

/* ========== FILTER POPULATION ========== */

function populateFilters(rows) {
  const countries = [...new Set(rows.map((r) => r.Country))].filter(Boolean);
  const materials = [...new Set(rows.map((r) => r.Material_Type))].filter(Boolean);
  const years = [...new Set(rows.map((r) => r.Year))].filter(Boolean);
  const certs = [...new Set(rows.map((r) => r.Certifications))].filter(Boolean);
  const trends = [...new Set(rows.map((r) => r.Trend))].filter(Boolean);

  const populate = (select, items) => {
    select.innerHTML = '<option value="">All</option>';
    items.sort().forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  };

  populate(countryFilter, countries);
  populate(materialFilter, materials);
  populate(yearFilter, years);
  populate(certFilter, certs);
  populate(trendFilter, trends);
}

/* ========== MAIN ANALYSIS PIPELINE ========== */

btnRun.addEventListener("click", () => {
  const filtered = applyFilters();
  if (!filtered.length) {
    alert("No data matches the current filters.");
    return;
  }

  // 1) Process data with Entropy, SIS, etc.
  const { rowsWithSIS, stats, materialAgg, elbowInfo, entropyWeights } = processData(filtered);
  PROCESSED_ROWS = rowsWithSIS;
  STATS = stats;
  MATERIAL_AGG = materialAgg;
  ELBOW_INFO = elbowInfo;
  ENTROPY_WEIGHTS = entropyWeights;

  // 2) Render all UI components
  renderKPIs();
  clusterAndRenderMaterials(); // This now handles K-Means and the new Section 5
  buildAndRenderRecommendations();
  renderEdaCharts();
});

function applyFilters() {
  return RAW_ROWS.filter((r) => {
    return (
      (!countryFilter.value || r.Country === countryFilter.value) &&
      (!materialFilter.value || r.Material_Type === materialFilter.value) &&
      (!yearFilter.value || r.Year == yearFilter.value) &&
      (!certFilter.value || r.Certifications === certFilter.value) &&
      (!trendFilter.value || r.Trend === trendFilter.value)
    );
  });
}

/* ========== KPI & ENTROPY RENDER (Section 3) ========== */

function renderKPIs() {
  if (!STATS) return;
  kpiRow.innerHTML = `
    <div class="kpi-item">
      <div class="kpi-value">${STATS.brandCount}</div>
      <div class="kpi-label">Brands Analyzed</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">$${STATS.avgPrice.toFixed(2)}</div>
      <div class="kpi-label">Average Price</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-value">${STATS.avgSIS.toFixed(3)}</div>
      <div class="kpi-label">Average SIS</div>
    </div>
    <div class="kpi-item info-card">
        <div class="kpi-label">📊 Entropy Weight Method Results</div>
        <div class="info-card-body">
            <div><strong>Environmental Weight:</strong> <span>${ENTROPY_WEIGHTS.env.toFixed(4)}</span></div>
            <div><strong>Policy Weight:</strong> <span>${ENTROPY_WEIGHTS.policy.toFixed(4)}</span></div>
        </div>
        <div class="info-card-footer">Objective weights derived from data variance.</div>
    </div>
  `;
}

/* ========== K-MEANS CLUSTERING (Section 5) ========== */

function clusterAndRenderMaterials() {
  if (!MATERIAL_AGG || !ELBOW_INFO) return;
  const bestK = ELBOW_INFO.bestK;

  // 1) Assign cluster to each material in the aggregate
  const clusters = kMeans(MATERIAL_AGG.map(m => m.features), bestK);
  MATERIAL_AGG.forEach((m, i) => {
    m.cluster = clusters.assignments[i];
  });

  // 2) Render the combined validation section
  renderClusteringValidation(bestK);
}

function renderClusteringValidation(kUsed) {
  renderElbowChart(kUsed);
  renderElbowInsight(kUsed);
  renderClusterScatter(kUsed);
  renderClusterLegend(kUsed);
  renderClusterScatterInsight(kUsed);
}

function renderElbowInsight(kUsed) {
  const insightDiv = document.getElementById("elbow-insight");
  if (!insightDiv) return;
  insightDiv.innerHTML = `
    <p><strong>Elbow Method Validation:</strong> The optimal number of clusters is <strong>k=${kUsed}</strong>, determined by analyzing the rate of change in inertia (WCSS). This validates the clustering approach and ensures the chosen k is data-driven, not arbitrary.</p>
    <p><strong>Interpretation:</strong> The elbow point indicates the best trade-off between minimizing within-cluster variance and minimizing the number of clusters.</p>
  `;
}

function renderClusterScatterInsight(kUsed) {
  const insightDiv = document.getElementById("cluster-scatter-insight");
  if (!insightDiv) return;
  const clusterCounts = MATERIAL_AGG.reduce((acc, m) => {
    acc[m.cluster] = (acc[m.cluster] || 0) + 1;
    return acc;
  }, {});

  const largestCluster = Object.entries(clusterCounts).sort(
    ([, a], [, b]) => b - a
  )[0];

  insightDiv.innerHTML = `
    <p><strong>Clustering Visualization:</strong> Materials are grouped into <strong>${kUsed} clusters</strong> (validated by Elbow Method). The plot visualizes the trade-off between Environmental Score (X) and Policy Score (Y).</p>
    <p><strong>Insight:</strong> Cluster ${largestCluster[0]} is the largest with ${largestCluster[1]} materials. Materials in the **Low-Impact Cluster** (typically top-left) offer the best balance of high environmental and policy scores.</p>
    <p><strong>Recommendation:</strong> Focus on materials in the Low-Impact Cluster for the most sustainable sourcing options.</p>
  `;
}

function renderElbowChart(kUsed) {
  const container = document.getElementById("elbow-chart");
  if (!container || !ELBOW_INFO) return;
  container.innerHTML = "";

  const data = ELBOW_INFO.elbowData;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([1, data.length]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.inertia) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(data.length));
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5));

  // Labels
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Number of Clusters (k)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Inertia (WCSS)");

  // Line
  const line = d3.line().x(d => xScale(d.k)).y(d => yScale(d.inertia));
  svg.append("path").datum(data).attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-width", 2).attr("d", line);

  // Points
  const tooltip = createTooltip("elbow-tooltip");
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.k))
    .attr("cy", d => yScale(d.inertia))
    .attr("r", d => (d.k === kUsed ? 8 : 5))
    .attr("fill", d => (d.k === kUsed ? "var(--cluster-high)" : "var(--accent)"))
    .attr("stroke", d => (d.k === kUsed ? "#fff" : "none"))
    .attr("stroke-width", d => (d.k === kUsed ? 2 : 0))
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", d => (d.k === kUsed ? 10 : 7));
      tooltip.html(`<strong>k = ${d.k}</strong><br>Inertia: ${d.inertia.toFixed(2)}`).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function (event, d) {
      d3.select(this).attr("r", d => (d.k === kUsed ? 8 : 5));
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterScatter(kUsed) {
  const container = document.getElementById("cluster-scatter");
  if (!container || !MATERIAL_AGG) return;
  container.innerHTML = "";

  const data = MATERIAL_AGG;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, 1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale));
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale));

  // Labels
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Environmental Score (Normalized)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Policy Score (Normalized)");

  // Color Scale
  const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain([...Array(kUsed).keys()]);

  // Tooltip
  const tooltip = createTooltip("scatter-tooltip");

  // Points
  svg.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => xScale(d.envScoreNorm))
    .attr("cy", d => yScale(d.policyScoreNorm))
    .attr("r", d => 8 + Math.min(8, d.count / 5)) // Increased base size
    .attr("fill", d => colorScale(d.cluster))
    .attr("stroke", "#fff") // Added white stroke for better visibility
    .attr("stroke-width", 2)
    .attr("opacity", 0.9)
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 12 + Math.min(8, d.count / 5));
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body">
          <div><strong>Cluster:</strong> ${d.cluster}</div>
          <div><strong>Env Score:</strong> ${d.envScoreNorm.toFixed(3)}</div>
          <div><strong>Policy Score:</strong> ${d.policyScoreNorm.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function (event, d) {
      d3.select(this).attr("opacity", 0.9).attr("r", 8 + Math.min(8, d.count / 5));
      tooltip.style("visibility", "hidden");
    });
}

function renderClusterLegend(kUsed) {
  clusterLegend.innerHTML = "";
  const colorScale = d3.scaleOrdinal(d3.schemeSet2).domain([...Array(kUsed).keys()]);
  for (let i = 0; i < kUsed; i++) {
    const div = document.createElement("div");
    div.className = "legend-item";
    div.innerHTML = `<span class="legend-color" style="background-color:${colorScale(i)};"></span> Cluster ${i}`;
    clusterLegend.appendChild(div);
  }
}

/* ========== PARETO FRONTIER (Section 6) ========== */

function renderParetoCharts() {
  const materialPareto = renderParetoMaterial();
  const brandPareto = renderParetoBrand();
  renderParetoInsight(materialPareto, brandPareto);
}

function renderParetoInsight(materialPareto, brandPareto) {
  if (!paretoInsightDiv) return;
  paretoInsightDiv.innerHTML = `
    <p><strong>Multi-Objective Optimization:</strong> The Pareto Frontier visualizes the optimal trade-off between <strong>Sustainability (SIS)</strong> and <strong>Price</strong>. Items on the frontier are "Pareto-optimal," meaning you cannot improve one metric without worsening the other.</p>
    <p><strong>Insight:</strong> We found <strong>${materialPareto.length} optimal materials</strong> and <strong>${brandPareto.length} optimal brands</strong>. These represent the most efficient choices in the dataset.</p>
    <p><strong>Recommendation:</strong> Always prefer items on the Pareto Frontier. They offer the best possible SIS for a given price (or the lowest price for a given SIS).</p>
  `;
}

function renderParetoMaterial() {
  const container = document.getElementById("pareto-material");
  if (!container || !MATERIAL_AGG) return [];

  const data = MATERIAL_AGG.map(m => ({ name: m.Material_Type, price: m.meanPrice, sis: m.meanSIS, count: m.count })).filter(d => d.price > 0 && d.sis > 0);
  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>Not enough data for Pareto analysis</p>";
    return [];
  }

  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;
  sorted.forEach(point => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Materials — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(paretoPoints).attr("fill", "none").attr("stroke", "var(--cluster-high)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-material-tooltip");

  // All points
  svg.selectAll("circle.all-point").data(data).enter().append("circle").attr("class", "all-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 6).attr("fill", "#d1d5db").attr("opacity", 0.6).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 8);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">Not on frontier</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.6).attr("r", 6);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 7).attr("fill", "var(--cluster-high)").attr("stroke", "#fff").attr("stroke-width", 2.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Brands:</strong> ${d.count}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  return paretoPoints;
}

function renderParetoBrand() {
  const container = document.getElementById("pareto-brand");
  if (!container || !PROCESSED_ROWS) return [];

  const data = PROCESSED_ROWS.map(r => ({ name: r.Brand_Name || r.Brand_ID, price: r.Average_Price_USD, sis: r.SIS, material: r.Material_Type })).filter(d => d.price > 0 && d.sis > 0);
  if (data.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>Not enough data for Pareto analysis</p>";
    return [];
  }

  const sorted = [...data].sort((a, b) => a.price - b.price);
  const paretoPoints = [];
  let maxSIS = -Infinity;
  sorted.forEach(point => {
    if (point.sis >= maxSIS) {
      maxSIS = point.sis;
      paretoPoints.push(point);
    }
  });

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleLinear().domain([0, d3.max(data, d => d.price) * 1.1]).range([padding.left, width - padding.right]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.sis) * 1.1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Brands — Pareto Frontier (Price vs SIS)");
  svg.append("text").attr("x", width / 2).attr("y", height - 5).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Average Price (USD)");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--text-muted)").attr("font-size", "11px").text("Sustainability Index (SIS)");

  // Pareto frontier line
  if (paretoPoints.length > 1) {
    const line = d3.line().x(d => xScale(d.price)).y(d => yScale(d.sis)).curve(d3.curveStepAfter);
    svg.append("path").datum(paretoPoints).attr("fill", "none").attr("stroke", "var(--cluster-low)").attr("stroke-width", 2).attr("stroke-dasharray", "5,3").attr("d", line);
  }

  const tooltip = createTooltip("pareto-brand-tooltip");

  // All points (sample to avoid overcrowding)
  const sampleData = data.length > 100 ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0) : data;
  svg.selectAll("circle.all-point").data(sampleData).enter().append("circle").attr("class", "all-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 4).attr("fill", "#d1d5db").attr("opacity", 0.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("r", 6);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer" style="color:var(--text-muted);">Not on frontier</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.5).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });

  // Pareto points (highlighted)
  svg.selectAll("circle.pareto-point").data(paretoPoints).enter().append("circle").attr("class", "pareto-point")
    .attr("cx", d => xScale(d.price)).attr("cy", d => yScale(d.sis)).attr("r", 7).attr("fill", "var(--cluster-low)").attr("stroke", "#fff").attr("stroke-width", 2.5).attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 9);
      tooltip.html(`
        <div class="tooltip-header">${d.name}</div>
        <div class="tooltip-body">
          <div><strong>Price:</strong> $${d.price.toFixed(2)}</div>
          <div><strong>SIS:</strong> ${d.sis.toFixed(3)}</div>
          <div><strong>Material:</strong> ${d.material || "N/A"}</div>
        </div>
        <div class="tooltip-footer tooltip-pareto">✓ Pareto-optimal</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 7);
      tooltip.style("visibility", "hidden");
    });

  return paretoPoints;
}

/* ========== RECOMMENDATIONS RENDER (Section 7) ========== */

function buildAndRenderRecommendations() {
  // Recommendations are now purely Pareto-based, no user priority weight
  const recs = buildRecommendations(PROCESSED_ROWS, 8);
  renderRecommendations(recs);
  renderParetoCharts();
}

function renderRecommendations(items) {
  recoList.innerHTML = "";
  if (!items.length) {
    recoList.textContent = "No recommendations for current filters.";
    return;
  }

  items.forEach((item, idx) => {
    const band = item.SIS >= 0.75 ? "reco-high" : item.SIS >= 0.55 ? "reco-mid" : "reco-low";
    const paretoTag = item.isPareto ? '<span class="reco-pill reco-pill-pareto">✓ Pareto-optimal</span>' : '<span class="reco-pill reco-pill-dominated">Dominated</span>';

    const div = document.createElement("div");
    div.className = `reco-item ${band}`;
    div.innerHTML = `
      <div class="reco-rank-badge">🔥 Top ${idx + 1}</div>
      <div class="reco-header">
        <div>
          <div class="reco-brand">${item.Brand_Name || item.Brand_ID}</div>
          <div class="reco-tagline">${item.Material_Type || "Unknown material"} • ${item.Country || "Unknown country"}</div>
        </div>
        <div class="reco-score">SIS: ${item.SIS.toFixed(3)}</div>
      </div>
      <div class="reco-metrics">
        <span>💰 $${item.Average_Price_USD.toFixed(2)}</span>
        <span>🌱 CO₂: ${item.Carbon_Footprint_MT.toFixed(1)} MT</span>
        <span>💧 Water: ${item.Water_Usage_Liters.toFixed(0)} L</span>
        <span>🗑️ Waste: ${item.Waste_Production_KG.toFixed(1)} kg</span>
      </div>
      <div class="reco-pill-row">
        ${paretoTag}
        <span class="reco-pill">Cert: ${item.Certifications || "N/A"}</span>
        <span class="reco-pill">Recycling: ${item.Recycling_Programs || "N/A"}</span>
      </div>
    `;
    recoList.appendChild(div);
  });
}

/* ========== EDA CHARTS (Section 4) - IMPROVED TOOLTIPS & COLORS ========== */

function renderEdaCharts() {
  renderEdaMaterial();
  renderEdaCountry();
  renderEdaTrend();
  renderEdaYear();
}

function computeCountryAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const c = r.Country || "Unknown";
    if (!map.has(c)) map.set(c, { Country: c, sumPrice: 0, sumSIS: 0, count: 0 });
    const m = map.get(c);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanPrice: m.sumPrice / m.count, meanSIS: m.sumSIS / m.count }));
}

function computeTrendAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const t = r.Trend || "Unknown";
    if (!map.has(t)) map.set(t, { Trend: t, sumSIS: 0, count: 0 });
    const m = map.get(t);
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanSIS: m.sumSIS / m.count }));
}

function computeYearAgg(rows) {
  const map = new Map();
  rows.forEach(r => {
    const y = r.Year || "Unknown";
    if (!map.has(y)) map.set(y, { Year: y, sumPrice: 0, sumSIS: 0, count: 0 });
    const m = map.get(y);
    m.sumPrice += r.Average_Price_USD || 0;
    m.sumSIS += r.SIS || 0;
    m.count += 1;
  });
  return Array.from(map.values()).map(m => ({ ...m, meanPrice: m.sumPrice / m.count, meanSIS: m.sumSIS / m.count }));
}

function renderEdaMaterial() {
  const container = document.getElementById("eda-material");
  if (!container || !MATERIAL_AGG) return;

  const agg = MATERIAL_AGG.sort((a, b) => b.count - a.count).slice(0, 10);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand().domain(agg.map(d => d.Material_Type)).range([padding.left, width - padding.right]).padding(0.2);
  const yScale = d3.scaleLinear().domain([0, 100]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").attr("transform", "rotate(-40)").attr("text-anchor", "end").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}`)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Avg Price & SIS by Material Type");

  const tooltip = createTooltip("eda-material-tooltip");

  // Price bars
  svg.selectAll("rect.price-bar").data(agg).enter().append("rect").attr("class", "price-bar")
    .attr("x", d => xScale(d.Material_Type)).attr("y", d => yScale(d.meanPrice)).attr("width", xScale.bandwidth() / 2).attr("height", d => height - padding.bottom - yScale(d.meanPrice))
    .attr("fill", "#a5b4fc") // Light purple/blue for Price
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body"><div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div><div><strong>Brands:</strong> ${d.count}</div></div>
        <div class="tooltip-footer" style="color:#a5b4fc;">Price (Purple Bar)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });

  // SIS bars
  svg.selectAll("rect.sis-bar").data(agg).enter().append("rect").attr("class", "sis-bar")
    .attr("x", d => xScale(d.Material_Type) + xScale.bandwidth() / 2).attr("y", d => yScale(d.meanSIS * 100)).attr("width", xScale.bandwidth() / 2).attr("height", d => height - padding.bottom - yScale(d.meanSIS * 100))
    .attr("fill", "#4ade80") // Light Green for SIS
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Material_Type}</div>
        <div class="tooltip-body"><div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div><div><strong>Brands:</strong> ${d.count}</div></div>
        <div class="tooltip-footer" style="color:#4ade80;">SIS (Green Bar)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });
}

function renderEdaCountry() {
  const container = document.getElementById("eda-country");
  if (!container || !PROCESSED_ROWS) return;

  const agg = computeCountryAgg(PROCESSED_ROWS).sort((a, b) => b.count - a.count).slice(0, 10);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand().domain(agg.map(d => d.Country)).range([padding.left, width - padding.right]).padding(0.2);
  const yScale = d3.scaleLinear().domain([0, 100]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").attr("transform", "rotate(-40)").attr("text-anchor", "end").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}`)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Avg Price & SIS by Country");

  const tooltip = createTooltip("eda-country-tooltip");

  // Price bars
  svg.selectAll("rect.price-bar").data(agg).enter().append("rect").attr("class", "price-bar")
    .attr("x", d => xScale(d.Country)).attr("y", d => yScale(d.meanPrice)).attr("width", xScale.bandwidth() / 2).attr("height", d => height - padding.bottom - yScale(d.meanPrice))
    .attr("fill", "#a5b4fc") // Light purple/blue for Price
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Country}</div>
        <div class="tooltip-body"><div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div><div><strong>Brands:</strong> ${d.count}</div></div>
        <div class="tooltip-footer" style="color:#a5b4fc;">Price (Purple Bar)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });

  // SIS bars
  svg.selectAll("rect.sis-bar").data(agg).enter().append("rect").attr("class", "sis-bar")
    .attr("x", d => xScale(d.Country) + xScale.bandwidth() / 2).attr("y", d => yScale(d.meanSIS * 100)).attr("width", xScale.bandwidth() / 2).attr("height", d => height - padding.bottom - yScale(d.meanSIS * 100))
    .attr("fill", "#4ade80") // Light Green for SIS
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Country}</div>
        <div class="tooltip-body"><div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div><div><strong>Brands:</strong> ${d.count}</div></div>
        <div class="tooltip-footer" style="color:#4ade80;">SIS (Green Bar)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });
}

function renderEdaTrend() {
  const container = document.getElementById("eda-trend");
  if (!container || !PROCESSED_ROWS) return;

  const agg = computeTrendAgg(PROCESSED_ROWS).sort((a, b) => b.count - a.count);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 40, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scaleBand().domain(agg.map(d => d.Trend)).range([padding.left, width - padding.right]).padding(0.2);
  const yScaleCount = d3.scaleLinear().domain([0, d3.max(agg, d => d.count) * 1.1]).range([height - padding.bottom, padding.top]);
  const yScaleSIS = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScaleCount).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${width - padding.right},0)`).call(d3.axisRight(yScaleSIS).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Brand Count & Avg SIS by Trend");

  const tooltip = createTooltip("eda-trend-tooltip");

  // Count bars
  svg.selectAll("rect.count-bar").data(agg).enter().append("rect").attr("class", "count-bar")
    .attr("x", d => xScale(d.Trend)).attr("y", d => yScaleCount(d.count)).attr("width", xScale.bandwidth()).attr("height", d => height - padding.bottom - yScaleCount(d.count))
    .attr("fill", "#4ade80") // Light Green for Count
    .attr("opacity", 0.8)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1);
      tooltip.html(`
        <div class="tooltip-header">${d.Trend}</div>
        <div class="tooltip-body"><div><strong>Brand Count:</strong> ${d.count}</div><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div></div>
        <div class="tooltip-footer" style="color:#4ade80;">Brand Count (Bar)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.8);
      tooltip.style("visibility", "hidden");
    });

  // SIS line
  const line = d3.line().x(d => xScale(d.Trend) + xScale.bandwidth() / 2).y(d => yScaleSIS(d.meanSIS));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--accent-dark)").attr("stroke-width", 2).attr("d", line);
}

function renderEdaYear() {
  const container = document.getElementById("eda-year");
  if (!container || !PROCESSED_ROWS) return;

  const agg = computeYearAgg(PROCESSED_ROWS).sort((a, b) => a.Year - b.Year);
  if (agg.length === 0) {
    container.innerHTML = "<p class='plot-nodata'>No data</p>";
    return;
  }

  container.innerHTML = "";
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 220;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);

  const xScale = d3.scalePoint().domain(agg.map(d => d.Year)).range([padding.left, width - padding.right]).padding(0.5);
  const yScale = d3.scaleLinear().domain([0, 1]).range([height - padding.bottom, padding.top]);

  // Axes & Labels
  svg.append("g").attr("transform", `translate(0,${height - padding.bottom})`).call(d3.axisBottom(xScale)).selectAll("text").style("font-size", "10px");
  svg.append("g").attr("transform", `translate(${padding.left},0)`).call(d3.axisLeft(yScale).ticks(5)).selectAll("text").style("font-size", "10px");
  svg.append("text").attr("x", width / 2).attr("y", 15).attr("text-anchor", "middle").attr("fill", "var(--accent-dark)").attr("font-size", "13px").attr("font-weight", "600").text("Average SIS Trend by Year");

  const tooltip = createTooltip("eda-year-tooltip");

  // Line
  const line = d3.line().x(d => xScale(d.Year)).y(d => yScale(d.meanSIS));
  svg.append("path").datum(agg).attr("fill", "none").attr("stroke", "var(--accent)").attr("stroke-width", 2).attr("d", line);

  // Points
  svg.selectAll("circle").data(agg).enter().append("circle")
    .attr("cx", d => xScale(d.Year)).attr("cy", d => yScale(d.meanSIS)).attr("r", 4)
    .attr("fill", "var(--accent-dark)") // Darker Green for points
    .attr("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("r", 6);
      tooltip.html(`
        <div class="tooltip-header">Year ${d.Year}</div>
        <div class="tooltip-body"><div><strong>Avg SIS:</strong> ${d.meanSIS.toFixed(3)}</div><div><strong>Avg Price:</strong> $${d.meanPrice.toFixed(2)}</div><div><strong>Brands:</strong> ${d.count}</div></div>
        <div class="tooltip-footer" style="color:var(--accent-dark);">SIS Trend (Line)</div>
      `).style("visibility", "visible");
    })
    .on("mousemove", (event) => tooltip.style("top", `${event.pageY - 10}px`).style("left", `${event.pageX + 10}px`))
    .on("mouseout", function () {
      d3.select(this).attr("r", 4);
      tooltip.style("visibility", "hidden");
    });
}

// Auto-load data on page load
document.addEventListener("DOMContentLoaded", () => {
  autoUploadBtn.click();
});
