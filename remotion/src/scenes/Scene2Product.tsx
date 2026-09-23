import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { fonts } from "../MainVideo";

export const Scene2Product = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const titleY = interpolate(titleSpring, [0, 1], [-100, 0]);
  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const line1Spring = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const line2Spring = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const line3Spring = spring({ frame: frame - 26, fps, config: { damping: 14 } });

  // Pulsing background glow
  const pulse = 0.5 + Math.sin(frame * 0.15) * 0.2;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{
        background: `radial-gradient(circle at center, rgba(255,40,0,${pulse * 0.4}) 0%, transparent 60%)`,
      }} />

      <div style={{
        fontFamily: fonts.inter,
        fontSize: 36,
        color: "#FFD93D",
        letterSpacing: 12,
        fontWeight: 700,
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        marginBottom: 40,
        textShadow: "0 0 20px #FF3030",
      }}>
        ★ THE PRIZE ★
      </div>

      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 140,
        color: "#FFFFFF",
        letterSpacing: -2,
        textAlign: "center",
        lineHeight: 1.05,
        textShadow: "0 0 30px #FF0000, 8px 8px 0 #000",
        WebkitTextStroke: "2px #000",
      }}>
        <div style={{
          opacity: interpolate(line1Spring, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(line1Spring, [0, 1], [-200, 0])}px)`,
        }}>
          MORTAL
        </div>
        <div style={{
          opacity: interpolate(line2Spring, [0, 1], [0, 1]),
          transform: `translateX(${interpolate(line2Spring, [0, 1], [200, 0])}px)`,
        }}>
          KOMBAT
        </div>
        <div style={{
          marginTop: 20,
          fontSize: 200,
          color: "#FFD93D",
          opacity: interpolate(line3Spring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(line3Spring, [0, 1], [0.3, 1])})`,
          textShadow: "0 0 50px #FF6B00, 8px 8px 0 #000",
        }}>
          1+2+3
        </div>
      </div>
    </AbsoluteFill>
  );
};
