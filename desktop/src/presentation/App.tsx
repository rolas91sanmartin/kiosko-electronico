import { useEffect, useState } from 'react';
import { AttendanceScreen } from './attendance/AttendanceScreen';
import { ReportsScreen } from './reports/ReportsScreen';

type Screen = 'attendance' | 'reports';

export function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get('screen') === 'reports' ? 'reports' : 'attendance'
  );

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setScreen((current) => current === 'attendance' ? 'reports' : 'attendance');
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  return screen === 'attendance'
    ? <AttendanceScreen onOpenReports={() => setScreen('reports')} />
    : <ReportsScreen onBack={() => setScreen('attendance')} />;
}
