import { parseCSVFile } from './preprocess.js';
import { computeSIS, normalizeCols } from './computeSIS.js';
import { runKMeans } from './kmeans.js';
import { runPCA2 } from './pca.js';
import { trainOrPredictMLP } from './mlpModel.js';
import { buildGraphJson } from './graphBuilder.js';
import { recommend } from './recommender.js';

// UI elements
const fileInput = document.getElementById('file-input');
const loadSampleBtn = document.getElementById('load-sample');
const fileInfo = document.getElementById('file-info');
const runBtn = document.getElementById('run-pipeline');

const selBrand = document.getElementById('filter-brand');
const selCategory = document.getElementById('filter-category');
const selMaterial = document.getElementById('filter-material');
const priority = document.getElementById('priority');

const kpiRow = document.getElementById('kpi-row');
const histDiv = document.getElementById('histogram');
const pcaDiv = document.getElementById('pca');
const clustersDiv = document.getElementById('clusters');
const recoDiv = document.getElementById('recommend-list');
const graphCanvas = document.getElementById('graph-canvas');

let RAW_ROWS = []; // original data rows as objects
let WORK_ROWS = []; // preprocessed numeric

fileInput.addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if(!f) return;
  fileInfo.innerText = `Loaded: ${f.name}`;
  const parsed = await parseCSVFile(f);
  onDataLoaded(parsed);
});

loadSampleBtn.addEventListener('click', async () => {
  const resp = await fetch('public/sample_dataset.csv');
  const txt = await resp.text();
  const parsed = Papa.parse(txt, {header:true,skipEmptyLines:true}).data;
  onDataLoaded(parsed);
});

function onDataLoaded(rows){
  RAW_ROWS = rows.map(r => {
    // normalize column names and parse numbers robustly
    return {
      Brand: (r.Brand||r.Brand||'').trim(),
      Category: (r.Category||'').trim(),
      Material_Type: (r.Material_Type||r.Material||'').trim(),
      Sustainable_Practice: (r.Sustainable_Practice||'').trim(),
      Carbon_Footprint: parseFloat((r.Carbon_Footprint||r.Carbon||r['Carbon_Footprint']||'') || NaN),
      Water_Usage: parseFloat((r.Water_Usage||r.Water||'') || NaN),
      Waste_Generation: parseFloat((r.Waste_Generation||r.Waste||'') || NaN),
      Overall_Sustainability_Score: parseFloat((r.Overall_Sustainability_Score||r.Score||r['Overall_Sustainability_Score']||'') || NaN)
    };
  });
  populateFilters(RAW_ROWS);
  fileInfo.innerText += ` — ${RAW_ROWS.length} rows parsed`;
}

function populateFilters(rows){
  const brands = Array.from(new Set(rows.map(r=>r.Brand).filter(x=>x))).sort();
  const cats = Array.from(new Set(rows.map(r=>r.Category).filter(x=>x))).sort();
  const mats = Array.from(new Set(rows.map(r=>r.Material_Type).filter(x=>x))).sort();
  selBrand.innerHTML = '<option value="__all">All</option>';
  selCategory.innerHTML = '<option value="__all">All</option>';
  selMaterial.innerHTML = '<option value="__all">All</option>';
  brands.forEach(b => selBrand.insertAdjacentHTML('beforeend', `<option>${b}</option>`));
  cats.forEach(c => selCategory.insertAdjacentHTML('beforeend', `<option>${c}</option>`));
  mats.forEach(m => selMaterial.insertAdjacentHTML('beforeend', `<option>${m}</option>`));
}

runBtn.addEventListener('click', async () => {
  if(!RAW_ROWS.length) { alert('Load dataset first'); return; }
  runBtn.disabled = true;
  runBtn.innerText = 'Processing...';

  // 1. Filter
  const fBrand = selBrand.value;
  const fCat = selCategory.value;
  const fMat = selMaterial.value;
  const rows = RAW_ROWS.filter(r=>{
    if(fBrand!=='__all' && r.Brand!==fBrand) return false;
    if(fCat!=='__all' && r.Category!==fCat) return false;
    if(fMat!=='__all' && r.Material_Type!==fMat) return false;
    return true;
  });

  // 2. Clean & normalize
  const { cleaned, stats } = normalizeCols(rows, ['Carbon_Footprint','Water_Usage','Waste_Generation','Overall_Sustainability_Score']);
  const withSIS = computeSIS(cleaned);

  // show KPIs
  showKPIs(withSIS, stats);

  // 3. Clustering on Material_Type features
  const agg = aggregateByMaterial(withSIS);
  const featureMatrix = agg.map(a => [a.meanCarbon, a.meanWater, a.meanWaste, a.meanScore]);
  const k = 3;
  const { centroids, assignments } = runKMeans(featureMatrix, k, {maxIter:50});
  // attach assignment to agg
  agg.forEach((a,i)=> a.cluster = assignments[i]);

  drawPCA(featureMatrix, agg, pcaDiv);
  drawClusters(agg, clustersDiv);

  // 4. MLP: train quick model to predict score if missing
  await trainOrPredictMLP(withSIS);

  // 5. Recommender: compute top N for current filters and priority
  const pri = parseFloat(priority.value);
  const recos = recommend(withSIS, pri, 10);
  renderRecommendations(recos);

  // 6. Graph build & render
  const graphJson = buildGraphJson(withSIS);
  renderGraph(graphJson);

  runBtn.disabled = false;
  runBtn.innerText = 'Process & Run';
});

function showKPIs(rows, stats){
  kpiRow.innerHTML = '';
  const avgSIS = (rows.reduce((s,r)=>s+(r.SIS||0),0)/rows.length) || 0;
  const avgCO2 = stats.mean.Carbon_Footprint || 0;
  const avgWater = stats.mean.Water_Usage || 0;
  const avgWaste = stats.mean.Waste_Generation || 0;
  kpiRow.insertAdjacentHTML('beforeend',
    `<div class="kpi"><strong>Avg SIS</strong><div>${avgSIS.toFixed(2)}</div></div>`);
  kpiRow.insertAdjacentHTML('beforeend',
    `<div class="kpi"><strong>Avg CO₂</strong><div>${avgCO2.toFixed(2)}</div></div>`);
  kpiRow.insertAdjacentHTML('beforeend',
    `<div class="kpi"><strong>Avg Water</strong><div>${avgWater.toFixed(0)} L</div></div>`);
  kpiRow.insertAdjacentHTML('beforeend',
    `<div class="kpi"><strong>Avg Waste</strong><div>${avgWaste.toFixed(2)}</div></div>`);
}

function aggregateByMaterial(rows){
  // returns array of {material, meanCarbon, meanWater, meanWaste, meanScore, count}
  const map = new Map();
  rows.forEach(r=>{
    const m = r.Material_Type || 'UNKNOWN';
    if(!map.has(m)) map.set(m,{material:m,sumC:0,sumW:0,sumWaste:0,sumScore:0,c:0});
    const rec = map.get(m);
    rec.sumC += r.Carbon_Footprint || 0;
    rec.sumW += r.Water_Usage || 0;
    rec.sumWaste += r.Waste_Generation || 0;
    rec.sumScore += r.Overall_Sustainability_Score || 0;
    rec.c += 1;
  });
  return Array.from(map.values()).map(v=>({
    material:v.material,
    meanCarbon: v.sumC / v.c,
    meanWater: v.sumW / v.c,
    meanWaste: v.sumWaste / v.c,
    meanScore: v.sumScore / v.c,
    count: v.c
  }));
}

function drawPCA(matrix, agg, targetDiv){
  // matrix: Nx4 numeric array
  const result = runPCA2(matrix);
  // result: {x:[], y:[]}
  targetDiv.innerHTML = '';
  const w = targetDiv.clientWidth || 600;
  const h = 320;
  const svg = d3.create("svg").attr("width",w).attr("height",h);
  const x = d3.scaleLinear().domain(d3.extent(result.x)).range([40,w-40]);
  const y = d3.scaleLinear().domain(d3.extent(result.y)).range([h-30,30]);
  svg.selectAll("circle").data(agg).enter().append("circle")
    .attr("cx",(d,i)=>x(result.x[i])).attr("cy",(d,i)=>y(result.y[i])).attr("r",6)
    .attr("fill",d=>d3.schemeCategory10[d.cluster % 10]).attr("opacity",0.85)
    .append("title").text(d=>`${d.material}\nSIS:${d.meanScore.toFixed(2)}`);
  svg.append("g").append("text").text("PCA projection of materials").attr("x",10).attr("y",18).attr("fill","#333");
  targetDiv.appendChild(svg.node());
}

function drawClusters(agg, el){
  el.innerHTML = '';
  agg.sort((a,b)=>a.cluster - b.cluster);
  agg.forEach(a=>{
    const div = document.createElement('div');
    div.style.padding='6px';
    div.style.borderBottom='1px solid #eee';
    div.innerHTML = `<strong>${a.material}</strong> (cluster ${a.cluster}) — SIS:${a.meanScore.toFixed(2)} — n:${a.count}`;
    el.appendChild(div);
  });
}

function renderRecommendations(list){
  recoDiv.innerHTML = '';
  if(!list || !list.length) { recoDiv.innerText = 'No recommendations'; return; }
  list.forEach(r=>{
    const d = document.createElement('div');
    d.className='reco-item';
    d.innerHTML = `<div><strong>${r.Brand}</strong> — ${r.Category} — ${r.Material_Type}</div>
                   <div>SIS: ${r.SIS.toFixed(2)} | CO₂: ${r.Carbon_Footprint.toFixed(2)} | Water: ${r.Water_Usage.toFixed(0)}L</div>
                   <div style="font-size:12px;color:#666">Reason: ${r.reason}</div>`;
    recoDiv.appendChild(d);
  });
}

function renderGraph(graphJson){
  graphCanvas.innerHTML = '';
  const width = graphCanvas.clientWidth || 900;
  const height = 420;
  const svg = d3.create("svg").attr("width",width).attr("height",height);
  const nodes = graphJson.nodes;
  const links = graphJson.links;
  const sim = d3.forceSimulation(nodes).force("link",d3.forceLink(links).id(d=>d.id).distance(70)).force("charge",d3.forceManyBody().strength(-120)).force("center",d3.forceCenter(width/2,height/2)).on("tick",ticked);
  const link = svg.append("g").selectAll("line").data(links).enter().append("line").attr("stroke","#bbb");
  const node = svg.append("g").selectAll("circle").data(nodes).enter().append("circle").attr("r",8).attr("fill",d=>d.type==='Brand'?'#1f77b4':d.type==='Category'?'#2ca02c':'#ff7f0e').call(d3.drag().on("start",dragstarted).on("drag",dragged).on("end",dragended));
  const labels = svg.append("g").selectAll("text").data(nodes).enter().append("text").text(d=>d.label).attr("font-size",10).attr("dx",10).attr("dy",4);
  function ticked(){ link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y); node.attr("cx",d=>d.x).attr("cy",d=>d.y); labels.attr("x",d=>d.x).attr("y",d=>d.y); }
  function dragstarted(event,d){ if(!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
  function dragged(event,d){ d.fx = event.x; d.fy = event.y; }
  function dragended(event,d){ if(!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }
  graphCanvas.appendChild(svg.node());
}
