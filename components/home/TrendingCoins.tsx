import { fetcher } from '@/lib/coingecko.actions';
import { cn, formatCurrency } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import DataTable from '../DataTable';

interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    large: string; // URL to large image
    thumb: string; // URL to thumb image
    data: {
      price: number;
      price_change_percentage_24h: {
        usd: number;
      };
    };
  };
}

const columns: DataTableColumn<TrendingCoin>[] = [
  {
    header: 'Name',
    cellClassName: 'name-cell',
    cell: (coin) => {
      const item = coin.item;

      return (
        <Link href={`/coins/${item.id}`}>
          <Image src={item.large} alt={item.name} width="36" height="36" />
          <p>{item.name}</p>
        </Link>
      );
    },
  },
  {
    header: '24H Change',
    cellClassName: 'name-cell',
    cell: (coin) => {
      const item = coin.item;
      const istrendingUp = item.data.price_change_percentage_24h.usd > 0;

      return (
        <div className={cn('price-change', istrendingUp ? 'text-green-500' : 'text-red-500')}>
          <p>
            {istrendingUp ? <TrendingUp width="16" height="16" /> : <TrendingDown width="16" height="16" />}
            {Math.abs(item.data.price_change_percentage_24h.usd).toFixed(2)}%
          </p>
        </div>
      );
    },
  },
  {
    header: 'Price',
    cellClassName: 'price-cell',
    cell: (coin) => formatCurrency(coin.item.data.price),
  },
];

const TrendingCoins = async () => {
  const trendingCoins = await fetcher<{ coins: TrendingCoin[] }>('/search/trending', undefined, 300);

  return (
    <div id="trending-coins">
      <h4>Trending Coins</h4>
      <div id="trending-coins">
        <DataTable
          columns={columns}
          data={trendingCoins.coins.slice(0, 6) || []}
          rowKey={(coin) => coin.item.id}
          tableClassName="trending-coins-table"
          headerCellClassName="py-3!"
          bodyCellClassName="py-2!"
        />
      </div>
    </div>
  );
};

export default TrendingCoins;
