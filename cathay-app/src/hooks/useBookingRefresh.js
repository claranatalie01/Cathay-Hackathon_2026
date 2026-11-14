import { useEffect } from 'react';
import { notifyDataChanged } from '../api';

const EVERY_MS = 15000;

// Other members book on their own phones, so quietly re-read the screen every 15 seconds while it is
// visible, and again as soon as the tab comes back into view.
export function useBookingRefresh() {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') notifyDataChanged();
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
}
