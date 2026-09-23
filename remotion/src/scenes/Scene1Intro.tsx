import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fonts } from "../MainVideo";

export const Scene1Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slamScale = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const scale = interpolate(slamScale, [0, 1], [3, 1]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const shake = frame < 18 ? Math.sin(frame * 4) * (1 - frame / 18) * 8 : 0;

  const subOpacity = interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(frame, [20, 35], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Flash on impact
  const flash = interpolate(frame, [0, 4, 12], [1, 0.6, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateX(${shake}px)` }}>
      <AbsoluteFill style={{ background: `rgba(255, 80, 0, ${flash})`, mixBlendMode: "screen" }} />

      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 220,
        color: "#FFD93D",
        letterSpacing: -4,
        opacity,
        transform: `scale(${scale})`,
        textShadow: "0 0 40px #FF3030, 0 0 80px #FF0000, 6px 6px 0 #000",
        WebkitTextStroke: "3px #000",
        lineHeight: 1,
      }}>
        WIN
      </div>

      <div style={{
        marginTop: 30,
        fontFamily: fonts.inter,
        fontWeight: 900,
        fontSize: 56,
        color: "#FFFFFF",
        letterSpacing: 8,
        opacity: subOpacity,
        transform: `translateY(${subY}px)`,
        textShadow: "0 4px 20px rgba(255,0,0,0.8)",
      }}>
        FREE GIVEAWAY
      </div>
    </AbsoluteFill>
  );
};
