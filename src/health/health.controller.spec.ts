import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: { getReadiness: vi.fn() } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports liveness without requiring infrastructure', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
  });
});
