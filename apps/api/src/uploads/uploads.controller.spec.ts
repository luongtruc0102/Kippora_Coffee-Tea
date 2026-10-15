import { NotFoundException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

describe('UploadsController private leave evidence', () => {
  type LeaveReference = {
    employeeId: number;
    branch: { managerId: number | null };
  };
  const prisma = {
    staffLeaveRequest: {
      findFirst: jest.fn<(input: unknown) => Promise<LeaveReference | null>>(),
    },
  };
  const controller = new UploadsController(prisma as never);
  const response = { setHeader: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.staffLeaveRequest.findFirst.mockResolvedValue({
      employeeId: 7,
      branch: { managerId: 11 },
    });
  });

  it('không cho nhân viên xem minh chứng của người khác', async () => {
    await expect(
      controller.viewLeaveEvidence(
        { user: { sub: 8, role: 'STAFF' } } as never,
        '1788646311576-853220591.png',
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không cho trưởng chi nhánh khác xem minh chứng', async () => {
    await expect(
      controller.viewLeaveEvidence(
        { user: { sub: 12, role: 'BRANCH_MANAGER' } } as never,
        '1788646311576-853220591.png',
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('chặn tên file có dấu hiệu đi ra ngoài thư mục', async () => {
    await expect(
      controller.viewLeaveEvidence(
        { user: { sub: 1, role: 'ADMIN' } } as never,
        '../schema.prisma',
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.staffLeaveRequest.findFirst).not.toHaveBeenCalled();
  });
});
