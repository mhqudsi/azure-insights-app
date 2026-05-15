import { EndpointDetails } from '../../services/insights.service';

/** Maps API rows (camelCase or PascalCase) into grid row shape. */
export function normalizeEndpointRows(
  raw: unknown,
): EndpointDetails[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      endpointName: String(row['endpointName'] ?? row['EndpointName'] ?? ''),
      totalRequests: Number(row['totalRequests'] ?? row['TotalRequests'] ?? 0),
      successRequests: Number(row['successRequests'] ?? row['SuccessRequests'] ?? 0),
      failedRequests: Number(row['failedRequests'] ?? row['FailedRequests'] ?? 0),
      averageDurationMs: Number(
        row['averageDurationMs'] ?? row['AverageDurationMs'] ?? 0,
      ),
      maxDurationMs: Number(row['maxDurationMs'] ?? row['MaxDurationMs'] ?? 0),
      lastCalled: String(row['lastCalled'] ?? row['LastCalled'] ?? ''),
    };
  });
}
