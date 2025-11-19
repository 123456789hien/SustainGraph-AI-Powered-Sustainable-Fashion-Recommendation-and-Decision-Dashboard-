export async function parseCSVFile(file){
  return new Promise((resolve,reject)=>{
    Papa.parse(file,{header:true,skipEmptyLines:true,complete:(res)=>resolve(res.data),error:err=>reject(err)});
  });
}
