/* Existing code from previous steps remains the same */

// Data Processing Functions (Normalizing, Preprocessing, etc.)

function preprocessRows(rawRows) {
  return rawRows.map((r) => {
    return {
      Brand_Name: r.Brand_Name || "",
      Material_Type: r.Material_Type || "",
      Country: r.Country || "",
      Year: parseInt(r.Year || "", 10) || null,
      Sustainability_Rating: r.Sustainability_Rating || "",
      Carbon_Footprint_MT: parseFloat(r.Carbon_Footprint_MT || 0),
      Water_Usage_Liters: parseFloat(r.Water_Usage_Liters || 0),
      Waste_Production_KG: parseFloat(r.Waste_Production_KG || 0),
      Average_Price_USD: parseFloat(r.Average_Price_USD || 0),
      Market_Trend: r.Market_Trend || "",
      Certifications: r.Certifications || "",
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

  const rowsWithSIS = rows.map((r, i) => {
    const ratingScore = ratingLetterToScore(r.Sustainability_Rating);

    const co2n = co2Norm.norm[i];
    const watern = waterNorm.norm[i];
    const wasten = wasteNorm.norm[i];

    const envScore = (1 - co2n + 1 - watern + 1 - wasten) / 3;
    const policyScore = (ratingScore) / 3;

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
  };

  return { rowsWithSIS, stats };
}

/* ========== EDA (Graphs) ========== */

function renderMaterialTypeVsPrice() {
  const data = PROCESSED_ROWS.filter((r) => r.Material_Type && r.Average_Price_USD);
  const materialTypes = [...new Set(data.map((d) => d.Material_Type))];

  const svg = d3.select("#material-type-vs-price")
    .append("svg")
    .attr("width", "100%")
    .attr("height", 400);

  const xScale = d3.scaleBand()
    .domain(materialTypes)
    .range([40, svg.node().getBoundingClientRect().width - 20])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.Average_Price_USD)])
    .range([svg.node().getBoundingClientRect().height - 40, 20]);

  svg.append("g")
    .selectAll(".bar")
    .data(materialTypes)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d))
    .attr("y", (d) => yScale(d3.mean(data.filter((e) => e.Material_Type === d), (e) => e.Average_Price_USD)))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => svg.node().getBoundingClientRect().height - yScale(d3.mean(data.filter((e) => e.Material_Type === d), (e) => e.Average_Price_USD)))
    .attr("fill", "#4CAF50");

  svg.append("g")
    .attr("transform", `translate(0,${svg.node().getBoundingClientRect().height - 40})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(40,0)`)
    .call(d3.axisLeft(yScale));
}

function renderMaterialTypeVsSIS() {
  const data = PROCESSED_ROWS.filter((r) => r.Material_Type && r.SIS);
  const materialTypes = [...new Set(data.map((d) => d.Material_Type))];

  const svg = d3.select("#material-type-vs-sis")
    .append("svg")
    .attr("width", "100%")
    .attr("height", 400);

  const xScale = d3.scaleBand()
    .domain(materialTypes)
    .range([40, svg.node().getBoundingClientRect().width - 20])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.SIS)])
    .range([svg.node().getBoundingClientRect().height - 40, 20]);

  svg.append("g")
    .selectAll(".bar")
    .data(materialTypes)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d))
    .attr("y", (d) => yScale(d3.mean(data.filter((e) => e.Material_Type === d), (e) => e.SIS)))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => svg.node().getBoundingClientRect().height - yScale(d3.mean(data.filter((e) => e.Material_Type === d), (e) => e.SIS)))
    .attr("fill", "#FBBF24");

  svg.append("g")
    .attr("transform", `translate(0,${svg.node().getBoundingClientRect().height - 40})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(40,0)`)
    .call(d3.axisLeft(yScale));
}
