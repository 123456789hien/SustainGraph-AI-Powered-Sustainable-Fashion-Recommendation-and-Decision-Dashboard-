// Using TensorFlow.js — small MLP to predict Overall_Sustainability_Score from numeric features
export async function trainOrPredictMLP(rows){
  // prepare dataset
  const inputs = [];
  const labels = [];
  rows.forEach(r=>{
    if(!isFinite(r.Carbon_Footprint) || !isFinite(r.Water_Usage) || !isFinite(r.Waste_Generation)) return;
    inputs.push([r.Carbon_Footprint, r.Water_Usage, r.Waste_Generation, r.SIS||0]);
    labels.push(isFinite(r.Overall_Sustainability_Score) ? r.Overall_Sustainability_Score : NaN);
  });
  // filter those with labels
  const X = [];
  const y = [];
  for(let i=0;i<inputs.length;i++){
    if(!isNaN(labels[i])){ X.push(inputs[i]); y.push(labels[i]); }
  }
  if(X.length<5){
    console.warn('Not enough labeled rows for training MLP');
    return;
  }
  const Xtensor = tf.tensor2d(X);
  const yNorm = tf.tensor2d(y, [y.length,1]).div(5); // normalize 0-1
  const model = tf.sequential();
  model.add(tf.layers.dense({units:64,activation:'relu',inputShape:[4]}));
  model.add(tf.layers.dense({units:32,activation:'relu'}));
  model.add(tf.layers.dense({units:1,activation:'sigmoid'}));
  model.compile({optimizer:tf.train.adam(0.01), loss:'meanSquaredError'});
  await model.fit(Xtensor, yNorm, {epochs:30, batchSize:16, verbose:0});
  // predict missing labels and fill
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    if(!isFinite(r.Overall_Sustainability_Score)){
      const input = tf.tensor2d([[r.Carbon_Footprint, r.Water_Usage, r.Waste_Generation, r.SIS||0]]);
      const pred = model.predict(input);
      const val = (await pred.data())[0] * 5;
      r.Overall_Sustainability_Score = val;
    }
  }
  // dispose tensors
  Xtensor.dispose(); yNorm.dispose();
  return model;
}
