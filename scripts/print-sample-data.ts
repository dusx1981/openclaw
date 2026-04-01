#!/usr/bin/env bun
/**
 * 打印各平台商品数据样本
 * 
 * 用法: bun scripts/print-sample-data.ts
 */

interface ProductSample {
  platform: string;
  platformId: string;
  title: string;
  mainImage?: string;
  images?: string[];
  sourceUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sales: number;
  salesUnit?: string;
  salesPeriod: string;
  rating?: number;
  reviewsCount?: number;
  shopId?: string;
  shopName?: string;
  shopUrl?: string;
  categoryId?: string;
  categoryName?: string;
  categoryPath?: string[];
  status: string;
  priority: string;
  isTrending: boolean;
  merchantId?: string;
  tags?: string[];
  extraData?: Record<string, unknown>;
}

const samples: Record<string, ProductSample[]> = {
  taobao: [
    {
      platform: "taobao",
      platformId: "607420172123",
      title: "2024夏季新款法式复古连衣裙女气质显瘦中长款裙子",
      mainImage: "https://img.alicdn.com/imgextra/i4/2200724907121/O1CN01FHgMXG1DU9xQzJfRz_!!2200724907121.jpg",
      images: [
        "https://img.alicdn.com/imgextra/i4/2200724907121/O1CN01FHgMXG1DU9xQzJfRz_!!2200724907121.jpg",
        "https://img.alicdn.com/imgextra/i2/2200724907121/O1CN01mZcGJH1DU9xMkYdXp_!!2200724907121.jpg",
        "https://img.alicdn.com/imgextra/i3/2200724907121/O1CN01YqKjLO1DU9xQzKvYf_!!2200724907121.jpg",
      ],
      sourceUrl: "https://item.taobao.com/item.htm?id=607420172123",
      price: 189.00,
      originalPrice: 299.00,
      currency: "CNY",
      sales: 2856,
      salesUnit: "件",
      salesPeriod: "month",
      rating: 4.9,
      reviewsCount: 1892,
      shopId: "2200724907121",
      shopName: "气质女装旗舰店",
      shopUrl: "https://shop12345678.taobao.com",
      categoryId: "1625",
      categoryName: "连衣裙",
      categoryPath: ["女装", "连衣裙", "中长款连衣裙"],
      status: "active",
      priority: "P1",
      isTrending: true,
      tags: ["夏季新款", "法式复古", "显瘦", "气质"],
      extraData: {
        coupon: "满199减20",
        freeShipping: true,
        sevenDayReturn: true,
        videoCount: 3,
      },
    },
    {
      platform: "taobao",
      platformId: "678901234567",
      title: "爆款夏季短袖T恤女宽松显瘦半袖上衣",
      mainImage: "https://img.alicdn.com/imgextra/i1/123456789/O1CN01xxx_!!123456789.jpg",
      sourceUrl: "https://item.taobao.com/item.htm?id=678901234567",
      price: 59.90,
      originalPrice: 99.00,
      currency: "CNY",
      sales: 15234,
      salesUnit: "件",
      salesPeriod: "month",
      rating: 4.8,
      reviewsCount: 8567,
      shopId: "123456789",
      shopName: "潮流服饰专营店",
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["爆款", "短袖", "宽松显瘦"],
    },
  ],

  amazon: [
    {
      platform: "amazon",
      platformId: "B08N5WRWNW",
      title: "Apple AirPods Pro (2nd Generation) Wireless Earbuds",
      mainImage: "https://m.media-amazon.com/images/I/61DUO0NqyyL._AC_SL1500_.jpg",
      images: [
        "https://m.media-amazon.com/images/I/61DUO0NqyyL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/71zPWCNJWmL._AC_SL1500_.jpg",
        "https://m.media-amazon.com/images/I/61JnYUpZRJL._AC_SL1500_.jpg",
      ],
      sourceUrl: "https://www.amazon.com/dp/B08N5WRWNW",
      price: 249.00,
      originalPrice: 249.00,
      currency: "USD",
      sales: 0,
      salesUnit: "units",
      salesPeriod: "month",
      rating: 4.6,
      reviewsCount: 125678,
      shopId: "A1VC38T7YXB528",
      shopName: "Amazon.com",
      shopUrl: "https://www.amazon.com",
      categoryId: "electronics",
      categoryName: "Electronics",
      categoryPath: ["Electronics", "Headphones", "Earbuds"],
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["bestseller", "wireless", "noise-cancelling"],
      extraData: {
        prime: true,
        freeShipping: true,
        bestseller: true,
        amazonChoice: true,
      },
    },
    {
      platform: "amazon",
      platformId: "B09V3KXJPB",
      title: "Samsung Galaxy S23 Ultra 256GB Unlocked Android Smartphone",
      mainImage: "https://m.media-amazon.com/images/I/61dxKiGo9dL._AC_SL1500_.jpg",
      sourceUrl: "https://www.amazon.com/dp/B09V3KXJPB",
      price: 1199.99,
      originalPrice: 1299.99,
      currency: "USD",
      sales: 0,
      salesPeriod: "month",
      rating: 4.5,
      reviewsCount: 4523,
      shopId: "ATVPDKIKX0DER",
      shopName: "Samsung Official Store",
      status: "active",
      priority: "P1",
      isTrending: false,
      tags: ["smartphone", "5G", "unlocked"],
      extraData: {
        prime: true,
        deal: "Limited time deal",
      },
    },
  ],

  douyin: [
    {
      platform: "douyin",
      platformId: "3567890123456789012",
      title: "【直播间爆款】夏季冰丝阔腿裤女垂感显瘦休闲裤",
      mainImage: "https://p3-aio.ecombdimg.com/obj/ecom-shop/xxx.jpg",
      sourceUrl: "https://haohuo.jinritemai.com//views/product/detail?id=3567890123456789012",
      price: 79.00,
      originalPrice: 159.00,
      currency: "CNY",
      sales: 8956,
      salesUnit: "件",
      salesPeriod: "day",
      rating: 4.7,
      reviewsCount: 2345,
      shopId: "shop_123456",
      shopName: "潮流穿搭直播号",
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["直播间爆款", "冰丝", "阔腿裤", "显瘦"],
      extraData: {
        liveSales: 5000,
        influencer: "时尚博主小美",
        commission: "20%",
        videoUrl: "https://www.douyin.com/video/xxx",
      },
    },
  ],

  "1688": [
    {
      platform: "1688",
      platformId: "610123456789",
      title: "厂家直销夏季女装T恤批发现货速发货支持代发",
      mainImage: "https://cbu01.alicdn.com/img/ibank/O1CN01xxx_!!2201234567890-0-cib.jpg",
      sourceUrl: "https://detail.1688.com/offer/610123456789.html",
      price: 15.50,
      originalPrice: 25.00,
      currency: "CNY",
      sales: 50000,
      salesUnit: "件",
      salesPeriod: "month",
      rating: 4.8,
      reviewsCount: 1234,
      shopId: "b2b_123456",
      shopName: "广州女装批发工厂店",
      shopUrl: "https://shop123456.1688.com",
      categoryId: "catid_123",
      categoryName: "女装T恤",
      categoryPath: ["服装", "女装", "T恤"],
      status: "active",
      priority: "P1",
      isTrending: false,
      tags: ["厂家直销", "批发", "支持代发"],
      extraData: {
        minOrder: 2,
        moq: 2,
        wholesale: true,
        supportDropship: true,
        priceRanges: [
          { min: 2, max: 99, price: 18.00 },
          { min: 100, max: 499, price: 16.00 },
          { min: 500, max: null, price: 15.50 },
        ],
      },
    },
  ],

  shopee: [
    {
      platform: "shopee",
      platformId: "123456789.987654321",
      title: "[Local Seller] iPhone 15 Pro Max 256GB Original Apple Malaysia",
      mainImage: "https://down-my.img.susercontent.com/file/xxx",
      sourceUrl: "https://shopee.com.my/product/123456789.987654321",
      price: 5299.00,
      originalPrice: 5999.00,
      currency: "MYR",
      sales: 234,
      salesUnit: "units",
      salesPeriod: "month",
      rating: 4.9,
      reviewsCount: 189,
      shopId: "shop_123456789",
      shopName: "Official Apple Store MY",
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["official", "apple", "iphone"],
      extraData: {
        location: "Selangor",
        shipsFrom: "Malaysia",
        freeShipping: true,
        cod: true,
      },
    },
  ],

  pinduoduo: [
    {
      platform: "pinduoduo",
      platformId: "123456789012",
      title: "【百亿补贴】品牌正品夏季连衣裙女新款气质显瘦",
      mainImage: "https://img.pddpic.com/mms-banner-img/xxx.png",
      sourceUrl: "https://mobile.yangkeduo.com/goods.html?goods_id=123456789012",
      price: 89.90,
      originalPrice: 199.00,
      currency: "CNY",
      sales: 15000,
      salesUnit: "件",
      salesPeriod: "month",
      rating: 4.8,
      reviewsCount: 8567,
      shopId: "pdd_shop_123",
      shopName: "品牌官方旗舰店",
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["百亿补贴", "品牌正品", "夏季新款"],
      extraData: {
        subsidy: "百亿补贴",
        groupPrice: 79.90,
        groupSize: 2,
        coupons: ["满100减10", "新人专享20元券"],
      },
    },
  ],

  jd: [
    {
      platform: "jd",
      platformId: "100012345678",
      title: "Apple MacBook Pro 14英寸 M3芯片 16G 512G 深空灰色",
      mainImage: "https://img14.360buyimg.com/n1/jfs/t1/xxx.jpg",
      sourceUrl: "https://item.jd.com/100012345678.html",
      price: 12999.00,
      originalPrice: 14999.00,
      currency: "CNY",
      sales: 5678,
      salesUnit: "台",
      salesPeriod: "month",
      rating: 4.9,
      reviewsCount: 3456,
      shopId: "jd_shop_1000001234",
      shopName: "Apple自营旗舰店",
      shopUrl: "https://mall.jd.com/index-1000001234.html",
      categoryId: "670",
      categoryName: "笔记本电脑",
      categoryPath: ["电脑", "笔记本", "Apple笔记本"],
      status: "active",
      priority: "P0",
      isTrending: true,
      tags: ["自营", "Apple", "M3芯片", "新品"],
      extraData: {
        jdSelf: true,
        jdDelivery: true,
        plusDiscount: true,
        installment: "12期免息",
      },
    },
  ],

  aliexpress: [
    {
      platform: "aliexpress",
      platformId: "3256801234567890",
      title: "2024 New Summer Women Dress Casual Loose Pocket Sundress",
      mainImage: "https://ae01.alicdn.com/kf/xxx.jpg",
      sourceUrl: "https://www.aliexpress.com/item/3256801234567890.html",
      price: 12.99,
      originalPrice: 25.99,
      currency: "USD",
      sales: 8500,
      salesUnit: "orders",
      salesPeriod: "month",
      rating: 4.7,
      reviewsCount: 2345,
      shopId: "ae_store_123456",
      shopName: "Fashion Dream Store",
      status: "active",
      priority: "P1",
      isTrending: true,
      tags: ["newarrival", "summer", "dress", "free-shipping"],
      extraData: {
        shipsFrom: "China",
        deliveryTime: "15-30 days",
        freeShipping: true,
        coupons: ["$3 off $20", "$5 off $35"],
      },
    },
  ],
};

function printProduct(product: ProductSample, index: number) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  商品 ${index + 1}: ${product.title}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`\n📦 基本信息`);
  console.log(`   平台: ${product.platform.toUpperCase()}`);
  console.log(`   商品ID: ${product.platformId}`);
  console.log(`   状态: ${product.status} | 优先级: ${product.priority} | 热门: ${product.isTrending ? "是" : "否"}`);
  console.log(`   链接: ${product.sourceUrl}`);

  console.log(`\n💰 价格信息`);
  console.log(`   现价: ${product.currency} ${product.price.toFixed(2)}`);
  if (product.originalPrice && product.originalPrice > product.price) {
    const discount = ((1 - product.price / product.originalPrice) * 100).toFixed(0);
    console.log(`   原价: ${product.currency} ${product.originalPrice.toFixed(2)} (折扣: ${discount}% off)`);
  }

  console.log(`\n📊 销售数据`);
  console.log(`   销量: ${product.sales.toLocaleString()} ${product.salesUnit || ""} / ${product.salesPeriod}`);
  if (product.rating) {
    console.log(`   评分: ${product.rating}/5.0 (${product.reviewsCount?.toLocaleString()} 评价)`);
  }

  if (product.shopName) {
    console.log(`\n🏪 店铺信息`);
    console.log(`   店铺: ${product.shopName}`);
    if (product.shopId) console.log(`   店铺ID: ${product.shopId}`);
  }

  if (product.categoryPath?.length) {
    console.log(`\n📁 分类路径`);
    console.log(`   ${product.categoryPath.join(" → ")}`);
  }

  if (product.tags?.length) {
    console.log(`\n🏷️ 标签`);
    console.log(`   ${product.tags.join(", ")}`);
  }

  if (product.images?.length) {
    console.log(`\n🖼️ 图片 (${product.images.length}张)`);
    product.images.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.slice(0, 60)}...`);
    });
  }

  if (product.extraData && Object.keys(product.extraData).length > 0) {
    console.log(`\n📋 扩展数据`);
    for (const [key, value] of Object.entries(product.extraData)) {
      if (typeof value === "object") {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`   ${key}: ${value}`);
      }
    }
  }
}

function printPlatformSummary(platform: string, products: ProductSample[]) {
  console.log("\n");
  console.log("═".repeat(60));
  console.log(`  ${platform.toUpperCase()} 平台数据样本`);
  console.log(`  商品数量: ${products.length}`);
  console.log("═".repeat(60));

  products.forEach((product, index) => {
    printProduct(product, index);
  });
}

function printAllSamples() {
  console.log("\n");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║" + " ".repeat(10) + "美潮龙虾 - 各平台商品数据样本" + " ".repeat(16) + "║");
  console.log("╚" + "═".repeat(58) + "╝");

  const platformOrder = ["taobao", "amazon", "douyin", "1688", "shopee", "pinduoduo", "jd", "aliexpress"];

  for (const platform of platformOrder) {
    const products = samples[platform];
    if (products && products.length > 0) {
      printPlatformSummary(platform, products);
    }
  }

  console.log("\n");
  console.log("═".repeat(60));
  console.log("  数据结构说明");
  console.log("═".repeat(60));
  console.log(`
ProductData 接口字段:

  必填字段:
  ├── platform       平台标识 (taobao/amazon/douyin/1688/shopee/pinduoduo/jd/aliexpress)
  ├── platformId     平台商品ID
  ├── title          商品标题
  ├── sourceUrl      商品来源URL
  ├── price          价格
  ├── currency       货币 (CNY/USD/MYR等)
  ├── sales          销量
  ├── salesPeriod    销量统计周期 (day/week/month)
  ├── status         商品状态 (active/inactive/deleted/sold_out)
  ├── priority       优先级 (P0/P1/P2)
  └── isTrending     是否热门

  可选字段:
  ├── mainImage      主图URL
  ├── images         图片列表
  ├── originalPrice  原价
  ├── salesUnit      销量单位
  ├── rating         评分
  ├── reviewsCount   评价数
  ├── shopId         店铺ID
  ├── shopName       店铺名称
  ├── shopUrl        店铺URL
  ├── categoryId     分类ID
  ├── categoryName   分类名称
  ├── categoryPath   分类路径
  ├── merchantId     商家ID
  ├── tags           标签列表
  └── extraData      扩展数据 (平台特定字段)
`);
}

printAllSamples();