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
        queryFilter[key + ".keyword"] = filters[key];
        queryFilters.push({ term: queryFilter });
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

const extractPage = (page, size) => {
  let pageQuery = {};
  let sizeQuery = {};
  if (size === undefined) {
  } else {
    if (size === 0 || size === null) {
      size = 10;
    }
    sizeQuery = { size: size };
    if (page === undefined || page === 0 || page === null) {
      page = 1;
    }
    pageQuery = { from: (page - 1) * size };
  }
  return { pageQuery, sizeQuery };
};

const getByFilter = async (filters = null, sort = null, page = null, size = null) => {
  let searchQuery = extractFilters(filters);
  let sortQuery = extractSort(sort);
  let { pageQuery, sizeQuery } = extractPage(page, size);
  try {
    let result = await elasticClient.search({
      index: "console_logs",
      body: {
        ...searchQuery,
        ...sortQuery,
        ...pageQuery,
        ...sizeQuery,
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

  try {
    let result = await elasticClient.count({
      index: "console_logs",
      body: {
        ...searchQuery,
      },
    });

    let count = 0;
    if (result && result.body && result.body.count) {
      count = result.body.count;
    }

    return count;
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getLogById = async (id) => {
  try {
    let result = await elasticClient.get({
      index: "console_logs",
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

    return {};
  }
};

const getLogByExecutionIdByAgentId = async (executionId, agentId) => {
  try {
    let result = await elasticClient.search({
      index: "console_logs",
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  orchestration_execution_id: executionId,
                },
              },
              {
                match: {
                  "agent.id": agentId,
                },
              },
            ],
          },
        },
      },
    });

    let data = {};
    console.log("result", result);
    if (result && result.hits && result.hits.hits.length > 0) {
      data = {
        id: result.hits.hits[0]._id,
        ...result.hits.hits[0]._source,
      };
    }

    return data;
  } catch (error) {
    console.log(error);

    return {};
  }
};

const createLog = async (data) => {
  try {
    data.created_date = new Date();
    data.modified_date = new Date();

    let result = await elasticClient.index({
      index: "console_logs",
      body: data,
    });

    let log = {};
    if (result && result.result === "created") {
      let data = await elasticClient.get({
        index: "console_logs",
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

const updateLog = async (consoleLogId, data) => {
  try {
    data.modified_date = new Date();

    let result = await elasticClient.update({
      index: "console_logs",
      id: consoleLogId,
      body: {
        doc: data,
      },
    });

    let log = {};
    if (result && result.result === "updated") {
      let data = await elasticClient.get({
        index: "console_logs",
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

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getLogById: getLogById,
  getLogByExecutionIdByAgentId: getLogByExecutionIdByAgentId,
  createLog: createLog,
  updateLog: updateLog,
};
