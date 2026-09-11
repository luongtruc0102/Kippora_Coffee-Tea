import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // Tìm Cart theo userId hoặc tự tạo một Cart rỗng cho user mới.
  private async getOrCreateCart(userId: number) {
    return this.prisma.cart.upsert({
      where: {
        userId,
      },
      update: {},
      create: {
        userId,
      },
    });
  }

  // Lấy giỏ đầy đủ, nạp product/variant/topping và tính lại mọi mức giá
  // từ database để client không thể tự sửa giá.
  async getCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);

    const cartWithItems = await this.prisma.cart.findUnique({
      where: {
        id: cart.id,
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cartWithItems) {
      throw new NotFoundException('Không tìm thấy giỏ hàng');
    }

    // Giá luôn được tính lại từ database, không tin giá do client gửi lên
    const items = cartWithItems.items.map((item) => {
      const variantPrice = Number(item.variant.price);

      const toppingPrice = item.toppings.reduce(
        (total, itemTopping) => total + Number(itemTopping.topping.price),
        0,
      );

      const unitPrice = variantPrice + toppingPrice;
      const lineTotal = unitPrice * item.quantity;

      return {
        ...item,
        unitPrice,
        lineTotal,
      };
    });

    const totalPrice = items.reduce((total, item) => total + item.lineTotal, 0);

    return {
      id: cartWithItems.id,
      userId: cartWithItems.userId,
      items,
      totalPrice,
      createdAt: cartWithItems.createdAt,
      updatedAt: cartWithItems.updatedAt,
    };
  }

  // Kiểm tra sản phẩm, size, topping rồi tăng dòng trùng cấu hình hoặc tạo
  // dòng mới; response luôn kèm addedItemId cho frontend chọn chính xác.
  async addItem(userId: number, addCartItemDto: AddCartItemDto) {
    const { productId, variantId, quantity, toppingIds = [] } = addCartItemDto;

    // Chỉ cho thêm sản phẩm đang hoạt động và thuộc category đang hoạt động
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        category: {
          isActive: true,
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        'Không tìm thấy sản phẩm hoặc sản phẩm đã bị khóa',
      );
    }

    // Variant phải đang hoạt động và thực sự thuộc sản phẩm được chọn
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
        isActive: true,
      },
    });

    if (!variant) {
      throw new BadRequestException(
        'Size không hợp lệ hoặc không thuộc sản phẩm này',
      );
    }

    if (toppingIds.length > 0) {
      // Chỉ chấp nhận topping đang hoạt động và đã được gắn với sản phẩm
      const validToppings = await this.prisma.topping.findMany({
        where: {
          id: {
            in: toppingIds,
          },
          isActive: true,
          products: {
            some: {
              productId,
            },
          },
        },
      });

      if (validToppings.length !== toppingIds.length) {
        throw new BadRequestException(
          'Có topping không hợp lệ hoặc không áp dụng cho sản phẩm này',
        );
      }
    }

    const cart = await this.getOrCreateCart(userId);

    // Tìm các CartItem cùng product + variant để kiểm tra topping có giống nhau không
    const existingItems = await this.prisma.cartItem.findMany({
      where: {
        cartId: cart.id,
        productId,
        variantId,
      },
      include: {
        toppings: true,
      },
    });

    const sortedToppingIds = [...toppingIds].sort((a, b) => a - b);

    const existingItem = existingItems.find((item) => {
      const existingToppingIds = item.toppings
        .map((topping) => topping.toppingId)
        .sort((a, b) => a - b);

      return (
        existingToppingIds.length === sortedToppingIds.length &&
        existingToppingIds.every((id, index) => id === sortedToppingIds[index])
      );
    });

    // Nếu cùng món + size + topping thì chỉ tăng số lượng
    if (existingItem) {
      const updatedItem = await this.prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: {
            increment: quantity,
          },
        },
      });

      const updatedCart = await this.getCart(userId);

      return {
        ...updatedCart,
        addedItemId: updatedItem.id,
      };
    }

    // Nếu cấu hình món khác thì tạo CartItem mới
    const createdItem = await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId,
        quantity,

        toppings: {
          create: toppingIds.map((toppingId) => ({
            toppingId,
          })),
        },
      },
    });

    const updatedCart = await this.getCart(userId);

    return {
      ...updatedCart,
      addedItemId: createdItem.id,
    };
  }

  // Đặt quantity mới cho một CartItem sau khi xác minh quyền sở hữu,
  // sau đó trả lại giỏ đã tính tổng tiền mới.
  async updateItem(
    userId: number,
    itemId: number,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    // Đảm bảo user chỉ sửa CartItem thuộc giỏ hàng của chính mình
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy món trong giỏ hàng');
    }

    await this.prisma.cartItem.update({
      where: {
        id: itemId,
      },
      data: {
        quantity: updateCartItemDto.quantity,
      },
    });

    return this.getCart(userId);
  }

  // Xóa một CartItem sau khi xác minh nó thuộc Cart của user hiện tại,
  // sau đó trả lại giỏ mới nhất.
  async removeItem(userId: number, itemId: number) {
    // Không cho user xóa CartItem của tài khoản khác
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Không tìm thấy món trong giỏ hàng');
    }

    // CartItemTopping sẽ tự xóa nhờ onDelete: Cascade
    await this.prisma.cartItem.delete({
      where: {
        id: itemId,
      },
    });

    return this.getCart(userId);
  }

  // Xóa mọi CartItem của user nhưng giữ Cart để tiếp tục tái sử dụng
  // và không làm thay đổi nghiệp vụ checkout.
  async clearCart(userId: number) {
    const cart = await this.getOrCreateCart(userId);

    // Xóa toàn bộ món nhưng vẫn giữ lại Cart của user
    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    return {
      message: 'Đã xóa toàn bộ giỏ hàng',
    };
  }
}
