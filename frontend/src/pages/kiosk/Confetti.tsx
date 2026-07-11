import { useMemo } from "react";

const COLORS = ["#ff3b8d", "#ffc233", "#8b5cf6", "#22d3c6", "#ff8a3b", "#fff"];
const EMOJI_SET = ["💐", "✨", "👑", "🦄", "🍩", "😎"];

interface ConfettoStyle extends React.CSSProperties {
  "--sway": string;
}

function randomPiece(i: number): { key: string; className: string; style: ConfettoStyle } {
  const left = Math.round(Math.random() * 100);
  const size = 8 + Math.round(Math.random() * 10);
  const fallDur = (7 + Math.random() * 6).toFixed(1);
  const fallDelay = (Math.random() * 8).toFixed(1);
  const spinDur = (1.4 + Math.random() * 2.2).toFixed(1);
  const spinDelay = (Math.random() * 3).toFixed(1);
  const flapDur = (0.6 + Math.random() * 0.8).toFixed(1);
  const flapDelay = (Math.random() * 2).toFixed(1);
  const sway = (20 + Math.random() * 40).toFixed(0);
  const color = COLORS[i % COLORS.length];
  const circle = i % 3 === 0;
  const anim = circle
    ? `fall ${fallDur}s linear infinite -${fallDelay}s, spin ${spinDur}s linear infinite -${spinDelay}s`
    : `fall ${fallDur}s linear infinite -${fallDelay}s, spin ${spinDur}s linear infinite -${spinDelay}s, flap ${flapDur}s ease-in-out infinite -${flapDelay}s`;
  return {
    key: `c${i}`,
    className: "confetto" + (circle ? " circle" : ""),
    style: {
      left: `${left}%`,
      width: `${size}px`,
      height: `${circle ? size : size * 1.6}px`,
      background: color,
      "--sway": `${sway}px`,
      animation: anim,
    },
  };
}

function randomEmojiPiece(): { key: string; style: ConfettoStyle; emoji: string } {
  const emoji = EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)];
  const left = 8 + Math.round(Math.random() * 84);
  const fallDur = 60;
  const fallDelay = Math.round(Math.random() * 60);
  const spinDur = (1.4 + Math.random() * 2.2).toFixed(1);
  const spinDelay = (Math.random() * 3).toFixed(1);
  const sway = (20 + Math.random() * 40).toFixed(0);
  return {
    key: "emoji",
    emoji,
    style: {
      left: `${left}%`,
      "--sway": `${sway}px`,
      animation: `fall ${fallDur}s linear infinite -${fallDelay}s, spin ${spinDur}s linear infinite -${spinDelay}s`,
    },
  };
}

export default function Confetti({ density = 18 }: { density?: number }) {
  const pieces = useMemo(() => Array.from({ length: density }, (_, i) => randomPiece(i)), [density]);
  const emojiPiece = useMemo(() => randomEmojiPiece(), []);

  return (
    <div className="confetti-layer">
      {pieces.map((p) => (
        <div key={p.key} className={p.className} style={p.style} />
      ))}
      <div className="confetto emoji" style={emojiPiece.style}>
        {emojiPiece.emoji}
      </div>
    </div>
  );
}
