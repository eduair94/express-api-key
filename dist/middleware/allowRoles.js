"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowRoles = allowRoles;
// Per-endpoint role authorization middleware
function allowRoles(roles) {
    return function (req, res, next) {
        const apiKeyDoc = req.apiKeyDoc;
        if (!apiKeyDoc) {
            return res.status(401).json({ error: "API key not authenticated" });
        }
        if (!roles.includes(apiKeyDoc.role)) {
            return res.status(403).json({ error: "Insufficient role for this endpoint" });
        }
        next();
    };
}
