export function graphicsProfile(quality, touchDevice) {
  const highDesktop = quality === "high" && !touchDevice;
  const high = quality === "high";

  return {
    shadows: highDesktop,
    bloom: highDesktop,
    msaa: highDesktop ? 2 : 0,
    shadowMapSize: highDesktop ? 2048 : 1024,
    maxPixelRatio: touchDevice ? high ? 1.35 : 1.1 : high ? 1.75 : 1.15,
    dustCount: highDesktop ? 22 : 10
  };
}
