"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const env = process.env.NODE_ENV || "local";

const appConfig = require(path.join(__dirname, "config", "app.json"))[env];
const routesConfig = require(path.join(__dirname, "config", "routes.json"));

function upstreamUrl(key) {
  const fromEnv = process.env[`UPSTREAM_${key.toUpperCase()}`];
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const base = appConfig.upstreams && appConfig.upstreams[key];
  if (!base) {
    throw new Error(`Missing upstream for "${key}" in config/app.json [${env}]`);
  }
  return String(base).replace(/\/$/, "");
}

const portRaw =
  process.env.GATEWAY_PORT ||
  process.env.PORT ||
  appConfig.port;
const port = parseInt(String(portRaw), 10);
if (Number.isNaN(port) || port < 1) {
  throw new Error(`Invalid gateway port: ${portRaw}`);
}

const host = process.env.GATEWAY_HOST || appConfig.host || "0.0.0.0";
const protocol = process.env.GATEWAY_PROTOCOL || "http";

module.exports = {
  env,
  host,
  port,
  publicUrl: `${protocol}://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
  upstreamUrl,
  proxies: routesConfig.proxies,
};
