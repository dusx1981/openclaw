import type {
  Platform,
  ProductStatus,
  ProductPriority,
  SalesPeriod,
  ProductData,
} from "../types.js";

export class Product {
  private _id?: number;
  private _platform: Platform;
  private _platformId: string;
  private _title: string;
  private _price: number;
  private _currency: string;
  private _sales: number;
  private _salesPeriod: SalesPeriod;
  private _status: ProductStatus;
  private _priority: ProductPriority;
  private _isTrending: boolean;
  private _mainImage?: string;
  private _images?: string[];
  private _sourceUrl: string;
  private _originalPrice?: number;
  private _salesUnit?: string;
  private _rating?: number;
  private _reviewsCount?: number;
  private _shopId?: string;
  private _shopName?: string;
  private _shopUrl?: string;
  private _categoryId?: string;
  private _categoryName?: string;
  private _categoryPath?: string[];
  private _merchantId?: string;
  private _tags?: string[];
  private _extraData?: Record<string, unknown>;
  private _firstSeenAt?: Date;
  private _lastSeenAt?: Date;
  private _priceUpdatedAt?: Date;
  private _salesUpdatedAt?: Date;

  private constructor(data: ProductData) {
    this._platform = data.platform;
    this._platformId = data.platformId;
    this._title = data.title;
    this._price = data.price;
    this._currency = data.currency;
    this._sales = data.sales;
    this._salesPeriod = data.salesPeriod;
    this._status = data.status;
    this._priority = data.priority;
    this._isTrending = data.isTrending;
    this._mainImage = data.mainImage;
    this._images = data.images;
    this._sourceUrl = data.sourceUrl;
    this._originalPrice = data.originalPrice;
    this._salesUnit = data.salesUnit;
    this._rating = data.rating;
    this._reviewsCount = data.reviewsCount;
    this._shopId = data.shopId;
    this._shopName = data.shopName;
    this._shopUrl = data.shopUrl;
    this._categoryId = data.categoryId;
    this._categoryName = data.categoryName;
    this._categoryPath = data.categoryPath;
    this._merchantId = data.merchantId;
    this._tags = data.tags;
    this._extraData = data.extraData;
  }

  static create(data: ProductData): Product {
    Product.validate(data);
    return new Product(data);
  }

  static validate(data: ProductData): void {
    if (!data.platform) {
      throw new Error("Platform is required");
    }
    if (!data.platformId || data.platformId.trim() === "") {
      throw new Error("Platform ID is required");
    }
    if (!data.title || data.title.trim() === "") {
      throw new Error("Title is required");
    }
    if (data.price < 0) {
      throw new Error("Price cannot be negative");
    }
    if (data.originalPrice !== undefined && data.originalPrice < 0) {
      throw new Error("Original price cannot be negative");
    }
    if (data.rating !== undefined && (data.rating < 0 || data.rating > 5)) {
      throw new Error("Rating must be between 0 and 5");
    }
  }

  get id(): number | undefined {
    return this._id;
  }

  get platform(): Platform {
    return this._platform;
  }

  get platformId(): string {
    return this._platformId;
  }

  get title(): string {
    return this._title;
  }

  get price(): number {
    return this._price;
  }

  get currency(): string {
    return this._currency;
  }

  get sales(): number {
    return this._sales;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get priority(): ProductPriority {
    return this._priority;
  }

  get isTrending(): boolean {
    return this._isTrending;
  }

  get sourceUrl(): string {
    return this._sourceUrl;
  }

  get extraData(): Record<string, unknown> | undefined {
    return this._extraData;
  }

  setId(id: number): Product {
    const product = new Product(this.toData());
    product._id = id;
    return product;
  }

  updatePrice(price: number, originalPrice?: number): Product {
    if (price < 0) {
      throw new Error("Price cannot be negative");
    }
    const data = this.toData();
    data.price = price;
    if (originalPrice !== undefined) {
      data.originalPrice = originalPrice;
    }
    const product = new Product(data);
    product._id = this._id;
    product._priceUpdatedAt = new Date();
    return product;
  }

  updateSales(sales: number, salesUnit?: string): Product {
    if (sales < 0) {
      throw new Error("Sales cannot be negative");
    }
    const data = this.toData();
    data.sales = sales;
    if (salesUnit) {
      data.salesUnit = salesUnit;
    }
    const product = new Product(data);
    product._id = this._id;
    product._salesUpdatedAt = new Date();
    return product;
  }

  markAsTrending(): Product {
    const data = this.toData();
    data.isTrending = true;
    data.priority = "P0";
    const product = new Product(data);
    product._id = this._id;
    return product;
  }

  markAsInactive(): Product {
    const data = this.toData();
    data.status = "inactive";
    const product = new Product(data);
    product._id = this._id;
    return product;
  }

  setPriority(priority: ProductPriority): Product {
    const data = this.toData();
    data.priority = priority;
    const product = new Product(data);
    product._id = this._id;
    return product;
  }

  toData(): ProductData {
    return {
      platform: this._platform,
      platformId: this._platformId,
      title: this._title,
      mainImage: this._mainImage,
      images: this._images,
      sourceUrl: this._sourceUrl,
      price: this._price,
      originalPrice: this._originalPrice,
      currency: this._currency,
      sales: this._sales,
      salesUnit: this._salesUnit,
      salesPeriod: this._salesPeriod,
      rating: this._rating,
      reviewsCount: this._reviewsCount,
      shopId: this._shopId,
      shopName: this._shopName,
      shopUrl: this._shopUrl,
      categoryId: this._categoryId,
      categoryName: this._categoryName,
      categoryPath: this._categoryPath,
      status: this._status,
      priority: this._priority,
      isTrending: this._isTrending,
      merchantId: this._merchantId,
      tags: this._tags,
      extraData: this._extraData,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      ...this.toData(),
      firstSeenAt: this._firstSeenAt,
      lastSeenAt: this._lastSeenAt,
      priceUpdatedAt: this._priceUpdatedAt,
      salesUpdatedAt: this._salesUpdatedAt,
    };
  }
}
