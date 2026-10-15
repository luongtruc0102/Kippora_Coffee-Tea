export type StoreSettings = {
  id: number;
  isAcceptingOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: number;
  maxDeliveryDistanceKm: number;
  deliveryBaseDistanceKm: number;
  deliveryBaseFee: number;
  deliveryFeePerKm: number;
  deliveryDiscountFirstThreshold: number;
  deliveryDiscountFirstAmount: number;
  deliveryDiscountSecondThreshold: number;
  deliveryDiscountSecondAmount: number;
  pauseReason: string | null;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreStatus = {
  isOpen: boolean;
  isWithinOpeningHours: boolean;
  isAcceptingOrders: boolean;
  isSystemActive: boolean;
  isBranchAcceptingOrders: boolean;
  branch: {
    id: number;
    code: string;
    name: string;
    address: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  bankTransferAvailable: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: number;
  maxDeliveryDistanceKm: number;
  deliveryBaseDistanceKm: number;
  deliveryBaseFee: number;
  deliveryFeePerKm: number;
  deliveryDiscountFirstThreshold: number;
  deliveryDiscountFirstAmount: number;
  deliveryDiscountSecondThreshold: number;
  deliveryDiscountSecondAmount: number;
  unavailableReason: string | null;
  unavailableScope: "SYSTEM" | "BRANCH" | "HOURS" | "FULFILLMENT" | null;
  timeZone: string;
};

export type BranchStatus = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  openedAt: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
  bankTransferAvailable: boolean;
  pauseReason: string | null;
  createdAt: string;
  updatedAt: string;
  manager: {
    id: number;
    email: string;
    fullName: string | null;
    phone: string | null;
    isActive: boolean;
  } | null;
  staffCount: number;
  activeStaffCount: number;
};

export type CreateBranchInput = {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  openedAt?: string;
};

export type UpdateBranchInput = {
  name?: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openedAt?: string | null;
};

export type PublicStoreLocation = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  isOpen: boolean;
  isAcceptingOrders: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: number;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  bankTransferAvailable: boolean;
  unavailableReason: string | null;
  timeZone: string;
};

export type UpdateStoreSettingsInput = {
  isAcceptingOrders?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  openingTime?: string;
  closingTime?: string;
  preparationMinutes?: number;
  maxDeliveryDistanceKm?: number;
  deliveryBaseDistanceKm?: number;
  deliveryBaseFee?: number;
  deliveryFeePerKm?: number;
  deliveryDiscountFirstThreshold?: number;
  deliveryDiscountFirstAmount?: number;
  deliveryDiscountSecondThreshold?: number;
  deliveryDiscountSecondAmount?: number;
  pauseReason?: string | null;
};
