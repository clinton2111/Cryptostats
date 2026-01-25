'use client';

import { useEffect, useRef, useState } from 'react';
import { IS_DEV_MODE_PUBLIC } from '@/lib/config';
import qs from 'query-string';

const WS_BASE = `${process.env.NEXT_PUBLIC_COINGECKO_WEBSOCKET_URL}?x_cg_pro_api_key=${process.env.NEXT_PUBLIC_COINGECKO_API_KEY_PROD}`;
const API_CONFIG = {
  BASE_URL: 'https://api.coingecko.com/api/v3',
  API_KEY: process.env.NEXT_PUBLIC_COINGECKO_API_KEY_DEV,
  AUTH_HEADER_NAME: 'x-cg-demo-api-key',
};

const fetcher = async <T>(endpoint: string, params?: QueryParams): Promise<T> => {
  const { BASE_URL, API_KEY, AUTH_HEADER_NAME } = API_CONFIG;
  const url = qs.stringifyUrl(
    {
      url: `${BASE_URL}/${endpoint}`,
      query: params,
    },
    { skipEmptyString: true, skipNull: true },
  );

  const response = await fetch(url, {
    headers: {
      [AUTH_HEADER_NAME]: API_KEY as string,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody: CoinGeckoErrorBody = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status}: ${errorBody.error || response.statusText}`);
  }

  return response.json();
};

export const useCoinGeckoWebSocket = ({
  coinId,
  poolId,
  liveInterval,
}: UseCoinGeckoWebSocketProps): UseCoinGeckoWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const subscribed = useRef(<Set<string>>new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [price, setPrice] = useState<ExtendedPriceData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ohlcv, setOhlcv] = useState<OHLCData | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (IS_DEV_MODE_PUBLIC) {
      const POLLING_INTERVAL = 5000; // 5 seconds

      const fetchData = async () => {
        try {
          const priceData = await fetcher<CoinMarketData[]>('coins/markets', {
            vs_currency: 'usd',
            ids: coinId,
          });
          if (priceData && priceData.length > 0) {
            const p = priceData[0];
            setPrice({
              usd: p.current_price,
              coin: p.id,
              price: p.current_price,
              change24h: p.price_change_percentage_24h,
              marketCap: p.market_cap,
              volume24h: p.total_volume,
              timestamp: new Date(p.last_updated).getTime(),
            });
          }

          if (poolId) {
            const [network, pool_address] = poolId.split('_');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tradesData = await fetcher<{ data: { attributes: any }[] }>(
              `onchain/networks/${network}/pools/${pool_address}/trades`,
            );

            if (tradesData?.data) {
              const newTrades = tradesData.data.map((trade): Trade => {
                const a = trade.attributes;
                const isBuy = a.kind === 'buy';

                const priceStr = isBuy ? a.price_to_in_usd : a.price_from_in_usd;
                const amountStr = isBuy ? a.to_token_amount : a.from_token_amount;

                return {
                  price: parseFloat(priceStr),
                  value: parseFloat(a.volume_in_usd),
                  timestamp: new Date(a.block_timestamp).getTime(),
                  type: isBuy ? 'b' : 's',
                  amount: parseFloat(amountStr),
                };
              });

              setTrades(newTrades.slice(0, 7));
            }
          }
          setIsConnected(true);
        } catch (error) {
          console.error('Error fetching data in dev mode:', error);
          setIsConnected(false);
        }
      };

      fetchData();
      intervalRef.current = setInterval(fetchData, POLLING_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;

      const send = (payload: Record<string, unknown>) => ws.send(JSON.stringify(payload));

      const handleMessage = (event: MessageEvent) => {
        const msg: WebSocketMessage = JSON.parse(event.data);

        if (msg.type === 'ping') {
          send({ type: 'pong' });
          return;
        }

        if (msg.type === 'confirm_subscription') {
          const { channel } = JSON.parse(msg.identifier ?? '');

          subscribed.current.add(channel);
        }

        if (msg.c === 'C1') {
          setPrice({
            usd: msg.p ?? 0,
            coin: msg.i,
            price: msg.p,
            change24h: msg.pp,
            marketCap: msg.m,
            volume24h: msg.v,
            timestamp: msg.t,
          });
        }

        if (msg.c === 'G2') {
          const newTrade: Trade = {
            price: msg.pu,
            value: msg.vo,
            timestamp: msg.t ?? 0,
            type: msg.ty,
            amount: msg.to,
          };

          setTrades((prev) => [newTrade, ...prev].slice(0, 7));
        }

        if (msg.ch === 'G3') {
          const timestamp = msg.t ?? 0;

          const candle: OHLCData = [
            timestamp,
            Number(msg.o ?? 0),
            Number(msg.h ?? 0),
            Number(msg.l ?? 0),
            Number(msg.c ?? 0),
          ];

          setOhlcv(candle);
        }
      };

      ws.onopen = () => setIsConnected(true);
      ws.onmessage = handleMessage;
      ws.onclose = () => setIsConnected(false);

      return () => ws.close();
    }
  }, [coinId, poolId]);

  useEffect(() => {
    if (IS_DEV_MODE_PUBLIC || !isConnected) return;

    const ws = wsRef.current;
    if (!ws) return;

    const send = (payload: Record<string, unknown>) => ws.send(JSON.stringify(payload));

    const unsubscribeAll = () => {
      subscribed.current.forEach((channel) => {
        send({
          command: 'unsubscribe',
          identifier: JSON.stringify({ channel }),
        });
      });

      subscribed.current.clear();
    };

    const subscribe = (channel: string, data?: Record<string, unknown>) => {
      if (subscribed.current.has(channel)) return;

      send({ command: 'subscribe', identifier: JSON.stringify({ channel }) });

      if (data) {
        send({
          command: 'message',
          identifier: JSON.stringify({ channel }),
          data: JSON.stringify(data),
        });
      }
    };

    queueMicrotask(() => {
      setPrice(null);
      setTrades([]);
      setOhlcv(null);

      unsubscribeAll();

      subscribe('CGSimplePrice', { coin_id: [coinId], action: 'set_tokens' });
    });

    const poolAddress = poolId.replace('_', ':') ?? '';

    if (poolAddress) {
      subscribe('OnchainTrade', {
        'network_id:pool_addresses': [poolAddress],
        action: 'set_pools',
      });

      subscribe('OnchainOHLCV', {
        'network_id:pool_addresses': [poolAddress],
        interval: liveInterval,
        action: 'set_pools',
      });
    }
  }, [coinId, poolId, isConnected, liveInterval]);

  return {
    price,
    trades,
    ohlcv,
    isConnected,
  };
};
