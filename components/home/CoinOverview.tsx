import { fetcher } from '@/lib/coingecko.actions';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { CoinOverviewFallback } from './fallback';
import CandlestickChart from '../CandlestickChart';
import { IS_DEV_MODE } from '@/lib/config';

const CoinOverview = async () => {
  let coin: CoinDetailsData;
  let coinOHLCData: OHLCData[];

  try {
    const ohlcPayload: Record<string, string | number | undefined> = {
      vs_currency: 'usd',
      days: 1,
      interval: 'hourly',
      precision: 'full',
    };
    if (IS_DEV_MODE) {
      delete ohlcPayload.interval;
    }

    [coin, coinOHLCData] = await Promise.all([
      fetcher<CoinDetailsData>('/coins/bitcoin', {
        dex_pair_format: 'symbol',
      }),
      fetcher<OHLCData[]>('/coins/bitcoin/ohlc', ohlcPayload),
    ]);
  } catch (error) {
    console.error('Error fetching coin details:', error);
    return <CoinOverviewFallback />;
  }

  return (
    <div id="coin-overview">
      <CandlestickChart data={coinOHLCData} coinId="bitcoin">
        <div className="header pt-2">
          <Image src={coin.image.large} alt={coin.name} width={56} height={56} />
          <div className="info">
            <p>
              {coin.name} / {coin.symbol.toUpperCase()}
            </p>
            <h1>{formatCurrency(coin.market_data.current_price.usd)}</h1>
          </div>
        </div>
      </CandlestickChart>
    </div>
  );
};

export default CoinOverview;
