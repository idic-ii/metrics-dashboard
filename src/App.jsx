import React, { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler)

const baseUrl = () => {
  const url = import.meta.env.VITE_ANALYTICS_URL
  return url ? url.replace(/\/$/, '') : ''
}

const authHeaders = () => {
  const token = import.meta.env.VITE_STATS_TOKEN
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export default function App() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [overview, setOverview] = useState(null)
  const [pageViewsSeries, setPageViewsSeries] = useState([])
  const [topEvents, setTopEvents] = useState([])

  useEffect(() => {
    const url = baseUrl()
    if (!url) {
      setLoading(false)
      setError('Configura VITE_ANALYTICS_URL')
      return
    }

    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const [overviewRes, pvRes, topRes] = await Promise.all([
          fetch(`${url}/stats/overview?days=${days}`, { headers: authHeaders(), signal: controller.signal }),
          fetch(`${url}/stats/timeseries?days=${days}&type=page_view`, { headers: authHeaders(), signal: controller.signal }),
          fetch(`${url}/stats/top-events?days=${days}&limit=10`, { headers: authHeaders(), signal: controller.signal }),
        ])

        if (!overviewRes.ok) throw new Error(`overview_${overviewRes.status}`)
        if (!pvRes.ok) throw new Error(`timeseries_${pvRes.status}`)
        if (!topRes.ok) throw new Error(`top_${topRes.status}`)

        const overviewJson = await overviewRes.json()
        const pvJson = await pvRes.json()
        const topJson = await topRes.json()

        setOverview(overviewJson)
        setPageViewsSeries(Array.isArray(pvJson.series) ? pvJson.series : [])
        setTopEvents(Array.isArray(topJson.items) ? topJson.items : [])
      } catch (e) {
        if (e?.name === 'AbortError') return
        setError(e?.message || 'Error cargando métricas')
      } finally {
        setLoading(false)
      }
    }

    run()

    return () => controller.abort()
  }, [days])

  const lineData = useMemo(() => {
    const labels = pageViewsSeries.map(i => {
      const d = new Date(i.day)
      return isNaN(d.getTime()) ? String(i.day) : d.toLocaleDateString('es-ES')
    })
    const values = pageViewsSeries.map(i => Number(i.count || 0))

    return {
      labels,
      datasets: [
        {
          label: 'Page views',
          data: values,
          borderColor: '#f78e1e',
          backgroundColor: 'rgba(247, 142, 30, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    }
  }, [pageViewsSeries])

  const barData = useMemo(() => {
    const labels = topEvents.map(i => i.name)
    const values = topEvents.map(i => Number(i.count || 0))

    return {
      labels,
      datasets: [
        {
          label: 'Eventos',
          data: values,
          backgroundColor: '#f78e1e',
          borderRadius: 6,
        },
      ],
    }
  }, [topEvents])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: 'rgba(255,255,255,0.75)' }, border: { display: false } },
      x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.75)' }, border: { display: false } },
    },
  }

  const url = baseUrl()

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h1">Dashboard de Métricas</h1>
          <p className="sub">Fuente: {url ? url : '-'}</p>
        </div>

        <div className="toolbar">
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Ventana</span>
          <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
            <option value={180}>180 días</option>
          </select>
        </div>
      </div>

      {loading && <div className="card loader">Cargando…</div>}
      {!loading && error && <div className="card error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid">
            <div className="card kpi">
              <div className="kpiValue">{overview?.page_views ?? 0}</div>
              <div className="kpiLabel">Page views</div>
            </div>
            <div className="card kpi">
              <div className="kpiValue">{overview?.sessions ?? 0}</div>
              <div className="kpiLabel">Sesiones</div>
            </div>
            <div className="card kpi">
              <div className="kpiValue">{overview?.events ?? 0}</div>
              <div className="kpiLabel">Eventos</div>
            </div>
          </div>

          <div className="charts">
            <div className="card chartCard">
              <div className="chartTitle">Page views por día</div>
              <div className="chartSub">Últimos {days} días</div>
              <div style={{ height: '280px' }}>
                <Line data={lineData} options={chartOptions} />
              </div>
            </div>

            <div className="card chartCard">
              <div className="chartTitle">Top eventos</div>
              <div className="chartSub">Últimos {days} días</div>
              <div style={{ height: '280px' }}>
                <Bar data={barData} options={chartOptions} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
