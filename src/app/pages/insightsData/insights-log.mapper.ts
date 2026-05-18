import { TelemetryLogEntry } from '../../services/insights.service';

function pick<T>(row: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] != null) {
      return row[key] as T;
    }
  }
  return undefined;
}

export function normalizeTelemetryLogs(raw: unknown): TelemetryLogEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      timestamp: String(pick(row, 'timestamp', 'Timestamp') ?? ''),
      telemetryType: String(pick(row, 'telemetryType', 'TelemetryType') ?? ''),
      name: String(pick(row, 'name', 'Name') ?? ''),
      message: String(pick(row, 'message', 'Message') ?? ''),
      success: pick<boolean | null>(row, 'success', 'Success') ?? null,
      resultCode:
        pick<string | null>(row, 'resultCode', 'ResultCode') != null
          ? String(pick(row, 'resultCode', 'ResultCode'))
          : null,
      durationMs:
        Number(pick(row, 'durationMs', 'DurationMs', 'duration') ?? NaN) || null,
      operationId:
        pick<string | null>(row, 'operationId', 'OperationId', 'operation_Id') !=
        null
          ? String(pick(row, 'operationId', 'OperationId', 'operation_Id'))
          : null,
      url:
        pick<string | null>(row, 'url', 'Url') != null
          ? String(pick(row, 'url', 'Url'))
          : null,
    };
  });
}
