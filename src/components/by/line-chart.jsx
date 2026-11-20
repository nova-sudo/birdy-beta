"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn";

const PAD = { top: 10, right: 12, bottom: 26, left: 44 };

/**
 * Round a maximum up to a tidy axis top. The axis has four equal steps, so
 * every top offered here divides into four round numbers.
 * @param {boolean} [integers] the values are whole things (leads, calls), so the steps must be whole too
 */
export function niceMax(max, integers = false) {
  if (!(max > 0)) return integers ? 4 : 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 4, 6, 8, 10].find((s) => s * pow >= max) * pow;
  return integers ? Math.max(4, Math.ceil(top / 4) * 4) : top;
}

/**
 * One series over time: a line with a soft fill under it.
 *
 * Drawn in real pixels (it measures its own width), so text and strokes stay
 * crisp at any size. Hover or focus a point to read its value. Screen readers
 * get the series as a list.
 *
 * @param {number[]} props.values
 * @param {string[]} props.labels axis labels, one per value; an empty string leaves that tick blank
 * @param {number[]} [props.previous] the period before, point for point, drawn as a dashed grey line behind the series
 * @param {string[]} [props.pointLabels] full labels for the readout, when the axis ones are thinned
 * @param {(n: number) => string} [props.format] how a value is written
 * @param {boolean} [props.integers] the values are counts, so the axis steps in whole numbers
 * @param {string} props["aria-label"] what the chart shows
 * @param {number} [props.height]
 */
export function LineChart({ values, previous, labels, pointLabels, format = (n) => Math.round(n).toLocaleString("en-GB"), integers = false, height = 220, "aria-label": ariaLabel, className, ...props }) {
  const id = useId();
  const ref = useRef(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => el.clientWidth > 0 && setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const before = previous?.length === values.length ? previous : null;
  const top = niceMax(Math.max(0, ...values, ...(before ?? [])), integers);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (values.length > 1 ? (i * innerW) / (values.length - 1) : innerW / 2);
  const y = (n) => PAD.top + innerH * (1 - n / top);
  const path = (series) => series.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(" ");
  const line = path(values);
  const area = values.length > 1 ? `${line} L${x(values.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)}Z` : "";
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top];
  const nameOf = (i) => pointLabels?.[i] || labels[i] || "";

  const nearest = (clientX) => {
    const box = ref.current.getBoundingClientRect();
    const ratio = (clientX - box.left - PAD.left) / innerW;
    return Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1))));
  };

  return (
    <div ref={ref} className={cn("relative font-by-body", className)} {...props}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        className="block"
        onMouseMove={(e) => setHover(nearest(e.clientX))}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--by-accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--by-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-by-line-soft" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className="fill-by-muted text-by-caption tabular-nums">{format(t)}</text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${id}-fill)`} />}
        {before && <path d={path(before)} fill="none" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" className="stroke-by-muted opacity-70" />}
        <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-by-accent" />
        {values.length <= 31 && values.map((n, i) => <circle key={i} cx={x(i)} cy={y(n)} r="2.5" className="fill-by-accent" />)}
        {labels.map((label, i) => label && (
          <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-by-muted text-by-caption">{label}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="stroke-by-line-strong" />
            <circle cx={x(hover)} cy={y(values[hover])} r="4.5" strokeWidth="2" className="fill-by-surface stroke-by-accent" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-by-md bg-by-text px-2.5 py-1.5 text-by-caption text-by-on-accent shadow-by-floating"
          style={{ left: Math.max(60, Math.min(width - 60, x(hover))), top: y(values[hover]) - 10 }}
        >
          <span className="opacity-80">{nameOf(hover)}</span> <b className="font-semibold tabular-nums">{format(values[hover])}</b>
          {before && <span className="opacity-80"> · before {format(before[hover])}</span>}
        </div>
      )}
      <ul className="sr-only">
        {values.map((n, i) => <li key={i}>{nameOf(i)}: {format(n)}{before ? `, ${format(before[i])} the period before` : ""}</li>)}
      </ul>
    </div>
  );
}
