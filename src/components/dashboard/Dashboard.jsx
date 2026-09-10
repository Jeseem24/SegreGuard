import React, { useState, useEffect } from 'react';
import {
  subscribeToWasteEvents,
  subscribeToBins,
  subscribeToHospitalRequests,
  approveAndDispatchToLogistics,
  adminDirectRequest,
  HOSPITALS,
  calculateSlaStatus
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { 
  Building2, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Scale, 
  TrendingUp, 
  Layers, 
  Activity, 
  Sparkles,
  QrCode,
  Truck,
  Send,
  UserCheck,
  AlertCircle,
  PackageCheck,
  MapPin,
  ChevronRight,
  Plus
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const [selectedHospitalId, setSelectedHospitalId] = useState('hosp-apex');
  const [events, setEvents] = useState([]);
  const [bins, setBins] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('wards'); // 'wards' | 'products' | 'manifest'
  const [selectedWard, setSelectedWard] = useState('ward-1');
  const [actionNotice, setActionNotice] = useState(null);
  const [exportedToast, setExportedToast] = useState(false);

  const hospital = HOSPITALS[selectedHospitalId] || HOSPITALS['hosp-apex'];

  useEffect(() => {
    const unsubEvents = subscribeToWasteEvents(null, (data) => setEvents(data || []));
    const unsubBins = subscribeToBins((data) => setBins(data || []));
    const unsubReqs = subscribeToHospitalRequests(selectedHospitalId, (data) => setRequests(data || []));

    return () => {
      unsubEvents();
      unsubBins();
      unsubReqs();
    };
  }, [selectedHospitalId]);

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Admin approves incoming nurse request and forwards to Logistics
  const handleApproveNurseRequest = async (requestId, wardName) => {
    try {
      await approveAndDispatchToLogistics(requestId, `Approved by Hospital Infection Control Admin for ${wardName}`);
      showNotice(`Request approved! Dispatched to CBWTF Logistics Transporter ✓`);
    } catch (err) {
      console.error('Failed to approve request:', err);
    }
  };

  // Admin directly creates logistics request for critical wards
  const handleDirectAdminDispatch = async () => {
    try {
      await adminDirectRequest({
        hospitalId: selectedHospitalId,
        wardIds: ['ward-1', 'ward-2'],
        urgency: 'CRITICAL',
        reason: 'Hospital Admin initiated scheduled bio-medical collection for high-fill wards'
      });
      showNotice(`Collection request sent directly to regional CBWTF fleet!`);
    } catch (err) {
      console.error('Failed to dispatch admin request:', err);
    }
  };

  // Metrics computation for THIS hospital
  const hospitalBins = bins.filter(b => !b.hospitalId || b.hospitalId === selectedHospitalId);
  const hospitalEvents = events.filter(e => !e.hospitalId || e.hospitalId === selectedHospitalId);
  
  const scansCount = hospitalEvents.length;
  const overrides = hospitalEvents.filter(e => e.wasEdited).length;
  const aiAccuracy = scansCount > 0 ? Math.round(((scansCount - overrides) / scansCount) * 100) : 98;
  
  // Pending nurse requests awaiting admin approval
  const nurseRequests = requests.filter(r => r.status === 'nurse_pending');
  // Requests already forwarded/accepted by logistics
  const activeLogisticsRequests = requests.filter(r => r.status === 'logistics_pending' || r.status === 'accepted');

  const criticalSlaBins = hospitalBins.filter(b => {
    const sla = calculateSlaStatus(b.slaDeadline);
    return sla.status === 'CRITICAL' || sla.status === 'BREACH';
  }).length;

  const currentWardData = hospital.wards[selectedWard] || hospital.wards['ward-1'];
  const currentWardBins = hospitalBins.filter(b => b.wardId === selectedWard);

  const handleExportCSV = () => {
    const headers = ['Manifest ID', 'Hospital', 'Ward', 'Room', 'Waste Description', 'CPCB Category', 'Rule Citation', 'Logged At', 'Confidence'];
    const rows = hospitalEvents.map(e => [
      e.id || 'EVT-704',
      hospital.name,
      e.wardId || 'ward-1',
      `"${e.room || 'General'}"`,
      `"${e.itemLabel || 'Biomedical Waste'}"`,
      e.category ? e.category.toUpperCase() : 'YELLOW',
      `"${e.ruleCitation || 'CPCB BMW Rules 2016'}"`,
      e.createdAt || new Date().toISOString(),
      `${Math.round((e.confidence || 0.95) * 100)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPCB_Manifest_${hospital.shortName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportedToast(true);
    setTimeout(() => setExportedToast(false), 3500);
  };

  return (
    <div className="dash">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="dash__toast-floating">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Hospital Identity & Header Strip */}
      <div className="dash__hospital-header">
        <div className="dash__hospital-profile">
          <div className="dash__hospital-avatar">
            <Building2 size={24} />
          </div>
          <div>
            <div className="dash__hospital-title-row">
              <h2 className="dash__hospital-name">{hospital.name}</h2>
              <span className="dash__accreditation-pill">CPCB ACCREDITED</span>
            </div>
            <p className="dash__hospital-address">
              <MapPin size={12} />
              {hospital.address} • {hospital.bedCount} Beds
            </p>
          </div>
        </div>

        {/* Hospital Switcher dropdown (Apex Memorial default) */}
        <div className="dash__hospital-selector-wrap">
          <span className="dash__selector-label">HOSPITAL NODE:</span>
          <select 
            className="dash__hospital-select"
            value={selectedHospitalId}
            onChange={(e) => {
              setSelectedHospitalId(e.target.value);
              setSelectedWard('ward-1');
            }}
          >
            {Object.values(HOSPITALS).map(h => (
              <option key={h.id} value={h.id}>{h.shortName} ({h.cityZone.split('(')[0]})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action / Notification Banner Strip: Nurse Requests & Direct Dispatch */}
      <div className="dash__action-dock">
        {nurseRequests.length > 0 ? (
          <div className="dash__nurse-requests-banner">
            <div className="dash__banner-left">
              <span className="dash__banner-alert-icon">
                <AlertCircle size={16} />
              </span>
              <div>
                <h4 className="dash__banner-title">
                  {nurseRequests.length} Incoming Ward Pickup Request{nurseRequests.length > 1 ? 's' : ''}
                </h4>
                <p className="dash__banner-desc">
                  {nurseRequests[0].reason} • {nurseRequests[0].room}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="dash__approve-dispatch-btn"
              onClick={() => handleApproveNurseRequest(nurseRequests[0].id, nurseRequests[0].wardName)}
            >
              <CheckCircle2 size={14} />
              <span>Confirm & Dispatch to Logistics</span>
            </button>
          </div>
        ) : (
          <div className="dash__standby-banner">
            <div className="dash__standby-text">
              <UserCheck size={16} className="text-emerald" />
              <span>All internal ward disposal points are monitored. Zero unhandled nurse requests.</span>
            </div>
            <button
              type="button"
              className="dash__direct-dispatch-btn"
              onClick={handleDirectAdminDispatch}
            >
              <Truck size={14} />
              <span>Request Logistics Waste Pickup</span>
            </button>
          </div>
        )}

        {/* Active Logistics Fleet Transit Status */}
        {activeLogisticsRequests.length > 0 && (
          <div className="dash__logistics-status-pill">
            <span className="dash__pulse-dot" />
            <span>
              <strong>CBWTF Transit Active:</strong> {activeLogisticsRequests[0].hospitalShortName} ({activeLogisticsRequests[0].wardName}) — {activeLogisticsRequests[0].status === 'accepted' ? 'Driver En Route' : 'In Logistics Queue'}
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="dash__metrics-grid">
        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">Items Segregated</span>
              <CheckCircle2 size={16} className="text-sky" />
            </div>
            <span className="metric-card__value">{scansCount}</span>
            <span className="metric-card__sub">At {hospital.shortName}</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">AI Segregation Accuracy</span>
              <ShieldCheck size={16} className="text-emerald" />
            </div>
            <span className="metric-card__value metric-card__value--green">{aiAccuracy}%</span>
            <span className="metric-card__sub">Schedule I verified</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">Active CBWTF Dispatches</span>
              <TrendingUp size={16} className="text-amber" />
            </div>
            <span className="metric-card__value metric-card__value--amber">
              {activeLogisticsRequests.length}
            </span>
            <span className="metric-card__sub">Transporter Fleet</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">48h SLA Integrity</span>
              <Clock size={16} className={criticalSlaBins > 0 ? 'text-red' : 'text-emerald'} />
            </div>
            <span className={`metric-card__value ${criticalSlaBins > 0 ? 'metric-card__value--red' : 'metric-card__value--green'}`}>
              {criticalSlaBins > 0 ? `${criticalSlaBins} At Risk` : '100% OK'}
            </span>
            <span className="metric-card__sub">Statutory compliance</span>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="dash__views">
        <button
          type="button"
          className={`dash__view-tab ${activeView === 'wards' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('wards')}
        >
          <Building2 size={15} />
          <span>Ward & Room Diagnostics</span>
        </button>
        <button
          type="button"
          className={`dash__view-tab ${activeView === 'products' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('products')}
        >
          <PackageCheck size={15} />
          <span>Recently Added Products ({hospitalEvents.length})</span>
        </button>
        <button
          type="button"
          className={`dash__view-tab ${activeView === 'manifest' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('manifest')}
        >
          <FileSpreadsheet size={15} />
          <span>CPCB Form IV Manifest</span>
        </button>
      </div>

      {/* VIEW 1: Hospital Wards & Specific Rooms Telemetry */}
      {activeView === 'wards' && (
        <div className="internal-wards-view">
          <div className="internal-wards-header">
            <div>
              <h3 className="internal-wards-title">Hospital Ward & Room Diagnostics</h3>
              <p className="internal-wards-sub">Select any ward below to inspect specific rooms, beds, and statutory 4-color bin fill gauges</p>
            </div>
          </div>

          {/* Wards Grid */}
          <div className="internal-wards-grid">
            {Object.entries(hospital.wards).map(([wId, ward]) => {
              const wardBins = hospitalBins.filter(b => b.wardId === wId);
              const maxFill = Math.max(0, ...wardBins.map(b => b.fillPercent || 0));
              const isSelected = selectedWard === wId;
              const hasAlert = maxFill >= 80;

              return (
                <div 
                  key={wId}
                  className={`ward-tile ${isSelected ? 'ward-tile--selected' : ''} ${hasAlert ? 'ward-tile--alert' : ''}`}
                  onClick={() => setSelectedWard(wId)}
                >
                  <div className="ward-tile__header">
                    <div>
                      <span className="ward-tile__floor">{ward.floor}</span>
                      <h4 className="ward-tile__name">{ward.name}</h4>
                    </div>
                    <span className={`ward-tile__fill-badge ${hasAlert ? 'ward-tile__fill-badge--crit' : ''}`}>
                      {maxFill}% Max Fill
                    </span>
                  </div>

                  {/* Rooms list inside this ward */}
                  <div className="ward-tile__rooms">
                    <span className="ward-tile__rooms-label">Specific Rooms / Bays:</span>
                    <div className="ward-tile__rooms-tags">
                      {ward.rooms?.map((r, rIdx) => (
                        <span key={rIdx} className="ward-room-chip">{r}</span>
                      ))}
                    </div>
                  </div>

                  {/* 4-bin mini fill bar indicator */}
                  <div className="ward-tile__mini-bars">
                    {['yellow', 'red', 'white', 'blue'].map(cat => {
                      const b = wardBins.find(item => item.category === cat) || { fillPercent: 0 };
                      const cInfo = CATEGORY_INFO[cat] || CATEGORY_INFO.unknown;
                      return (
                        <div key={cat} className="ward-tile__mini-col">
                          <div className="ward-tile__bar-track">
                            <div 
                              className="ward-tile__bar-fill"
                              style={{ 
                                height: `${b.fillPercent || 0}%`,
                                background: cInfo.color 
                              }}
                            />
                          </div>
                          <span className="ward-tile__bar-label">{cat[0].toUpperCase()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Ward Bin Detail Matrix */}
          <div className="ward-detail">
            <div className="ward-detail__top">
              <div>
                <h4 className="ward-detail__title">{currentWardData.name} — Detailed Bin Telemetry</h4>
                <p className="ward-detail__location">{currentWardData.floor} • {currentWardData.bedCount} Beds</p>
              </div>
              <span className="ward-detail__active-badge">Active Inspection</span>
            </div>

            <div className="ward-detail__bins-grid">
              {currentWardBins.map(bin => {
                const info = CATEGORY_INFO[bin.category] || CATEGORY_INFO.unknown;
                const sla = calculateSlaStatus(bin.slaDeadline);

                return (
                  <div key={bin.id} className="ward-bin-card" style={{ '--bin-color': info.color }}>
                    <div className="ward-bin-card__header">
                      <div className="ward-bin-card__title">
                        <span className="ward-bin-card__dot" />
                        <span>{info.label}</span>
                      </div>
                      <span className="ward-bin-card__fill-text">{bin.fillPercent || 0}%</span>
                    </div>

                    <div className="ward-bin-card__bar">
                      <div
                        className="ward-bin-card__fill"
                        style={{
                          width: `${bin.fillPercent || 0}%`,
                          background: (bin.fillPercent >= 80) ? '#ef4444' : info.color
                        }}
                      />
                    </div>

                    <div className="ward-bin-card__footer">
                      <span className="ward-bin-card__barcode">{bin.barcodeId}</span>
                      <span className={`ward-bin-card__sla-badge ward-bin-card__sla-badge--${sla.status.toLowerCase()}`}>
                        {sla.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Recently Added Products & Clinical Feed */}
      {activeView === 'products' && (
        <div className="products-view">
          <div className="products-view__header">
            <div>
              <h3 className="products-view__title">Recently Added Bio-Medical Products</h3>
              <p className="products-view__sub">Live audit trail of waste logged inside {hospital.name} with ward and room specificity</p>
            </div>
          </div>

          <div className="products-list">
            {hospitalEvents.length === 0 ? (
              <div className="products-empty">
                <PackageCheck size={36} className="text-sky" />
                <p>No products have been scanned today yet at {hospital.shortName}.</p>
              </div>
            ) : (
              hospitalEvents.map((evt, idx) => {
                const cInfo = CATEGORY_INFO[evt.category] || CATEGORY_INFO.unknown;
                const wardName = hospital.wards[evt.wardId]?.name || evt.wardId || 'ICU-3';
                const roomName = evt.room || (hospital.wards[evt.wardId]?.rooms?.[0] || 'Ward Station');
                const timeStr = evt.createdAt
                  ? new Date(evt.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : 'Just now';

                return (
                  <div key={evt.id || idx} className="product-row" style={{ '--row-accent': cInfo.color }}>
                    <div className="product-row__left">
                      <div 
                        className="product-row__category-tag"
                        style={{ background: `${cInfo.color}18`, borderColor: `${cInfo.color}50`, color: cInfo.color }}
                      >
                        <span className="product-row__dot" style={{ background: cInfo.color }} />
                        <span>{cInfo.label.split(' ')[0]}</span>
                      </div>

                      <div className="product-row__details">
                        <h4 className="product-row__item-name">{evt.itemLabel}</h4>
                        <div className="product-row__meta">
                          <span className="product-row__location">
                            <MapPin size={11} />
                            <strong>{wardName}</strong> • {roomName}
                          </span>
                          <span className="product-row__user">
                            Logged by {evt.userId || 'Nurse'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="product-row__right">
                      <span className="product-row__time">{timeStr}</span>
                      <span className="product-row__rule">{evt.ruleCitation || 'CPCB 2016'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CPCB Form IV Statutory Manifest */}
      {activeView === 'manifest' && (
        <div className="manifest-container">
          <div className="manifest-header">
            <div>
              <div className="manifest-header__title-row">
                <Scale className="text-sky" size={18} />
                <h3 className="manifest-header__title">CPCB Form IV Statutory Manifest</h3>
              </div>
              <p className="manifest-header__subtitle">
                Central Pollution Control Board Bio-Medical Waste Management Rules 2016 ({hospital.shortName})
              </p>
            </div>
            <button type="button" className="manifest-export-btn" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export CSV Manifest</span>
            </button>
          </div>

          {exportedToast && (
            <div className="dash__toast-banner">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>CPCB Form IV Manifest exported successfully ({hospitalEvents.length} records).</span>
            </div>
          )}

          <div className="manifest-table-wrapper">
            <table className="manifest-table">
              <thead>
                <tr>
                  <th>MANIFEST REF</th>
                  <th>WARD / ROOM</th>
                  <th>WASTE PRODUCT</th>
                  <th>STATUTORY BIN</th>
                  <th>RULE CITATION</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {hospitalEvents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="manifest-empty-td">
                      No waste events recorded yet today. Use the AI Scanner to log entries.
                    </td>
                  </tr>
                ) : (
                  hospitalEvents.map((e, idx) => {
                    const catInfo = CATEGORY_INFO[e.category] || CATEGORY_INFO.unknown;
                    const dateStr = e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                    const wardName = hospital.wards[e.wardId]?.name || e.wardId || 'ICU-3';
                    const roomName = e.room || 'Station';

                    return (
                      <tr key={e.id || idx}>
                        <td className="manifest-ref">#{e.id ? e.id.slice(-6).toUpperCase() : `704-${idx}`}</td>
                        <td className="manifest-ward">
                          <strong>{wardName}</strong>
                          <span className="manifest-room-sub">{roomName}</span>
                        </td>
                        <td className="manifest-item">{e.itemLabel || 'Clinical Waste'}</td>
                        <td>
                          <span 
                            className="manifest-cat-badge"
                            style={{ 
                              background: `${catInfo.color}18`,
                              borderColor: `${catInfo.color}50`,
                              color: catInfo.color 
                            }}
                          >
                            {catInfo.label}
                          </span>
                        </td>
                        <td className="manifest-citation">{e.ruleCitation || 'CPCB Sched. I'}</td>
                        <td className="manifest-time">{dateStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
