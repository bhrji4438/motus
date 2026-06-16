export class ContractVersionValidator {
  /**
   * Asserts event schema version compatibility against target version.
   * Format: major.minor.patch (e.g., 1.0.0).
   * Major version must match exactly.
   */
  public isCompatible(eventVersion: string, expectedVersion: string): boolean {
    const evParts = eventVersion.split(".");
    const exParts = expectedVersion.split(".");

    if (evParts.length !== 3 || exParts.length !== 3) {
      return false;
    }

    const evMajor = parseInt(evParts[0], 10);
    const exMajor = parseInt(exParts[0], 10);
    const evMinor = parseInt(evParts[1], 10);
    const exMinor = parseInt(exParts[1], 10);

    // Major version must be identical
    if (evMajor !== exMajor) {
      return false;
    }

    // Event minor version must be greater than or equal to expected version
    return evMinor >= exMinor;
  }
}
