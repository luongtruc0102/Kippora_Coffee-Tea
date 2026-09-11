import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import * as argon2 from 'argon2';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateBranchStaffDto } from './dto/create-branch-staff.dto';
import { UpdateStaffAssignmentDto } from './dto/update-staff-assignment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { CHECK_IN_EARLY_MINUTES } from '../staff-schedules/staff-schedules.service';
import {
  completeAcceptedCoverageForShift,
  synchronizeBranchAttendances,
  synchronizeEmployeeAttendance,
} from '../staff-schedules/attendance-automation';
import {
  flattenPersonProfile,
  flattenUserProfiles,
  personProfileSelect,
  userProfileRelationsSelect,
} from '../common/user-profiles/user-profiles.util';

@Injectable()
export class UsersService {
  // Dùng PrismaService để thao tác với bảng User trong PostgreSQL
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuzzySearch: FuzzySearchService,
  ) {}

  private readonly staffSelect = {
    id: true,
    email: true,
    ...userProfileRelationsSelect,
    isActive: true,
    role: { select: { name: true } },
    createdAt: true,
    updatedAt: true,
  } as const;

  // Xác thực người gọi thật sự là trưởng được gán cho chi nhánh hiện tại.
  private async getManagedBranch(managerUserId: number) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: {
        isActive: true,
        staffProfile: { select: { branchId: true } },
        role: { select: { name: true } },
        managedBranch: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!manager || !manager.isActive) {
      throw new ForbiddenException('Tài khoản trưởng chi nhánh đã bị khóa');
    }

    if (
      manager.role.name !== 'BRANCH_MANAGER' ||
      !manager.managedBranch ||
      manager.staffProfile?.branchId !== manager.managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được phân công quản lý chi nhánh',
      );
    }

    if (!manager.managedBranch.isActive) {
      throw new ForbiddenException('Chi nhánh đang bị khóa');
    }

    return manager.managedBranch;
  }

  private async assertUniqueStaffIdentity(email: string, phone: string) {
    const [existingEmail, existingPhone] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.userProfile.findUnique({ where: { phone } }),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email đã được sử dụng');
    }

    if (existingPhone) {
      throw new ConflictException('Số điện thoại đã được sử dụng');
    }
  }

  private async getStaffRole() {
    const staffRole = await this.prisma.role.findUnique({
      where: { name: 'STAFF' },
    });

    if (!staffRole) {
      throw new InternalServerErrorException('Không tìm thấy Role STAFF');
    }

    return staffRole;
  }

  private readonly attendanceSelect = {
    id: true,
    employeeId: true,
    branchId: true,
    recordedById: true,
    scheduledShiftId: true,
    clockIn: true,
    clockOut: true,
    autoClockIn: true,
    autoClockOut: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    employee: {
      select: {
        id: true,
        email: true,
        ...personProfileSelect,
        isActive: true,
      },
    },
    scheduledShift: {
      select: {
        id: true,
        startAt: true,
        endAt: true,
      },
    },
  } as const;

  private getVietnamDayRange(reference = new Date()) {
    const vietnamOffsetMs = 7 * 60 * 60 * 1000;
    const vietnamTime = new Date(reference.getTime() + vietnamOffsetMs);
    const startUtcMs =
      Date.UTC(
        vietnamTime.getUTCFullYear(),
        vietnamTime.getUTCMonth(),
        vietnamTime.getUTCDate(),
      ) - vietnamOffsetMs;

    return {
      start: new Date(startUtcMs),
      end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
    };
  }

  private async getManagedStaff(managerUserId: number, staffUserId: number) {
    const branch = await this.getManagedBranch(managerUserId);
    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffUserId,
        staffProfile: { branchId: branch.id },
        role: { name: 'STAFF' },
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Không tìm thấy nhân viên trong chi nhánh');
    }

    return { branch, staff };
  }

  // Điểm danh được mở từ 5 phút trước giờ bắt đầu và đóng khi ca kết thúc.
  // Backend kiểm tra lại để không thể bỏ qua giới hạn bằng cách gọi API trực tiếp.
  private async getEligibleScheduledShift(
    employeeId: number,
    branchId: number,
    reference = new Date(),
  ) {
    const earlyLimit = new Date(
      reference.getTime() + CHECK_IN_EARLY_MINUTES * 60 * 1000,
    );
    const shift = await this.prisma.staffShift.findFirst({
      where: {
        employeeId,
        branchId,
        startAt: { lte: earlyLimit },
        endAt: { gt: reference },
        attendances: { none: {} },
        leaveRequests: {
          none: { status: 'APPROVED', scope: 'FULL_SHIFT' },
        },
      },
      select: { id: true, startAt: true, endAt: true },
      orderBy: { startAt: 'desc' },
    });

    if (shift) return shift;

    const nextShift = await this.prisma.staffShift.findFirst({
      where: {
        employeeId,
        branchId,
        startAt: { gt: earlyLimit },
        attendances: { none: {} },
        leaveRequests: {
          none: { status: 'APPROVED', scope: 'FULL_SHIFT' },
        },
      },
      select: { startAt: true },
      orderBy: { startAt: 'asc' },
    });

    if (nextShift) {
      const checkInOpensAt = new Date(
        nextShift.startAt.getTime() - CHECK_IN_EARLY_MINUTES * 60 * 1000,
      );
      const formatted = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }).format(checkInOpensAt);

      throw new BadRequestException(
        `Chỉ được điểm danh từ ${formatted}, trước ca ${CHECK_IN_EARLY_MINUTES} phút`,
      );
    }

    throw new BadRequestException('Nhân viên chưa được xếp ca làm sắp tới');
  }

  // Xác thực nhân viên thường đang hoạt động và đã được gắn vào một chi nhánh
  // còn hoạt động trước khi cho phép tự điểm danh.
  private async getSelfAttendanceStaff(staffUserId: number) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: {
        id: true,
        isActive: true,
        staffProfile: {
          select: {
            branchId: true,
            branch: { select: { id: true, isActive: true } },
          },
        },
        role: { select: { name: true } },
      },
    });

    if (!staff || staff.role.name !== 'STAFF') {
      throw new ForbiddenException('Chức năng này chỉ dành cho nhân viên');
    }

    if (!staff.isActive) {
      throw new ForbiddenException('Tài khoản nhân viên đang bị khóa');
    }

    if (!staff.staffProfile?.branchId || !staff.staffProfile.branch) {
      throw new BadRequestException('Nhân viên chưa được phân công chi nhánh');
    }

    if (!staff.staffProfile.branch.isActive) {
      throw new ForbiddenException('Chi nhánh đang bị khóa');
    }

    return { staffId: staff.id, branchId: staff.staffProfile.branch.id };
  }
  // Tìm tài khoản theo email, dùng khi đăng ký và đăng nhập

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        profile: true,
        customerProfile: true,
        staffProfile: { include: { branch: true } },
      },
    });

    return user ? flattenUserProfiles(user) : null;
  }

  // Tạo User mới và liên kết với Role tương ứng
  async create(
    email: string,
    password: string,
    fullName: string | undefined,
    roleId: number,
  ) {
    const user = await this.prisma.user.create({
      data: {
        email,
        password,
        roleId,
        profile: { create: { fullName } },
        customerProfile: { create: {} },
      },
      include: {
        role: true,
        profile: true,
        customerProfile: true,
        staffProfile: { include: { branch: true } },
      },
    });

    return flattenUserProfiles(user);
  }

  // Tìm User theo ID và lấy thông tin Role
  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        profile: true,
        customerProfile: true,
        staffProfile: { include: { branch: true } },
      },
    });

    return user ? flattenUserProfiles(user) : null;
  }

  // ADMIN tạo tài khoản nhân viên
  async createStaff(createStaffDto: CreateStaffDto) {
    const email = createStaffDto.email.trim().toLowerCase();

    const phone = createStaffDto.phone.trim();

    // Không cho trùng email
    const existingEmail = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Không cho trùng số điện thoại
    const existingPhone = await this.prisma.userProfile.findUnique({
      where: {
        phone,
      },
    });

    if (existingPhone) {
      throw new ConflictException('Số điện thoại đã được sử dụng');
    }

    // Staff chỉ được tạo với role STAFF
    const staffRole = await this.prisma.role.findUnique({
      where: {
        name: 'STAFF',
      },
    });

    if (!staffRole) {
      throw new InternalServerErrorException('Không tìm thấy Role STAFF');
    }

    // Không bao giờ lưu mật khẩu dạng plain text
    const hashedPassword = await argon2.hash(createStaffDto.password);

    // Không giả định chi nhánh MAIN luôn có id = 1.
    const branch = createStaffDto.branchId
      ? await this.prisma.storeBranch.findUnique({
          where: { id: createStaffDto.branchId },
        })
      : await this.prisma.storeBranch.findUnique({
          where: { code: 'MAIN' },
        });

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Chi nhánh không tồn tại hoặc đã bị khóa');
    }

    const staff = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roleId: staffRole.id,
        profile: {
          create: { fullName: createStaffDto.fullName.trim(), phone },
        },
        customerProfile: { create: {} },
        staffProfile: { create: { branchId: branch.id } },
      },
      select: this.staffSelect,
    });

    return flattenUserProfiles(staff);
  }

  // Trưởng chi nhánh xem danh sách nhân viên trong phạm vi được phân công.
  async findBranchStaff(managerUserId: number, query = '') {
    const branch = await this.getManagedBranch(managerUserId);
    const [staff, attendanceRecords] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          staffProfile: { branchId: branch.id },
          role: { name: 'STAFF' },
        },
        select: this.staffSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.staffAttendance.findMany({
        where: {
          branchId: branch.id,
          clockOut: { not: null },
        },
        select: {
          employeeId: true,
          clockIn: true,
          clockOut: true,
        },
      }),
    ]);

    // Cộng lịch sử các ca đã chốt; ca đang mở chưa được tính để tránh lưu số giờ tạm.
    const totalWorkedSeconds = new Map<number, number>();

    for (const attendance of attendanceRecords) {
      if (!attendance.clockOut) {
        continue;
      }

      const seconds = Math.max(
        0,
        Math.floor(
          (attendance.clockOut.getTime() - attendance.clockIn.getTime()) / 1000,
        ),
      );

      totalWorkedSeconds.set(
        attendance.employeeId,
        (totalWorkedSeconds.get(attendance.employeeId) ?? 0) + seconds,
      );
    }

    const staffWithWorkedTime = staff.map((employee) => ({
      ...flattenUserProfiles(employee),
      totalWorkedSeconds: totalWorkedSeconds.get(employee.id) ?? 0,
    }));

    return this.fuzzySearch.search(staffWithWorkedTime, query, {
      keys: [
        { name: 'fullName', weight: 0.4 },
        { name: 'email', weight: 0.3 },
        { name: 'phone', weight: 0.3 },
      ],
    });
  }

  // Trưởng chi nhánh tạo Staff và backend tự gắn đúng chi nhánh quản lý.
  async createBranchStaff(
    managerUserId: number,
    createBranchStaffDto: CreateBranchStaffDto,
  ) {
    const branch = await this.getManagedBranch(managerUserId);
    const email = createBranchStaffDto.email.trim().toLowerCase();
    const phone = createBranchStaffDto.phone.trim();

    await this.assertUniqueStaffIdentity(email, phone);

    const [staffRole, hashedPassword] = await Promise.all([
      this.getStaffRole(),
      argon2.hash(createBranchStaffDto.password),
    ]);

    const createdStaff = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roleId: staffRole.id,
        profile: {
          create: { fullName: createBranchStaffDto.fullName.trim(), phone },
        },
        customerProfile: { create: {} },
        staffProfile: { create: { branchId: branch.id } },
      },
      select: this.staffSelect,
    });

    return {
      ...flattenUserProfiles(createdStaff),
      totalWorkedSeconds: 0,
    };
  }

  // Lấy các ca bắt đầu trong ngày hiện tại theo múi giờ Việt Nam.
  async getTodayBranchAttendance(managerUserId: number) {
    const branch = await this.getManagedBranch(managerUserId);
    const { start, end } = this.getVietnamDayRange();
    await synchronizeBranchAttendances(this.prisma, branch.id);

    const attendances = await this.prisma.staffAttendance.findMany({
      where: {
        branchId: branch.id,
        clockIn: { gte: start, lt: end },
      },
      select: this.attendanceSelect,
      orderBy: { clockIn: 'desc' },
    });

    return attendances.map(({ employee, ...attendance }) => ({
      ...attendance,
      employee: flattenPersonProfile(employee),
    }));
  }

  // Nhân viên xem ca đang mở của chính mình để header hiện đúng trạng thái.
  async getMyOpenAttendance(staffUserId: number) {
    const staff = await this.getSelfAttendanceStaff(staffUserId);
    await synchronizeEmployeeAttendance(
      this.prisma,
      staff.staffId,
      staff.branchId,
    );

    const attendance = await this.prisma.staffAttendance.findUnique({
      where: { openKey: `employee:${staff.staffId}` },
      select: this.attendanceSelect,
    });

    if (!attendance) return null;
    return {
      ...attendance,
      employee: flattenPersonProfile(attendance.employee),
    };
  }

  // Nhân viên tự bắt đầu ca; trưởng chi nhánh vẫn là người kết thúc ca.
  async checkInMyAttendance(staffUserId: number) {
    const staff = await this.getSelfAttendanceStaff(staffUserId);
    const openKey = `employee:${staff.staffId}`;
    await synchronizeEmployeeAttendance(
      this.prisma,
      staff.staffId,
      staff.branchId,
    );
    const openAttendance = await this.prisma.staffAttendance.findUnique({
      where: { openKey },
      select: { id: true },
    });

    if (openAttendance) {
      throw new ConflictException('Bạn đang có một ca làm chưa kết thúc');
    }

    const scheduledShift = await this.getEligibleScheduledShift(
      staff.staffId,
      staff.branchId,
    );

    const clockInAt = new Date();
    await completeAcceptedCoverageForShift(
      this.prisma,
      scheduledShift.id,
      clockInAt,
    );

    const attendance = await this.prisma.staffAttendance.create({
      data: {
        employeeId: staff.staffId,
        branchId: staff.branchId,
        recordedById: staff.staffId,
        scheduledShiftId: scheduledShift.id,
        clockIn: clockInAt,
        openKey,
      },
      select: this.attendanceSelect,
    });

    return {
      ...attendance,
      employee: flattenPersonProfile(attendance.employee),
    };
  }

  // Mỗi nhân viên chỉ được có một ca chưa kết thúc tại một thời điểm.
  async checkInBranchStaff(managerUserId: number, staffUserId: number) {
    const { branch, staff } = await this.getManagedStaff(
      managerUserId,
      staffUserId,
    );

    if (!staff.isActive) {
      throw new BadRequestException('Tài khoản nhân viên đang bị khóa');
    }

    await synchronizeEmployeeAttendance(this.prisma, staff.id, branch.id);

    const openAttendance = await this.prisma.staffAttendance.findUnique({
      where: { openKey: `employee:${staff.id}` },
      select: { id: true },
    });

    if (openAttendance) {
      throw new ConflictException('Nhân viên đang có một ca làm chưa kết thúc');
    }

    const scheduledShift = await this.getEligibleScheduledShift(
      staff.id,
      branch.id,
    );

    const clockInAt = new Date();
    await completeAcceptedCoverageForShift(
      this.prisma,
      scheduledShift.id,
      clockInAt,
    );

    const attendance = await this.prisma.staffAttendance.create({
      data: {
        employeeId: staff.id,
        branchId: branch.id,
        recordedById: managerUserId,
        scheduledShiftId: scheduledShift.id,
        clockIn: clockInAt,
        openKey: `employee:${staff.id}`,
      },
      select: this.attendanceSelect,
    });

    return {
      ...attendance,
      employee: flattenPersonProfile(attendance.employee),
    };
  }

  async checkOutBranchStaff(managerUserId: number, staffUserId: number) {
    const { branch, staff } = await this.getManagedStaff(
      managerUserId,
      staffUserId,
    );
    await synchronizeEmployeeAttendance(this.prisma, staff.id, branch.id);
    const openAttendance = await this.prisma.staffAttendance.findUnique({
      where: { openKey: `employee:${staff.id}` },
      select: { id: true, branchId: true },
    });

    if (!openAttendance || openAttendance.branchId !== branch.id) {
      throw new BadRequestException('Nhân viên chưa bắt đầu ca làm');
    }

    const attendance = await this.prisma.staffAttendance.update({
      where: { id: openAttendance.id },
      data: {
        clockOut: new Date(),
        autoClockOut: false,
        openKey: null,
      },
      select: this.attendanceSelect,
    });

    return {
      ...attendance,
      employee: flattenPersonProfile(attendance.employee),
    };
  }
  // Không cho trưởng chi nhánh tác động manager, admin hoặc Staff chi nhánh khác.

  async updateBranchStaffStatus(
    managerUserId: number,
    staffUserId: number,
    isActive: boolean,
  ) {
    const branch = await this.getManagedBranch(managerUserId);
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: {
        id: true,
        staffProfile: { select: { branchId: true } },
        role: { select: { name: true } },
      },
    });

    if (!staff) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    if (
      staff.staffProfile?.branchId !== branch.id ||
      staff.role.name !== 'STAFF'
    ) {
      throw new ForbiddenException(
        'Không thể quản lý tài khoản ngoài chi nhánh của bạn',
      );
    }

    // Phải chốt ca trước khi khóa tài khoản để dữ liệu công không bị treo.
    if (!isActive) {
      const openAttendance = await this.prisma.staffAttendance.findUnique({
        where: { openKey: `employee:${staff.id}` },
        select: { id: true },
      });

      if (openAttendance) {
        throw new BadRequestException(
          'Cần kết thúc ca làm trước khi khóa nhân viên',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: staffUserId },
      data: { isActive },
      select: this.staffSelect,
    });

    return flattenUserProfiles(updated);
  }

  // Admin đổi vai trò và chi nhánh trong một transaction để quan hệ trưởng luôn đồng bộ.
  async updateStaffAssignment(
    staffUserId: number,
    assignment: UpdateStaffAssignmentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const [user, targetBranch, staffRole, managerRole, openAttendance] =
        await Promise.all([
          tx.user.findUnique({
            where: { id: staffUserId },
            select: {
              id: true,
              isActive: true,
              staffProfile: { select: { branchId: true } },
              role: { select: { name: true } },
              managedBranch: { select: { id: true } },
            },
          }),
          tx.storeBranch.findUnique({
            where: { id: assignment.branchId },
            select: { id: true, isActive: true, managerId: true },
          }),
          tx.role.findUnique({ where: { name: 'STAFF' } }),
          tx.role.findUnique({ where: { name: 'BRANCH_MANAGER' } }),
          tx.staffAttendance.findUnique({
            where: { openKey: `employee:${staffUserId}` },
            select: { id: true },
          }),
        ]);

      if (!user) {
        throw new NotFoundException('Không tìm thấy nhân viên');
      }

      if (user.role.name !== 'STAFF' && user.role.name !== 'BRANCH_MANAGER') {
        throw new BadRequestException(
          'Chỉ có thể phân công tài khoản nhân viên',
        );
      }

      if (!targetBranch || !targetBranch.isActive) {
        throw new BadRequestException(
          'Chi nhánh không tồn tại hoặc đang bị khóa',
        );
      }

      if (!staffRole || !managerRole) {
        throw new NotFoundException('Thiếu Role STAFF hoặc BRANCH_MANAGER');
      }

      if (
        user.staffProfile?.branchId !== assignment.branchId &&
        openAttendance
      ) {
        throw new BadRequestException(
          'Cần kết thúc ca làm trước khi chuyển chi nhánh',
        );
      }

      if (assignment.role === 'BRANCH_MANAGER' && !user.isActive) {
        throw new BadRequestException(
          'Không thể giao quyền trưởng cho tài khoản đã bị khóa',
        );
      }

      // Nếu đang quản lý chi nhánh cũ, gỡ quan hệ trước khi chuyển hoặc hạ vai trò.
      if (user.managedBranch) {
        await tx.storeBranch.update({
          where: { id: user.managedBranch.id },
          data: { managerId: null },
        });
      }

      if (
        assignment.role === 'BRANCH_MANAGER' &&
        targetBranch.managerId &&
        targetBranch.managerId !== user.id
      ) {
        // Chi nhánh chỉ có một trưởng; trưởng cũ trở về STAFF nhưng vẫn thuộc chi nhánh.
        await tx.user.update({
          where: { id: targetBranch.managerId },
          data: { roleId: staffRole.id },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          roleId:
            assignment.role === 'BRANCH_MANAGER'
              ? managerRole.id
              : staffRole.id,
          staffProfile: {
            upsert: {
              create: { branchId: assignment.branchId },
              update: { branchId: assignment.branchId },
            },
          },
        },
        select: this.staffSelect,
      });

      if (assignment.role === 'BRANCH_MANAGER') {
        await tx.storeBranch.update({
          where: { id: assignment.branchId },
          data: { managerId: user.id },
        });
      }

      return flattenUserProfiles(updatedUser);
    });
  }
  // Lấy danh sách tất cả User trong hệ thống
  async findAll(query = '') {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        ...userProfileRelationsSelect,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        // Chỉ lấy tên Role của User
        role: {
          select: {
            name: true,
          },
        },

        orders: {
          where: { status: 'COMPLETED' },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },

      // User mới nhất hiển thị trước
      orderBy: {
        createdAt: 'desc',
      },
    });

    const usersWithActivity = users.map(({ orders, ...user }) => ({
      ...flattenUserProfiles(user),
      lastPurchaseAt: orders[0]?.createdAt ?? null,
    }));

    return this.fuzzySearch.search(usersWithActivity, query, {
      keys: [
        {
          name: 'id',
          weight: 0.05,
          getFn: (user) => String(user.id),
        },
        { name: 'fullName', weight: 0.3 },
        { name: 'email', weight: 0.25 },
        { name: 'phone', weight: 0.2 },
        { name: 'address', weight: 0.1 },
        { name: 'role.name', weight: 0.1 },
      ],
    });
  }

  // ADMIN xem chi tiết một tài khoản
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },

      select: {
        id: true,
        email: true,
        ...userProfileRelationsSelect,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    let totalWorkedSeconds: number | undefined;
    if (user.role.name === 'STAFF' || user.role.name === 'BRANCH_MANAGER') {
      // Chi tiết nhân viên giữ toàn bộ lịch sử, kể cả ca ở chi nhánh cũ.
      // Chỉ cộng ca đã kết thúc, giống cách tính tổng trên bảng chấm công.
      const completedAttendances = await this.prisma.staffAttendance.findMany({
        where: { employeeId: id, clockOut: { not: null } },
        select: { clockIn: true, clockOut: true },
      });
      totalWorkedSeconds = completedAttendances.reduce((total, attendance) => {
        if (!attendance.clockOut) return total;
        return (
          total +
          Math.max(
            0,
            Math.floor(
              (attendance.clockOut.getTime() - attendance.clockIn.getTime()) /
                1000,
            ),
          )
        );
      }, 0);
    }

    const completedOrders = await this.prisma.order.findMany({
      where: {
        userId: id,
        status: 'COMPLETED',
      },

      select: {
        id: true,
        totalPrice: true,
        status: true,
        createdAt: true,

        payment: {
          select: {
            method: true,
            status: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalSpent = completedOrders.reduce(
      (total, order) => total + Number(order.totalPrice),
      0,
    );

    const recentOrders = await this.prisma.order.findMany({
      where: {
        userId: id,
      },

      select: {
        id: true,
        totalPrice: true,
        status: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 5,
    });

    return {
      ...flattenUserProfiles(user),

      ...(totalWorkedSeconds !== undefined ? { totalWorkedSeconds } : {}),

      purchaseSummary: {
        totalOrders: completedOrders.length,

        totalSpent,

        lastPurchaseAt: completedOrders[0]?.createdAt ?? null,
      },

      recentOrders,
    };
  }

  // ADMIN thay đổi Role của một User
  async updateRole(id: number, roleName: string) {
    // Kiểm tra User có tồn tại hay không
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Tìm Role tương ứng trong database
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException('Không tìm thấy Role');
    }

    // Cập nhật roleId của User
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        roleId: role.id,
        ...(roleName === 'STAFF' || roleName === 'BRANCH_MANAGER'
          ? { staffProfile: { upsert: { create: {}, update: {} } } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        profile: { select: { fullName: true } },
        role: {
          select: {
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.profile?.fullName ?? null,
      role: updated.role,
      updatedAt: updated.updatedAt,
    };
  }

  // ADMIN khóa hoặc mở khóa tài khoản User
  async updateStatus(id: number, isActive: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive,
      },
      select: {
        id: true,
        email: true,
        profile: { select: { fullName: true } },
        isActive: true,
        role: {
          select: {
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.profile?.fullName ?? null,
      isActive: updated.isActive,
      role: updated.role,
      updatedAt: updated.updatedAt,
    };
  }
}
