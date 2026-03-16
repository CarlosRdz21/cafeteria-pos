export type DrinkBaseType = 'none' | 'milk' | 'water' | 'food';
export type ProductServiceTemperature = 'default' | 'cold-only';

export interface ProductVariantPricing {
  hot12OzExtra?: number;
  hot16OzExtra?: number;
  cold16OzExtra?: number;
  flatWhite8OzExtra?: number;
  espresso3OzExtra?: number;
  espressoDobleExtra?: number;
  espressoCortadoExtra?: number;
}

export interface Product {
  id?: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  categoryId?: number;
  available: boolean;
  stock?: number;
  variantPricing?: ProductVariantPricing;
  drinkBaseType?: DrinkBaseType;
  milkOptions?: string[];
  waterOptions?: string[];
  milkOptionExtras?: Record<string, number>;
  waterOptionExtras?: Record<string, number>;
  allowFlavorSelection?: boolean;
  flavorOptions?: string[];
  flavorOptionExtras?: Record<string, number>;
  serviceTemperature?: ProductServiceTemperature;
  removableIngredients?: string[];
  extraIngredients?: string[];
  extraIngredientPrices?: Record<string, number>;
}

export interface OrderItem {
  id?: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface AppliedPromotionSummary {
  promotionId: string;
  promotionName: string;
  discountTotal: number;
  affectedUnits: number;
}

export interface Order {
  id?: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountTotal?: number;
  appliedPromotions?: AppliedPromotionSummary[];
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  paymentMethod?: 'cash' | 'card';
  amountPaid?: number;
  change?: number;
  tableNumber?: string;
  customerName?: string;
  notes?: string | null;
}

export interface CashRegister {
  id?: number;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  cashSales: number;
  cardSales: number;
  expenses: number;
  totalTransactions: number;
  openedAt: Date;
  closedAt?: Date;
  status: 'open' | 'closed';
  userId: string;
}

export interface Expense {
  id?: number;
  description?: string;
  concept?: string;
  amount: number;
  category: string;
  timestamp: Date;
  userId?: number;
  userName?: string;
  notes?: string;
  cashRegisterId?: number;
}

export interface Supply {
  id?: number;
  name: string;
  category: string;
  categoryId?: number;
  unit: string;
  currentStock: number;
  unitCost?: number;
  minStock?: number;
  notes?: string;
  active: boolean;
  createdAt: Date;
}

export interface SupplyMovement {
  id?: number;
  supplyId: number;
  type: 'in' | 'out';
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  reason?: string;
  reference?: string;
  userId?: number;
  userName?: string;
  timestamp: Date;
  notes?: string;
}

export interface User {
  id?: number;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'barista' | 'mesero';
  active: boolean;
  createdAt: Date;
}

export interface ProductCategory {
  id?: number;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface SupplyCategory {
  id?: number;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface CleanDataIntegrityReport {
  missingProductCategoryIds: number[];
  missingSupplyCategoryIds: number[];
  productsWithoutCategoryId: number[];
  suppliesWithoutCategoryId: number[];
}

export interface CleanExportSnapshot {
  meta: {
    app: string;
    schemaVersion: number;
    generatedAt: string;
  };
  productCategories: Array<Omit<ProductCategory, 'createdAt'> & { id: number; createdAt: string }>;
  supplyCategories: Array<Omit<SupplyCategory, 'createdAt'> & { id: number; createdAt: string }>;
  products: Array<Omit<Product, 'id'> & { id: number; categoryName: string }>;
  supplies: Array<Omit<Supply, 'id' | 'createdAt'> & { id: number; createdAt: string; categoryName: string }>;
  orders: Array<Omit<Order, 'id'> & { id: number }>;
  cashRegisters: Array<Omit<CashRegister, 'id' | 'openedAt' | 'closedAt'> & { id: number; openedAt: string; closedAt?: string }>;
  expenses: Array<Omit<Expense, 'id' | 'timestamp'> & { id: number; timestamp: string }>;
  supplyMovements: Array<Omit<SupplyMovement, 'id' | 'timestamp'> & { id: number; timestamp: string }>;
  users: Array<Omit<User, 'id' | 'createdAt'> & { id: number; createdAt: string }>;
  integrity: CleanDataIntegrityReport;
}
