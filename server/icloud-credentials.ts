import { envValues, updateEnv } from "./env-file";

export type ICloudCredentials = { email: string; password: string };
export interface ICloudCredentialStore {
  load(): Promise<ICloudCredentials | null>;
  save(credentials: ICloudCredentials): Promise<void>;
  clear(): Promise<void>;
}

/** Server-only credentials. Never load these variables into browser configuration. */
export class DotEnvICloudCredentials implements ICloudCredentialStore {
  constructor(private file: string) {}

  async load(): Promise<ICloudCredentials | null> {
    const env = await envValues(this.file);
    const email = env.ICLOUD_EMAIL?.trim();
    const password = env.ICLOUD_APP_PASSWORD?.trim();
    if (!email && !password) return null;
    if (!email || !password) throw new Error("Both ICLOUD_EMAIL and ICLOUD_APP_PASSWORD are required in .env.");
    return { email, password };
  }

  private async update(credentials: ICloudCredentials | null): Promise<void> {
    if (credentials && !/^[a-z]{4}(?:-[a-z]{4}){3}$/i.test(credentials.password)) throw new Error("Invalid iCloud credentials.");
    return updateEnv(this.file, ["ICLOUD_EMAIL", "ICLOUD_APP_PASSWORD"], credentials ? { ICLOUD_EMAIL: credentials.email, ICLOUD_APP_PASSWORD: credentials.password } : {});
  }
  save(credentials: ICloudCredentials) { return this.update(credentials); }
  clear() { return this.update(null); }
}
