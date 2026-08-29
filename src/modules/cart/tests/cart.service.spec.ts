import { CartQuantityLimitError, CartSkuUnavailableError } from '../errors/cart.error.js';
import { CartService } from '../services/cart.service.js';

describe('CartService', () => {
  const user = { id: 'user-id', firebaseUid: 'firebase-id', email: null, displayName: null, role: 'CUSTOMER' as const };
  const purchasableSku = { skuId: 'sku-id', skuActive: true, productActive: true, sellerActive: true, availableQuantity: 5 };
  const repository = { findSku: vi.fn(), addItem: vi.fn(), listItems: vi.fn(), findItem: vi.fn(), updateQuantity: vi.fn(), setItemSelection: vi.fn(), setAllSelection: vi.fn(), removeItem: vi.fn() };
  const service = new CartService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findSku.mockResolvedValue(purchasableSku);
    repository.addItem.mockResolvedValue(true);
    repository.listItems.mockResolvedValue([]);
  });

  it('adds a SKU only after checking its current availability and does not reserve inventory', async () => {
    await service.add(user, 'sku-id', 2);

    expect(repository.findSku).toHaveBeenCalledWith('sku-id');
    expect(repository.addItem).toHaveBeenCalledWith('user-id', 'sku-id', 2);
    expect(repository).not.toHaveProperty('reserve');
  });

  it('rejects quantities above current available stock', async () => {
    await expect(service.add(user, 'sku-id', 6)).rejects.toBeInstanceOf(CartQuantityLimitError);
    expect(repository.addItem).not.toHaveBeenCalled();
  });

  it('rejects inactive products and SKUs', async () => {
    repository.findSku.mockResolvedValue({ ...purchasableSku, productActive: false });
    await expect(service.add(user, 'sku-id', 1)).rejects.toBeInstanceOf(CartSkuUnavailableError);
  });

  it('revalidates an item before it can be selected', async () => {
    repository.findItem.mockResolvedValue({ skuId: 'sku-id', quantity: 2 });
    repository.setItemSelection.mockResolvedValue(true);
    await service.setItemSelection(user, 'item-id', true);

    expect(repository.findSku).toHaveBeenCalledWith('sku-id');
    expect(repository.setItemSelection).toHaveBeenCalledWith('user-id', 'item-id', true);
  });
});
