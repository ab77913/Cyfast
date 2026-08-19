"use strict";
const utils = require("../utils");

// Fetch record by Project ID
const getById = async (project_id) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("projects");
    const [rows] = await pool.query(sqlQueries.projectbyId, [project_id]);
    return rows;
  } catch (error) {
    return error.message;
  }
};

/* Uncomment if needed for MySQL implementation

// Fetch all events
const getEvents = async () => {
  try {
    const pool = utils.pool;
    if (!pool) {
    throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries('events');
    const [rows] = await pool.query(sqlQueries.eventslist);
    return rows;
  } catch (error) {
    console.log(error.message);
  }
};

// Create an event
const creatEvent = async (eventdata) => {
  try {
    const pool = utils.pool;
    if (!pool) {
    throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries('events');
    const [rows] = await pool.query(sqlQueries.createEvent, [
      eventdata.eventTitle,
      eventdata.eventDescription,
      eventdata.startDate,
      eventdata.endDate,
      eventdata.avenue,
      eventdata.maxMembers
    ]);
    return rows;
  } catch (error) {
    return error.message;
  }
};

// Update an event
const updateEvent = async (eventId, data) => {
  try {
    const pool = utils.pool;
    if (!pool) {
    throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries('events');
    const [rows] = await pool.query(sqlQueries.updateEvent, [
      data.eventTitle,
      data.eventDescription,
      data.startDate,
      data.endDate,
      data.avenue,
      data.maxMembers,
      eventId
    ]);
    return rows;
  } catch (error) {
    return error.message;
  }
};

// Delete an event
const deleteEvent = async (eventId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
    throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries('events');
    const [rows] = await pool.query(sqlQueries.deleteEvent, [eventId]);
    return rows;
  } catch (error) {
    return error.message;
  }
}; */

module.exports = {
  getById,
  /* Uncomment to use event-related methods
  getEvents,
  creatEvent,
  updateEvent,
  deleteEvent, */
};
