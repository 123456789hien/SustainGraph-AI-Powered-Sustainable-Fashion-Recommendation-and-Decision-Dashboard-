import * as tf from '@tensorflow/tfjs';

// MLP model để dự đoán Sustainability Score
export async function trainOrPredictMLP(rows) {
  const inputs = [];
  const labels = [];

  rows.forEach(r => {
    if (
      !Number.isFinite(r.Carbon_Footprint) ||
      !Number.isFinite(r.Water_Usage) ||
      !Number.isFinite(r.Waste_Generation)
    )
      return;
    inputs.push([
      r.Carbon_Footprint,
      r.Water_Usage,
      r.Waste_Generation,
      r.SIS || 0,
    ]);
    labels.push(Number.isFinite(r.Overall_Sustainability_Score) ? r.Overall_Sustainability_Score : NaN);
  });

  const X = inputs.filter((_, i) => !isNaN(labels[i]));
  const y = labels.filter(label => !isNaN(label));

  if (X.length < 5) {
    console.warn('Not enough data to train model');
    return;
  }

  const Xtensor = tf.tensor2d(X);
  const yNorm = tf.tensor2d(y, [y.length, 1]).div(5); // Normalize 0-1

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [4] }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

  await model.fit(Xtensor, yNorm, { epochs: 30, batchSize: 16, verbose: 0 });

  // Dự đoán cho các sản phẩm không có điểm số bền vững
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Number.isFinite(r.Overall_Sustainability_Score)) {
      const input = tf.tensor2d([[r.Carbon_Footprint, r.Water_Usage, r.Waste_Generation, r.SIS || 0]]);
      const pred = model.predict(input);
      const val = (await pred.data())[0] * 5;
      r.Overall_Sustainability_Score = val;
    }
  }

  Xtensor.dispose();
  yNorm.dispose();

  return model;
}
