import { useId, useMemo } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    CURRENCY_INFO,
    formatDay,
    formatMoney,
    formatShortDay,
    formatTime,
} from '../lib/format';
import { usePrivacy } from '../lib/privacy';

const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
});

function Tip({ active, payload, currency }) {
    const { hidden } = usePrivacy();

    if (!active || !payload?.length) return null;

    const point = payload[0].payload;

    return (
        <div className="chart-tip">
            <strong>
                {hidden ? '••••' : formatMoney(point.balance, currency)}
            </strong>

            {point.kind === 'baseline' ? (
                <span>Balance before displayed transactions</span>
            ) : (
                <span>
          {formatDay(point.ts)}, {formatTime(point.ts)}
        </span>
            )}

            {point.kind === 'snapshot' && (
                <span>Balance at refresh</span>
            )}

            {point.tx?.description && (
                <span>{point.tx.description}</span>
            )}
        </div>
    );
}

export default function BalanceChart({ points, currency }) {
    const { hidden } = usePrivacy();
    const instanceId = useId();
    const color = CURRENCY_INFO[currency]?.color ?? '#2C4FDB';
    const gradientId =
        `fill-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const chartPoints = useMemo(
        () => points.map((point) => ({
            ...point,
            // Approximation is used only for drawing.
            chartBalance: Number(point.balance),
        })),
        [points],
    );

    if (points.length < 2) {
        return (
            <p className="empty">
                The balance chart appears after the first transaction.
            </p>
        );
    }

    return (
        <div
            className="chart"
            role="img"
            aria-label={`Balance history for the ${currency} wallet`}
        >
            <ResponsiveContainer width="100%" height={230}>
                <AreaChart
                    data={chartPoints}
                    margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
                >
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={color}
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="100%"
                                stopColor={color}
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} stroke="#D5DBE6" />

                    <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatShortDay}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={56}
                        tick={{ fontSize: 12, fill: '#56657B' }}
                    />

                    <YAxis
                        width={56}
                        domain={[0, 'auto']}
                        tickFormatter={(value) =>
                            hidden ? '•••' : compact.format(value)
                        }
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: '#56657B' }}
                    />

                    <Tooltip
                        content={<Tip currency={currency} />}
                        cursor={{
                            stroke: '#0D1B2E',
                            strokeOpacity: 0.25,
                        }}
                    />

                    <Area
                        type="stepAfter"
                        dataKey="chartBalance"
                        stroke={color}
                        strokeWidth={2.25}
                        fill={`url(#${gradientId})`}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}