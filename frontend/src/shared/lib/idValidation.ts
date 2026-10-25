/**
 * Strict ID number validation rules based on Philippine ID types.
 */

export interface IdTypeRule {
  exactLength?: number;
  minLength?: number;
  maxLength?: number;
  numericOnly?: boolean;
  pattern?: RegExp;
  placeholder: string;
  hint: string;
  formatDescription: string;
}

export const ID_TYPE_RULES: Record<string, IdTypeRule> = {
  "PhilSys / National ID": {
    exactLength: 16,
    numericOnly: true,
    pattern: /^\d{16}$/,
    placeholder: "16-digit PhilSys Card Number",
    hint: "Must be exactly 16 numeric digits.",
    formatDescription: "16 digits (numeric only)",
  },
  "PhilHealth ID": {
    exactLength: 12,
    numericOnly: true,
    pattern: /^\d{12}$/,
    placeholder: "12-digit PhilHealth Number",
    hint: "Must be exactly 12 numeric digits.",
    formatDescription: "12 digits (numeric only)",
  },
  "SSS / GSIS / UMID": {
    minLength: 10,
    maxLength: 12,
    numericOnly: true,
    pattern: /^\d{10,12}$/,
    placeholder: "10 to 12-digit ID Number",
    hint: "Must be 10 to 12 numeric digits (SSS: 10, GSIS: 11, UMID: 12).",
    formatDescription: "10 to 12 digits (numeric only)",
  },
  "Driver's Licence": {
    exactLength: 11,
    pattern: /^[A-Za-z0-9]{11}$/,
    placeholder: "11-character Driver's Licence Number",
    hint: "Must be exactly 11 alphanumeric characters.",
    formatDescription: "11 alphanumeric characters",
  },
  "Passport": {
    exactLength: 9,
    pattern: /^[A-Za-z0-9]{9}$/,
    placeholder: "9-character Passport Number",
    hint: "Must be exactly 9 alphanumeric characters.",
    formatDescription: "9 alphanumeric characters",
  },
  "Voter's ID": {
    exactLength: 12,
    numericOnly: true,
    pattern: /^\d{12}$/,
    placeholder: "12-digit Voter's Identification Number",
    hint: "Must be exactly 12 numeric digits.",
    formatDescription: "12 digits (numeric only)",
  },
  "Postal ID": {
    exactLength: 16,
    pattern: /^[A-Za-z0-9]{16}$/,
    placeholder: "16-character Postal ID PRN",
    hint: "Must be exactly 16 characters.",
    formatDescription: "16 alphanumeric characters",
  },
};

export function validateIdNumber(idType: string, idNumber: string): { valid: boolean; error?: string } {
  const trimmed = idNumber.trim();
  if (!trimmed) {
    return { valid: true };
  }

  const rule = ID_TYPE_RULES[idType];
  if (!rule) {
    return { valid: true };
  }

  if (rule.numericOnly && !/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      error: `${idType} must contain only numbers.`,
    };
  }

  if (rule.exactLength !== undefined) {
    if (trimmed.length < rule.exactLength) {
      return {
        valid: false,
        error: `${idType} number is too short. Exactly ${rule.exactLength} ${rule.numericOnly ? "digits" : "characters"} are required (entered ${trimmed.length}).`,
      };
    }
    if (trimmed.length > rule.exactLength) {
      return {
        valid: false,
        error: `${idType} number is too long. Exactly ${rule.exactLength} ${rule.numericOnly ? "digits" : "characters"} are required (entered ${trimmed.length}).`,
      };
    }
  }

  if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
    return {
      valid: false,
      error: `${idType} number is too short. At least ${rule.minLength} ${rule.numericOnly ? "digits" : "characters"} are required.`,
    };
  }

  if (rule.maxLength !== undefined && trimmed.length > rule.maxLength) {
    return {
      valid: false,
      error: `${idType} number is too long. At most ${rule.maxLength} ${rule.numericOnly ? "digits" : "characters"} are allowed.`,
    };
  }

  if (rule.pattern && !rule.pattern.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid format for ${idType}. Expected format: ${rule.formatDescription}.`,
    };
  }

  return { valid: true };
}

