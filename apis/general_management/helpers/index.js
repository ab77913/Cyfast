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
  return req.protocol + "://" + req.get("host") + req.originalUrl;
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

/**
 * Normalized paging for Sequelize list endpoints.
 * Defaults and max cap keep payloads bounded.
 */
function normalizePaging(
  page,
  size,
  { defaultPage = 1, defaultSize = 25, maxSize = 200 } = {},
) {
  const pRaw =
    page !== undefined && page !== null && String(page).trim() !== ""
      ? parseInt(String(page), 10)
      : NaN;
  const pageNum = Number.isFinite(pRaw) && pRaw >= 1 ? pRaw : defaultPage;

  const sRaw =
    size !== undefined && size !== null && String(size).trim() !== ""
      ? parseInt(String(size), 10)
      : NaN;
  const sizeNumUncapped =
    Number.isFinite(sRaw) && sRaw >= 1 ? sRaw : defaultSize;
  const sizeNum = Math.min(maxSize, Math.max(1, sizeNumUncapped));

  const { limit, offset } = getPagination(pageNum, sizeNum);
  return { page: pageNum, size: sizeNum, limit, offset };
}

/** Parse GET list query (?filters[..], optional page/size/sort/include) for Sequelize factories. */
function parseListFetchQuery(query = {}) {
  const filters =
    query.filters &&
    typeof query.filters === "object" &&
    !Array.isArray(query.filters)
      ? query.filters
      : {};

  let sort = query.sort;
  if (!Array.isArray(sort)) sort = [];

  const include =
    query.include !== undefined ? query.include : null;

  const paging = normalizePaging(query.page, query.size);

  return {
    filters,
    sort,
    include,
    page: paging.page,
    size: paging.size,
  };
}

function buildPaginationMeta(totalItems, pageNum, pageSizeNum) {
  const n = Number(totalItems) || 0;
  return {
    totalItems: n,
    totalPages: n === 0 ? 0 : Math.ceil(n / pageSizeNum),
    currentPage: pageNum,
    pageSize: pageSizeNum,
  };
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
  normalizePaging,
  parseListFetchQuery,
  buildPaginationMeta,
};
