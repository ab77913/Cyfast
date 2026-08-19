"use strict";

function convertToBytes(size) {
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  let i = sizes.findIndex((v) => size.includes(v));
  let sizeVal = size.replace(/[^\d.]/g, "");

  return parseInt(sizeVal, 10) * Math.pow(k, i);
}

function convertToSnakeCase(jsonObject) {
  const snakeCaseObject = {};
  for (const key in jsonObject) {
    if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
      const snakeCaseKey = key
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase();
      snakeCaseObject[snakeCaseKey] = jsonObject[key];
    }
  }
  return snakeCaseObject;
}

function convertToCamelCase(jsonObject) {
  const camelCaseObject = {};
  for (const key in jsonObject) {
    if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
      const camelCaseKey = key
        .replace(/_([a-z])/g, (g) => g[1].toUpperCase())
        .replace(/^[A-Z]/, (g) => g.toLowerCase());
      camelCaseObject[camelCaseKey] = jsonObject[key];
    }
  }
  return camelCaseObject;
}

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}

function rekey(data, key, unique = false) {
  let result = {};
  data.forEach((item) => {
    if (unique) {
      result[item[key]] = item;
    } else {
      if (!result[item[key]]) {
        result[item[key]] = [];
      }
      result[item[key]].push(item);
    }
  });
  return result;
}

function getUrl(req) {
  return req.protocol + "://" + req.hostname + req.url;
}

function convertArrayToQueryString(obj, prefix) {
  var str = [],
    p;
  for (p in obj) {
    var k = prefix ? prefix + "[" + p + "]" : p,
      v = obj[p];
    str.push(
      v !== null && typeof v === "object"
        ? convertArrayToQueryString(v, k)
        : encodeURIComponent(k) + "=" + encodeURIComponent(v)
    );
  }
  return str.join("&");
}

function getPagination(page, size) {
  const limit = size ? +size : 10;
  const offset = page ? (page - 1) * limit : 0;

  return { limit, offset };
}

module.exports = {
  convertToBytes,
  convertToSnakeCase,
  convertToCamelCase,
  getUrl,
  getKeyByValue,
  rekey,
  convertArrayToQueryString,
  getPagination,
};
