"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const sql = require("mssql");
const dbConfig = {
  server: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  options: {
    encrypt: config.database_primary.sql_encrypt !== undefined ? config.database_primary.sql_encrypt : true,
  },
};

const getById = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("projects");
    console.log("SQL - ", sqlQueries.projectById);
    const event = await pool.request().input("ProjectID", sql.Int, projectId).query(sqlQueries.projectById);

    return Array.isArray(event.recordset) && event.recordset.length > 0 ? event.recordset[0] : {};
  } catch (error) {
    return error.message;
  }
};

const getConfigurationsByProjectId = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("projects");
    console.log("SQL - ", sqlQueries.configurationsByProjectId);
    const event = await pool.request().input("ProjectID", sql.Int, projectId).query(sqlQueries.configurationsByProjectId);

    return Array.isArray(event.recordset) && event.recordset.length > 0 ? event.recordset[0] : {};
  } catch (error) {
    return error.message;
  }
};

/*const getEvents = async () => {
    try {
        let pool = await sql.connect(config.database_primary);
        const sqlQueries = await utils.loadSqlQueries('events');
        const eventsList = await pool.request().query(sqlQueries.eventslist);
        return eventsList.recordset;
    } catch (error) {
        console.log(error.message);
    }
}

const creatEvent = async (eventdata) => {
    try {
        let pool = await sql.connect(config.database_primary);
        const sqlQueries = await utils.loadSqlQueries('events');
        const insertEvent = await pool.request()
                            .input('eventTitle', sql.NVarChar(100), eventdata.eventTitle)
                            .input('eventDescription', sql.NVarChar(1500), eventdata.eventDescription)
                            .input('startDate', sql.Date, eventdata.startDate)
                            .input('endDate', sql.Date, eventdata.endDate)
                            .input('avenue', sql.NVarChar(200), eventdata.avenue)
                            .input('maxMembers', sql.Int, eventdata.maxMembers)
                            .query(sqlQueries.createEvent);                            
        return insertEvent.recordset;
    } catch (error) {
        return error.message;
    }
}

const updateEvent = async (eventId, data) => {
    try {
        let pool = await sql.connect(config.database_primary);
        const sqlQueries = await utils.loadSqlQueries('events');
        const update = await pool.request()
                        .input('eventId', sql.Int, eventId)
                        .input('eventTitle', sql.NVarChar(100), data.eventTitle)
                        .input('eventDescription', sql.NVarChar(1500), data.eventDescription)
                        .input('startDate', sql.Date, data.startDate)
                        .input('endDate', sql.Date, data.endDate)
                        .input('avenue', sql.NVarChar(200), data.avenue)
                        .input('maxMembers', sql.Int, data.maxMembers)
                        .query(sqlQueries.updateEvent);
        return update.recordset;
    } catch (error) {
        return error.message;
    }
}

const deleteEvent = async (eventId) => {
    try {
        let pool = await sql.connect(config.database_primary);
        const sqlQueries = await utils.loadSqlQueries('events');
        const deleteEvent = await pool.request()
                            .input('eventId', sql.Int, eventId)
                            .query(sqlQueries.deleteEvent);
        return deleteEvent.recordset;
    } catch (error) {
        return error.message;
    }
}*/

module.exports = {
  getById,
  getConfigurationsByProjectId,
  /*getEvents,
    creatEvent,
    updateEvent,
    deleteEvent*/
};
