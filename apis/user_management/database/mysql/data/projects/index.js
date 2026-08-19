"use strict";
const mysql = require("mysql2/promise");
const utils = require("../utils");
const config = require("../../../../config");

const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl:
    config.database_primary.sql_encrypt !== undefined
      ? config.database_primary.sql_encrypt
      : true
      ? { rejectUnauthorized: false }
      : null,
};

const getById = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("projects");
    console.log("SQL - ", sqlQueries.projectById);

    const [rows] = await pool.query(sqlQueries.projectById, [projectId]);

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

/* Optional functions can be adapted similarly for MySQL
const getEvents = async () => {
    try {
        const pool = await mysql.createPool(dbConfig);
        const sqlQueries = await utils.loadSqlQueries('events');
        const [rows] = await pool.query(sqlQueries.eventslist);
        return rows;
    } catch (error) {
        console.log(error.message);
    }
}

const createEvent = async (eventdata) => {
    try {
        const pool = await mysql.createPool(dbConfig);
        const sqlQueries = await utils.loadSqlQueries('events');
        const result = await pool.query(sqlQueries.createEvent, [
            eventdata.eventTitle,
            eventdata.eventDescription,
            eventdata.startDate,
            eventdata.endDate,
            eventdata.avenue,
            eventdata.maxMembers
        ]);                          
        return result[0];
    } catch (error) {
        return error.message;
    }
}

const updateEvent = async (eventId, data) => {
    try {
        const pool = await mysql.createPool(dbConfig);
        const sqlQueries = await utils.loadSqlQueries('events');
        const result = await pool.query(sqlQueries.updateEvent, [
            data.eventTitle,
            data.eventDescription,
            data.startDate,
            data.endDate,
            data.avenue,
            data.maxMembers,
            eventId
        ]);
        return result[0];
    } catch (error) {
        return error.message;
    }
}

const deleteEvent = async (eventId) => {
    try {
        const pool = await mysql.createPool(dbConfig);
        const sqlQueries = await utils.loadSqlQueries('events');
        const result = await pool.query(sqlQueries.deleteEvent, [eventId]);
        return result[0];
    } catch (error) {
        return error.message;
    }
}
*/

module.exports = {
  getById,
  getConfigurationsByProjectId,
  /* getEvents, createEvent, updateEvent, deleteEvent */
};
