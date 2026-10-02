// MT4 reports times in the broker's server clock. Most brokers run on "New York close"
// time: UTC+3 while the US is on daylight saving time and UTC+2 otherwise, so a single
// offset is wrong for half of any long history. When the observed offset is +2h or +3h
// we apply that rule per timestamp; any other offset is treated as fixed.
// Shared by the browser (statement import) and the mt4-ingest Edge Function.

const HOUR = 3600

// Nth Sunday of a month (UTC date), n = 1..5
function nthSunday(year, month, n) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay()
  return 1 + ((7 - first) % 7) + (n - 1) * 7
}

// US daylight saving time (rules since 2007): 2am local, second Sunday of March
// to first Sunday of November. Input and comparison in UTC seconds.
export function isUsDst(utcSeconds) {
  const year = new Date(utcSeconds * 1000).getUTCFullYear()
  const start = Date.UTC(year, 2, nthSunday(year, 2, 2), 7) / 1000 // 02:00 EST = 07:00 UTC
  const end = Date.UTC(year, 10, nthSunday(year, 10, 1), 6) / 1000 // 02:00 EDT = 06:00 UTC
  return utcSeconds >= start && utcSeconds < end
}

export const isNewYorkClose = (offsetMinutes) => offsetMinutes === 120 || offsetMinutes === 180

// Broker server seconds -> UTC seconds
export function serverToUtc(serverSeconds, offsetMinutes) {
  if (!isNewYorkClose(offsetMinutes)) return serverSeconds - offsetMinutes * 60
  const summer = serverSeconds - 3 * HOUR
  return isUsDst(summer) ? summer : serverSeconds - 2 * HOUR
}
