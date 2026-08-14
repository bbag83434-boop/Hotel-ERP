import { AppError } from '../utils/response.utils';

export type UnitCategory = 'WEIGHT' | 'VOLUME' | 'COUNT';

export interface ConversionFactor {
  symbol: string;
  category: UnitCategory;
  baseFactor: number; // Ratio against standard base unit (Gram for weight, ML for volume, Piece for count)
  aliases: string[];
}

export class UnitConversionService {
  // Deterministic conversion dictionary
  private static readonly UNIT_DICTIONARY: Record<string, ConversionFactor> = {
    // Weight Units (Base: Grams)
    kg: { symbol: 'kg', category: 'WEIGHT', baseFactor: 1000, aliases: ['kilogram', 'kgs', 'kilo'] },
    g: { symbol: 'g', category: 'WEIGHT', baseFactor: 1, aliases: ['gram', 'grams', 'gm', 'gms'] },
    mg: { symbol: 'mg', category: 'WEIGHT', baseFactor: 0.001, aliases: ['milligram', 'milligrams'] },
    quintal: { symbol: 'quintal', category: 'WEIGHT', baseFactor: 100000, aliases: ['qtl'] },
    ton: { symbol: 'ton', category: 'WEIGHT', baseFactor: 1000000, aliases: ['tonne', 'metric_ton'] },
    lb: { symbol: 'lb', category: 'WEIGHT', baseFactor: 453.59237, aliases: ['pound', 'lbs'] },
    oz: { symbol: 'oz', category: 'WEIGHT', baseFactor: 28.3495, aliases: ['ounce', 'ounces'] },

    // Volume Units (Base: Millilitres)
    l: { symbol: 'l', category: 'VOLUME', baseFactor: 1000, aliases: ['litre', 'liter', 'ltr', 'litres', 'liters'] },
    ml: { symbol: 'ml', category: 'VOLUME', baseFactor: 1, aliases: ['millilitre', 'milliliter', 'mls'] },
    cl: { symbol: 'cl', category: 'VOLUME', baseFactor: 10, aliases: ['centilitre', 'centiliter'] },
    gallon: { symbol: 'gallon', category: 'VOLUME', baseFactor: 3785.41, aliases: ['gal', 'gallons'] },
    fl_oz: { symbol: 'fl_oz', category: 'VOLUME', baseFactor: 29.5735, aliases: ['floz'] },

    // Count Units (Base: Pieces)
    pcs: { symbol: 'pcs', category: 'COUNT', baseFactor: 1, aliases: ['pc', 'piece', 'pieces', 'unit', 'units', 'nos'] },
    dozen: { symbol: 'dozen', category: 'COUNT', baseFactor: 12, aliases: ['doz', 'dz'] },
    half_dozen: { symbol: 'half_dozen', category: 'COUNT', baseFactor: 6, aliases: ['half-dozen'] },
    box: { symbol: 'box', category: 'COUNT', baseFactor: 1, aliases: ['boxes'] },
    pack: { symbol: 'pack', category: 'COUNT', baseFactor: 1, aliases: ['packet', 'packets', 'pkg'] },
    crate: { symbol: 'crate', category: 'COUNT', baseFactor: 1, aliases: ['crates'] }
  };

  /**
   * Normalize input unit string to standard canonical dictionary entry
   */
  private static findUnitEntry(inputUnit: string): ConversionFactor | null {
    const normalized = inputUnit.toLowerCase().trim().replace(/[\s.-]/g, '');

    // Direct key match
    if (this.UNIT_DICTIONARY[normalized]) {
      return this.UNIT_DICTIONARY[normalized];
    }

    // Alias search
    for (const key of Object.keys(this.UNIT_DICTIONARY)) {
      const entry = this.UNIT_DICTIONARY[key];
      if (entry.symbol.toLowerCase() === normalized || entry.aliases.includes(normalized)) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Deterministic conversion between two units.
   * Throws AppError if units belong to incompatible dimensions (e.g. converting KG to Litre without density).
   */
  public static convert(
    amount: number,
    fromUnit: string,
    toUnit: string,
    customPackFactor?: number
  ): {
    originalAmount: number;
    fromUnit: string;
    convertedAmount: number;
    toUnit: string;
    category: UnitCategory;
    conversionFormula: string;
  } {
    if (amount < 0) {
      throw new AppError('Quantity to convert must be greater than or equal to 0', 400);
    }

    const fromEntry = this.findUnitEntry(fromUnit);
    const toEntry = this.findUnitEntry(toUnit);

    if (!fromEntry) {
      throw new AppError(`Unknown or unsupported unit: "${fromUnit}"`, 400);
    }
    if (!toEntry) {
      throw new AppError(`Unknown or unsupported unit: "${toUnit}"`, 400);
    }

    if (fromEntry.category !== toEntry.category) {
      throw new AppError(
        `Cannot convert dimensionally incompatible units: "${fromUnit}" (${fromEntry.category}) to "${toUnit}" (${toEntry.category})`,
        400
      );
    }

    // Custom pack multiplier override if provided
    let fromFactor = fromEntry.baseFactor;
    let toFactor = toEntry.baseFactor;

    if (customPackFactor && customPackFactor > 0) {
      if (['box', 'pack', 'crate'].includes(fromEntry.symbol)) {
        fromFactor = customPackFactor;
      }
      if (['box', 'pack', 'crate'].includes(toEntry.symbol)) {
        toFactor = customPackFactor;
      }
    }

    // Base value calculation: amount * fromFactor = in standard base unit
    const baseValue = amount * fromFactor;
    // Target value calculation: baseValue / toFactor
    const convertedAmount = Number((baseValue / toFactor).toFixed(6));

    return {
      originalAmount: amount,
      fromUnit: fromEntry.symbol,
      convertedAmount,
      toUnit: toEntry.symbol,
      category: fromEntry.category,
      conversionFormula: `${amount} ${fromEntry.symbol} = ${convertedAmount} ${toEntry.symbol} (Base Factor Ratio: ${fromFactor / toFactor})`
    };
  }

  /**
   * Get complete dictionary of all supported units categorized
   */
  public static getSupportedUnits() {
    const list = Object.values(this.UNIT_DICTIONARY).map((u) => ({
      symbol: u.symbol,
      category: u.category,
      baseFactor: u.baseFactor,
      aliases: u.aliases
    }));

    return {
      weight: list.filter((u) => u.category === 'WEIGHT'),
      volume: list.filter((u) => u.category === 'VOLUME'),
      count: list.filter((u) => u.category === 'COUNT')
    };
  }
}
