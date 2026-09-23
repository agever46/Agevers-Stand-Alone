import { AbsoluteFill, useCurrentFrame, interpolate, random } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { loadFont } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Product } from "./scenes/Scene2Product";
import { Scene3Features } from "./scenes/Scene3Features";
import { Scene4Price } from "./scenes/Scene4Price";
import { Scene5CTA } from "./scenes/Scene5CTA";

const { fontFamily: orbitron } = loadFont("normal", { weights: ["700", "900"], subsets: ["latin"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "700", "900"], subsets: ["latin"] });

export const fonts = { orbitron, inter };

const TRANSITION_FRAMES = 12;
const springCfg = { config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES };

export const MainVideo = () => {
  const frame = useCurrentFrame();

  // Subtle red/black arcade backdrop with flicker
  const flicker = Math.sin(frame * 0.8) * 3 + Math.sin(frame * 2.3) * 2;
  const bg1 = `hsl(0, 70%, ${5 + flicker * 0.2}%)`;
  const bg2 = `hsl(15, 60%, ${10 + flicker * 0.3}%)`;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${bg2}, ${bg1} 70%, #000 100%)` }}>
      <Embers frame={frame} />
      <Scanlines />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={70}>
          <Scene1Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming(springCfg)} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene2Product />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming(springCfg)} />
        <TransitionSeries.Sequence durationInFrames={70}>
          <Scene3Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming(springCfg)} />
        <TransitionSeries.Sequence durationInFrames={70}>
          <Scene4Price />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming(springCfg)} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <Scene5CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>

    </AbsoluteFill>
  );
};

const Embers = ({ frame }: { frame: number }) => {
  const particles = Array.from({ length: 35 }, (_, i) => {
    const seed = random(`p-${i}`);
    const x = seed * 1080;
    const speed = 0.6 + random(`s-${i}`) * 1.4;
    const y = 1920 - ((frame * speed + i * 80) % 2200);
    const size = 2 + random(`sz-${i}`) * 4;
    const opacity = interpolate(y, [-100, 400, 1600, 2000], [0, 0.9, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const wobble = Math.sin((frame + i * 30) * 0.05) * 30;
    const hue = 10 + random(`h-${i}`) * 30;
    return (
      <div key={i} style={{
        position: "absolute", left: x + wobble, top: y, width: size, height: size,
        borderRadius: "50%",
        background: `hsl(${hue}, 100%, 60%)`,
        boxShadow: `0 0 ${size * 4}px hsl(${hue}, 100%, 50%)`,
        opacity,
      }} />
    );
  });
  return <AbsoluteFill>{particles}</AbsoluteFill>;
};

const Scanlines = () => (
  <AbsoluteFill style={{
    background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 4px)",
    pointerEvents: "none",
    mixBlendMode: "multiply",
  }} />
);

const Vignette = () => (
  <AbsoluteFill style={{
    background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)",
    pointerEvents: "none",
  }} />
);
