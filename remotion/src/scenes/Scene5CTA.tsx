import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { fonts } from "../MainVideo";

export const Scene5CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterSpring = spring({ frame, fps, config: { damping: 10, stiffness: 160 } });
  const enterScale = interpolate(enterSpring, [0, 1], [0.3, 1]);

  const urlSpring = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const urlY = interpolate(urlSpring, [0, 1], [60, 0]);

  const brandSpring = spring({ frame: frame - 30, fps, config: { damping: 14 } });

  // Pulse on the CTA
  const pulse = 1 + Math.sin(frame * 0.25) * 0.04;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 180,
        color: "#FFFFFF",
        letterSpacing: -4,
        textShadow: "0 0 50px #FFD93D, 0 0 100px #FF3030, 8px 8px 0 #000",
        WebkitTextStroke: "3px #000",
        transform: `scale(${enterScale * pulse})`,
        lineHeight: 1,
      }}>
        ENTER
      </div>
      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 180,
        color: "#FFD93D",
        letterSpacing: -4,
        textShadow: "0 0 50px #FF3030, 8px 8px 0 #000",
        WebkitTextStroke: "3px #000",
        transform: `scale(${enterScale * pulse})`,
        marginBottom: 40,
        lineHeight: 1,
      }}>
        NOW
      </div>

      <div style={{
        padding: "24px 50px",
        background: "linear-gradient(90deg, #FF3030, #FF8C00)",
        borderRadius: 12,
        boxShadow: "0 0 40px rgba(255,80,0,0.8), inset 0 -6px 0 rgba(0,0,0,0.4)",
        opacity: interpolate(urlSpring, [0, 1], [0, 1]),
        transform: `translateY(${urlY}px)`,
        marginBottom: 40,
      }}>
        <div style={{
          fontFamily: fonts.inter,
          fontWeight: 900,
          fontSize: 52,
          color: "#FFF",
          letterSpacing: 1,
          textShadow: "2px 2px 0 #000",
        }}>
          agevers.com/giveaway
        </div>
      </div>

      <div style={{
        fontFamily: fonts.inter,
        fontWeight: 700,
        fontSize: 36,
        color: "#FFD93D",
        letterSpacing: 8,
        opacity: interpolate(brandSpring, [0, 1], [0, 1]),
        textShadow: "0 0 20px #FF3030",
      }}>
        AGEVER'S
      </div>
    </AbsoluteFill>
  );
};
