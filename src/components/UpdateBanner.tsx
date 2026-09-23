import { useRegisterSW } from 'virtual:pwa-register/react';

// When a new version has been deployed, the service worker downloads it in
// the background and we show this banner. The app only reloads when you tap
// "Update", so nothing you're typing gets lost.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="banner" role="status">
      <span>A new version is available.</span>
      <button className="btn small" onClick={() => updateServiceWorker(true)}>Update</button>
      <button className="btn small ghost" onClick={() => setNeedRefresh(false)}>Later</button>
    </div>
  );
}
