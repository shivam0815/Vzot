import React from 'react';

const VZOTBackground: React.FC = () => (
  <div className="fixed inset-0 -z-10">
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(1200px 700px at 20% 10%, rgba(0,255,180,0.18), transparent 60%),\
           radial-gradient(900px 600px at 85% 20%, rgba(3,180,140,0.18), transparent 60%),\
           radial-gradient(1000px 700px at 50% 100%, rgba(0,0,0,0.55), rgba(0,0,0,0.85))',
      }}
    />
    <div
      className="absolute inset-0 opacity-70"
      style={{
        background:
          'conic-gradient(from 210deg at 70% 40%, rgba(18,170,120,0.20), rgba(0,0,0,0.2), rgba(0,140,110,0.25), rgba(0,0,0,0.25), rgba(18,170,120,0.20))',
        filter: 'saturate(1.1)',
      }}
    />
    <div
      className="absolute inset-0 mix-blend-overlay opacity-[0.08] pointer-events-none"
      style={{
      // tiny inline noise
        backgroundImage:
          'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+qY8QxQAAAABJRU5ErkJggg==)',
      }}
    />
    <div
      className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full blur-[90px] opacity-60"
      style={{ background: 'linear-gradient(140deg, #25F4B7, #0B7C67)' }}
    />
    <div
      className="absolute top-40 right-[-120px] h-[520px] w-[520px] rounded-full blur-[100px] opacity-50"
      style={{ background: 'linear-gradient(160deg, #0A1E28, #0D2E3A)' }}
    />
  </div>
);

export default VZOTBackground;
