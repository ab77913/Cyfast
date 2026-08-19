"use strict";

const db = require("../models");
const ReportTemplate = db.reportTemplate;

const buildMongooseQuery = (filters) => {
  let conditions = {};
  
  if (filters) {
    Object.keys(filters).forEach((key) => {
      if (typeof filters[key] === "object" && !Array.isArray(filters[key])) {
        // Handle range queries (gte, lte, gt, lt)
        if (
          filters[key]["gte"] !== undefined ||
          filters[key]["lte"] !== undefined ||
          filters[key]["gt"] !== undefined ||
          filters[key]["lt"] !== undefined
        ) {
          conditions[key] = {};
          if (filters[key]["gte"]) conditions[key]["$gte"] = filters[key]["gte"];
          if (filters[key]["lte"]) conditions[key]["$lte"] = filters[key]["lte"];
          if (filters[key]["gt"]) conditions[key]["$gt"] = filters[key]["gt"];
          if (filters[key]["lt"]) conditions[key]["$lt"] = filters[key]["lt"];
        }
      } else if (Array.isArray(filters[key])) {
        // Handle array of values (in query)
        conditions[key] = { $in: filters[key] };
      } else {
        // Handle exact match
        conditions[key] = filters[key];
      }
    });
  }
  
  return conditions;
};

const buildSort = (sort) => {
  let sortCondition = {};
  
  if (sort && typeof sort === "object" && Object.keys(sort).length > 0) {
    Object.keys(sort).forEach((key) => {
      sortCondition[key] = sort[key] === "asc" ? 1 : -1;
    });
  } else {
    sortCondition = { created_date: -1 };
  }
  
  return sortCondition;
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
    
    const conditions = buildMongooseQuery(filters);
    const sortCondition = buildSort(sort);
    const limit = parseInt(size);
    const offset = (parseInt(page) - 1) * limit;

    const data = await ReportTemplate.find(conditions)
      .limit(limit)
      .skip(offset)
      .sort(sortCondition);

    const totalItems = await ReportTemplate.countDocuments(conditions);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: data,
      pagination: {
        totalItems: totalItems,
        totalPages: totalPages,
        currentPage: parseInt(page),
      },
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
  try {
    const conditions = buildMongooseQuery(filters);
    const count = await ReportTemplate.countDocuments(conditions);
    return count;
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const getById = async (id) => {
  try {
    const data = await ReportTemplate.findById(id);
    return data || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

const create = async (data) => {
  try {
    data.is_default = data.is_default === undefined ? false : data.is_default;
    
    const reportTemplate = new ReportTemplate(data);
    const savedTemplate = await reportTemplate.save();
    return savedTemplate;
  } catch (error) {
    console.log(error);
    return {};
  }
};

const update = async (id, data) => {
  try {
    const updatedTemplate = await ReportTemplate.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );
    return updatedTemplate || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

const remove = async (reportTemplateId) => {
  try {
    const result = await ReportTemplate.findByIdAndDelete(reportTemplateId);
    return result;
  } catch (error) {
    console.log(error);
    return {};
  }
};

const setDefault = async (id, reportTemplates) => {
  try {
    for (let reportTemplate of reportTemplates.data) {
      if (reportTemplate.id === id) {
        await update(reportTemplate.id, { is_default: true });
      } else {
        await update(reportTemplate.id, { is_default: false });
      }
    }
    return { id };
  } catch (error) {
    console.log(error);
    return {};
  }
};

const getDefaultTemplate = async (reportType) => {
  try {
    const filters = {
      report_type: reportType,
      is_default: true,
    };
    const filteredResult = await getByFilter(filters);
    return filteredResult.data[0];
  } catch (error) {
    console.log("error generate", error);
    return null;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  create,
  update,
  remove,
  setDefault,
  getDefaultTemplate,
};
