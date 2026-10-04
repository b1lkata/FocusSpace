import { useEffect, useState } from 'react';
export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => { const media = matchMedia('(max-width: 760px)'); const change = () => setPhone(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return phone;
}
