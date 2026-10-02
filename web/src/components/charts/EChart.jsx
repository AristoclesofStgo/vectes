import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent,
  TooltipComponent, VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart, ScatterChart, HeatmapChart, BarChart, GridComponent, TooltipComponent, LegendComponent,
  VisualMapComponent, MarkLineComponent, MarkPointComponent, DataZoomComponent, CanvasRenderer,
])

/** Thin ECharts wrapper: one instance per mount, resizes with its container. */
export default function EChart({ option, height = 320, group, onEvents, ariaLabel }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const chart = echarts.init(ref.current, null, { renderer: 'canvas' })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !option) return
    chart.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !group) return
    chart.group = group
    echarts.connect(group)
  }, [group])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    for (const [name, handler] of Object.entries(onEvents)) chart.on(name, handler)
    return () => { for (const [name, handler] of Object.entries(onEvents)) chart.off(name, handler) }
  }, [onEvents])

  return <div ref={ref} className="echart" style={{ height }} role="img" aria-label={ariaLabel} />
}
