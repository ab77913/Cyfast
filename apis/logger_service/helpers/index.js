"use strict";

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}

function rekey(data, key, unique = false) {
  let result = {};
  console.log(data);
  if (data && data instanceof Array && data.length > 0) {
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
  }
  return result;
}

function getUrl(req) {
  return req.protocol + "://" + req.get("host") + req.originalUrl;
}

function convertArrayToQueryString(obj, prefix) {
  var str = [],
    p;
  for (p in obj) {
    var k = prefix ? prefix + "[" + p + "]" : p,
      v = obj[p];
    str.push(v !== null && typeof v === "object" ? serialize(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v));
  }
  return str.join("&");
}

function getPagination(page, size) {
  const limit = size ? +size : 10;
  const offset = page ? (page - 1) * limit : 0;

  return { limit, offset };
}

module.exports = {
  getUrl,
  getKeyByValue,
  rekey,
  convertArrayToQueryString,
  getPagination,
};
