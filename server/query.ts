/** PostgreSQL QueryRunner returns [rows, affectedCount] for UPDATE/DELETE. */
export function queryRows<T = any>(result: any): T[] {
  return Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === "number"
    ? result[0]
    : result;
}
