export function buildGraphJson(rows){
  // nodes: Brands, Categories, Materials
  const nodes = [];
  const links = [];
  const brandSet = new Set(), catSet = new Set(), matSet = new Set();
  rows.forEach(r=>{
    if(r.Brand) brandSet.add(r.Brand);
    if(r.Category) catSet.add(r.Category);
    if(r.Material_Type) matSet.add(r.Material_Type);
  });
  const addNodes = (set,type) => {
    Array.from(set).forEach((v,i)=> nodes.push({id: `${type}:${v}`, label:v, type}));
  };
  addNodes(brandSet,'Brand');
  addNodes(catSet,'Category');
  addNodes(matSet,'Material');
  // links
  rows.forEach(r=>{
    if(r.Brand && r.Category) links.push({source:`Brand:${r.Brand}`, target:`Category:${r.Category}`});
    if(r.Category && r.Material_Type) links.push({source:`Category:${r.Category}`, target:`Material:${r.Material_Type}`});
  });
  // deduplicate links
  const key = l=> `${l.source}___${l.target}`;
  const seen = new Set();
  const uniq = [];
  links.forEach(l=>{ const k=key(l); if(!seen.has(k)){seen.add(k); uniq.push(l);} });
  return {nodes, links:uniq};
}
