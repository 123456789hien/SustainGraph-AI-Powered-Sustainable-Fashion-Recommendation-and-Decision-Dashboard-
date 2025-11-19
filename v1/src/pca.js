// Simple PCA using numeric.js SVD
export function runPCA2(X){
  // X: NxM array
  if(X.length===0) return {x:[], y:[]};
  // center
  const M = X[0].length;
  const N = X.length;
  const mean = Array(M).fill(0);
  for(let j=0;j<M;j++){
    for(let i=0;i<N;i++) mean[j]+=X[i][j];
    mean[j]/=N;
  }
  const A = numeric.rep([N,M],0);
  for(let i=0;i<N;i++) for(let j=0;j<M;j++) A[i][j]=X[i][j]-mean[j];
  // covariance = A' * A
  const C = numeric.dot(numeric.transpose(A), A);
  const svd = numeric.svd(C);
  // projection onto top 2 eigenvectors svd.U
  const U = svd.U;
  const comp1 = U.map(r=>r[0]);
  const comp2 = U.map(r=>r[1] || 0);
  // project original centered data
  const x = numeric.dot(A, comp1);
  const y = numeric.dot(A, comp2);
  return {x,y};
}
