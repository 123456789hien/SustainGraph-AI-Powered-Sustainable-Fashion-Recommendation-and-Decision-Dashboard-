export function normalizeCols(rows, numericCols){
  // copy
  const cleaned = rows.map(r=>Object.assign({}, r));
  const stats = {min:{},max:{},mean:{}};
  numericCols.forEach(col=>{
    const vals = cleaned.map(r=>isFinite(r[col])?r[col]:NaN).filter(v=>!isNaN(v));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
    stats.min[col]=min; stats.max[col]=max; stats.mean[col]=mean;
    cleaned.forEach(r=>{
      const v = isFinite(r[col])?r[col]:mean;
      r[col] = v;
      r[col+'_norm'] = (v - min) / (max - min || 1);
    });
  });
  return {cleaned, stats};
}

export function computeSIS(rows){
  // SIS = avg( score_norm, (1 - CO2_norm), (1 - Water_norm), (1 - Waste_norm) )
  return rows.map(r=>{
    const scoreNorm = ('Overall_Sustainability_Score' in r && isFinite(r.Overall_Sustainability_Score)) ? (r.Overall_Sustainability_Score/5) : 0.5;
    const co2n = (r.Carbon_Footprint_norm !== undefined)? r.Carbon_Footprint_norm : 0;
    const watern = (r.Water_Usage_norm !== undefined)? r.Water_Usage_norm : 0;
    const wastn = (r.Waste_Generation_norm !== undefined)? r.Waste_Generation_norm : 0;
    r.SIS = (scoreNorm + (1-co2n) + (1-watern) + (1-wastn)) / 4;
    return r;
  });
}
