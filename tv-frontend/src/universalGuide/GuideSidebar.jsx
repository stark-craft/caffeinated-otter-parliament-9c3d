export default function Sidebar() {
  return (
    <nav className="sidebar ug-sidebar" aria-label="TV home menu" data-ug-row="sidebar">
      <div className="sidebar-avatar" role="button" tabIndex={0} aria-label="TV profile" data-ug-focus="rail-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21v-1a6 6 0 0112 0v1"/>
        </svg>
      </div>

      <div className="sidebar-item" title="Search" role="button" tabIndex={0} aria-label="Search" data-ug-focus="rail-1">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5"/>
          <line x1="15.5" y1="15.5" x2="20" y2="20"/>
        </svg>
      </div>

      <div className="sidebar-item" title="Ambient" role="button" tabIndex={0} aria-label="Ambient" data-ug-focus="rail-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="14" rx="2"/>
          <path d="M2 14l5-4 3 3 4-5 8 6"/>
          <circle cx="16" cy="8" r="2"/>
        </svg>
      </div>

      <div className="sidebar-item" title="Daily+" role="button" tabIndex={0} aria-label="Daily plus" data-ug-focus="rail-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
        </svg>
      </div>

      <div className="sidebar-item active" title="Home" role="button" tabIndex={0} aria-label="Home" data-ug-focus="rail-home">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4dd9e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l9-8 9 8"/>
          <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
        </svg>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-item" title="Connected Devices" role="button" tabIndex={0} aria-label="Connected devices" data-ug-focus="rail-5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="13" rx="2"/>
          <line x1="8" y1="20" x2="16" y2="20"/>
          <line x1="12" y1="16" x2="12" y2="20"/>
          <path d="M7 9h2m6 0h2"/>
        </svg>
      </div>

      <div className="sidebar-item" title="Settings" role="button" tabIndex={0} aria-label="Settings" data-ug-focus="rail-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </div>

      <div className="sidebar-item" title="Privacy Choices" role="button" tabIndex={0} aria-label="Privacy choices" data-ug-focus="rail-7">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
    </nav>
  );
}