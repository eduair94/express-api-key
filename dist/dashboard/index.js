"use strict";
/**
 * Dashboard module for API Key statistics UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDashboardData = exports.setSessionSecret = exports.initSessionStore = exports.hasValidSession = exports.getSessionApiKey = exports.destroySession = exports.createSession = exports.cleanupExpiredSessions = exports.renderStatusPage = exports.renderLoginPage = exports.renderInvalidApiKeyPage = exports.renderErrorPage = exports.renderDashboard = exports.renderApiKeyRequiredPage = void 0;
var renderer_1 = require("./renderer");
Object.defineProperty(exports, "renderApiKeyRequiredPage", { enumerable: true, get: function () { return renderer_1.renderApiKeyRequiredPage; } });
Object.defineProperty(exports, "renderDashboard", { enumerable: true, get: function () { return renderer_1.renderDashboard; } });
Object.defineProperty(exports, "renderErrorPage", { enumerable: true, get: function () { return renderer_1.renderErrorPage; } });
Object.defineProperty(exports, "renderInvalidApiKeyPage", { enumerable: true, get: function () { return renderer_1.renderInvalidApiKeyPage; } });
Object.defineProperty(exports, "renderLoginPage", { enumerable: true, get: function () { return renderer_1.renderLoginPage; } });
Object.defineProperty(exports, "renderStatusPage", { enumerable: true, get: function () { return renderer_1.renderStatusPage; } });
var session_1 = require("./session");
Object.defineProperty(exports, "cleanupExpiredSessions", { enumerable: true, get: function () { return session_1.cleanupExpiredSessions; } });
Object.defineProperty(exports, "createSession", { enumerable: true, get: function () { return session_1.createSession; } });
Object.defineProperty(exports, "destroySession", { enumerable: true, get: function () { return session_1.destroySession; } });
Object.defineProperty(exports, "getSessionApiKey", { enumerable: true, get: function () { return session_1.getSessionApiKey; } });
Object.defineProperty(exports, "hasValidSession", { enumerable: true, get: function () { return session_1.hasValidSession; } });
Object.defineProperty(exports, "initSessionStore", { enumerable: true, get: function () { return session_1.initSessionStore; } });
Object.defineProperty(exports, "setSessionSecret", { enumerable: true, get: function () { return session_1.setSessionSecret; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "computeDashboardData", { enumerable: true, get: function () { return utils_1.computeDashboardData; } });
