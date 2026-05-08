import { motion } from 'framer-motion';

export function Navbar() {
  return (
    <motion.nav
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="sticky top-0 z-50 px-5 py-3"
      style={{
        background: 'rgba(11,20,34,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">

        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg,#1A5276,#2E86C1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M12 3C12 3 5 10.5 5 15.5a7 7 0 0 0 14 0C19 10.5 12 3 12 3z"
                    fill="white" opacity="0.9" />
              <path d="M8 15.5a4 4 0 0 0 4 4" stroke="rgba(93,173,226,0.7)"
                    strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="font-mono text-t1 font-bold text-sm tracking-wide">
              Prédiction Sécheresse Maroc
            </div>
            <div className="text-t2 text-xs">Surveillance SPI · Bassins Versants · Ensemble ML</div>
          </div>
        </div>

        {/* Authors */}
        <div className="hidden xl:block font-mono text-t3 text-xs tracking-wider">
          EL HIOUILE Z. &nbsp;·&nbsp; HARBAL S. &nbsp;·&nbsp; BOUCETTA A. &nbsp;·&nbsp; EL ASAD A.
        </div>

        {/* Badges + live */}
        <div className="flex items-center gap-2">
          <span className="bdg">Mai 2026</span>
          <span className="bdg hidden sm:inline-flex">Ensemble Stacking</span>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md"
               style={{ background: 'rgba(30,132,73,0.1)', border: '1px solid rgba(30,132,73,0.25)' }}>
            <span className="live-dot" />
            <span className="font-mono text-xs font-bold" style={{ color: '#27AE60' }}>EN DIRECT</span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
