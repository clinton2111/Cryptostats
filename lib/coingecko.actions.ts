'use server';

import qs from 'query-string';
import { IS_DEV_MODE } from './config';

const getConfig = () => {
  const BASE_URL = IS_DEV_MODE ? process.env.COINGECKO_DEV_BASE_URL : process.env.COINGECKO_PROD_BASE_URL;
  const API_KEY = IS_DEV_MODE ? process.env.COINGECKO_DEV_API_KEY : process.env.COINGECKO_PROD_API_KEY;
  const AUTH_HEADER_NAME = IS_DEV_MODE ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key';

  if (!BASE_URL)
    throw new Error('CoinGecko Base URL is not defined. Please set COINGECKO_DEV_BASE_URL or COINGECKO_PROD_BASE_URL');
  if (!API_KEY)
    throw new Error('CoinGecko API Key is not defined. Please set COINGECKO_DEV_API_KEY or COINGECKO_PROD_API_KEY');

  return { BASE_URL, API_KEY, AUTH_HEADER_NAME };
};

export const fetcher = async <T>(endpoint: string, params?: QueryParams, revalidate = 60): Promise<T> => {
  const { BASE_URL, API_KEY, AUTH_HEADER_NAME } = getConfig();
  const url = qs.stringifyUrl(
    {
      url: `${BASE_URL}/${endpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true },
  );

  const response = await fetch(url, {
    headers: {
      [AUTH_HEADER_NAME]: API_KEY,
      'Content-Type': 'application/json',
    } as Record<string, string>,
    next: { revalidate },
  });

  // Simulate network delay
  // await new Promise((resolve) => setTimeout(resolve, 2000));

  if (!response.ok) {
    const errorBody: CoinGeckoErrorBody = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status}: ${errorBody.error || response.statusText}`);
  }

  return response.json();
};

export const getPools = async (
  id: string,
  network?: string | null,
  contractAddress?: string | null,
): Promise<PoolData> => {
  const fallback: PoolData = {
    id: '',
    address: '',
    name: '',
    network: '',
  };

  if (network && contractAddress) {
    try {
      const poolData = await fetcher<{ data: PoolData[] }>(
        `/onchain/networks/${network}/tokens/${contractAddress}/pools`,
      );

      return poolData.data?.[0] ?? fallback;
    } catch (error) {
      console.log(error);
      return fallback;
    }
  }

  try {
    const poolData = await fetcher<{ data: PoolData[] }>('/onchain/search/pools', { query: id });

    return poolData.data?.[0] ?? fallback;
  } catch {
    return fallback;
  }
};

export const getTrendingCoins = async (): Promise<TrendingCoin[]> => {
  try {
    const data = await fetcher<{ coins: TrendingCoin[] }>('/search/trending');
    return data.coins;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const searchCoins = async (query: string): Promise<SearchCoin[]> => {
  if (!query) {
    return [];
  }

  try {
    const searchResult = await fetcher<{
      coins: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number | null;
        thumb: string;
        large: string;
      }[];
    }>('/search', { query });
    const top10Coins = searchResult.coins.slice(0, 10);
    const coinIds = top10Coins.map((coin) => coin.id);

    if (coinIds.length === 0) {
      return [];
    }

    const marketsResult = await fetcher<CoinMarketData[]>('/coins/markets', {
      vs_currency: 'usd',
      ids: coinIds.join(','),
    });

    const merged = top10Coins.map((coin) => {
      const marketData = marketsResult.find((m) => m.id === coin.id);
      return {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        market_cap_rank: coin.market_cap_rank,
        thumb: coin.thumb,
        large: coin.large,
        data: {
          price: marketData?.current_price,
          price_change_percentage_24h: marketData?.price_change_percentage_24h ?? 0,
        },
      };
    });

    return merged;
  } catch (error) {
    console.error('Error searching coins:', error);
    return [];
  }
};
