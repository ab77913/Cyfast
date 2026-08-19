"use strict";

const fastify = require("fastify");
const cors = require("@fastify/cors");
const multipart = require("@fastify/multipart");
const staticFiles = require("@fastify/static");
const path = require("path");
const config = require("./config");
const { buildOpenApiDoc } = require("./swagger/openapi-config");
const { swaggerTransform } = require("./swagger/swagger-transform");
const { info, error } = require("./helpers/logger");

// Initialize MongoDB connection
const db = require("./database/mongodb/models");

// Create Fastify instance
const app = fastify({
  logger: {
    level: config.log_level,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard"
      }
    }
  },
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "requestId",
  disableRequestLogging: false,
  bodyLimit: config.max_file_size
});

// Register plugins
const registerPlugins = async () => {
  try {
    // CORS
    await app.register(cors, {
      origin: "*", // Configure appropriately for production
      credentials: true
    });

    await app.register(require("@fastify/swagger"), {
      openapi: buildOpenApiDoc(config),
      transform: swaggerTransform,
    });
    await app.register(require("@fastify/swagger-ui"), {
      routePrefix: "/api-docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
      staticCSP: true,
    });

    // Multipart (file upload)
    await app.register(multipart, {
      limits: {
        fileSize: config.max_file_size,
        files: 10 // Max 10 files per request
      }
    });

    // Static file serving for uploaded files
    await app.register(staticFiles, {
      root: path.join(__dirname, config.storage_path),
      prefix: "/files/",
      decorateReply: false
    });

    info("Plugins registered successfully");
  } catch (err) {
    error("Error registering plugins", err);
    throw err;
  }
};

// Register routes
const registerRoutes = async () => {
  try {
    // Import routes
    const storageRoutes = require("./routes/storage-routes");

    // Register routes
    await app.register(storageRoutes);

    info("Routes registered successfully");
  } catch (err) {
    error("Error registering routes", err);
    throw err;
  }
};

// Error handler
app.setErrorHandler((error, request, reply) => {
  const log = require("./helpers/logger").requestLogger(request);
  
  log.error("Request error", error);

  // Handle Fastify errors
  if (error.statusCode) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      error: error.message
    });
  }

  // Handle validation errors
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      message: "Validation error",
      errors: error.validation
    });
  }

  // Default error response
  return reply.code(500).send({
    success: false,
    message: "Internal server error",
    error: config.env === "production" ? "An error occurred" : error.message
  });
});

// Not found handler
app.setNotFoundHandler((request, reply) => {
  return reply.code(404).send({
    success: false,
    message: "Route not found",
    path: request.url
  });
});

// Start server
const start = async () => {
  try {
    // Ensure storage directory exists
    const fs = require("fs").promises;
    await fs.mkdir(config.storage_path, { recursive: true });
    info(`Storage directory ensured: ${config.storage_path}`);

    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Start listening
    await app.listen({
      port: config.port,
      host: "0.0.0.0" // Listen on all interfaces
    });

    info(`
╔════════════════════════════════════════════════════╗
║        Storage Service Started Successfully        ║
╠════════════════════════════════════════════════════╣
║  Environment: ${config.env.padEnd(38)} ║
║  URL: ${config.url.padEnd(44)} ║
║  Storage Path: ${config.storage_path.padEnd(35)} ║
║  MongoDB: Connected                                ║
╚════════════════════════════════════════════════════╝
    `);

  } catch (err) {
    error("Error starting server", err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  info(`${signal} received, shutting down gracefully...`);
  
  try {
    // Close Fastify server
    await app.close();
    info("Fastify server closed");

    // Close MongoDB connection
    await db.mongoose.connection.close();
    info("MongoDB connection closed");

    process.exit(0);
  } catch (err) {
    error("Error during shutdown", err);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  error("Uncaught exception", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  error("Unhandled rejection", { reason, promise });
  process.exit(1);
});

// Start the server
start();

module.exports = app;
