"use client";
import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartJSChartsProps {
  chartData: any[];
  xKey: string;
  xLabel: string;
  yLabel: string;
  colorPalette?: string[];
  chartType?: string;
}

export default function ChartJSCharts({ chartData, xKey, xLabel, yLabel, colorPalette, chartType = "bar" }: ChartJSChartsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Detect mobile device and client-side rendering
  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      const mobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  // Prepare data for Chart.js
  const labels = chartDataToUse.map(entry => xTickFormatter(entry[xKey]));
  const data = chartDataToUse.map(entry => entry.total);

  const chartDataConfig = {
    labels,
    datasets: [
      {
        label: yLabel,
        data,
        backgroundColor: pastelColors[0],
        borderColor: pastelColors[0],
        borderWidth: 2,
        fill: chartType === "area",
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${yLabel}: ${context.parsed.y.toLocaleString('de-DE')}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: isMobile ? 8 : 10
          },
          maxRotation: isMobile ? 45 : 0,
          minRotation: isMobile ? 45 : 0
        }
      },
      y: {
        ticks: {
          font: {
            size: isMobile ? 8 : 10
          },
          callback: function(value: any) {
            return value.toLocaleString('de-DE');
          }
        }
      }
    }
  };

  // Don't render charts on server-side to prevent hydration issues
  if (!isClient) {
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

  // Always render a chart container, even if empty
  return (
    <div className="space-y-8">
      <div>
        <div className="border-2 border-gray-300 bg-gray-50 p-4 rounded" style={{ minHeight: '400px' }}>
          <div style={{ height: isMobile ? '250px' : '300px' }}>
            {chartType === "bar" ? (
              <Bar data={chartDataConfig} options={options} />
            ) : chartType === "line" ? (
              <Line data={chartDataConfig} options={options} />
            ) : chartType === "area" ? (
              chartDataToUse.length < 2 ? (
                <div className="flex items-center justify-center h-full w-full text-gray-500">
                  Se necesitan al menos dos puntos de datos para el gráfico de área.
                </div>
              ) : (
                <Line data={chartDataConfig} options={options} />
              )
            ) : (
              <Bar data={chartDataConfig} options={options} />
            )}
          </div>
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