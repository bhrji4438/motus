/**
 * Metadata schema defining deprecation rules for API properties,
 * endpoints, commands, or events scheduled for removal.
 */
export interface DeprecationMetadata {
  /**
   * The date/time when deprecation was active (ISO 8601 UTC).
   */
  readonly deprecatedAt: string;
  /**
   * The targeted date/time when support will be physically deleted.
   */
  readonly sunsetAt: string;
  /**
   * Optional replacement code, property, or schema namespace name.
   */
  readonly alternativeContract?: string;
}

/**
 * A wrapper mapping a specific semantic or schema version identifier
 * to its corresponding payload contract.
 */
export interface VersionedPayload<TVersion extends string, TPayload> {
  readonly schemaVersion: TVersion;
  readonly payload: TPayload;
}
