import { useId } from "react";
import type { BoardSide } from "./project";

export function DemoBoard({ side, visibility }: { side: BoardSide; visibility: Readonly<Record<string, boolean>> }) {
  const id = useId().replace(/:/g, "");
  const clipId = `gw-demo-clip-${id}`;
  const shadowId = `gw-demo-shadow-${id}`;
  const boardGradientId = `gw-demo-board-${id}`;
  const copperGradientId = `gw-demo-copper-${id}`;
  const faceTransform = side === "bottom" ? "translate(760 0) scale(-1 1)" : undefined;
  const holes = Array.from({ length: 30 }, (_, index) => ({
    x: 143 + (index % 10) * 51 + (index % 2) * 8,
    y: 105 + Math.floor(index / 10) * 127,
    r: index % 7 === 0 ? 8 : 5,
  }));

  return (
    <svg className="gw-demo-board" viewBox="0 0 760 470" role="img" aria-labelledby={`gw-demo-title-${id}`}>
      <title id={`gw-demo-title-${id}`}>Interactive demonstration circuit board, {side} side</title>
      <defs>
        <clipPath id={clipId}>
          <path d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z" />
        </clipPath>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#020806" floodOpacity=".38" />
        </filter>
        <linearGradient id={boardGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#127657" />
          <stop offset=".52" stopColor="#095c45" />
          <stop offset="1" stopColor="#073f32" />
        </linearGradient>
        <linearGradient id={copperGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#f4cb76" />
          <stop offset=".48" stopColor="#c98a30" />
          <stop offset="1" stopColor="#f0bd5d" />
        </linearGradient>
      </defs>
      <g transform={faceTransform}>
        <path
          d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z"
          fill="#031d17"
          filter={`url(#${shadowId})`}
          transform="translate(0 8)"
        />
        <g clipPath={`url(#${clipId})`}>
          {visibility["demo-mask"] ? (
            <path d="M45 34h642v399H45z" fill={`url(#${boardGradientId})`} />
          ) : (
            <path d="M45 34h642v399H45z" fill="#a66e2b" />
          )}
          {visibility["demo-bottom"] && side === "bottom" ? (
            <g fill="none" stroke="#b8752d" strokeWidth="12" opacity=".68">
              <path d="M105 116h97l54 54h134l83-83h164" />
              <path d="M92 357h181l77-77h129l98 98h92" />
              <path d="M153 227h112l45 45h223l71-71" />
            </g>
          ) : null}
          {visibility["demo-copper"] && side === "top" ? (
            <g fill="none" stroke={`url(#${copperGradientId})`} strokeLinecap="round" strokeLinejoin="round">
              <path d="M98 119h118l46 46h117l63-63h189" strokeWidth="10" />
              <path d="M104 343h122l57-57h118l77 77h158" strokeWidth="12" />
              <path d="M124 235h99l44-44h87l58 58h189" strokeWidth="7" />
              <path d="M302 88v54m80 151v72M534 91v65M185 286v76" strokeWidth="6" />
              <path d="M108 178h78l34 34m267 75 38 38h107" strokeWidth="4" opacity=".8" />
            </g>
          ) : null}
          {visibility["demo-copper"] ? (
            <g fill="#e1aa48" opacity=".94">
              {holes.map((hole, index) => (
                <circle key={`pad-${index}`} cx={hole.x} cy={hole.y} r={hole.r + 5} />
              ))}
            </g>
          ) : null}
          {visibility["demo-drill"] ? (
            <g fill="#061c17" stroke="#f1c067" strokeWidth="2">
              {holes.map((hole, index) => (
                <circle key={`hole-${index}`} cx={hole.x} cy={hole.y} r={hole.r} />
              ))}
              <circle cx="106" cy="91" r="14" />
              <circle cx="625" cy="91" r="14" />
              <circle cx="106" cy="376" r="14" />
              <circle cx="625" cy="376" r="14" />
            </g>
          ) : null}
          <g>
            <rect x="292" y="177" width="134" height="105" rx="9" fill="#101613" stroke="#657068" strokeWidth="2" />
            <rect x="131" y="151" width="68" height="51" rx="5" fill="#151b17" stroke="#657068" />
            <rect x="518" y="235" width="76" height="58" rx="5" fill="#151b17" stroke="#657068" />
            <g fill="#c4b48c">
              {Array.from({ length: 7 }, (_, index) => (
                <g key={index}>
                  <rect x={300 + index * 18} y="166" width="7" height="13" />
                  <rect x={300 + index * 18} y="281" width="7" height="13" />
                </g>
              ))}
            </g>
          </g>
          {visibility["demo-silk"] ? (
            <g fill="none" stroke="#eef1e7" strokeWidth="2" opacity=".9">
              <path d="M278 161h162v137H278z" />
              <path d="M118 139h95v77h-95zM505 220h102v88H505z" />
              <path d="M82 118v-28h74M579 390h67v-42" />
              <text x="91" y="332" fill="#eef1e7" stroke="none" fontFamily="ui-monospace, monospace" fontSize="13" letterSpacing="2">
                TRACE WORKS / POWER STAGE R1.4
              </text>
              <text x="318" y="231" fill="#d8ded6" stroke="none" fontFamily="ui-monospace, monospace" fontSize="12">
                GAN CTRL
              </text>
            </g>
          ) : null}
        </g>
        {visibility["demo-outline"] ? (
          <path
            d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z"
            fill="none"
            stroke="#6ed0a8"
            strokeWidth="3"
          />
        ) : null}
      </g>
    </svg>
  );
}

