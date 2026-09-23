import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { fonts } from "../MainVideo";

export const Scene4Price = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stamp = spring({ frame, fps, config: { damping: 8, stiffness: 200 } });
  const rotation = interpolate(stamp, [0, 1], [-25, -8]);
  const scale = interpolate(stamp, [0, 1], [3, 1]);

  const subSpring = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const daySpring = spring({ frame: frame - 35, fps, config: { damping: 12, stiffness: 180 } });

  // Pulsing urgency
  const pulse = 1 + Math.sin(frame * 0.3) * 0.05;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily: fonts.inter,
        fontWeight: 900,
        fontSize: 48,
        color: "#FFFFFF",
        letterSpacing: 6,
        opacity: interpolate(subSpring, [0, 1], [0, 1]),
        marginBottom: 30,
        textShadow: "0 0 20px #FF0000",
      }}>
        ENDS SOON
      </div>

      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 280,
        color: "#FFD93D",
        letterSpacing: -8,
        transform: `rotate(${rotation}deg) scale(${scale * pulse})`,
        textShadow: "0 0 60px #FF3030, 12px 12px 0 #000",
        WebkitTextStroke: "4px #000",
        lineHeight: 1,
      }}>
        APR 29
      </div>

      <div style={{
        marginTop: 40,
        fontFamily: fonts.inter,
        fontWeight: 700,
        fontSize: 44,
        color: "#FFD93D",
        letterSpacing: 2,
        opacity: interpolate(daySpring, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(daySpring, [0, 1], [40, 0])}px)`,
        textAlign: "center",
      }}>
        LAST CHANCE TO WIN
      </div>
    </AbsoluteFill>
  );
};
