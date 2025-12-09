function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;

  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); 
  return new Date(excelEpoch.getTime() + serial * 86400000);
}

module.exports = excelDateToJSDate;