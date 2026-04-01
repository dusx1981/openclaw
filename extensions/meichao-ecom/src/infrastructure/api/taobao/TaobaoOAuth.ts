export interface TaobaoOAuthConfig {
  appKey: string;
  appSecret: string;
  redirectUri?: string;
}

export interface TaobaoTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: number;
}

export class TaobaoOAuth {
  private tokenInfo?: TaobaoTokenInfo;

  constructor(private config: TaobaoOAuthConfig) {}

  static fromEnv(): TaobaoOAuth {
    const appKey = process.env.TAOBAO_APP_KEY;
    const appSecret = process.env.TAOBAO_APP_SECRET;
    const accessToken = process.env.TAOBAO_ACCESS_TOKEN;

    if (!appKey || !appSecret) {
      throw new Error("Missing TAOBAO_APP_KEY or TAOBAO_APP_SECRET");
    }

    const oauth = new TaobaoOAuth({ appKey, appSecret });

    if (accessToken) {
      oauth.setAccessToken(accessToken);
    }

    return oauth;
  }

  setAccessToken(token: string, expiresIn?: number): void {
    this.tokenInfo = {
      accessToken: token,
      expiresIn: expiresIn ?? 86400,
      expiresAt: Date.now() + (expiresIn ?? 86400) * 1000,
    };
  }

  getAccessToken(): string | undefined {
    if (!this.tokenInfo) {
      return process.env.TAOBAO_ACCESS_TOKEN;
    }

    if (this.isExpired()) {
      console.warn("Taobao access token has expired");
      return undefined;
    }

    return this.tokenInfo.accessToken;
  }

  isExpired(): boolean {
    if (!this.tokenInfo) {
      return true;
    }

    const bufferMs = 5 * 60 * 1000;
    return Date.now() >= this.tokenInfo.expiresAt - bufferMs;
  }

  getTokenInfo(): TaobaoTokenInfo | undefined {
    return this.tokenInfo;
  }
}
