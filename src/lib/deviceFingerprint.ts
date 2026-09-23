// Generate a simple device fingerprint based on browser properties
export const getDeviceFingerprint = (): string => {
  const nav = window.navigator;
  const screen = window.screen;

  const components = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    `${screen.width}x${screen.height}`,
    nav.hardwareConcurrency,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.platform,
  ];

  // Simple hash
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
};
