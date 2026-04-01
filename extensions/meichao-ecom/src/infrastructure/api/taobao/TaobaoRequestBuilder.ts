import type { TaobaoApiConfig } from "./TaobaoApiClient.js";

export interface ProductDetailParams {
  num_iid: string;
  fields?: string;
}

export interface ProductSearchParams {
  q: string;
  page_no?: number;
  page_size?: number;
  sort?: string;
}

export interface ProductDetailResult {
  item: {
    num_iid: string;
    title: string;
    price: string;
    pic_url: string;
    detail_url: string;
    volume: number;
    nick: string;
    cid: number;
    approve_status: string;
  };
}

export interface ProductSearchResult {
  items: {
    item: Array<{
      num_iid: string;
      title: string;
      price: string;
      pic_url: string;
      volume: number;
    }>;
    total_results: number;
  };
}

const DEFAULT_FIELDS = "num_iid,title,price,pic_url,detail_url,volume,nick,cid,approve_status";

export class TaobaoRequestBuilder {
  static buildProductDetailRequest(params: ProductDetailParams) {
    return {
      method: "taobao.item.seller.get",
      params: {
        num_iid: params.num_iid,
        fields: params.fields ?? DEFAULT_FIELDS,
      },
      needAuth: false,
    };
  }

  static buildProductSearchRequest(params: ProductSearchParams) {
    return {
      method: "taobao.items.search",
      params: {
        q: params.q,
        page_no: params.page_no ?? 1,
        page_size: params.page_size ?? 20,
        ...(params.sort && { sort: params.sort }),
      },
      needAuth: false,
    };
  }
}
