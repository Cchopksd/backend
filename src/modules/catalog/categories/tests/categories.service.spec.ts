import { CatalogConflictError } from '../../errors/catalog.error.js';
import { CategoriesService } from '../services/categories.service.js';
describe('CategoriesService', () => {
  const repository = { findById: vi.fn(), create: vi.fn(), list: vi.fn(), update: vi.fn(), hasChildrenOrProducts: vi.fn(), delete: vi.fn() };
  const service = new CategoriesService(repository);
  beforeEach(() => vi.clearAllMocks());
  it('does not delete a category that is still referenced', async () => {
    repository.findById.mockResolvedValue({ id: 'category', parentId: null, name: 'Name', slug: 'name', createdAt: new Date(), updatedAt: new Date() });
    repository.hasChildrenOrProducts.mockResolvedValue(true);
    await expect(service.remove('category')).rejects.toBeInstanceOf(CatalogConflictError);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
