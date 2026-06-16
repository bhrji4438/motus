/**
 * Represents standard JSON-serializable primitive values.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Represents a standard JSON-serializable list.
 */
export type JsonArray = readonly JsonValue[];

/**
 * Represents a standard JSON-serializable map interface.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * Represents any valid JSON-serializable structure.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
