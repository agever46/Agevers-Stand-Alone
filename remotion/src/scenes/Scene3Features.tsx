import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { fonts } from "../MainVideo";

const features = [
  { icon: "⚔", text: "3 LEGENDARY GAMES" },
  { icon: "🎮", text: "PC / GOG EDITION" },
  { icon: "🔥", text: "100% FREE TO ENTER" },
];

export const Scene3Features = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{
        fontFamily: fonts.orbitron,
        fontWeight: 900,
        fontSize: 80,
        color: "#FFD93D",
        marginBottom: 60,
        letterSpacing: -2,
        textShadow: "0 0 30px #FF3030, 6px 6px 0 #000",
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        WHY ENTER?
      </div>

      {features.map((f, i) => {
        const delay = 8 + i * 10;
        const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140 } });
        return (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            marginBottom: 40,
            padding: "30px 50px",
            background: "linear-gradient(90deg, rgba(255,30,0,0.4), rgba(255,150,0,0.15))",
            border: "3px solid #FFD93D",
            borderRadius: 16,
            boxShadow: "0 0 30px rgba(255,50,0,0.5)",
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateX(${interpolate(s, [0, 1], [-300, 0])}px)`,
            width: "78%",
            boxSizing: "border-box",
          }}>
            <div style={{ fontSize: 60 }}>{f.icon}</div>
            <div style={{
              fontFamily: fonts.inter,
              fontWeight: 900,
              fontSize: 36,
              color: "#FFF",
              letterSpacing: 1,
              textShadow: "2px 2px 0 #000",
            }}>
              {f.text}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
