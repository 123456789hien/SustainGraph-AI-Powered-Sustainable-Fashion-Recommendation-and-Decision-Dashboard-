// Hàm cosine similarity
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Hàm khuyến nghị dựa trên tương đồng và SIS
export function recommend(rows, sustainabilityWeight = 0.5, topN = 10) {
  const materials = Array.from(new Set(rows.map(r => r.Material_Type))).slice(0, 1000);
  const matIndex = new Map(materials.map((m, i) => [m, i]));

  const vectors = rows.map(r => {
    const v = new Array(materials.length).fill(0);
    const idx = matIndex.get(r.Material_Type);
    if (idx !== undefined) v[idx] = 1;

    const sis = r.SIS || 0;
    const score = r.Overall_Sustainability_Score ? r.Overall_Sustainability_Score / 5 : 0;
    v.push(sis, score);
    return v;
  });

  const seed = rows.slice().sort((a, b) => (b.SIS || 0) - (a.SIS || 0))[0];

  if (!seed) return [];
  const seedVec = vectors[rows.indexOf(seed)];

  const results = rows
    .map((r, i) => {
      const sim = cosine(seedVec, vectors[i]);
      const sis = r.SIS || 0;
      const final = (1 - sustainabilityWeight) * sim + sustainabilityWeight * sis;
      return { ...r, sim, final, reason: `similarity:${sim.toFixed(2)} SIS:${sis.toFixed(2)}` };
    })
    .sort((a, b) => b.final - a.final)
    .slice(0, topN);

  return results;
}
