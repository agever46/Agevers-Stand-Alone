/**
 * Kinguin charges a 7.35% marketplace fee on top of the listed price.
 * This helper returns the actual cost we pay for a Kinguin product.
 */
export const KINGUIN_FEE_PCT = 0.0735;

export const kinguinBuyPrice = (rawPrice: number): number =>
  rawPrice * (1 + KINGUIN_FEE_PCT);
