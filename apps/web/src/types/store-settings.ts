export type StoreSettings = {
  id: number;
  isAcceptingOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: number;
  maxDeliveryDistanceKm: number;
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
  };
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: number;
  maxDeliveryDistanceKm: number;
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
  openedAt: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
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
  openedAt?: string;
};

export type UpdateBranchInput = {
  name?: string;
  address?: string | null;
  phone?: string | null;
  openedAt?: string | null;
};

export type UpdateStoreSettingsInput = {
  isAcceptingOrders?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  openingTime?: string;
  closingTime?: string;
  preparationMinutes?: number;
  maxDeliveryDistanceKm?: number;
  pauseReason?: string | null;
};
