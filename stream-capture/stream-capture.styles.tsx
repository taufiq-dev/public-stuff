// stream-capture.styles.tsx
import styled from "styled-components";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const SLIDE = "0.6s";

// Two flags drive the sheet, as before:
//   data-capturing — the tap was acknowledged: controls and text fade out.
//   data-closing   — the slide-down is running (after capture, or immediately on cancel).
//
// The guide geometry lives in CSS variables so the box and the instruction text derive from one
// definition. The crop reads the rendered box via getBoundingClientRect(), so it is always exactly
// what the user saw — including after URL-bar or orientation changes.
export const CameraContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  overflow: hidden;
  z-index: 10000;
  background-color: black;

  /* Dynamic viewport height where supported, so the layout tracks the URL bar. */
  --viewport-height: 100vh;
  @supports (height: 100dvh) {
    --viewport-height: 100dvh;
  }
  height: var(--viewport-height);

  --guide-inset: 16px;
  --guide-ratio: 1.65; /* 330 / 200, the original card box ratio */
  --guide-width: calc(100vw - 2 * var(--guide-inset));
  --guide-height: calc(var(--guide-width) / var(--guide-ratio));
  --guide-top: calc((var(--viewport-height) - var(--guide-height)) * 0.2);
  --guide-bottom: calc(var(--guide-top) + var(--guide-height));

  /* The controls row is as tall as the capture button; its top edge is what the text centres against. */
  --controls-bottom: 40px;
  --capture-button-size: 70px;
  --controls-top: calc(var(--viewport-height) - var(--controls-bottom) - var(--capture-button-size));

  /* CSS-only slide-up animation on mount */
  animation: slideUp ${SLIDE} ${EASE} forwards;

  @keyframes slideUp {
    from {
      transform: translateY(100vh);
    }
    to {
      transform: translateY(0);
    }
  }

  @keyframes slideDown {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(100vh);
    }
  }

  /* Slide down when closing */
  &[data-closing="true"] {
    animation: slideDown ${SLIDE} ${EASE} forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    &[data-closing="true"] {
      animation: none;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    }
  }
`;

export const CameraVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;

  &[data-ready="true"] {
    opacity: 1;
  }
`;

export const CameraPlaceholder = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #17181a;
  z-index: 2;
  transition: opacity 0.3s ease-in-out;

  &[data-ready="true"] {
    opacity: 0;
    pointer-events: none;
  }
`;

// The captured card, positioned by inline style over the exact region it was cut from. It sits
// under the dimmed surround (z-index 3 < 4), so through the guide box the user sees the real
// capture — proof that what was framed is what was taken — and it slides away with the sheet.
export const CapturedImage = styled.img`
  position: absolute;
  z-index: 3;
  object-fit: cover;
  pointer-events: none;
`;

// The dimmed surround is the box's own shadow, so the cut-out follows the border radius exactly
// and stays crisp at any device pixel ratio — no overlay canvas to size or redraw.
export const GuideBox = styled.div`
  position: absolute;
  z-index: 4;
  top: var(--guide-top);
  left: var(--guide-inset);
  width: var(--guide-width);
  height: var(--guide-height);
  box-sizing: border-box;
  border: 4px solid #fff;
  border-radius: 18px;
  box-shadow: 0 0 0 200vmax rgba(23, 24, 26, 0.8);
  pointer-events: none;
`;

// Centred on the midpoint between the guide box's bottom edge and the capture button's top edge.
export const GuidelineTextBox = styled.div`
  position: absolute;
  z-index: 10;
  top: calc((var(--guide-bottom) + var(--controls-top)) / 2);
  left: 50%;
  transform: translate(-50%, -50%);
  width: 330px;
  max-width: calc(100vw - 32px);
  text-align: center;
  transition: opacity 0.3s ease-out;

  ${CameraContainer}[data-capturing="true"] & {
    opacity: 0;
  }
`;

export const EKTPGuidelineTextTitle = styled.div`
  color: #ffffff;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.005em;
`;

export const CaptureControlsContainer = styled.div`
  position: absolute;
  bottom: var(--controls-bottom);
  left: 0;
  right: 0;
  padding: 0 24px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 10;
  transition: opacity 0.3s ease-out;

  ${CameraContainer}[data-capturing="true"] & {
    opacity: 0;
    pointer-events: none;
  }
`;

export const CancelButton = styled.button<{ $invisible?: boolean }>`
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 18px;
  font-weight: 500;
  line-height: 22.5px;
  letter-spacing: -0.005em;
  padding: 8px 16px;
  cursor: pointer;
  outline: none;

  &:active {
    opacity: 0.7;
  }

  &:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
    border-radius: 4px;
  }

  ${({ $invisible }) =>
    $invisible &&
    `
    visibility: hidden;
    pointer-events: none;
  `}
`;

export const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 32px;
  background-color: rgba(23, 39, 51, 0.85);
`;

export const ErrorText = styled.p`
  margin: 0 0 8px;
  color: #ffffff;
  font-size: 16px;
  line-height: 22px;
  text-align: center;
`;
