import { NextFunction, Request, Response } from "express";

// Per-endpoint role authorization middleware
export function allowRoles(roles: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const apiKeyDoc = (req as any).apiKeyDoc;
    if (!apiKeyDoc) {
      return res.status(401).json({ error: "API key not authenticated" });
    }
    if (!roles.includes(apiKeyDoc.role)) {
      return res.status(403).json({ error: "Insufficient role for this endpoint" });
    }
    next();
  };
}
