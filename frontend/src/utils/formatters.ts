/**
 * Indian Localization Utilities (Currency, Date, Financial Year & GST)
 */

/**
 * Formats a numeric value or string into Indian Rupee format (e.g., ₹1,25,000.00)
 */
export const formatINR = (amount: number | string | null | undefined, includeSymbol = true): string => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return includeSymbol ? '₹0.00' : '0.00';
  }

  const num = Number(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);

  return includeSymbol ? `₹${formatted}` : formatted;
};

/**
 * Formats a date string or Date object to Indian standard DD/MM/YYYY format
 */
export const formatDateIN = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

/**
 * Formats a date string or Date object to Indian standard DD/MM/YYYY, hh:mm A
 */
export const formatDateTimeIN = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year}, ${formattedHours}:${minutes} ${ampm}`;
  } catch {
    return '-';
  }
};

/**
 * Computes Indian Financial Year (1 April – 31 March), e.g. "FY 2026-27"
 */
export const getIndianFinancialYear = (date: Date = new Date()): string => {
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  if (month >= 3) {
    // April (3) onwards belongs to current year - next year
    const nextYear = String(year + 1).slice(-2);
    return `FY ${year}-${nextYear}`;
  } else {
    // Jan - March belongs to prev year - current year
    const currentYearShort = String(year).slice(-2);
    return `FY ${year - 1}-${currentYearShort}`;
  }
};
