import { CatalogInvalidStateError, CatalogPermissionDeniedError } from '../../errors/catalog.error.js';
import { ProductsService } from '../services/products.service.js';

describe('ProductsService', () => {
  const repository = { findSellerId: vi.fn(), create: vi.fn(), findById: vi.fn(), list: vi.fn(), update: vi.fn(), categoryIsLeaf: vi.fn(), hasSku: vi.fn(), remove: vi.fn() };
  const service = new ProductsService(repository);
  const user = { id: 'user-id', firebaseUid: 'firebase-id', email: null, displayName: null, role: 'SELLER' as const };
  beforeEach(() => vi.clearAllMocks());
  it('does not publish without required catalog data', async () => {
    repository.findSellerId.mockResolvedValue('seller-id');
    await expect(service.create(user, { name: 'Keyboard', slug: 'keyboard', status: 'ACTIVE' })).rejects.toBeInstanceOf(CatalogInvalidStateError);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('derives seller scope from the authenticated user', async () => {
    repository.findSellerId.mockResolvedValue(null);
    await expect(service.listSeller(user, { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' })).rejects.toBeInstanceOf(CatalogPermissionDeniedError);
  });
});
