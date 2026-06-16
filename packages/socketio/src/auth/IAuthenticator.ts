import { TenantId, DriverId } from '@motus/types';

export interface AuthContext {
  readonly tenantId: TenantId;
  readonly driverId?: DriverId;
  readonly userId?: string;
  readonly tokenExpiresAt?: number; // Unix timestamp in milliseconds
  readonly metadata?: Record<string, any>;
}

export interface IAuthenticator {
  /**
   * Validates credentials passed during client socket handshake.
   * Throws an error on authentication failure.
   */
  authenticate(handshakeData: {
    token?: string;
    auth?: Record<string, any>;
    headers?: Record<string, any>;
    query?: Record<string, any>;
  }): Promise<AuthContext>;
}
