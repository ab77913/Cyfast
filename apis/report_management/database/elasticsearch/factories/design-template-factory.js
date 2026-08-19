"use strict";

const elasticClient = require("../models");

const extractFilters = (filters) => {
  let searchQuery = {};
  let queryFilters = [];
  let rangeFilters = [];
  let termFilters = [];

  if (filters) {
    Object.keys(filters).forEach((key) => {
      if (typeof filters[key] === "object") {
        if (
          filters[key]["gte"] !== undefined ||
          filters[key]["lte"] !== undefined ||
          filters[key]["gt"] !== undefined ||
          filters[key]["lt"] !== undefined
        ) {
          let rangeFilter = {};
          rangeFilter[key] = filters[key];
          rangeFilters.push({ range: rangeFilter });
        }
      } else if (Array.isArray(filters[key])) {
        let termFilter = {};
        termFilter[key] = filters[key].map((v) => v.toLowerCase());
        termFilters.push({ terms: termFilter });
      } else {
        let queryFilter = {};
        queryFilter[key] = filters[key];
        queryFilters.push({ match: queryFilter });
      }
    });

    if (queryFilters.length > 0) {
      searchQuery = {
        bool: {
          must: [...queryFilters],
        },
      };
    }
    if (termFilters.length > 0 || rangeFilters.length > 0) {
      if (searchQuery.bool === undefined) {
        searchQuery = {
          bool: {
            must: [...rangeFilters, ...termFilters],
          },
        };
      } else {
        searchQuery.bool.filter = {
          bool: {
            must: [...rangeFilters, ...termFilters],
          },
        };
      }
    }

    return { query: searchQuery };
  } else {
    return {};
  }
};

const extractSort = (sort) => {
  let sortQuery = [];
  if (sort && typeof sort === "object" && Object.keys(sort).length > 0) {
    Object.keys(sort).forEach((key) => {
      sortQuery.push({ [key]: { order: sort[key] } });
    });
  } else {
    sortQuery.push({ created_date: { order: "desc" } });
  }

  return { sort: sortQuery };
};

const getByFilter = async (
  filters = null,
  sort = null,
  page = null,
  size = null
) => {
  try {
    page = page || 1;
    size = size || 10;

    let sortQuery = extractSort(sort);
    let searchQuery = extractFilters(filters);

    let result = await elasticClient.search({
      index: "report_design_templates",
      body: {
        ...searchQuery,
        ...sortQuery,
        from: (page - 1) * size,
        size: size,
      },
    });

    let data = [];
    let pagination = {};
    if (result && result.hits && result.hits.hits) {
      pagination = {
        totalItems: result.hits.total.value,
        totalPages: Math.ceil(result.hits.total.value / size),
        currentPage: page,
      };

      data = result.hits.hits.map((item) => {
        return {
          id: item._id,
          ...item._source,
        };
      });
    }

    return {
      data: data,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);

    return {
      data: [],
      pagination: {},
    };
  }
};

const getCountByFilter = async (filters) => {
  let searchQuery = extractFilters(filters);

  let result = await elasticClient.count({
    index: "report_design_templates",
    body: {
      ...searchQuery,
    },
  });

  let count = 0;
  if (result && result.count) {
    count = result.count;
  }

  return count;
};

const getById = async (id) => {
  try {
    let result = await elasticClient.get({
      index: "report_design_templates",
      id: id,
    });

    let data = {};
    if (result && result.found) {
      data = {
        id: result._id,
        ...result._source,
      };
    }

    return data;
  } catch (error) {
    console.log(error);

    return {
      data: [],
      pagination: {},
    };
  }
};

const getByOriginalName = async (originalname) => {
  let filters = {
    originalname: originalname,
  };
  let result = await getByFilter(filters);

  let data = [];
  if (result && result.data) {
    data = result.data;
  }

  return data;
};

const create = async (data) => {
  try {
    data.created_date = new Date();
    data.modified_date = new Date();

    let result = await elasticClient.index({
      index: "report_design_templates",
      body: data,
    });

    let log = {};
    if (result && result.result === "created") {
      let data = await elasticClient.get({
        index: "report_design_templates",
        id: result._id,
      });

      if (data && data.found) {
        log = {
          id: data._id,
          ...data._source,
        };
      }
    }

    return log;
  } catch (error) {
    console.log(error);

    return {};
  }
};

const remove = async (designTemplateId) => {
  try {
    let result = await elasticClient.delete({
      index: "report_design_templates",
      id: designTemplateId,
    });

    return result;
  } catch (error) {
    console.log(error);

    return {};
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getByOriginalName,
  getById,
  create,
  remove,
};
