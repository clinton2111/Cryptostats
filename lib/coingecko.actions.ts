'use server';

import qs from 'query-string';

const IS_DEV_MODE = process.env.API_MODE === 'DEV';
const BASE_URL = IS_DEV_MODE ? process.env.COINGECKO_DEV_BASE_URL : process.env.COINGECKO_PROD_BASE_URL;
const API_KEY = IS_DEV_MODE ? process.env.COINGECKO_DEV_API_KEY : process.env.COINGECKO_PROD_API_KEY;
const AUTH_HEADER_NAME = IS_DEV_MODE ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key';

if (!BASE_URL) throw new Error('Base url is not defined');
if (!API_KEY) throw new Error('Api key is not defined');

export const fetcher = async <T>(endpoint: string, params?: QueryParams, revalidate = 60): Promise<T> => {
  const url = qs.stringifyUrl(
    {
      url: `${BASE_URL}/${endpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true }
  );

  //x-cg-pro-api-key
  const response = await fetch(url, {
    headers: {
      [AUTH_HEADER_NAME]: API_KEY,
      'Content-Type': 'application/json',
    } as Record<string, string>,
    next: { revalidate },
  });

  if (!response.ok) {
    const errorBody: CoinGeckoErrorBody = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status}: ${errorBody.error || response.statusText}`);
  }

  return response.json();
};
