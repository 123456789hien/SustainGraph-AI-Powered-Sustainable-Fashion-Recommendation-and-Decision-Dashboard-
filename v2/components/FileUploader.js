import React from 'react';

function FileUploader({ onDataLoaded }) {
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const data = await parseCSVFile(file);
      onDataLoaded(data);
    }
  };

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    });
  };

  return (
    <div className="card">
      <h2>Upload Dataset</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
    </div>
  );
}

export default FileUploader;
