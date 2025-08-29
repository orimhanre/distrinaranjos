"use client";
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell as BarCell,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

interface EstadisticasChartsProps {
  chartData: any[];
  xKey: string;
  xLabel: string;
  yLabel: string;
  colorPalette?: string[];
  chartType?: string;
}

export default function EstadisticasCharts({ chartData, xKey, xLabel, yLabel, colorPalette, chartType = "bar" }: EstadisticasChartsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Detect mobile device and client-side rendering
  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      const mobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Delay mounting to ensure proper hydration
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(timer);
    };
  }, []);

  // Defensive: check required props
  if (!xKey || !xLabel || !yLabel) {
    return <div className="text-red-600 text-center p-4">Error: Faltan parámetros requeridos para el gráfico.</div>;
  }

  // Defensive: always use an array for chartData
  const safeChartData = Array.isArray(chartData) ? chartData : [];

  // Sanitize chart data: filter out entries with missing xKey or total
  const sanitizedChartData = safeChartData.filter(
    entry => entry && entry[xKey] != null && entry.total != null && entry[xKey] !== ''
  );

  // Use sanitized data, but fallback to original if sanitized is empty
  const chartDataToUse = sanitizedChartData.length > 0 ? sanitizedChartData : safeChartData;

  // Calculate the sum of all totals in the chart
  const totalSum = chartDataToUse.reduce((acc, entry) => acc + (typeof entry.total === 'number' ? entry.total : 0), 0);

  // Simple tooltip for mobile compatibility
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{`${xLabel}: ${label}`}</p>
          <p className="text-blue-600 font-bold">
            {`${yLabel}: ${payload[0].value?.toLocaleString("de-DE") || 0}`}
          </p>
        </div>
      );
    }
    return null;
  };

  // X axis label formatter
  function xTickFormatter(value: string) {
    if (typeof value !== 'string') return value ?? '-';
    if (xKey === "periodo") {
      if (xLabel === "Semana") {
        const match = value.match(/(\d{4})-S(\d+)/);
        if (match) {
          const year = parseInt(match[1], 10);
          const week = parseInt(match[2], 10);
          return `S${week} ${year}`;
        }
      }
      if (xLabel === "Mes") {
        const match = value.match(/(\d{4})-(\d{2})/);
        if (match) {
          const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          const monthIdx = parseInt(match[2], 10) - 1;
          return `${months[monthIdx]} ${match[1]}`;
        }
      }
      if (xLabel === "Año") {
        return value;
      }
    }
    if (xKey === "departamento" || xKey === "ciudad") {
      return value;
    }
    return value;
  }

  // Use provided colorPalette or default
  const pastelColors = colorPalette || [
    "#A7F3D0", // green
    "#BFDBFE", // blue
    "#DDD6FE", // purple
    "#FDE68A", // yellow
    "#FBCFE8", // pink
    "#FDE2E4", // light pink
    "#FECACA", // red
    "#FEF9C3", // light yellow
    "#C7D2FE", // indigo
    "#FCA5A5", // rose
    "#FDBA74", // orange
  ];

  // Y-axis tick formatter for thousand separators
  function yTickFormatter(value: number) {
    return typeof value === 'number' ? value.toLocaleString('de-DE') : value;
  }

  // Don't render charts on server-side to prevent hydration issues
  if (!isClient || !mounted) {
    return (
      <div className="border-2 border-gray-300 bg-gray-50 p-4 rounded" style={{ minHeight: '400px' }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Cargando gráficos...</p>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic height and margins based on device type
  const chartHeight = isMobile ? 200 : 300;
  const chartMargins = isMobile 
    ? { top: 10, right: 10, left: 10, bottom: 10 }
    : { top: 20, right: 30, left: 0, bottom: 5 };

  // Always render a chart container, even if empty
  return (
    <div className="space-y-8">
      <div>
        <div className="border-2 border-gray-300 bg-gray-50 p-4 rounded" style={{ minHeight: '400px' }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            {chartType === "bar" ? (
              <BarChart
                data={chartDataToUse}
                margin={chartMargins}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={xKey} 
                  tickFormatter={xTickFormatter} 
                  tick={{ fontSize: isMobile ? 8 : 10 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                  height={isMobile ? 60 : 30}
                />
                <YAxis 
                  tickFormatter={yTickFormatter} 
                  tick={{ fontSize: isMobile ? 8 : 10 }}
                  width={isMobile ? 50 : 60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="total" name={yLabel} fill="#8884d8">
                  {chartDataToUse.map((entry, idx) => (
                    <BarCell key={`cell-${idx}`} fill={pastelColors[idx % pastelColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart
                data={chartDataToUse}
                margin={chartMargins}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey={xKey} 
                  tickFormatter={xTickFormatter} 
                  tick={{ fontSize: isMobile ? 8 : 10 }}
                  angle={isMobile ? -45 : 0}
                  textAnchor={isMobile ? "end" : "middle"}
                  height={isMobile ? 60 : 30}
                />
                <YAxis 
                  tickFormatter={yTickFormatter} 
                  tick={{ fontSize: isMobile ? 8 : 10 }}
                  width={isMobile ? 50 : 60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            ) : chartType === "area" ? (
              chartDataToUse.length < 2 ? (
                <div className="flex items-center justify-center h-full w-full text-gray-500" style={{ minHeight: 200 }}>
                  Se necesitan al menos dos puntos de datos para el gráfico de área.
                </div>
              ) : (
                <AreaChart
                  data={chartDataToUse}
                  margin={chartMargins}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={xKey} 
                    tickFormatter={xTickFormatter} 
                    tick={{ fontSize: isMobile ? 8 : 10 }}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                    height={isMobile ? 60 : 30}
                  />
                  <YAxis 
                    tickFormatter={yTickFormatter} 
                    tick={{ fontSize: isMobile ? 8 : 10 }}
                    width={isMobile ? 50 : 60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="total" stroke="#ef4444" fill="#fecaca" fillOpacity={0.7} strokeWidth={3} />
                </AreaChart>
              )
            ) : (
              <div style={{ display: 'none' }} />
            )}
          </ResponsiveContainer>
          {chartDataToUse.length === 0 && (
            <div className="text-gray-500 text-center p-4">
              No hay datos para mostrar en el gráfico.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 