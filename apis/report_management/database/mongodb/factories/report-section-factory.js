"use strict";

const db = require("../models");
const ReportSection = db.reportSection;

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

    const data = await ReportSection.find(conditions)
      .limit(limit)
      .skip(offset)
      .sort(sortCondition);

    const totalItems = await ReportSection.countDocuments(conditions);
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
    const count = await ReportSection.countDocuments(conditions);
    return count;
  } catch (error) {
    console.log(error);
    return 0;
  }
};

const getById = async (id) => {
  try {
    const data = await ReportSection.findById(id);
    return data || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

const getByIds = async (sectionIds) => {
  try {
    if (!sectionIds || sectionIds.length === 0) {
      return [];
    }
    
    const data = await ReportSection.find({
      _id: { $in: sectionIds }
    });
    
    return data;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const create = async (data) => {
  try {
    const reportSection = new ReportSection(data);
    const savedSection = await reportSection.save();
    return savedSection;
  } catch (error) {
    console.log(error);
    return {};
  }
};

const update = async (id, data) => {
  try {
    const updatedSection = await ReportSection.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );
    return updatedSection || {};
  } catch (error) {
    console.log(error);
    return {};
  }
};

const remove = async (reportSectionId) => {
  try {
    const result = await ReportSection.findByIdAndDelete(reportSectionId);
    return result;
  } catch (error) {
    console.log(error);
    return {};
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getByIds,
  getById,
  create,
  update,
  remove,
};
