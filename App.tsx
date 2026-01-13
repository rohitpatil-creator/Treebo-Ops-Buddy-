
import React, { useState, useMemo } from 'react';
import { AppStatus, HotelReport, GroundingSource } from './types';
import { fetchHotelReport } from './services/geminiService';
import { InfoSection, DataRow } from './components/InfoSection';
import * as XLSX from 'xlsx';

const THVLogo = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left Column - Dark Brown */}
    <rect width="33.33" height="100" fill="#3d1a11" />
    <text x="16.66" y="65" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="42" fill="white" textAnchor="middle">T</text>
    
    {/* Middle Column - Terracotta */}
    <rect x="33.33" width="33.34" height="100" fill="#C04D2E" />
    <text x="50" y="65" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="42" fill="white" textAnchor="middle">H</text>
    
    {/* Right Column - Dark Brown */}
    <rect x="66.67" width="33.33" height="100" fill="#3d1a11" />
    <text x="83.33" y="65" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="42" fill="white" textAnchor="middle">V</text>
  </svg>
);

type SortKey = 'name' | 'size';
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  const [hotelName, setHotelName] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [report, setReport] = useState<HotelReport | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName || !city) return;

    setStatus(AppStatus.SEARCHING);
    setError(null);
    setReport(null);
    setSortConfig(null);
    try {
      const result = await fetchHotelReport(hotelName, city);
      setReport(result.data);
      setSources(result.sources);
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error("Scout Error:", err);
      setError(err.message || "An unexpected error occurred during property scouting.");
      setStatus(AppStatus.ERROR);
    }
  };

  const exportToExcel = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Basic Info & Ratings
    const basicInfo = [
      ["PROPERTY SUMMARY", ""],
      ["Field", "Value"],
      ["Hotel Name", report.basic_info.hotel_name],
      ["City", report.basic_info.city],
      ["Segment", report.basic_info.segment],
      ["Micro Market", report.basic_info.micro_market || "N/A"],
      ["Style", report.basic_info.property_style],
      ["Year Built", report.basic_info.year_built || "N/A"],
      ["Description", report.basic_info.overview_description],
      ["", ""],
      ["OTA RATINGS", ""],
      ["Platform", "Score", "Review Count"],
      ...Object.entries(report.ota_ratings).map(([key, val]) => {
        const rating = val as { score: number; count: number } | undefined;
        return [
          key.toUpperCase(),
          rating?.score || "N/A",
          rating?.count || 0
        ];
      })
    ];
    const wsBasic = XLSX.utils.aoa_to_sheet(basicInfo);
    XLSX.utils.book_append_sheet(wb, wsBasic, "Summary & Ratings");

    // Sheet 2: Revenue & ARR with MoM Growth
    const revenueHeaders = [["Month", "ARR (INR)", "Occupancy (%)", "MoM Occupancy Growth (%)"]];
    const revenueData = (report.revenue_insights || []).map((item, i) => {
      const prev = i > 0 ? report.revenue_insights![i - 1] : null;
      const growth = (prev && prev.occupancy > 0)
        ? (((item.occupancy - prev.occupancy) / prev.occupancy) * 100).toFixed(2) + '%'
        : "N/A (Baseline)";
      return [
        item.month,
        item.arr,
        item.occupancy,
        growth
      ];
    });
    const wsRevenue = XLSX.utils.aoa_to_sheet([...revenueHeaders, ...revenueData]);
    XLSX.utils.book_append_sheet(wb, wsRevenue, "Revenue Intelligence");

    // Sheet 3: Inventory
    const inventoryHeaders = [["OTA Room Type", "Size (Sqft)", "View", "Flooring", "Connected", "Amenities", "Cancellation Policy"]];
    const inventoryData = (report.room_details?.categories || []).map(cat => [
      cat.name,
      cat.size_sqft || "N/A",
      cat.view_type || "Standard",
      cat.flooring_type || "N/A",
      cat.connected_rooms ? "Yes" : "No",
      (cat.amenities || []).join(", "),
      cat.cancellation_policy || "N/A"
    ]);
    const wsInventory = XLSX.utils.aoa_to_sheet([...inventoryHeaders, ...inventoryData]);
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory Matrix");

    // Sheet 4: Operational Details & Negative Points
    const opsData = [
      ["CATEGORY", "PARAMETER", "STATUS / VALUE"],
      ["Amenities", "Infinity Pool", report.amenities.infinity_pool ? "Yes" : "No"],
      ["Amenities", "Gym Available", report.amenities.gym.available ? "Yes" : "No"],
      ["Amenities", "EV Charging", report.amenities.ev_charging.available ? "Yes" : "No"],
      ["Amenities", "Power Backup", report.amenities.power_backup.type || "N/A"],
      ["Safety", "24/7 Manned Security", report.safety_and_structure.security.manned_24x7 ? "Yes" : "No"],
      ["Dining", "Pure Veg", report.dining.pure_veg ? "Yes" : "No"],
      ["Critique", "Negative Points Identified", (report.negative_points || []).join(" | ")]
    ];
    const wsOps = XLSX.utils.aoa_to_sheet(opsData);
    XLSX.utils.book_append_sheet(wb, wsOps, "Operational Specs");

    XLSX.writeFile(wb, `${report.basic_info.hotel_name.replace(/\s+/g, '_')}_Intel_Report.xlsx`);
  };

  const getNumericSize = (sizeStr?: string) => {
    if (!sizeStr) return 0;
    const numericPart = sizeStr.replace(/[^\d.]/g, '');
    const val = parseFloat(numericPart);
    return isNaN(val) ? 0 : val;
  };

  const sortedCategories = useMemo(() => {
    if (!report?.room_details?.categories) return [];
    let categories = [...report.room_details.categories];
    
    if (sortConfig !== null) {
      categories.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'name') {
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
        } else if (sortConfig.key === 'size') {
          aValue = getNumericSize(a.size_sqft);
          bValue = getNumericSize(b.size_sqft);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return categories;
  }, [report, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderRoomSize = (size_sqft?: string | number) => {
    if (size_sqft === undefined || size_sqft === null || size_sqft === 'N/A' || size_sqft === '—' || size_sqft === '') {
      return <span className="text-slate-300">N/A</span>;
    }
    
    const strVal = String(size_sqft);
    const numericPart = strVal.replace(/[^\d.]/g, '');
    const sqft = parseFloat(numericPart);
    
    if (isNaN(sqft)) return <span className="text-slate-600 font-medium">{strVal}</span>;
    
    const sqm = (sqft * 0.092903).toFixed(1);
    return (
      <div className="flex flex-col">
        <span className="text-slate-900 font-bold">{sqft} sq. ft.</span>
        <span className="text-slate-400 text-[10px] uppercase font-black tracking-widest leading-none mt-0.5">~{sqm} m²</span>
      </div>
    );
  };

  const getPeakPax = () => {
    if (!report) return '—';
    const capacities = [
      ...(report.banquet_and_conference?.banquet_halls || []).map(h => Number(h.capacity) || 0),
      ...(report.banquet_and_conference?.conference_halls || []).map(h => Number(h.capacity) || 0)
    ];
    const max = Math.max(0, ...capacities);
    return max > 0 ? `${max} Pax` : 'N/A';
  };

  const renderRatingBar = (score: number, max: number = 5) => {
    if (!score || score === 0) return <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"></div>;
    const percentage = (score / max) * 100;
    let colorClass = "bg-red-500";
    if (score >= max * 0.8) colorClass = "bg-[#C04D2E]"; 
    else if (score >= max * 0.6) colorClass = "bg-amber-500";

    return (
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 selection:bg-orange-100 font-sans text-slate-900">
      {/* Header - THV Dark Brown Gradient */}
      <header className="bg-gradient-to-br from-[#3d1a11] to-[#2a120c] text-white py-10 px-4 shadow-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-5 mb-4">
            <div className="bg-white p-1 rounded shadow-lg flex items-center justify-center overflow-hidden">
              <THVLogo />
            </div>
            <div>
              <h1 className="text-3xl tracking-tight drop-shadow-sm flex items-baseline gap-2">
                <span className="font-black text-white">THV</span> 
                <span className="font-light text-orange-100 opacity-80">Ops Buddy</span>
              </h1>
              <p className="text-orange-50/60 font-medium text-[10px] uppercase tracking-[0.3em]">Property Intelligence Aggregator</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mt-8 bg-white p-2 rounded-xl shadow-2xl flex flex-col md:flex-row gap-2 border border-white/10">
            <div className="flex-1 relative">
              <i className="fa-solid fa-hotel absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input 
                type="text" 
                placeholder="Enter Property Name..." 
                className="w-full pl-12 pr-4 py-4 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C04D2E] bg-slate-50 border-none transition-all placeholder:text-slate-400 font-medium"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                required
              />
            </div>
            <div className="w-full md:w-64 relative">
              <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input 
                type="text" 
                placeholder="City" 
                className="w-full pl-12 pr-4 py-4 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C04D2E] bg-slate-50 border-none transition-all placeholder:text-slate-400 font-medium"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={status === AppStatus.SEARCHING}
              className="bg-[#C04D2E] hover:bg-[#a63d22] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-4 px-10 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap uppercase tracking-widest text-xs"
            >
              {status === AppStatus.SEARCHING ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Gathering Intel...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass-chart"></i>
                  Scout Property
                </>
              )}
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 -mt-6">
        {status === AppStatus.IDLE && (
          <div className="bg-white rounded-2xl p-16 text-center shadow-2xl border border-slate-100 mt-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                <i className="fa-solid fa-microchip text-[#3d1a11] text-4xl animate-pulse"></i>
              </div>
              <h2 className="text-2xl font-black text-[#3d1a11] mb-3">Omni-Platform Scout</h2>
              <p className="text-slate-500 mb-10 leading-relaxed font-medium">Synchronizing operational metrics across Google and major OTAs to create an unshakeable Ground Truth for property intelligence.</p>
              <div className="flex flex-wrap justify-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-10">
                <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><i className="fa-solid fa-check text-[#C04D2E]"></i> Verified Ratings</span>
                <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><i className="fa-solid fa-check text-[#C04D2E]"></i> Asset Analysis</span>
                <span className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100"><i className="fa-solid fa-check text-[#C04D2E]"></i> Safety Audits</span>
              </div>
            </div>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-red-700 flex flex-col items-center gap-4 mt-12 text-center shadow-lg">
            <i className="fa-solid fa-circle-exclamation text-4xl mb-2"></i>
            <div>
              <h4 className="text-lg font-black uppercase tracking-tight">Intelligence Blocked</h4>
              <p className="text-sm mt-1 max-w-lg mx-auto opacity-80 font-medium">{error}</p>
            </div>
            <button 
              onClick={() => setStatus(AppStatus.IDLE)}
              className="mt-4 px-8 py-3 bg-[#3d1a11] text-white rounded-lg font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-md"
            >
              Restart Session
            </button>
          </div>
        )}

        {status === AppStatus.COMPLETED && report && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Download Action Bar */}
            <div className="flex justify-end mb-6 mt-4">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-[#C04D2E] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-50 hover:border-[#C04D2E]/30 transition-all shadow-sm"
              >
                <i className="fa-solid fa-file-excel text-lg"></i>
                Download Intel Report (.xlsx)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
              {/* Sidebar */}
              <div className="lg:col-span-4 space-y-6">
                <InfoSection title="Property Core Identity" icon="fa-solid fa-address-card">
                  <h2 className="text-xl font-black text-[#3d1a11] mb-3 leading-tight uppercase tracking-tight">
                    {report.basic_info?.hotel_name || hotelName}
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-2.5 py-1 bg-orange-50 text-[#C04D2E] text-[10px] font-black rounded uppercase tracking-widest border border-orange-100">
                      {report.basic_info?.segment || 'Standard'}
                    </span>
                    <span className="px-2.5 py-1 bg-stone-50 text-[#3d1a11] text-[10px] font-black rounded uppercase tracking-widest border border-stone-100">
                      {report.basic_info?.property_style || 'Hotel'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 italic font-medium">
                    {report.basic_info?.overview_description || 'Synthesized property intelligence from multiple sources.'}
                  </p>
                  <DataRow label="Regional Hub" value={report.basic_info?.micro_market} />
                  <DataRow label="Opening Year" value={report.basic_info?.year_built} />
                </InfoSection>

                {/* OTA Content Critique Section - NEW */}
                <InfoSection title="OTA Content & Guest Critique" icon="fa-solid fa-triangle-exclamation">
                  <div className="space-y-3">
                    {report.negative_points && report.negative_points.length > 0 ? (
                      report.negative_points.map((point, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl group shadow-sm">
                          <i className="fa-solid fa-circle-minus text-rose-400 mt-1 flex-shrink-0"></i>
                          <p className="text-[11px] font-bold text-rose-900 leading-relaxed italic">{point}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 px-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <i className="fa-solid fa-circle-check text-emerald-500 text-xl mb-2"></i>
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-tight">No Critical Content Gaps Identified</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[9px] text-slate-400 italic font-medium">Based on customer feedback and description audits across OTAs.</p>
                </InfoSection>

                <InfoSection title="Market Sentiment" icon="fa-solid fa-star-half-stroke">
                  <div className="space-y-5">
                    {[
                      { key: 'google', label: 'Google Business', icon: 'fa-brands fa-google', max: 5 },
                      { key: 'makemytrip', label: 'MakeMyTrip', icon: 'fa-solid fa-plane-up', max: 5 },
                      { key: 'goibibo', label: 'Goibibo', icon: 'fa-solid fa-g', max: 5 },
                      { key: 'booking_com', label: 'Booking.com', icon: 'fa-solid fa-b', max: 10 },
                      { key: 'agoda', label: 'Agoda', icon: 'fa-solid fa-a', max: 10 },
                      { key: 'easemytrip', label: 'EaseMyTrip', icon: 'fa-solid fa-e', max: 5 },
                      { key: 'yatra', label: 'Yatra', icon: 'fa-solid fa-y', max: 5 },
                      { key: 'treebo', label: 'Internal Scan', icon: 'fa-solid fa-magnifying-glass', max: 5 }
                    ].map(ota => {
                      const data = (report.ota_ratings as any)?.[ota.key];
                      const hasData = data && data.score > 0;
                      
                      return (
                        <div key={ota.key} className={`space-y-1.5 ${!hasData ? 'opacity-30' : ''}`}>
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                              <i className={`${ota.icon} text-[10px] ${hasData ? 'text-[#C04D2E]' : 'text-slate-400'}`}></i>
                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{ota.label}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-800">{hasData ? data.score : '—'}</span>
                              {hasData && <span className="text-[10px] text-slate-400 ml-0.5">/{ota.max}</span>}
                            </div>
                          </div>
                          {renderRatingBar(hasData ? data.score : 0, ota.max)}
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                            {hasData ? `${data.count?.toLocaleString()} Data points` : 'No Entry'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </InfoSection>

                <InfoSection title="External Mapping" icon="fa-solid fa-up-right-from-square">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'MMT', link: report.external_links?.mmt_link, color: 'text-red-600' },
                      { label: 'Goibibo', link: report.external_links?.goibibo_link, color: 'text-orange-600' },
                      { label: 'Booking', link: report.external_links?.booking_com_link, color: 'text-blue-800' },
                      { label: 'Agoda', link: report.external_links?.agoda_link, color: 'text-purple-700' },
                      { label: 'EMT', link: report.external_links?.easemytrip_link, color: 'text-sky-600' },
                      { label: 'Yatra', link: report.external_links?.yatra_link, color: 'text-red-800' },
                      { label: 'Google', link: report.external_links?.google_listing, color: 'text-blue-600' },
                      { label: 'Treebo', link: report.external_links?.treebo_link, color: 'text-[#C04D2E]' }
                    ].map((platform, i) => platform.link ? (
                      <a 
                        key={i} 
                        href={platform.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center gap-1.5 hover:bg-orange-50 hover:border-orange-200 transition-all group shadow-sm"
                      >
                          <span className={`text-[10px] font-black uppercase tracking-widest ${platform.color}`}>{platform.label}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[8px] text-slate-300 group-hover:text-[#3d1a11]"></i>
                      </a>
                    ) : null)}
                  </div>
                </InfoSection>
              </div>

              {/* Main Report Body */}
              <div className="lg:col-span-8 space-y-8">
                {/* 6-Month Revenue Visual Intelligence */}
                <InfoSection title="Market Performance Insights (Last 6 Months)" icon="fa-solid fa-chart-line-up">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <span className="text-[10px] uppercase font-black text-orange-400 tracking-widest block mb-1">Average ARR</span>
                        <span className="text-2xl font-black text-[#C04D2E]">
                           ₹{report.revenue_insights && report.revenue_insights.length > 0 
                             ? Math.round(report.revenue_insights.reduce((acc, curr) => acc + curr.arr, 0) / report.revenue_insights.length).toLocaleString()
                             : '—'
                           }
                        </span>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <span className="text-[10px] uppercase font-black text-stone-400 tracking-widest block mb-1">Avg Occupancy</span>
                        <span className="text-2xl font-black text-[#3d1a11]">
                           {report.revenue_insights && report.revenue_insights.length > 0 
                             ? Math.round(report.revenue_insights.reduce((acc, curr) => acc + curr.occupancy, 0) / report.revenue_insights.length)
                             : '—'
                           }%
                        </span>
                      </div>
                   </div>
                   
                   <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                          <th className="px-6 py-4 text-left">Financial Month</th>
                          <th className="px-6 py-4 text-right">ARR (INR)</th>
                          <th className="px-6 py-4 text-right">Occupancy %</th>
                          <th className="px-6 py-4 text-right">MoM Growth (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(report.revenue_insights || []).map((rev, i) => {
                          const prevRev = i > 0 ? report.revenue_insights![i - 1] : null;
                          let growth = null;
                          if (prevRev && prevRev.occupancy > 0) {
                            growth = ((rev.occupancy - prevRev.occupancy) / prevRev.occupancy) * 100;
                          }
                          return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-black text-[#3d1a11]">{rev.month}</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-600">₹{rev.arr.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-bold text-slate-600">{rev.occupancy}%</span>
                                  <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#C04D2E]" style={{ width: `${rev.occupancy}%` }}></div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {growth !== null ? (
                                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter shadow-sm border ${growth >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                    <i className={`fa-solid fa-caret-${growth >= 0 ? 'up' : 'down'}`}></i>
                                    {Math.abs(growth).toFixed(1)}% MoM
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Baseline</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                   </div>
                </InfoSection>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InfoSection title="Physical Assets" icon="fa-solid fa-warehouse">
                    <DataRow label="Total Unit Count" value={report.room_details?.total_inventory} />
                    <DataRow label="Fitness Infrastructure" value={report.amenities?.gym?.available} />
                    <DataRow label="Power Redundancy" value={report.amenities?.power_backup?.type || 'Standard'} />
                    <DataRow label="Utility (Laundry)" value={report.amenities?.laundry_service} />
                    <DataRow label="Property Approach" value={report.location_intelligence?.approach_type} />
                    <DataRow label="EV Infrastructure" value={report.amenities?.ev_charging?.available} />
                  </InfoSection>

                  <InfoSection title="Operational Safety Matrix" icon="fa-solid fa-lock">
                    <DataRow label="Guarded Security" value={report.safety_and_structure?.security?.manned_24x7} />
                    <DataRow label="Lady Staff on Duty" value={report.safety_and_structure?.security?.lady_staff} />
                    <DataRow label="Surveillance (CCTV)" value={report.safety_and_structure?.cctv?.entrance_cctv} />
                    <DataRow label="Elevator Safety Type" value={report.safety_and_structure?.elevator?.door_type} />
                    <DataRow label="Elevator Access Type" value={report.safety_and_structure?.elevator?.access_type} />
                    <DataRow label="Room Sprinklers" value={report.safety_and_structure?.fire_safety?.sprinklers_in_rooms} />
                    <DataRow label="Common Area Sprinklers" value={report.safety_and_structure?.fire_safety?.sprinklers_in_common_areas} />
                    <DataRow label="Life Safety Policy" value={report.safety_and_structure?.fire_safety?.safety_measures_in_rooms} />
                    <DataRow label="Medical Emergency" value={report.safety_and_structure?.doctor_on_call} />
                  </InfoSection>
                </div>

                <InfoSection title="Unit Inventory Matrix" icon="fa-solid fa-list-check">
                  <div className="overflow-x-auto -mx-6 px-6 pb-2">
                    <table className="w-full text-left text-sm min-w-[750px]">
                      <thead className="text-slate-400 border-b border-slate-100 uppercase tracking-widest text-[10px] font-black">
                        <tr>
                          <th 
                            className="pb-5 pr-4 cursor-pointer hover:text-[#C04D2E] transition-colors"
                            onClick={() => requestSort('name')}
                          >
                            <div className="flex items-center gap-1.5">
                              Public Room Type (OTA)
                              {sortConfig?.key === 'name' ? (
                                <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-[8px]`}></i>
                              ) : (
                                <i className="fa-solid fa-sort text-[8px] opacity-30"></i>
                              )}
                            </div>
                          </th>
                          <th 
                            className="pb-5 pr-4 cursor-pointer hover:text-[#C04D2E] transition-colors"
                            onClick={() => requestSort('size')}
                          >
                            <div className="flex items-center gap-1.5">
                              Area (Sqft)
                              {sortConfig?.key === 'size' ? (
                                <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'} text-[8px]`}></i>
                              ) : (
                                <i className="fa-solid fa-sort text-[8px] opacity-30"></i>
                              )}
                            </div>
                          </th>
                          <th className="pb-5 pr-4">Visual Specs</th>
                          <th className="pb-5 pr-4">Operational Terms</th>
                          <th className="pb-5 text-center">Inter-Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(sortedCategories || []).map((cat, i) => (
                          <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-5 font-black text-[#3d1a11] pr-4 align-top">
                              {cat.name}
                            </td>
                            <td className="py-5 pr-4 align-top">{renderRoomSize(cat.size_sqft)}</td>
                            <td className="py-5 pr-4 align-top">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{cat.view_type || 'Standard'}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(cat.amenities || []).slice(0, 4).map((am, idx) => (
                                      <span key={idx} className="bg-white text-slate-400 text-[8px] px-2 py-0.5 rounded border border-slate-200 uppercase font-black tracking-tighter">
                                      {am}
                                      </span>
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="py-5 pr-4 align-top">
                              <div className="flex flex-col gap-1 max-w-[200px]">
                                  <span className="text-[10px] font-bold text-slate-400 leading-snug">
                                      {cat.cancellation_policy || 'Standard Brand Terms'}
                                  </span>
                              </div>
                            </td>
                            <td className="py-5 text-center align-top">
                              {cat.connected_rooms ? <i className="fa-solid fa-link text-[#C04D2E] text-sm"></i> : <i className="fa-solid fa-minus text-slate-100"></i>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </InfoSection>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <InfoSection title="MICE Infrastructure" icon="fa-solid fa-briefcase">
                    <DataRow label="Meeting Venues" value={(report.banquet_and_conference?.conference_halls?.length || 0) + (report.banquet_and_conference?.banquet_halls?.length || 0)} />
                    <DataRow label="Max PAX Capacity" value={getPeakPax()} />
                    <DataRow label="Banquet Climate" value={report.banquet_and_conference?.banquet_halls?.[0]?.ac_available} />
                    <DataRow label="AV/Music Capability" value={report.banquet_and_conference?.events?.dj_available || report.banquet_and_conference?.events?.live_music} />
                  </InfoSection>

                  <InfoSection title="Culinary Services" icon="fa-solid fa-utensils">
                    <DataRow label="Breakfast Type" value={report.dining?.breakfast_type || 'Standard'} />
                    <DataRow label="Vegetarian Kitchen" value={report.dining?.pure_veg} />
                    <DataRow label="Liquor Provisions" value={report.dining?.liquor_allowed} />
                    <DataRow label="Engagement (Happy Hours)" value={report.dining?.happy_hours?.available} />
                  </InfoSection>
                </div>

                <InfoSection title="Territorial Analysis" icon="fa-solid fa-map-location-dot">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <i className="fa-solid fa-city"></i> Commercial Hubs
                      </h4>
                      <div className="space-y-2.5">
                        {(report.location_intelligence?.business_hubs || []).length > 0 ? report.location_intelligence.business_hubs.map((hub, i) => (
                          <div key={i} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-orange-200 transition-all shadow-sm">
                            <span className="text-xs font-black text-slate-700 truncate mr-3">{hub.name}</span>
                            <span className="text-[10px] font-black px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[#3d1a11] whitespace-nowrap">{hub.distance}</span>
                          </div>
                        )) : (
                          <p className="text-[11px] text-slate-300 italic font-medium">No districts found.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <i className="fa-solid fa-camera"></i> Regional Landmarks
                      </h4>
                      <div className="space-y-2.5">
                        {(report.location_intelligence?.tourist_spots || []).length > 0 ? report.location_intelligence.tourist_spots.map((spot, i) => (
                          <div key={i} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-orange-200 transition-all shadow-sm">
                            <span className="text-xs font-black text-slate-700 truncate mr-3">{spot.name}</span>
                            <span className="text-[10px] font-black px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[#C04D2E] whitespace-nowrap">{spot.distance}</span>
                          </div>
                        )) : (
                          <p className="text-[11px] text-slate-300 italic font-medium">No landmarks found.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </InfoSection>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-5 text-center z-10 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2">
          <span className="w-4 h-4 rounded-sm flex overflow-hidden scale-75 border border-slate-100">
            <span className="flex-1 bg-[#3d1a11]"></span>
            <span className="flex-1 bg-[#C04D2E]"></span>
            <span className="flex-1 bg-[#3d1a11]"></span>
          </span>
          THV Ops Buddy • Official Operational Support Interface
        </p>
      </footer>
    </div>
  );
};

export default App;
