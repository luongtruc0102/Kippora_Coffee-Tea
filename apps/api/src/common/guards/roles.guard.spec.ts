import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function contextFor(role?: string): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { sub: 1, email: 'user@example.com', role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as never);

  beforeEach(() => jest.clearAllMocks());

  it('cho phép endpoint không yêu cầu role cụ thể', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('cho phép đúng role được khai báo', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(contextFor('ADMIN'))).toBe(true);
  });

  it('từ chối user truy cập chức năng Admin', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(contextFor('USER'))).toThrow(
      ForbiddenException,
    );
  });
});
