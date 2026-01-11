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
    { skipEmptyString: true, skipNull: true }
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
