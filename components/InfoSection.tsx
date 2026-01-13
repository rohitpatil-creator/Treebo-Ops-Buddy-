
import React from 'react';

interface InfoSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

export const InfoSection: React.FC<InfoSectionProps> = ({ title, icon, children }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        {/* Dark Brown for Section Icons */}
        <i className={`${icon} text-[#3d1a11] text-lg`}></i>
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">{title}</h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export const DataRow: React.FC<{ label: string; value: React.ReactNode; fullWidth?: boolean }> = ({ label, value, fullWidth }) => {
  const isValueValid = value !== null && value !== undefined && value !== '';
  
  return (
    <div className={`py-2 border-b border-slate-100 last:border-0 ${fullWidth ? 'w-full' : 'flex items-center justify-between gap-4'}`}>
      <span className="text-slate-500 text-sm font-medium">{label}</span>
      <span className={`text-slate-900 font-semibold ${fullWidth ? 'block mt-1' : 'text-right text-sm'}`}>
        {value === true ? <i className="fa-solid fa-circle-check text-[#C04D2E]"></i> : 
         value === false ? <i className="fa-solid fa-circle-xmark text-red-400"></i> : 
         isValueValid ? value : '—'}
      </span>
    </div>
  );
};
