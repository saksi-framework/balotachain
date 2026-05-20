import { protocolPackageName } from "@tala/protocol";

export const applicationName = "balotachain";

export function describeApplication(): string {
  return `${applicationName} uses ${protocolPackageName}`;
}

