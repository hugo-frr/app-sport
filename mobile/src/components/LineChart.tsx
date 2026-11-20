import { useState } from 'react';
import { LayoutChangeEvent, Platform, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { formatShortDate } from '@/lib/format';
import { colors, type } from '@/theme';

const FONT = Platform.select({ web: '-apple-system, system-ui, sans-serif', default: undefined });

export interface ChartPoint {
  date: string;
  value: number;
}

/** Courbe de progression : aire en dégradé dans la couleur du type d'exercice, ligne du record en pointillé or. */
export function LineChart({
  points,
  format = (v) => String(v),
  height = 220,
  recordValue,
  color = colors.force,
}: {
  points: ChartPoint[];
  format?: (v: number) => string;
  height?: number;
  recordValue?: number | null;
  color?: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={type.subhead}>Pas encore de données</Text>
      </View>
    );
  }

  const padX = 12;
  const padT = 28;
  const padB = 26;
  const values = points.map((p) => p.value);
  let min = Math.min(...values, recordValue ?? Infinity);
  let max = Math.max(...values, recordValue ?? -Infinity);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  min -= range * 0.15;
  max += range * 0.1;
  const innerW = Math.max(width - padX * 2, 1);
  const innerH = height - padT - padB;
  const x = (i: number) => padX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`;
  const last = points[points.length - 1];
  const lx = x(points.length - 1);
  const ly = y(last.value);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((t) => (
            <Line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={padT + innerH * t}
              y2={padT + innerH * t}
              stroke={colors.separator}
              strokeWidth={0.5}
            />
          ))}
          <Path d={area} fill="url(#area)" />
          {recordValue != null && (
            <Line
              x1={padX}
              x2={width - padX}
              y1={y(recordValue)}
              y2={y(recordValue)}
              stroke={colors.record}
              strokeDasharray="3 5"
              strokeWidth={1.5}
            />
          )}
          <Path d={line} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={lx} cy={ly} r={6} fill={colors.card} stroke={color} strokeWidth={3} />
          <SvgText
            fontFamily={FONT}
            x={Math.min(Math.max(lx, 40), width - padX)}
            y={ly - 14}
            fontSize={13}
            fontWeight="800"
            fill={colors.text}
            textAnchor={lx > width - 40 ? 'end' : 'middle'}
          >
            {format(last.value)}
          </SvgText>
          <SvgText fontFamily={FONT} x={padX} y={height - 6} fontSize={11} fill={colors.secondary}>
            {formatShortDate(points[0].date)}
          </SvgText>
          {points.length > 1 && (
            <SvgText fontFamily={FONT} x={width - padX} y={height - 6} fontSize={11} fill={colors.secondary} textAnchor="end">
              {formatShortDate(last.date)}
            </SvgText>
          )}
        </Svg>
      )}
    </View>
  );
}
