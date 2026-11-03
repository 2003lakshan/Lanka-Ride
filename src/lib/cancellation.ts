/**
 * Shared definitions, reasons, and validation logic for ride cancellation.
 */

export interface CancellationReasonOption {
  code: string;
  label: string;
  requiresExplanation?: boolean;
}

export const CANCELLATION_REASONS: CancellationReasonOption[] = [
  { code: "PLANS_CHANGED", label: "Plans changed." },
  { code: "WRONG_LOCATION", label: "Pickup/drop-off entered incorrectly." },
  { code: "DRIVER_DELAY", label: "Driver is taking too long." },
  { code: "CANNOT_CONTACT_DRIVER", label: "Unable to contact driver." },
  { code: "BOOKED_ANOTHER_RIDE", label: "Booked another ride." },
  { code: "OTHER", label: "Other.", requiresExplanation: true },
];

export const CANCELLABLE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
] as const;

export const NON_CANCELLABLE_STARTED_STATUSES = [
  "PASSENGER_PICKED_UP",
  "TRIP_IN_PROGRESS",
] as const;

export const NON_CANCELLABLE_FINISHED_STATUSES = [
  "COMPLETED",
  "REFUNDED",
] as const;

export function getCancellationReasonByCode(code: string): CancellationReasonOption | undefined {
  if (!code) return undefined;
  return CANCELLATION_REASONS.find(
    (r) => r.code.toUpperCase() === code.trim().toUpperCase()
  );
}

export function validateCancellationReason(
  code: string,
  comments?: string
): { isValid: boolean; error?: string; reasonOption?: CancellationReasonOption } {
  if (!code || typeof code !== "string" || !code.trim()) {
    return { isValid: false, error: "Please select a cancellation reason." };
  }

  const option = getCancellationReasonByCode(code);
  if (!option) {
    return {
      isValid: false,
      error: `Invalid cancellation reason code. Must be one of: ${CANCELLATION_REASONS.map((r) => r.code).join(", ")}`,
    };
  }

  if (option.requiresExplanation) {
    if (!comments || typeof comments !== "string" || comments.trim().length < 3) {
      return {
        isValid: false,
        error: "Please provide a short explanation for 'Other'.",
        reasonOption: option,
      };
    }
  }

  return { isValid: true, reasonOption: option };
}
