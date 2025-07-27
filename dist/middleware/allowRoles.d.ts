import { NextFunction, Request, Response } from "express";
export declare function allowRoles(roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
