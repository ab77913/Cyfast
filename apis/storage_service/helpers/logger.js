"use strict";

const pino = require("pino");
const config = require("../config");

// Create logger instance
const logger = pino({
  level: config.log_level,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  }
});

/**
 * Log info message
 * @param {String} message - Log message
 * @param {Object} data - Additional data
 */
const info = (message, data = {}) => {
  logger.info(data, message);
};

/**
 * Log error message
 * @param {String} message - Error message
 * @param {Error|Object} error - Error object or additional data
 */
const error = (message, error = {}) => {
  if (error instanceof Error) {
    logger.error({ err: error, stack: error.stack }, message);
  } else {
    logger.error(error, message);
  }
};

/**
 * Log warning message
 * @param {String} message - Warning message
 * @param {Object} data - Additional data
 */
const warn = (message, data = {}) => {
  logger.warn(data, message);
};

/**
 * Log debug message
 * @param {String} message - Debug message
 * @param {Object} data - Additional data
 */
const debug = (message, data = {}) => {
  logger.debug(data, message);
};

/**
 * Create request logger
 * @param {Object} request - Fastify request
 * @returns {Object} Request-specific logger
 */
const requestLogger = (request) => {
  return {
    info: (message, data = {}) => {
      logger.info({ 
        requestId: request.id, 
        method: request.method, 
        url: request.url,
        ...data 
      }, message);
    },
    error: (message, error = {}) => {
      if (error instanceof Error) {
        logger.error({ 
          requestId: request.id, 
          method: request.method, 
          url: request.url,
          err: error,
          stack: error.stack
        }, message);
      } else {
        logger.error({ 
          requestId: request.id, 
          method: request.method, 
          url: request.url,
          ...error 
        }, message);
      }
    },
    warn: (message, data = {}) => {
      logger.warn({ 
        requestId: request.id, 
        method: request.method, 
        url: request.url,
        ...data 
      }, message);
    },
    debug: (message, data = {}) => {
      logger.debug({ 
        requestId: request.id, 
        method: request.method, 
        url: request.url,
        ...data 
      }, message);
    }
  };
};

module.exports = {
  logger,
  info,
  error,
  warn,
  debug,
  requestLogger
};
