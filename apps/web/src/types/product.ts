export type Category = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;

  _count?: {
    products: number;
  };

  createdAt: string;
  updatedAt: string;
};
  
  export type ProductVariant = {
    id: number;
    size: string;
    price: number | string;
    isActive: boolean;
    productId: number;
    createdAt: string;
    updatedAt: string;
  };
  
  export type Topping = {
    id: number;
    name: string;
    price: number | string;
    imageUrl: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  
  export type ProductTopping = {
    productId: number;
    toppingId: number;
    topping: Topping;
  };
  
  export type Product = {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    imageUrl: string | null;
    isActive: boolean;
  
    categoryId: number;
    category: Category;
  
    toppings: ProductTopping[];
    variants: ProductVariant[];
  
    createdAt: string;
    updatedAt: string;
  };
  
  export type CreateProductInput = {
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    categoryId: number;
  };
  
  export type UpdateProductInput = {
    name?: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    categoryId?: number;
  };
  
  export type CreateProductVariantInput = {
    size: string;
    price: number;
  };
  
  export type UpdateProductVariantInput = {
    size?: string;
    price?: number;
  };
