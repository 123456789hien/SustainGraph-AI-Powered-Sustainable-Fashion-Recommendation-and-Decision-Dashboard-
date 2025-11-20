// Thêm biểu đồ EDA cho Price & SIS và các Quốc Gia
function renderEdaCharts(rows) {
  const materialTypeData = rows.map((r) => ({
    material: r.Material_Type,
    price: r.Average_Price_USD,
    SIS: r.SIS,
  }));
  const countryData = rows.map((r) => ({
    country: r.Country,
    price: r.Average_Price_USD,
    SIS: r.SIS,
  }));

  renderMaterialTypeChart(materialTypeData);
  renderCountryChart(countryData);
}

function renderMaterialTypeChart(data) {
  const svg = d3.select("#eda-materials").append("svg").attr("width", 400).attr("height", 300);
  const x = d3.scaleBand().domain(["Low", "Medium", "High"]).range([0, 380]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.SIS)]).nice().range([290, 10]);

  svg.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.material))
    .attr("y", (d) => y(d.SIS))
    .attr("width", x.bandwidth())
    .attr("height", (d) => 290 - y(d.SIS))
    .attr("fill", "#4CAF50")
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  svg.append("g").selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", (d) => x(d.material) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.SIS) - 5)
    .attr("text-anchor",```javascript
    .attr("text-anchor", "middle")
    .text((d) => d.SIS.toFixed(2))
    .attr("fill", "#000");
}

function renderCountryChart(data) {
  const svg = d3.select("#eda-countries").append("svg").attr("width", 400).attr("height", 300);
  const x = d3.scaleBand().domain(data.map((d) => d.country)).range([0, 380]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.SIS)]).nice().range([290, 10]);

  svg.selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.country))
    .attr("y", (d) => y(d.SIS))
    .attr("width", x.bandwidth())
    .attr("height", (d) => 290 - y(d.SIS))
    .attr("fill", "#2196F3")
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  svg.append("g").selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", (d) => x(d.country) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.SIS) - 5)
    .attr("text-anchor", "middle")
    .text((d) => d.SIS.toFixed(2))
    .attr("fill", "#000");
}

/* ========== FILTERING AND HANDLING DATA ========== */

function preprocessRows(rawRows) {
  return rawRows.map((r) => {
    const Brand_ID = r.Brand_ID || r["Brand_ID"] || "";
    const Brand_Name = r.Brand_Name || r["Brand_Name"] || "";
    const Country = r.Country || "";
    const Year = parseInt(r.Year || r["Year"] || "", 10);
    const Material_Type = r.Material_Type || r["Material_Type"] || "";
    const Eco_Friendly_Manufacturing = r.Eco_Friendly_Manufacturing || r["Eco_Friendly_Manufacturing"] || "";
    const Carbon_Footprint_MT = toNumber(r.Carbon_Footprint_MT || r["Carbon_Footprint_MT"] || r.Carbon || "");
    const Water_Usage_Liters = toNumber(r.Water_Usage_Liters || r["Water_Usage_Liters"] || r.Water || "");
    const Waste_Production_KG = toNumber(r.Waste_Production_KG || r["Waste_Production_KG"] || r.Waste || "");
    const Recycling_Programs = r.Recycling_Programs || r["Recycling_Programs"] || "";
    const Product_Lines = toNumber(r.Product_Lines || r["Product_Lines"] || "");
    const Average_Price_USD = toNumber(r.Average_Price_USD || r["Average_Price_USD"] || r.Price || "");
    const Market_Trend = r.Market_Trend || r["Market_Trend"] || "";
    const Certifications = r.Certifications || r["Certifications"] || "";

    return {
      Brand_ID,
      Brand_Name,
      Country,
      Year: isNaN(Year) ? null : Year,
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

/* ========== UPDATE FILTER AND SHOW FILTERED DATA ========== */

function populateFilters(rows) {
  const materials = uniqueSorted(rows.map((r) => r.Material_Type));  // Filter by Material_Type
  const countries = uniqueSorted(rows.map((r) => r.Country));
  const years = uniqueSorted(
    rows
      .map((r) => parseInt(r.Year || r.year || "", 10))
      .filter((v) => !isNaN(v))
  );
  const certs = uniqueSorted(rows.map((r) => r.Certifications));
  const trends = uniqueSorted(rows.map((r) => r.Market_Trend));

  fillSelect(materialFilter, materials);
  fillSelect(countryFilter, countries);
  fillSelect(yearFilter, years.map(String));
  fillSelect(certFilter, certs);
  fillSelect(trendFilter, trends);
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

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

/* ========== PIPELINE AND PROCESSING ========== */

function runPipeline() {
  if (!RAW_ROWS.length) {
    alert("Please upload or auto-load the dataset first.");
    return;
  }
  btnRun.disabled = true;
  btnRun.textContent = "Processing...";

  try {
    const filtered = RAW_ROWS.filter((r) => {
      const material = r.Material_Type;
      const country = r.Country;
      const year = parseInt(r.Year || r.year || "", 10);
      const cert = r.Certifications;
      const trend = r.Market_Trend;

      if (materialFilter.value !== "__all" && material !== materialFilter.value)
        return false;
      if (countryFilter.value !== "__all" && country !== countryFilter.value)
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

    renderKPIs();
    renderEdaCharts(filtered);
    buildAndRenderRecommendations();
  } catch (err) {
    console.error(err);
    alert("Pipeline error (see console).");
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = "🚀 Run Analysis & Recommendations";
  }
}

btnRun.addEventListener("click", runPipeline);

