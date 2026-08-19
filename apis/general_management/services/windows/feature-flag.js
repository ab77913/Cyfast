"use strict";
function isWindowsAutomationEnabled() {
  return String(process.env.WINDOWS_AUTOMATION_ENABLED || "false").toLowerCase() === "true";
}
module.exports = { isWindowsAutomationEnabled };
