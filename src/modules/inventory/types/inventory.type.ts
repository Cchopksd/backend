export type InventorySnapshot = {
  skuId: string;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  flashSaleAllocation: number;
  incomingQuantity: number;
  version: number;
};

export type StockChannel = 'STANDARD' | 'FLASH_SALE';

export type StockReference = {
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
};
