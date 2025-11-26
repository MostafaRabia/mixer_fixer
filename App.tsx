import React, { useState } from 'react';
import { LiveInterface } from './components/LiveInterface';
import { SpeakerWaveIcon, WrenchScrewdriverIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const startSession = () => {
    setHasStarted(true);
    setInCall(true);
  };

  const endSession = () => {
    setInCall(false);
    // Optionally reset hasStarted if you want to show the splash screen again
    // setHasStarted(false); 
  };

  if (inCall) {
    return <LiveInterface onDisconnect={endSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-blue-600 rounded-full blur-3xl"></div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 text-center max-w-md mx-auto w-full">
        
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 rounded-full"></div>
          <SpeakerWaveIcon className="w-24 h-24 text-emerald-400 relative z-10" />
        </div>

        <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
          مهندس الصوت
          <span className="block text-xl text-emerald-400 mt-1 font-normal">للمساجد</span>
        </h1>

        <p className="text-slate-300 mb-10 text-lg leading-relaxed">
          هل تواجه مشكلة "صدى" أو "زنة" في سماعات المسجد؟
          <br />
          افتح الكاميرا وسيقوم الذكاء الاصطناعي بمساعدتك في ضبط الجهاز فوراً.
        </p>

        <button
          onClick={startSession}
          className="group relative w-full max-w-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-emerald-900/50 transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="flex items-center justify-center gap-3 text-xl">
             <WrenchScrewdriverIcon className="w-6 h-6" />
             ابـدأ الفحص الآن
          </span>
        </button>

        <div className="mt-12 grid grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <ShieldCheckIcon className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            تحليل بصري للإعدادات
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <SpeakerWaveIcon className="w-6 h-6 mx-auto mb-2 text-orange-400" />
            استماع وتحليل للصوت
          </div>
        </div>

        <footer className="absolute bottom-6 text-xs text-slate-600">
           مدعوم بواسطة Gemini 2.5
        </footer>

      </main>
    </div>
  );
};

export default App;