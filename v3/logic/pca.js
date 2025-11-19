// Hàm tính PCA sử dụng SVD (Singular Value Decomposition)
export function runPCA2(X) {
  const N = X.length;
  const M = X[0].length;

  // Trung bình các cột (tính trung tâm)
  const mean = Array(M).fill(0);
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) mean[j] += X[i][j];
    mean[j] /= N;
  }

  const A = numeric.rep([N, M], 0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) A[i][j] = X[i][j] - mean[j];
  }

  // Covariance matrix
  const C = numeric.dot(numeric.transpose(A), A);
  const svd = numeric.svd(C);

  // Projection lên 2 eigenvectors
  const U = svd.U;
  const comp1 = U.map(r => r[0]);
  const comp2 = U.map(r => r[1] || 0);

  const x = numeric.dot(A, comp1);
  const y = numeric.dot(A, comp2);

  return { x, y };
}
