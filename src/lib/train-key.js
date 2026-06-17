/**
 * @param {string} stopId
 * @param {{line: string, minutes: number, arrivalTime?: number, tripId?: string}} arrival
 * @param {number} [index]
 */
export function trainKey(stopId, arrival, index = 0) {
  return arrival.tripId || `${stopId}:${arrival.line}:${arrival.arrivalTime ?? arrival.minutes}:${index}`;
}
