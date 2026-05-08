import { motion } from 'framer-motion';
import { PredictionsProvider } from './context/PredictionsContext';
import { Navbar } from './components/Navbar';
import { KpiSpi, KpiT3, KpiT6, KpiAlert } from './components/KpiCard';
import { MapCard } from './components/MapCard';
import { SpiChart } from './components/SpiChart';
import { ShapChart } from './components/ShapChart';
import { AlertList } from './components/AlertList';
import { ModelsCard } from './components/ModelsCard';
import { PipelineCard } from './components/PipelineCard';

const containerV = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const kpiV = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

export default function App() {
  return (
    <PredictionsProvider>
    <div className="relative z-10 min-h-screen">
      <Navbar />

      <main className="relative z-10 max-w-screen-2xl mx-auto px-4 py-4">

        {/* ── KPI Strip ── */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3"
          variants={kpiV}
          initial="hidden"
          animate="show"
        >
          <KpiSpi />
          <KpiT3 />
          <KpiT6 />
          <KpiAlert />
        </motion.div>

        {/* ── Bento Grid ── */}
        <motion.div
          className="bento"
          variants={containerV}
          initial="hidden"
          animate="show"
        >
          <MapCard />
          <SpiChart />
          <ShapChart />
          <AlertList />
          <ModelsCard />
          <PipelineCard />
        </motion.div>

      </main>
    </div>
    </PredictionsProvider>
  );
}
