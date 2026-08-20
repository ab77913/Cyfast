"use strict";

class PlatformAdapterRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlatformAdapterRegistryError";
    this.code = code;
    this.details = details;
  }
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCapabilities(values) {
  return new Set((Array.isArray(values) ? values : []).map(normalize).filter(Boolean));
}

class PlatformAdapterRegistry {
  constructor() {
    this._registrations = [];
  }

  register({ platform = "*", capabilities = [], priority = 0, name }, factory) {
    if (typeof factory !== "function") {
      throw new TypeError("Platform adapter factory must be a function.");
    }
    const registration = Object.freeze({
      id: `${normalize(platform) || "*"}:${name || this._registrations.length + 1}`,
      name: String(name || `adapter-${this._registrations.length + 1}`),
      platform: normalize(platform) || "*",
      capabilities: normalizeCapabilities(capabilities),
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      factory,
    });
    this._registrations.push(registration);
    this._registrations.sort((left, right) => right.priority - left.priority);
    return registration.id;
  }

  unregister(registrationId) {
    const index = this._registrations.findIndex((item) => item.id === registrationId);
    if (index < 0) return false;
    this._registrations.splice(index, 1);
    return true;
  }

  list() {
    return this._registrations.map((registration) => ({
      id: registration.id,
      name: registration.name,
      platform: registration.platform,
      capabilities: [...registration.capabilities],
      priority: registration.priority,
    }));
  }

  async resolve({ platform, target = {}, execution } = {}) {
    const normalizedPlatform = normalize(platform || execution?.platform);
    if (!normalizedPlatform) {
      throw new PlatformAdapterRegistryError("PLATFORM_REQUIRED", "Platform is required.");
    }
    const available = normalizeCapabilities(
      target.capabilities || target.capabilitySnapshot || execution?.targetSnapshot?.capabilities,
    );
    const required = normalizeCapabilities(
      execution?.packageSnapshot?.requiredCapabilities || target.requiredCapabilities,
    );
    const missing = [...required].filter((capability) => !available.has(capability));
    if (missing.length > 0) {
      throw new PlatformAdapterRegistryError(
        "TARGET_CAPABILITY_MISMATCH",
        `Target is missing required capabilities: ${missing.join(", ")}.`,
        { missing, available: [...available] },
      );
    }

    const matches = this._registrations.filter((registration) => {
      if (registration.platform !== "*" && registration.platform !== normalizedPlatform) return false;
      return [...registration.capabilities].every((capability) => available.has(capability));
    });
    if (matches.length === 0) {
      throw new PlatformAdapterRegistryError(
        "PLATFORM_ADAPTER_NOT_FOUND",
        `No compatible adapter is registered for ${normalizedPlatform}.`,
        { platform: normalizedPlatform, available: [...available] },
      );
    }

    for (const registration of matches) {
      const adapter = await registration.factory({
        platform: normalizedPlatform,
        target,
        execution,
        registration: {
          id: registration.id,
          name: registration.name,
          capabilities: [...registration.capabilities],
        },
      });
      if (adapter) return adapter;
    }
    throw new PlatformAdapterRegistryError(
      "PLATFORM_ADAPTER_UNAVAILABLE",
      `Compatible adapters for ${normalizedPlatform} are currently unavailable.`,
    );
  }
}

module.exports = {
  PlatformAdapterRegistry,
  PlatformAdapterRegistryError,
  normalizeCapabilities,
};
