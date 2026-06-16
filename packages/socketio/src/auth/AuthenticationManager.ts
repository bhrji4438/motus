import { TenantId } from '@motus/types';
import { IAuthenticator, AuthContext } from '@/auth/IAuthenticator.js';
import { MetricsManager } from '@/observability/MetricsManager.js';
import { createUnauthorizedError } from '@/errors/errors.js';

export class AuthenticationManager {
  constructor(
    private readonly authenticator: IAuthenticator,
    private readonly metrics: MetricsManager,
    private readonly enableStrictTenantCheck: boolean = true
  ) {}

  /**
   * Processes the socket connection handshake query/auth parameters.
   * Resolves authentication context or throws an error.
   */
  public async authenticateSocket(socket: any): Promise<AuthContext> {
    const tenantId = (socket.handshake.query.tenantId as TenantId) || socket.handshake.auth?.tenantId;
    if (!tenantId) {
      throw createUnauthorizedError('Handshake rejected: Missing tenantId.');
    }

    const credentials = {
      token: socket.handshake.auth?.token || socket.handshake.headers['authorization'],
      auth: socket.handshake.auth,
      headers: socket.handshake.headers,
      query: socket.handshake.query,
    };

    try {
      const authContext = await this.authenticator.authenticate(credentials);

      if (this.enableStrictTenantCheck && authContext.tenantId !== tenantId) {
        throw createUnauthorizedError('Handshake rejected: TenantId mismatch.');
      }

      return authContext;
    } catch (err) {
      this.metrics.metrics.recordSocketError(tenantId, 'AUTHENTICATION_FAILED');
      throw createUnauthorizedError((err as Error).message);
    }
  }
}
