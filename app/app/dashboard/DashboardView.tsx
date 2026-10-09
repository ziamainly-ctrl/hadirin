import './dashboard.css';
import AttentionCard from './AttentionCard';
import FeedCard from './FeedCard';
import HeatCard from './HeatCard';
import HoursCard from './HoursCard';
import KpiStrip from './KpiStrip';
import OnboardingCard from './OnboardingCard';
import StatusCard from './StatusCard';
import TrendCard from './TrendCard';
import { buildSetupSteps } from './model';
import type { DashboardData } from './model';
import type { SetupProgress } from '@/lib/queries/dashboard-insights';

/**
 * The admin dashboard body: a KPI strip over a grid of six small cards, all of it one viewport tall on
 * a desktop (layout and density tiers live in dashboard.css; the cards that do not fit a short window
 * are hidden there, not squeezed). Server-rendered from `loadDashboard`; <AutoRefresh> in the page
 * header re-renders it every 30 s, so numbers count to their new value and nothing replays.
 * An organization with nothing to chart gets the "Mulai di sini" card instead.
 */
export default function DashboardView({ data, setup }: { data: DashboardData; setup: SetupProgress | null }) {
  if (data.empty) {
    return (
      <OnboardingCard
        steps={buildSetupSteps(setup ?? { branches: 0, shifts: 0, trackedPeople: 0, hasOwnCheckIn: false })}
        orgWide={data.orgWide}
      />
    );
  }
  return (
    <div className="dash">
      <KpiStrip kpis={data.kpis} />
      <div className="dash-cards">
        <TrendCard points={data.trend} order={1} />
        <StatusCard stats={data.stats} branches={data.branches} holidayName={data.holidayName} order={2} />
        <HoursCard hours={data.hours} order={3} />
        <HeatCard heatmap={data.heatmap} orgWide={data.orgWide} order={4} />
        <AttentionCard data={data.attention} order={5} />
        <FeedCard items={data.feed} timeZone={data.timeZone} order={6} />
      </div>
    </div>
  );
}
