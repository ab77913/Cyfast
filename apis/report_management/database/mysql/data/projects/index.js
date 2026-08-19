"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const mysql = require("mysql2/promise");
const fs = require("fs");

const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl:
    config.database_primary.sql_encrypt !== undefined
      ? { rejectUnauthorized: true } // Use SSL if encrypt is defined
      : null, // Otherwise, no SSL
};

const getById = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("projects");
    console.log("SQL - ", sqlQueries.projectById);
    const [rows] = await pool.execute(sqlQueries.projectById, [projectId]);

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

const getConfigurationsByProjectId = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("projects");
    console.log("SQL - ", sqlQueries.configurationsByProjectId);
    const [rows] = await pool.execute(sqlQueries.configurationsByProjectId, [
      projectId,
    ]);

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

/* Uncomment the following if you want to migrate the events-related methods as well:

const getEvents = async () => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries('events');
    const [rows] = await pool.query(sqlQueries.eventslist);
    return rows;
  } catch (error) {
    console.log(error.message);
  }
};

const creatEvent = async (eventdata) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries('events');
    const [result] = await pool.execute(sqlQueries.createEvent, [
      eventdata.eventTitle,
      eventdata.eventDescription,
      eventdata.startDate,
      eventdata.endDate,
      eventdata.avenue,
      eventdata.maxMembers,
    ]);
    return result;
  } catch (error) {
    return error.message;
  }
};

const updateEvent = async (eventId, data) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries('events');
    const [result] = await pool.execute(sqlQueries.updateEvent, [
      data.eventTitle,
      data.eventDescription,
      data.startDate,
      data.endDate,
      data.avenue,
      data.maxMembers,
      eventId
    ]);
    return result;
  } catch (error) {
    return error.message;
  }
};

const deleteEvent = async (eventId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries('events');
    const [result] = await pool.execute(sqlQueries.deleteEvent, [eventId]);
    return result;
  } catch (error) {
    return error.message;
  }
};
*/

module.exports = {
  getById,
  getConfigurationsByProjectId,
  /*getEvents,
    creatEvent,
    updateEvent,
    deleteEvent*/
};
