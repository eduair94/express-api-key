// SOLID-compliant database abstraction for API key and role management

export interface IApiKey {
  key: string;
  role: string;
  createdAt: Date;
  daysValid: number;
  lastUsedAt?: Date;
  requestCountMonth: number;
  requestCountStart?: Date;
  save?: () => Promise<void>;
}

export interface IRole {
  name: string;
  minIntervalSeconds?: number;
  maxMonthlyUsage?: number;
}

export interface IApiKeyRoleDatabase {
  findApiKey(key: string): Promise<IApiKey | null>;
  findRole(name: string): Promise<IRole | null>;
  // Optionally, add create/update methods for extensibility
}
