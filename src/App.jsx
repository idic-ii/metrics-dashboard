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

const fetchJson = async (url, signal) => {
  const res = await fetch(url, { headers: authHeaders(), signal })
  if (!res.ok) throw new Error(`${res.status}`)
  return await res.json()
}

const fmtNumber = (n) => {
  const v = Number(n || 0)
  return new Intl.NumberFormat('es-ES').format(v)
}

const fmtTime = (iso) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('es-ES')
}

export default function App() {
  const [days, setDays] = useState(30)
  const [refreshSec, setRefreshSec] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [overview, setOverview] = useState(null)
  const [pageViewsSeries, setPageViewsSeries] = useState([])
  const [topEvents, setTopEvents] = useState([])
  const [topPages, setTopPages] = useState([])
  const [topReferrers, setTopReferrers] = useState([])
  const [topOutbound, setTopOutbound] = useState([])
  const [recentEvents, setRecentEvents] = useState([])

  useEffect(() => {
    const url = baseUrl()
    if (!url) {
      setLoading(false)
      setError('Configura VITE_ANALYTICS_URL')
      return
    }

    let mounted = true
    let intervalId = null

    const run = async (signal, { isBackground } = {}) => {
      if (!isBackground) {
        setLoading(true)
        setError(null)
      }

      try {
        const [overviewJson, pvJson, topEventsJson, topPagesJson, topRefJson, topOutJson, recentJson] = await Promise.all([
          fetchJson(`${url}/stats/overview?days=${days}`, signal),
          fetchJson(`${url}/stats/timeseries?days=${days}&type=page_view`, signal),
          fetchJson(`${url}/stats/top-events?days=${days}&limit=10`, signal),
          fetchJson(`${url}/stats/top-pages?days=${days}&limit=10`, signal),
          fetchJson(`${url}/stats/top-referrers?days=${days}&limit=10`, signal),
          fetchJson(`${url}/stats/top-outbound?days=${days}&limit=10`, signal),
          fetchJson(`${url}/stats/recent-events?limit=25`, signal),
        ])

        if (!mounted) return

        setOverview(overviewJson)
        setPageViewsSeries(Array.isArray(pvJson.series) ? pvJson.series : [])
        setTopEvents(Array.isArray(topEventsJson.items) ? topEventsJson.items : [])
        setTopPages(Array.isArray(topPagesJson.items) ? topPagesJson.items : [])
        setTopReferrers(Array.isArray(topRefJson.items) ? topRefJson.items : [])
        setTopOutbound(Array.isArray(topOutJson.items) ? topOutJson.items : [])
        setRecentEvents(Array.isArray(recentJson.items) ? recentJson.items : [])
        setLastUpdated(new Date().toISOString())
        setError(null)
      } catch (e) {
        if (e?.name === 'AbortError') return
        if (!mounted) return
        setError(e?.message || 'Error cargando métricas')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    const controller = new AbortController()
    run(controller.signal)

    if (refreshSec > 0) {
      intervalId = setInterval(() => {
        const c = new AbortController()
        run(c.signal, { isBackground: true })
      }, refreshSec * 1000)
    }

    return () => {
      mounted = false
      controller.abort()
      if (intervalId) clearInterval(intervalId)
    }
  }, [days, refreshSec])

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
      y: { grid: { color: 'rgba(17,17,17,0.08)' }, ticks: { color: '#5b5b63' }, border: { display: false } },
      x: { grid: { display: false }, ticks: { color: '#5b5b63' }, border: { display: false } },
    },
  }

  const url = baseUrl()

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="brandTitle">Universidad de Lima</div>
            <div className="brandSub">Panel de analítica del dashboard</div>
          </div>
          <div className="pill">
            <span className="accentDot" />
            <span>Última actualización: {lastUpdated ? fmtTime(lastUpdated) : '-'}</span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="header">
          <div>
            <h1 className="h1">Métricas de uso</h1>
            <p className="sub">Servidor de analítica: {url ? url : '-'}</p>
          </div>

          <div className="toolbar">
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Período</span>
            <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={180}>Últimos 180 días</option>
            </select>

            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Actualización automática</span>
            <select className="select" value={refreshSec} onChange={e => setRefreshSec(Number(e.target.value))}>
              <option value={0}>Desactivada</option>
              <option value={5}>Cada 5 segundos</option>
              <option value={15}>Cada 15 segundos</option>
              <option value={60}>Cada 60 segundos</option>
            </select>
          </div>
        </div>

        {loading && <div className="card loader">Cargando métricas…</div>}
        {!loading && error && <div className="card error">No se pudieron cargar las métricas ({error}).</div>}

        {!loading && !error && (
          <>
            <div className="grid">
              <div className="card kpi">
                <div className="kpiValue">{fmtNumber(overview?.page_views ?? 0)}</div>
                <div className="kpiLabel">Visitas a la página</div>
              </div>
              <div className="card kpi">
                <div className="kpiValue">{fmtNumber(overview?.sessions ?? 0)}</div>
                <div className="kpiLabel">Sesiones (aprox. usuarios)</div>
              </div>
              <div className="card kpi">
                <div className="kpiValue">{fmtNumber(overview?.events ?? 0)}</div>
                <div className="kpiLabel">Interacciones (clics, filtros, búsquedas)</div>
              </div>
            </div>

            <div className="charts">
              <div className="card chartCard">
                <div className="chartTitle">Visitas por día</div>
                <div className="chartSub">Últimos {days} días</div>
                <div style={{ height: '280px' }}>
                  <Line data={lineData} options={chartOptions} />
                </div>
              </div>

              <div className="card chartCard">
                <div className="chartTitle">Acciones más usadas</div>
                <div className="chartSub">Últimos {days} días</div>
                <div style={{ height: '280px' }}>
                  <Bar data={barData} options={chartOptions} />
                </div>
              </div>
            </div>

            <div className="sections">
              <div className="card section">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Secciones más visitadas</div>
                    <div className="sectionSub">Páginas dentro del dashboard</div>
                  </div>
                </div>
                <div className="table">
                  {topPages.map((i) => (
                    <div key={i.path} className="row">
                      <div className="cellMain">{i.path}</div>
                      <div className="cellNum">{fmtNumber(i.count)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card section">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Origen del tráfico</div>
                    <div className="sectionSub">Sitios desde donde ingresan</div>
                  </div>
                </div>
                <div className="table">
                  {topReferrers.map((i) => (
                    <div key={i.referrer} className="row">
                      <div className="cellMain">{i.referrer}</div>
                      <div className="cellNum">{fmtNumber(i.count)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card section">
                <div className="sectionHeader">
                  <div>
                    <div className="sectionTitle">Clics a enlaces externos</div>
                    <div className="sectionSub">Salidas hacia páginas de congresos</div>
                  </div>
                </div>
                <div className="table">
                  {topOutbound.map((i) => (
                    <div key={i.url} className="row">
                      <div className="cellMain"><a href={i.url} target="_blank" rel="noreferrer">{i.url}</a></div>
                      <div className="cellNum">{fmtNumber(i.count)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card section" style={{ marginTop: '12px' }}>
              <div className="sectionHeader">
                <div>
                  <div className="sectionTitle">Actividad reciente</div>
                  <div className="sectionSub">Últimas 25 acciones registradas</div>
                </div>
              </div>
              <div className="recentTable">
                <div className="recentHead">
                  <div>Hora</div>
                  <div>Tipo</div>
                  <div>Nombre</div>
                  <div>Sección</div>
                </div>
                {recentEvents.map((e, idx) => (
                  <div key={`${e.created_at}-${idx}`} className="recentRow">
                    <div className="muted">{fmtTime(e.created_at)}</div>
                    <div>{e.type}</div>
                    <div>{e.name || '-'}</div>
                    <div className="muted">{e.path || '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
