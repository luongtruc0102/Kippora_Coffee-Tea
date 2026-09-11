export type Category = {
    id: number;
    name: string;
    description: string | null;
  };
  
  export type ProductVariant = {
    id: number;
    size: string;
    price: number | string;
    isActive: boolean;
  };
  
  export type Topping = {
    id: number;
    name: string;
    price: number | string;
    imageUrl: string | null;
    isActive: boolean;
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
  
    category: {
      id: number;
      name: string;
    };
  
    variants: ProductVariant[];
  
    toppings: ProductTopping[];
  };
