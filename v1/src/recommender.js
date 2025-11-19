// Content-based + SIS weighting recommender
function cosine(a,b){
  let dot=0,na=0,nb=0;
  for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  if(na===0||nb===0) return 0;
  return dot/(Math.sqrt(na)*Math.sqrt(nb));
}

export function recommend(rows, sustainabilityWeight=0.5, topN=10){
  // Build item vectors: material one-hot (small), plus SIS, overall score
  const materials = Array.from(new Set(rows.map(r=>r.Material_Type))).slice(0,1000);
  const matIndex = new Map(materials.map((m,i)=>[m,i]));
  const vectors = rows.map(r=>{
    const v = new Array(materials.length).fill(0);
    const idx = matIndex.get(r.Material_Type);
    if(idx!==undefined) v[idx]=1;
    // append SIS and normalized overall score
    const sis = isFinite(r.SIS)? r.SIS : 0;
    const score = isFinite(r.Overall_Sustainability_Score)? r.Overall_Sustainability_Score/5 : 0;
    v.push(sis, score);
    return v;
  });
  // choose seed: top SIS item
  const sorted = rows.slice().sort((a,b)=> (b.SIS||0) - (a.SIS||0));
  const seed = sorted[0];
  if(!seed) return [];
  const seedVec = vectors[rows.indexOf(seed)];
  // cosine similarity and final score
  const results = rows.map((r,i)=>{
    const sim = cosine(seedVec, vectors[i]);
    const sis = r.SIS || 0;
    const final = (1 - sustainabilityWeight) * sim + sustainabilityWeight * sis;
    return {...r, sim, final, reason: `similarity:${sim.toFixed(2)} SIS:${sis.toFixed(2)}`};
  }).sort((a,b)=>b.final - a.final).slice(0,topN);
  return results;
}
