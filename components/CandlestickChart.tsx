'use client';

import { getCandlestickConfig, getChartConfig, PERIOD_BUTTONS, PERIOD_CONFIG } from '@/constants';
import { fetcher } from '@/lib/coingecko.actions';
import { IS_DEV_MODE_PUBLIC } from '@/lib/config';
import { convertOHLCData } from '@/lib/utils';
import { CandlestickSeries, createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useEffect, useRef, useState, useTransition } from 'react';

const CandlestickChart = ({ children, data, coinId, height = 360, initialPeriod = 'daily' }: CandlestickChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(initialPeriod);
  const [OHLCData, setOHLCData] = useState<OHLCData[]>(data ?? []);
  const [isPending, startTransistion] = useTransition();

  const fetchOHLCData = async (selectedPeriod: Period) => {
    try {
      const { days, interval } = PERIOD_CONFIG[selectedPeriod];

      const ohlcPayload: Record<string, string | number | undefined> = {
        vs_currency: 'usd',
        days,
        precision: 'full',
      };

      if (!IS_DEV_MODE_PUBLIC) {
        // ohlcPayload.days = days;
        ohlcPayload.interval = interval;
      } else {
        if (days === 'max') return;
      }

      console.log(ohlcPayload);

      const newData = await fetcher<OHLCData[]>(`/coins/${coinId}/ohlc`, ohlcPayload);
      setOHLCData(newData ?? []);
    } catch (error) {
      console.error('Error fetching OHLC data:', error);
    }
  };

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === period) return;

    startTransistion(async () => {
      setPeriod(newPeriod);
      await fetchOHLCData(newPeriod);
    });
  };

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const showTime = ['daily', 'weekly', 'monthly'].includes(period);

    const chart = createChart(container, {
      ...getChartConfig(height, showTime),
      width: container.clientWidth,
    });

    const series = chart.addSeries(CandlestickSeries, getCandlestickConfig());
    series.setData(convertOHLCData(OHLCData));
    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleSeriesRef.current = series;

    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;

      chart.applyOptions({ width: entries[0].contentRect.width });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const convertedToSeconds = OHLCData.map(
      (item) => [Math.floor(item[0] / 1000), item[1], item[2], item[3], item[4]] as OHLCData
    );

    const converted = convertOHLCData(convertedToSeconds);
    candleSeriesRef.current.setData(converted);
    chartRef.current?.timeScale().fitContent();
  }, [OHLCData, period]);

  return (
    <div id="candlestick-chart">
      <div className="chart-header">
        <div className="flex-1">{children}</div>

        <div className="button-group">
          <span className="text-sm mx-2 font-medium text-purple-100/50">Period:</span>
          {PERIOD_BUTTONS.map(({ value, label }) => (
            <button
              key={value}
              className={period === value ? 'config-button-active' : 'config-button'}
              onClick={() => handlePeriodChange(value)}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="chart" style={{ height }} />
    </div>
  );
};

export default CandlestickChart;
