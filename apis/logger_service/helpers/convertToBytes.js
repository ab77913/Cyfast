function convertToBytes(size) {
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  let i = sizes.findIndex((v) => size.includes(v));
  let sizeVal = size.replace(/[^\d.]/g, "");

  return parseInt(sizeVal, 10) * Math.pow(k, i);
}

module.exports = convertToBytes;
