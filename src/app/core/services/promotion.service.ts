import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { OrderItem, Product } from '../models/domain.models';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/server.config';

export type PromotionType = 'percentage_discount' | 'bundle_price';
export type PromotionScope = 'all' | 'category' | 'product';

export interface Promotion {
  id: string;
  name: string;
  active: boolean;
  type: PromotionType;
  scope: PromotionScope;
  productIds: number[];
  categoryIds: number[];
  categoryNames: string[];
  percentageOff?: number;
  bundleQuantity?: number;
  bundlePrice?: number;
  dayOfWeek: number[];
  startDate?: string;
  endDate?: string;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  discountTotal: number;
  affectedUnits: number;
}

export interface PromotionPricingResult {
  originalSubtotal: number;
  discountTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  pricedItems: OrderItem[];
  appliedPromotions: AppliedPromotion[];
}

type ExpandedOrderUnit = {
  sourceItem: OrderItem;
  product?: Product;
  unitPrice: number;
  locked: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private readonly storageKey = 'cafeteria-pos.promotions.v1';
  private readonly promotionsApi = buildApiUrl('promotions');
  private readonly promotionsSubject = new BehaviorSubject<Promotion[]>(this.loadPromotions());
  private loadPromise: Promise<Promotion[]> | null = null;

  readonly promotions$ = this.promotionsSubject.asObservable();

  constructor(private http: HttpClient) {
    void this.loadRemotePromotions().catch(() => undefined);
  }

  getPromotions(): Promotion[] {
    return this.promotionsSubject.value;
  }

  async savePromotion(promotion: Promotion): Promise<void> {
    const current = this.getPromotions();
    const index = current.findIndex(item => item.id === promotion.id);
    const next = [...current];
    if (index >= 0) {
      next[index] = this.normalizePromotion(promotion);
    } else {
      next.push(this.normalizePromotion(promotion));
    }
    const normalizedPromotion = this.normalizePromotion(promotion);
    this.persistPromotions(next);

    try {
      const saved = await firstValueFrom(this.http.put<Partial<Promotion>>(this.promotionsApi, normalizedPromotion));
      const merged = saved ? this.normalizePromotion(saved) : normalizedPromotion;
      const refreshed = this.getPromotions().map(item => item.id === merged.id ? merged : item);
      this.persistPromotions(refreshed);
    } catch {
      // Mantener cache local si el servidor no está disponible.
    }
  }

  async deletePromotion(id: string): Promise<void> {
    this.persistPromotions(this.getPromotions().filter(item => item.id !== id));
    try {
      await firstValueFrom(this.http.delete(`${this.promotionsApi}/${encodeURIComponent(id)}`));
    } catch {
      // Mantener cache local si el servidor no está disponible.
    }
  }

  createDraftPromotion(): Promotion {
    return {
      id: this.createPromotionId(),
      name: '',
      active: true,
      type: 'percentage_discount',
      scope: 'all',
      productIds: [],
      categoryIds: [],
      categoryNames: [],
      percentageOff: 10,
      bundleQuantity: 2,
      bundlePrice: 0,
      dayOfWeek: [],
      startDate: '',
      endDate: ''
    };
  }

  evaluateOrder(items: OrderItem[], products: Product[], now: Date = new Date()): PromotionPricingResult {
    const originalSubtotal = this.roundCurrency(items.reduce((sum, item) => sum + item.subtotal, 0));
    if (!items.length) {
      return {
        originalSubtotal,
        discountTotal: 0,
        subtotal: originalSubtotal,
        tax: 0,
        total: originalSubtotal,
        pricedItems: [],
        appliedPromotions: []
      };
    }

    const productMap = new Map<number, Product>();
    for (const product of products) {
      if (product.id != null) {
        productMap.set(product.id, product);
      }
    }

    const units = this.expandOrderItems(items, productMap);
    const appliedPromotions: AppliedPromotion[] = [];
    const promotions = this.getPromotions()
      .filter(promotion => this.isPromotionActive(promotion, now))
      .sort((left, right) => this.getPromotionPriority(left) - this.getPromotionPriority(right));

    for (const promotion of promotions) {
      if (promotion.type === 'bundle_price') {
        this.applyBundlePromotion(units, promotion, appliedPromotions);
        continue;
      }
      this.applyPercentagePromotion(units, promotion, appliedPromotions);
    }

    const pricedItems = this.collapseOrderUnits(units);
    const subtotal = this.roundCurrency(pricedItems.reduce((sum, item) => sum + item.subtotal, 0));
    const discountTotal = this.roundCurrency(originalSubtotal - subtotal);

    return {
      originalSubtotal,
      discountTotal,
      subtotal,
      tax: 0,
      total: subtotal,
      pricedItems,
      appliedPromotions
    };
  }

  async ensureLoaded(force: boolean = false): Promise<Promotion[]> {
    return this.loadRemotePromotions(force);
  }

  private loadPromotions(): Promotion[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(item => this.normalizePromotion(item));
    } catch {
      return [];
    }
  }

  private persistPromotions(promotions: Promotion[]): void {
    const normalized = promotions.map(item => this.normalizePromotion(item));
    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
    this.promotionsSubject.next(normalized);
  }

  private async loadRemotePromotions(force: boolean = false): Promise<Promotion[]> {
    if (!force && this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = firstValueFrom(this.http.get<Partial<Promotion>[]>(this.promotionsApi))
      .then(rows => {
        const normalized = Array.isArray(rows)
          ? rows.map(row => this.normalizePromotion(row))
          : [];
        this.persistPromotions(normalized);
        return normalized;
      })
      .catch(() => this.getPromotions())
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  private normalizePromotion(value: Partial<Promotion>): Promotion {
    return {
      id: typeof value.id === 'string' && value.id.trim() ? value.id : this.createPromotionId(),
      name: typeof value.name === 'string' ? value.name.trim() : '',
      active: value.active !== false,
      type: value.type === 'bundle_price' ? 'bundle_price' : 'percentage_discount',
      scope: value.scope === 'category' || value.scope === 'product' ? value.scope : 'all',
      productIds: this.normalizeNumberList(value.productIds),
      categoryIds: this.normalizeNumberList(value.categoryIds),
      categoryNames: this.normalizeStringList((value as Partial<Promotion>).categoryNames),
      percentageOff: this.toPositiveNumber(value.percentageOff),
      bundleQuantity: Math.max(2, Math.round(this.toPositiveNumber(value.bundleQuantity) || 2)),
      bundlePrice: this.toPositiveNumber(value.bundlePrice),
      dayOfWeek: this.normalizeNumberList(value.dayOfWeek).filter(day => day >= 0 && day <= 6),
      startDate: typeof value.startDate === 'string' ? value.startDate : '',
      endDate: typeof value.endDate === 'string' ? value.endDate : ''
    };
  }

  private normalizeNumberList(values: unknown): number[] {
    if (!Array.isArray(values)) return [];
    const out: number[] = [];
    for (const value of values) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) continue;
      if (!out.includes(parsed)) out.push(parsed);
    }
    return out;
  }

  private normalizeStringList(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const out: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const clean = value.trim();
      if (!clean) continue;
      if (!out.some(item => this.normalizeText(item) === this.normalizeText(clean))) {
        out.push(clean);
      }
    }
    return out;
  }

  private expandOrderItems(items: OrderItem[], productMap: Map<number, Product>): ExpandedOrderUnit[] {
    const units: ExpandedOrderUnit[] = [];
    for (const item of items) {
      if (!item || item.quantity <= 0) continue;
      const unitPrice = this.roundCurrency(item.price);
      for (let index = 0; index < item.quantity; index += 1) {
        units.push({
          sourceItem: item,
          product: productMap.get(item.productId),
          unitPrice,
          locked: false
        });
      }
    }
    return units;
  }

  private collapseOrderUnits(units: ExpandedOrderUnit[]): OrderItem[] {
    const grouped = new Map<string, OrderItem>();
    for (const unit of units) {
      const price = this.roundCurrency(unit.unitPrice);
      const key = `${unit.sourceItem.productId}::${unit.sourceItem.name}::${price.toFixed(2)}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.subtotal = this.roundCurrency(existing.quantity * existing.price);
        continue;
      }

      grouped.set(key, {
        productId: unit.sourceItem.productId,
        name: unit.sourceItem.name,
        price,
        quantity: 1,
        subtotal: price
      });
    }

    return Array.from(grouped.values());
  }

  private applyBundlePromotion(
    units: ExpandedOrderUnit[],
    promotion: Promotion,
    appliedPromotions: AppliedPromotion[]
  ): void {
    const bundleQuantity = Math.max(2, Math.round(this.toPositiveNumber(promotion.bundleQuantity) || 0));
    const bundlePrice = this.roundCurrency(this.toPositiveNumber(promotion.bundlePrice));
    if (!bundleQuantity || !Number.isFinite(bundlePrice) || bundlePrice <= 0) return;

    const eligibleUnits = units
      .filter(unit => !unit.locked && this.matchesPromotionScope(unit, promotion))
      .sort((left, right) => right.unitPrice - left.unitPrice);

    const bundleCount = Math.floor(eligibleUnits.length / bundleQuantity);
    if (bundleCount <= 0) return;

    let totalDiscount = 0;
    let affectedUnits = 0;
    for (let bundleIndex = 0; bundleIndex < bundleCount; bundleIndex += 1) {
      const bundleUnits = eligibleUnits.slice(bundleIndex * bundleQuantity, (bundleIndex + 1) * bundleQuantity);
      const regularTotal = this.roundCurrency(bundleUnits.reduce((sum, unit) => sum + unit.unitPrice, 0));
      const discount = this.roundCurrency(regularTotal - bundlePrice);
      if (discount <= 0) {
        continue;
      }

      const discounts = this.distributeDiscountAcrossUnits(bundleUnits.map(unit => unit.unitPrice), discount);
      discounts.forEach((discountAmount, index) => {
        bundleUnits[index].unitPrice = this.roundCurrency(bundleUnits[index].unitPrice - discountAmount);
        bundleUnits[index].locked = true;
      });
      totalDiscount += discount;
      affectedUnits += bundleUnits.length;
    }

    if (totalDiscount > 0) {
      appliedPromotions.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountTotal: this.roundCurrency(totalDiscount),
        affectedUnits
      });
    }
  }

  private applyPercentagePromotion(
    units: ExpandedOrderUnit[],
    promotion: Promotion,
    appliedPromotions: AppliedPromotion[]
  ): void {
    const percentageOff = Math.min(100, this.toPositiveNumber(promotion.percentageOff));
    if (!percentageOff) return;

    const eligibleUnits = units.filter(unit => !unit.locked && this.matchesPromotionScope(unit, promotion));
    if (!eligibleUnits.length) return;

    let totalDiscount = 0;
    for (const unit of eligibleUnits) {
      const discount = this.roundCurrency(unit.unitPrice * (percentageOff / 100));
      if (discount <= 0) continue;
      unit.unitPrice = this.roundCurrency(unit.unitPrice - discount);
      unit.locked = true;
      totalDiscount += discount;
    }

    if (totalDiscount > 0) {
      appliedPromotions.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountTotal: this.roundCurrency(totalDiscount),
        affectedUnits: eligibleUnits.length
      });
    }
  }

  private distributeDiscountAcrossUnits(prices: number[], totalDiscount: number): number[] {
    const safePrices = prices.map(price => this.roundCurrency(Math.max(0, price)));
    const totalPrice = this.roundCurrency(safePrices.reduce((sum, price) => sum + price, 0));
    if (totalDiscount <= 0 || totalPrice <= 0) {
      return safePrices.map(() => 0);
    }

    const discounts = safePrices.map((price, index) => {
      if (index === safePrices.length - 1) return 0;
      return this.roundCurrency((price / totalPrice) * totalDiscount);
    });

    const allocated = this.roundCurrency(discounts.reduce((sum, discount) => sum + discount, 0));
    discounts[discounts.length - 1] = this.roundCurrency(totalDiscount - allocated);

    return discounts.map((discount, index) => {
      const maxDiscount = safePrices[index];
      return this.roundCurrency(Math.min(maxDiscount, Math.max(0, discount)));
    });
  }

  private matchesPromotionScope(unit: ExpandedOrderUnit, promotion: Promotion): boolean {
    if (unit.sourceItem.productId <= 0) return false;
    if (promotion.scope === 'all') return true;
    if (promotion.scope === 'product') {
      return promotion.productIds.includes(unit.sourceItem.productId);
    }

    const categoryId = unit.product?.categoryId;
    if (categoryId != null && promotion.categoryIds.includes(categoryId)) {
      return true;
    }

    const unitCategoryName = this.normalizeText(unit.product?.category || '');
    if (!unitCategoryName) return false;

    return promotion.categoryNames.some(categoryName => this.normalizeText(categoryName) === unitCategoryName);
  }

  private isPromotionActive(promotion: Promotion, now: Date): boolean {
    if (!promotion.active || !promotion.name.trim()) return false;

    if (promotion.dayOfWeek.length > 0 && !promotion.dayOfWeek.includes(now.getDay())) {
      return false;
    }

    const nowKey = this.getDateKey(now);
    if (promotion.startDate && promotion.startDate > nowKey) {
      return false;
    }
    if (promotion.endDate && promotion.endDate < nowKey) {
      return false;
    }

    return true;
  }

  private getPromotionPriority(promotion: Promotion): number {
    return promotion.type === 'bundle_price' ? 0 : 1;
  }

  private getDateKey(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toPositiveNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private createPromotionId(): string {
    return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
