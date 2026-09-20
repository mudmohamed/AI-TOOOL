import React, { useRef, useEffect, useState } from 'react';
import { calculateEMASeries, calculateBollingerBands } from '../utils/indicators';
import { calculateSMA, calculateSMASeries } from '../utils/chartCompat';
import { Eye, EyeOff, Maximize2, RefreshCw } from 'lucide-react';

interface LiveChartProps {
  prices: number[];
  digits: number[];
  symbol: string;
  pip: number;
  currentPrice: number;
}

export const LiveChart: React.FC<LiveChartProps> = ({
  prices,
  digits,
  symbol,
  pip,
  currentPrice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showEMA9, setShowEMA9] = useState(true);
  const [showEMA21, setShowEMA21] = useState(true);
  const [showSMA10, setShowSMA10] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [hoverData, setHoverData] = useState<{ price: number; digit: number; index: number; x: number; y: number } | null>(null);

  // 1. Observe container resize and resize canvas correctly
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      drawChart();
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Redraw whenever prices, digits, or overlays change!
  useEffect(() => {
    drawChart();
  }, [prices, digits, showEMA9, showEMA21, showSMA10, showBollinger, pip]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    if (width === 0 || height === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Padding for axes
    const padding = { top: 24, right: 65, bottom: 28, left: 16 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (prices.length < 2) {
      // Draw placeholder grid and status
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (i / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = '#64748b';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Connecting to ${symbol} real tick stream...`, padding.left + chartW / 2, padding.top + chartH / 2);
      ctx.restore();
      return;
    }

    // View last 120 ticks for optimum granularity
    const sliceCount = Math.min(prices.length, 120);
    const visiblePrices = prices.slice(-sliceCount);
    const visibleDigits = digits.slice(-sliceCount);

    let minPrice = Math.min(...visiblePrices);
    let maxPrice = Math.max(...visiblePrices);
    const range = maxPrice - minPrice || 0.0001;
    minPrice -= range * 0.08;
    maxPrice += range * 0.08;
    const adjRange = maxPrice - minPrice;

    const getX = (i: number) => padding.left + (i / (sliceCount - 1)) * chartW;
    const getY = (price: number) => padding.top + chartH - ((price - minPrice) / adjRange) * chartH;

    // 1. Draw Grid Lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (i / gridSteps) * chartH;
      const priceVal = maxPrice - (i / gridSteps) * adjRange;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      // Price label on right axis
      ctx.fillStyle = '#64748b';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(priceVal.toFixed(pip), padding.left + chartW + 8, y + 3);
    }
    ctx.setLineDash([]);

    // 2. Bollinger Bands
    if (showBollinger && visiblePrices.length >= 20) {
      const upperPoints: { x: number; y: number }[] = [];
      const lowerPoints: { x: number; y: number }[] = [];

      for (let i = 19; i < visiblePrices.length; i++) {
        const sub = visiblePrices.slice(0, i + 1);
        const { upper, lower } = calculateBollingerBands(sub);
        upperPoints.push({ x: getX(i), y: getY(upper) });
        lowerPoints.push({ x: getX(i), y: getY(lower) });
      }

      if (upperPoints.length > 0) {
        // Bollinger Cloud
        ctx.beginPath();
        ctx.moveTo(upperPoints[0].x, upperPoints[0].y);
        for (let i = 1; i < upperPoints.length; i++) {
          ctx.lineTo(upperPoints[i].x, upperPoints[i].y);
        }
        for (let i = lowerPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(lowerPoints[i].x, lowerPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.fill();

        // Upper line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        upperPoints.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        // Lower line
        ctx.beginPath();
        lowerPoints.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }
    }

    // 3. SMA 10 (Violet/Purple)
    if (showSMA10 && visiblePrices.length >= 10) {
      const sma10Series = calculateSMASeries(visiblePrices, 10);
      ctx.beginPath();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < sma10Series.length; i++) {
        const x = getX(i);
        const y = getY(sma10Series[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 4. EMA 21 (Amber)
    if (showEMA21 && visiblePrices.length >= 21) {
      const ema21Series = calculateEMASeries(visiblePrices, 21);
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < ema21Series.length; i++) {
        const x = getX(i);
        const y = getY(ema21Series[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 5. EMA 9 (Cyan)
    if (showEMA9 && visiblePrices.length >= 9) {
      const ema9Series = calculateEMASeries(visiblePrices, 9);
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < ema9Series.length; i++) {
        const x = getX(i);
        const y = getY(ema9Series[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 5. Main Tick Price Line with gradient glow
    ctx.beginPath();
    for (let i = 0; i < visiblePrices.length; i++) {
      const x = getX(i);
      const y = getY(visiblePrices[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Area under price line
    const lastX = getX(visiblePrices.length - 1);
    const firstX = getX(0);
    ctx.lineTo(lastX, padding.top + chartH);
    ctx.lineTo(firstX, padding.top + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 6. Draw dots & digits along the price curve
    for (let i = 0; i < visiblePrices.length; i++) {
      const x = getX(i);
      const y = getY(visiblePrices[i]);
      const digit = visibleDigits[i];
      const isLatest = i === visiblePrices.length - 1;

      if (isLatest) {
        // Glowing animated head
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      } else if (i % 3 === 0 || i > visiblePrices.length - 15) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
      }
    }

    // 7. Current Price Horizontal Dash Line
    const currentY = getY(currentPrice);
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, currentY);
    ctx.lineTo(padding.left + chartW, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current price pill tag on the right
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(padding.left + chartW + 4, currentY - 9, 58, 18);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(currentPrice.toFixed(pip), padding.left + chartW + 33, currentY + 4);

    ctx.restore();
  };

  useEffect(() => {
    drawChart();
  }, [prices, digits, currentPrice, showEMA9, showEMA21, showSMA10, showBollinger]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 24, right: 65, bottom: 28, left: 16 };
    const chartW = rect.width - padding.left - padding.right;

    if (mouseX < padding.left || mouseX > padding.left + chartW) {
      setHoverData(null);
      return;
    }

    const sliceCount = Math.min(prices.length, 120);
    const visiblePrices = prices.slice(-sliceCount);
    const visibleDigits = digits.slice(-sliceCount);

    const relativeX = (mouseX - padding.left) / chartW;
    const index = Math.min(sliceCount - 1, Math.max(0, Math.round(relativeX * (sliceCount - 1))));

    setHoverData({
      price: visiblePrices[index],
      digit: visibleDigits[index],
      index,
      x: mouseX,
      y: mouseY,
    });
  };

  return (
    <div className="space-y-2">
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            {symbol} Live Tick Trajectory
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            120-Tick Horizon
          </span>
        </div>

        {/* Toggle Overlays */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <button
            onClick={() => setShowSMA10(!showSMA10)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              showSMA10 ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-slate-500 hover:text-slate-400'
            }`}
            title="Toggle 10-period Simple Moving Average line"
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            SMA 10
          </button>

          <button
            onClick={() => setShowEMA9(!showEMA9)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              showEMA9 ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            EMA 9
          </button>

          <button
            onClick={() => setShowEMA21(!showEMA21)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              showEMA21 ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            EMA 21
          </button>

          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              showBollinger ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Bollinger (20,2)
          </button>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-72 sm:h-80 rounded-xl border border-slate-800 bg-slate-950 relative overflow-hidden select-none"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Tooltip */}
        {hoverData && (
          <div
            className="absolute pointer-events-none bg-slate-900/95 border border-slate-700 shadow-xl rounded-lg px-2.5 py-1.5 text-[11px] font-mono z-30"
            style={{
              left: `${Math.min(hoverData.x + 12, (containerRef.current?.clientWidth || 300) - 130)}px`,
              top: `${Math.max(10, hoverData.y - 50)}px`,
            }}
          >
            <div className="text-slate-400">Price: <span className="text-white font-bold">{hoverData.price.toFixed(pip)}</span></div>
            <div className="text-slate-400">Digit: <span className="text-amber-400 font-extrabold">{hoverData.digit}</span></div>
            {showSMA10 && prices.length >= 10 && (
              <div className="text-slate-400">
                SMA 10: <span className="text-purple-300 font-bold">{calculateSMA(prices.slice(0, prices.length - Math.min(prices.length, 120) + hoverData.index + 1), 10).toFixed(pip)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
