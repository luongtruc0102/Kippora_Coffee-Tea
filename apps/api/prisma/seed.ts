import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Lấy chuỗi kết nối PostgreSQL từ file .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL không được định nghĩa');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Tạo 3 Role mặc định; nếu đã tồn tại thì không tạo trùng
  const roles = ['ADMIN', 'BRANCH_MANAGER', 'STAFF', 'USER'];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Seed roles thành công: ADMIN, BRANCH_MANAGER, STAFF, USER');

  const supplierDefinitions = [
    {
      code: 'NCC-CA-PHE',
      name: 'Công ty Cà phê Tây Nguyên',
      contactName: 'Nguyễn Minh Khang',
      phone: '0909123456',
      email: 'donhang@caphetaynguyen.vn',
      address: '18 Nguyễn Lương Bằng, Buôn Ma Thuột, Đắk Lắk',
      note: 'Giao hạt rang vào thứ Hai, Tư và Sáu.',
    },
    {
      code: 'NCC-SUA',
      name: 'Công ty Sữa Việt',
      contactName: 'Trần Thanh Hương',
      phone: '0908234567',
      email: 'kinhdoanh@suaviet.vn',
      address: '102 Nguyễn Văn Linh, Quận 7, Hồ Chí Minh',
      note: 'Sản phẩm sữa và kem cần được bảo quản lạnh khi giao.',
    },
    {
      code: 'NCC-TRA',
      name: 'Nông sản Trà Việt',
      contactName: 'Lê Quốc Bảo',
      phone: '0917345678',
      email: 'banhang@traviet.vn',
      address: '45 Trần Phú, Bảo Lộc, Lâm Đồng',
      note: 'Cung cấp cốt trà, syrup và đường pha chế.',
    },
    {
      code: 'NCC-PHA-CHE',
      name: 'Nguyên liệu Pha chế An Nhiên',
      contactName: 'Phạm Ngọc Anh',
      phone: '0936456789',
      email: 'cskh@annhienmix.vn',
      address: '76 Tân Kỳ Tân Quý, Tân Phú, Hồ Chí Minh',
      note: 'Giao topping, trái cây và vật tư pha chế trong ngày.',
    },
  ];

  const suppliers = new Map<string, { id: number; code: string }>();
  for (const definition of supplierDefinitions) {
    const supplier = await prisma.supplier.upsert({
      where: { code: definition.code },
      update: {},
      create: definition,
    });
    suppliers.set(supplier.code, supplier);
  }

  const ingredientDefinitions = [
    {
      key: 'COFFEE',
      name: 'Hạt cà phê rang',
      unit: 'GRAM' as const,
      minimum: 1000,
    },
    {
      key: 'CONDENSED_MILK',
      name: 'Sữa đặc',
      unit: 'MILLILITER' as const,
      minimum: 1500,
    },
    {
      key: 'FRESH_MILK',
      name: 'Sữa tươi',
      unit: 'MILLILITER' as const,
      minimum: 3000,
    },
    {
      key: 'PEACH_TEA',
      name: 'Nước cốt trà đào',
      unit: 'MILLILITER' as const,
      minimum: 2000,
    },
    {
      key: 'BLACK_TEA',
      name: 'Nước cốt trà đen',
      unit: 'MILLILITER' as const,
      minimum: 2000,
    },
    {
      key: 'PEACH_SYRUP',
      name: 'Syrup đào',
      unit: 'MILLILITER' as const,
      minimum: 800,
    },
    {
      key: 'SUGAR',
      name: 'Đường nước',
      unit: 'MILLILITER' as const,
      minimum: 1200,
    },
    { key: 'ORANGE', name: 'Cam vàng', unit: 'PIECE' as const, minimum: 15 },
    { key: 'LEMONGRASS', name: 'Sả cây', unit: 'PIECE' as const, minimum: 20 },
    {
      key: 'PEARL',
      name: 'Trân châu trắng',
      unit: 'GRAM' as const,
      minimum: 1200,
    },
    {
      key: 'CREAM',
      name: 'Kem tươi',
      unit: 'MILLILITER' as const,
      minimum: 800,
    },
    {
      key: 'WATER',
      name: 'Nước tinh khiết',
      unit: 'MILLILITER' as const,
      minimum: 5000,
    },
  ];

  const ingredients = new Map<
    string,
    { id: number; name: string; minimum: number }
  >();
  for (const definition of ingredientDefinitions) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: definition.name },
      update: {},
      create: { name: definition.name, unit: definition.unit },
    });
    ingredients.set(definition.key, {
      id: ingredient.id,
      name: ingredient.name,
      minimum: definition.minimum,
    });
  }

  const recipeByProduct = (productName: string) => {
    const name = productName.toLocaleLowerCase('vi-VN');
    if (name.includes('bạc sỉu')) {
      return [
        ['COFFEE', 12],
        ['CONDENSED_MILK', 25],
        ['FRESH_MILK', 80],
        ['WATER', 30],
      ] as const;
    }
    if (name.includes('espresso')) {
      return [
        ['COFFEE', 18],
        ['WATER', 35],
      ] as const;
    }
    if (name.includes('trà đào')) {
      return [
        ['PEACH_TEA', 120],
        ['PEACH_SYRUP', 20],
        ['SUGAR', 10],
        ['ORANGE', 0.5],
        ['LEMONGRASS', 1],
      ] as const;
    }
    if (name.includes('trà sữa')) {
      return [
        ['BLACK_TEA', 120],
        ['FRESH_MILK', 60],
        ['CONDENSED_MILK', 20],
        ['SUGAR', 10],
      ] as const;
    }
    if (name.includes('cà phê sữa')) {
      return [
        ['COFFEE', 18],
        ['CONDENSED_MILK', 25],
        ['FRESH_MILK', 30],
        ['WATER', 45],
      ] as const;
    }
    return [] as ReadonlyArray<readonly [string, number]>;
  };

  const sizeMultiplier = (size: string) => {
    const normalized = size.trim().toUpperCase();
    if (normalized === 'M') return 1.25;
    if (normalized === 'L') return 1.55;
    if (normalized === 'X' || normalized === 'XL') return 1.8;
    return 1;
  };

  const products = await prisma.product.findMany({
    include: { variants: true },
  });
  for (const product of products) {
    const baseRecipe = recipeByProduct(product.name);
    if (!baseRecipe.length) continue;
    for (const variant of product.variants) {
      const configured = await prisma.variantRecipeIngredient.count({
        where: { variantId: variant.id },
      });
      if (configured > 0) continue;
      const multiplier = sizeMultiplier(variant.size);
      await prisma.variantRecipeIngredient.createMany({
        data: baseRecipe.map(([key, quantity]) => ({
          variantId: variant.id,
          ingredientId: ingredients.get(key)!.id,
          quantity: Number((quantity * multiplier).toFixed(3)),
        })),
      });
    }
  }

  const toppings = await prisma.topping.findMany();
  for (const topping of toppings) {
    const name = topping.name.toLocaleLowerCase('vi-VN');
    const recipe: ReadonlyArray<readonly [string, number]> = name.includes(
      'kem',
    )
      ? ([['CREAM', 30]] as const)
      : name.includes('trân châu')
        ? ([['PEARL', 35]] as const)
        : [];
    if (!recipe.length) continue;
    const configured = await prisma.toppingRecipeIngredient.count({
      where: { toppingId: topping.id },
    });
    if (configured > 0) continue;
    await prisma.toppingRecipeIngredient.createMany({
      data: recipe.map(([key, quantity]) => ({
        toppingId: topping.id,
        ingredientId: ingredients.get(key)!.id,
        quantity,
      })),
    });
  }

  const receiptGroups = [
    {
      supplierCode: 'NCC-CA-PHE',
      items: [{ key: 'COFFEE', main: 8000, branch: 4000, unitCost: 320 }],
    },
    {
      supplierCode: 'NCC-SUA',
      items: [
        { key: 'CONDENSED_MILK', main: 12000, branch: 6000, unitCost: 65 },
        { key: 'FRESH_MILK', main: 30000, branch: 15000, unitCost: 42 },
        { key: 'CREAM', main: 8000, branch: 4000, unitCost: 115 },
      ],
    },
    {
      supplierCode: 'NCC-TRA',
      items: [
        { key: 'PEACH_TEA', main: 20000, branch: 10000, unitCost: 28 },
        { key: 'BLACK_TEA', main: 18000, branch: 9000, unitCost: 24 },
        { key: 'PEACH_SYRUP', main: 8000, branch: 4000, unitCost: 95 },
        { key: 'SUGAR', main: 10000, branch: 5000, unitCost: 22 },
      ],
    },
    {
      supplierCode: 'NCC-PHA-CHE',
      items: [
        { key: 'ORANGE', main: 120, branch: 60, unitCost: 9000 },
        { key: 'LEMONGRASS', main: 180, branch: 90, unitCost: 1800 },
        { key: 'PEARL', main: 12000, branch: 6000, unitCost: 75 },
        { key: 'WATER', main: 80000, branch: 40000, unitCost: 8 },
      ],
    },
  ];

  const creator = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' } },
    orderBy: { id: 'asc' },
  });
  const branches = await prisma.storeBranch.findMany({
    orderBy: { code: 'asc' },
  });

  const expenseDefinitions = [
    {
      suffix: '01',
      category: 'RENT',
      paymentMethod: 'BANK_TRANSFER',
      mainAmount: 18_000_000,
      branchAmount: 22_000_000,
      day: 1,
      description: 'Tiền thuê mặt bằng tháng 09/2026',
      note: 'Thanh toán theo hợp đồng thuê mặt bằng.',
      status: 'APPROVED',
    },
    {
      suffix: '02',
      category: 'UTILITIES',
      paymentMethod: 'BANK_TRANSFER',
      mainAmount: 3_250_000,
      branchAmount: 2_680_000,
      day: 3,
      description: 'Tiền điện, nước và Internet tháng 08/2026',
      note: 'Đã đối chiếu chỉ số điện, nước và hóa đơn dịch vụ.',
      status: 'APPROVED',
    },
    {
      suffix: '03',
      category: 'SUPPLIES',
      paymentMethod: 'CASH',
      mainAmount: 850_000,
      branchAmount: 690_000,
      day: 5,
      description: 'Mua ly giấy, ống hút và túi mang đi',
      note: 'Vật tư sử dụng trong tuần đầu tháng 9.',
      status: 'APPROVED',
    },
    {
      suffix: '04',
      category: 'MAINTENANCE',
      paymentMethod: 'BANK_TRANSFER',
      mainAmount: 1_450_000,
      branchAmount: 980_000,
      day: 7,
      description: 'Bảo dưỡng máy pha cà phê định kỳ',
      note: 'Chờ Admin đối chiếu phiếu bảo dưỡng.',
      status: 'PENDING',
    },
    {
      suffix: '05',
      category: 'TRANSPORT',
      paymentMethod: 'CASH',
      mainAmount: 480_000,
      branchAmount: 350_000,
      day: 8,
      description: 'Chi phí vận chuyển nguyên liệu',
      note: 'Đang bổ sung biên nhận giao hàng.',
      status: 'DRAFT',
    },
    {
      suffix: '06',
      category: 'MARKETING',
      paymentMethod: 'BANK_TRANSFER',
      mainAmount: 2_200_000,
      branchAmount: 1_800_000,
      day: 6,
      description: 'Chi phí quảng bá chương trình đầu tháng',
      note: 'Đề nghị thanh toán chiến dịch truyền thông tại chi nhánh.',
      status: 'REJECTED',
    },
  ] as const;

  if (creator) {
    for (const branch of branches) {
      const createdById = branch.managerId ?? creator.id;
      for (const definition of expenseDefinitions) {
        const code = `CP-202609-${branch.code}-${definition.suffix}`;
        const incurredOn = new Date(Date.UTC(2026, 8, definition.day));
        const submittedAt =
          definition.status === 'DRAFT'
            ? null
            : new Date(Date.UTC(2026, 8, definition.day, 3));
        const hasReview =
          definition.status === 'APPROVED' || definition.status === 'REJECTED';
        await prisma.branchExpense.upsert({
          where: { code },
          update: { paymentMethod: definition.paymentMethod },
          create: {
            code,
            branchId: branch.id,
            createdById,
            reviewedById: hasReview ? creator.id : null,
            category: definition.category,
            paymentMethod: definition.paymentMethod,
            amount:
              branch.code === 'MAIN'
                ? definition.mainAmount
                : definition.branchAmount,
            incurredOn,
            description: definition.description,
            note: definition.note,
            status: definition.status,
            submittedAt,
            reviewedAt: hasReview
              ? new Date(Date.UTC(2026, 8, definition.day, 4))
              : null,
            reviewNote:
              definition.status === 'APPROVED'
                ? 'Đã kiểm tra và đối chiếu chứng từ.'
                : definition.status === 'REJECTED'
                  ? 'Cần bổ sung hóa đơn hoặc biên nhận hợp lệ.'
                  : null,
            createdAt: new Date(Date.UTC(2026, 8, definition.day, 2)),
          },
        });
      }
    }
    console.log(
      `✅ Seed chi phí thành công: ${branches.length * expenseDefinitions.length} chứng từ mẫu trong database.`,
    );
  } else {
    console.warn('⚠️ Chưa có tài khoản ADMIN nên bỏ qua dữ liệu chi phí mẫu.');
  }

  const cashSessionDefinitions = [
    {
      day: 3,
      status: 'APPROVED',
      mainDifference: 0,
      branchDifference: 0,
      closingNote: 'Tiền mặt khớp với số liệu bán hàng trong ngày.',
    },
    {
      day: 4,
      status: 'OPEN',
      mainDifference: 0,
      branchDifference: 0,
      closingNote: null,
    },
    {
      day: 5,
      status: 'APPROVED',
      mainDifference: -20_000,
      branchDifference: 15_000,
      closingNote: 'Đã kiểm tra lại tiền mặt và lưu giải trình chênh lệch.',
    },
    {
      day: 7,
      status: 'PENDING_REVIEW',
      mainDifference: 10_000,
      branchDifference: -5_000,
      closingNote: 'Chênh lệch nhỏ, đã kiểm đếm lại và gửi Admin duyệt.',
    },
  ] as const;

  if (creator) {
    let createdCashSessions = 0;
    for (const branch of branches) {
      const openedById = branch.managerId ?? creator.id;
      const openingFloat = branch.code === 'MAIN' ? 1_000_000 : 750_000;

      for (const definition of cashSessionDefinitions) {
        const dateKey = `2026-09-${String(definition.day).padStart(2, '0')}`;
        const sessionBusinessDate = new Date(Date.UTC(2026, 8, definition.day));
        const existing = await prisma.cashSession.findUnique({
          where: {
            branchId_businessDate: {
              branchId: branch.id,
              businessDate: sessionBusinessDate,
            },
          },
        });
        if (existing) continue;

        const paymentStart = new Date(
          Date.UTC(2026, 8, definition.day - 1, 17),
        );
        const paymentEnd = new Date(paymentStart.getTime() + 86_400_000);
        const nextBusinessDate = new Date(
          sessionBusinessDate.getTime() + 86_400_000,
        );
        const [payments, refunds, cashExpenses] = await Promise.all([
          prisma.payment.groupBy({
            by: ['method'],
            where: {
              status: 'PAID',
              paidAt: { gte: paymentStart, lt: paymentEnd },
              order: { branchId: branch.id },
            },
            _sum: { amount: true },
          }),
          prisma.paymentRefund.groupBy({
            by: ['method'],
            where: {
              branchId: branch.id,
              processedAt: { gte: paymentStart, lt: paymentEnd },
            },
            _sum: { amount: true },
          }),
          prisma.branchExpense.aggregate({
            where: {
              branchId: branch.id,
              paymentMethod: 'CASH',
              status: 'APPROVED',
              incurredOn: {
                gte: sessionBusinessDate,
                lt: nextBusinessDate,
              },
            },
            _sum: { amount: true },
          }),
        ]);
        const cashSalesAmount = Number(
          payments.find((payment) => payment.method === 'COD')?._sum.amount ??
            0,
        );
        const bankSalesAmount = Number(
          payments.find((payment) => payment.method === 'BANK_TRANSFER')?._sum
            .amount ?? 0,
        );
        const cashExpenseAmount = Number(cashExpenses._sum.amount ?? 0);
        const cashRefundAmount = Number(
          refunds.find((refund) => refund.method === 'CASH')?._sum.amount ?? 0,
        );
        const bankRefundAmount = Number(
          refunds.find((refund) => refund.method === 'BANK_TRANSFER')?._sum
            .amount ?? 0,
        );
        const expectedCash =
          openingFloat + cashSalesAmount - cashExpenseAmount - cashRefundAmount;
        const difference =
          branch.code === 'MAIN'
            ? definition.mainDifference
            : definition.branchDifference;
        const openedAt = new Date(
          Date.UTC(2026, 8, definition.day - 1, 23, 15),
        );
        const closedAt = new Date(Date.UTC(2026, 8, definition.day, 15));
        const approvedAt = new Date(Date.UTC(2026, 8, definition.day, 15, 30));
        const isOpen = definition.status === 'OPEN';
        const isApproved = definition.status === 'APPROVED';

        await prisma.cashSession.create({
          data: {
            code: `Q-${dateKey.replaceAll('-', '')}-${branch.code}`,
            branchId: branch.id,
            businessDate: sessionBusinessDate,
            status: definition.status,
            openingFloat,
            openingNote: 'Quỹ tiền mặt đầu ngày theo định mức chi nhánh.',
            openedById,
            openedAt,
            cashSalesAmount,
            bankSalesAmount,
            cashExpenseAmount,
            cashRefundAmount,
            bankRefundAmount,
            expectedCash,
            actualCash: isOpen ? null : expectedCash + difference,
            difference: isOpen ? null : difference,
            closingNote: isOpen ? null : definition.closingNote,
            closedById: isOpen ? null : openedById,
            closedAt: isOpen ? null : closedAt,
            approvedById: isApproved ? creator.id : null,
            approvedAt: isApproved ? approvedAt : null,
            reviewNote: isApproved
              ? 'Admin đã đối chiếu doanh thu, chi phí và tiền kiểm đếm.'
              : null,
            events: {
              create: [
                {
                  actorId: openedById,
                  type: 'OPENED',
                  reason: 'Mở quỹ đầu ngày.',
                  afterData: { openingFloat, expectedCash },
                  createdAt: openedAt,
                },
                ...(!isOpen
                  ? [
                      {
                        actorId: openedById,
                        type: 'CLOSED' as const,
                        reason: definition.closingNote,
                        beforeData: { status: 'OPEN' },
                        afterData: {
                          cashSalesAmount,
                          bankSalesAmount,
                          cashExpenseAmount,
                          cashRefundAmount,
                          bankRefundAmount,
                          expectedCash,
                          actualCash: expectedCash + difference,
                          difference,
                        },
                        createdAt: closedAt,
                      },
                    ]
                  : []),
                ...(isApproved
                  ? [
                      {
                        actorId: creator.id,
                        type: 'APPROVED' as const,
                        reason: 'Số liệu đã được đối chiếu.',
                        beforeData: { status: 'PENDING_REVIEW' },
                        afterData: { status: 'APPROVED', difference },
                        createdAt: approvedAt,
                      },
                    ]
                  : []),
              ],
            },
          },
        });
        createdCashSessions += 1;
      }
    }
    console.log(
      `✅ Seed sổ quỹ thành công: thêm ${createdCashSessions} sổ dùng số liệu thu chi thực tế.`,
    );
  }

  if (creator) {
    for (const branch of branches) {
      for (const [groupIndex, group] of receiptGroups.entries()) {
        const code = `PN-MAU-${branch.code}-${String(groupIndex + 1).padStart(2, '0')}`;
        const exists = await prisma.stockReceipt.findUnique({
          where: { code },
        });
        if (exists) continue;
        const supplier = suppliers.get(group.supplierCode)!;
        const receivedAt = new Date(
          Date.UTC(2026, 7, 28 + groupIndex, 3 + groupIndex, 30),
        );
        const receiptItems = group.items.map((item) => {
          const ingredient = ingredients.get(item.key)!;
          const quantity = branch.code === 'MAIN' ? item.main : item.branch;
          return {
            ingredientId: ingredient.id,
            quantity,
            unitCost: item.unitCost,
            lineTotal: quantity * item.unitCost,
          };
        });
        const totalCost = receiptItems.reduce(
          (sum, item) => sum + item.lineTotal,
          0,
        );
        await prisma.$transaction(async (tx) => {
          const receipt = await tx.stockReceipt.create({
            data: {
              code,
              branchId: branch.id,
              supplierId: supplier.id,
              createdById: creator.id,
              status: 'COMPLETED',
              receivedAt,
              createdAt: receivedAt,
              note: 'Phiếu nhập dữ liệu mẫu ban đầu.',
              totalCost,
              items: { create: receiptItems },
            },
          });
          for (const item of receiptItems) {
            const definition = [...ingredients.values()].find(
              (ingredient) => ingredient.id === item.ingredientId,
            )!;
            const stock = await tx.inventoryStock.upsert({
              where: {
                branchId_ingredientId: {
                  branchId: branch.id,
                  ingredientId: item.ingredientId,
                },
              },
              create: {
                branchId: branch.id,
                ingredientId: item.ingredientId,
                quantity: item.quantity,
                minimumLevel:
                  branch.code === 'MAIN'
                    ? definition.minimum
                    : definition.minimum * 0.6,
              },
              update: {
                quantity: { increment: item.quantity },
                lowStockNotifiedAt: null,
              },
            });
            await tx.inventoryMovement.create({
              data: {
                branchId: branch.id,
                ingredientId: item.ingredientId,
                stockReceiptId: receipt.id,
                actorId: creator.id,
                type: 'RECEIVE',
                quantityDelta: item.quantity,
                reservedDelta: 0,
                quantityAfter: stock.quantity,
                reservedAfter: stock.reservedQuantity,
                note: `Nhập kho theo phiếu mẫu ${code}`,
                createdAt: receivedAt,
              },
            });
          }
        });
      }
    }
  } else {
    console.warn('⚠️ Chưa có tài khoản ADMIN nên bỏ qua các phiếu nhập mẫu.');
  }

  console.log(
    `✅ Seed kho thành công: ${suppliers.size} nhà cung cấp, ${ingredients.size} nguyên liệu, công thức và phiếu nhập mẫu.`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Seed database thất bại:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
