/**
 * Consistent date and time formatting utilities for Sri Lankan travel operations.
 * Enforces an explicit locale and Asia/Colombo timezone on both server and client
 * to prevent React hydration mismatches and prevent calendar day shifts across timezones.
 */

export const SRI_LANKA_TIMEZONE = "Asia/Colombo";
export const SRI_LANKA_LOCALE = "en-US";

/**
 * Parses a trip date, treating calendar dates (e.g. date-only strings or UTC midnight)
 * as calendar dates anchored at midday UTC so timezone conversion never shifts the day.
 */
export function parseSriLankanTripDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;

  if (typeof input === "string") {
    const trimmed = input.trim();
    // Match date-only strings like "YYYY-MM-DD" or UTC midnight ISO strings "YYYY-MM-DDT00:00:00...Z"
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00(?::00(?:\.000)?)?Z?)?$/);
    if (dateOnlyMatch) {
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10) - 1;
      const day = parseInt(dateOnlyMatch[3], 10);
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }

    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    // If stored as UTC midnight date-only representation
    if (input.getUTCHours() === 0 && input.getUTCMinutes() === 0 && input.getUTCSeconds() === 0) {
      return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12, 0, 0));
    }
    return input;
  }

  return null;
}

/**
 * Formats a trip date with explicit locale (en-US) and explicit timezone (Asia/Colombo).
 * Produces identical string output on server SSR and all client devices.
 */
export function formatSriLankanDate(
  dateInput: string | Date | null | undefined,
  fallback: string = "TBD",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseSriLankanTripDate(dateInput);
  if (!d) return fallback;

  return d.toLocaleDateString(SRI_LANKA_LOCALE, {
    timeZone: SRI_LANKA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...options,
  });
}

/**
 * Formats currency amounts with consistent explicit locale formatting.
 */
export function formatSriLankanLKR(amount: number | null | undefined, fallback: string = "N/A"): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return fallback;
  return `LKR ${Number(amount).toLocaleString(SRI_LANKA_LOCALE)}`;
}

/**
 * Formats general numeric values with consistent explicit locale.
 */
export function formatNumber(value: number | null | undefined, fallback: string = "0"): string {
  if (value === null || value === undefined || isNaN(Number(value))) return fallback;
  return Number(value).toLocaleString(SRI_LANKA_LOCALE);
}


/**
 * Formats completion or status timestamps with consistent explicit locale (en-US)
 * and explicit timezone (Asia/Colombo).
 * If date is missing (e.g. legacy completed bookings), returns "Completion time unavailable".
 */
export function formatSriLankanDateTime(
  dateInput: string | Date | null | undefined,
  fallback: string = "Completion time unavailable"
): string {
  if (!dateInput) return fallback;
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return fallback;

  return d.toLocaleString(SRI_LANKA_LOCALE, {
    timeZone: SRI_LANKA_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
