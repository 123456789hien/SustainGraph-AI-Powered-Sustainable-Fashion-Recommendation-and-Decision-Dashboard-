// Simple kmeans implementation
export function euclid(a,b){ let s=0; for(let i=0;i<a.length;i++){ s+= (a[i]-b[i])**2 } return Math.sqrt(s); }

export function runKMeans(X, k=3, opts={maxIter:100}){
  const n = X.length;
  if(n===0) return {centroids:[],assignments:[]};
  // init centroids: pick k distinct
  const centroids = [];
  const used = new Set();
  while(centroids.length<k){
    const idx = Math.floor(Math.random()*n);
    if(!used.has(idx)){ centroids.push(X[idx].slice()); used.add(idx); }
  }
  let assignments = new Array(n).fill(0);
  for(let iter=0; iter<opts.maxIter; iter++){
    let changed = false;
    // assign
    for(let i=0;i<n;i++){
      let best = 0; let bestd = euclid(X[i],centroids[0]);
      for(let c=1;c<centroids.length;c++){
        const d = euclid(X[i],centroids[c]);
        if(d<bestd){ bestd=d; best=c; }
      }
      if(assignments[i]!==best){ assignments[i]=best; changed=true; }
    }
    // recompute centroids
    const sums = Array(k).fill(0).map(()=>Array(X[0].length).fill(0));
    const counts = Array(k).fill(0);
    for(let i=0;i<n;i++){
      const a = assignments[i]; counts[a]++;
      for(let j=0;j<X[0].length;j++) sums[a][j]+=X[i][j];
    }
    for(let c=0;c<k;c++){
      if(counts[c]===0) continue;
      for(let j=0;j<X[0].length;j++) centroids[c][j]=sums[c][j]/counts[c];
    }
    if(!changed) break;
  }
  return {centroids, assignments};
}
