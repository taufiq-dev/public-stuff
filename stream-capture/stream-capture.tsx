// stream-capture.tsx
//
// Same flow as before: slides up on mount → user taps capture → captured image holds on screen
// while the sheet slides down → after the slide, uploadImage(dataUrl) and setStream(false).
// Cancel: onStreamCancel() → slide down → setStream(false).
//
// What changed underneath:
//   - the camera is chosen by capability scoring (useMainRearCamera), not by whichever rear lens
//     the browser happened to hand back — this is what fixes the Huawei zoom-lens problem;
//   - the KTP crop is taken from the preview frame at the stream's full resolution (a 4K preview is
//     requested) in source pixels, not from a viewport-sized canvas, so it is ~1000–2000 px wide
//     instead of ~368 px — and it is exactly what the user framed;
//   - the guide box is a DOM element and the crop reads its rendered rect, so the two can't drift;
//   - the crop carries a margin around the box for the backend (cropMargin, default 8%), and
//     uploadImage also receives where the box sits inside it, so the viewer can be shown just the
//     box (see focused-image.tsx) while the backend gets the context.

import React, { useCallback, useEffect, useRef, useState } from "react";
import CaptureButton from "./capture-button";
import type { CapturedImageMeta, StreamCaptureProps } from "./types";
import { useMainRearCamera } from "./use-main-rear-camera";
import { blobToDataUrl, capturePhoto, cropSpecFromElements, mapSourceToOverlay } from "./capture-photo";
import {
  CameraContainer,
  CameraPlaceholder,
  CameraVideo,
  CancelButton,
  CapturedImage,
  CaptureControlsContainer,
  EKTPGuidelineTextTitle,
  ErrorOverlay,
  ErrorText,
  GuideBox,
  GuidelineTextBox,
} from "./stream-capture.styles";

const SLIDE_MS = 600; // must match the slide animations in stream-capture.styles
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_CROP_MARGIN = 0.08;

const StreamCapture: React.FC<StreamCaptureProps> = ({
  cmsContent,
  uploadImage,
  setStream,
  cropMargin = DEFAULT_CROP_MARGIN,
  onClickCapture,
  onStreamCancel,
  onCameraReport,
  enableCameraSwitch = false,
  streamCaptureCancelTagIdentifier,
  streamCaptureCaptureTagIdentifier,
}) => {
  const { videoRef, state, retry, switchTo } = useMainRearCamera({ onReport: onCameraReport });
  const guideRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [isCapturing, setIsCapturing] = useState(false); // tap acknowledged: controls hidden
  const [isClosing, setIsClosing] = useState(false); // slide-down running
  // The captured card plus where it sits on screen, so it can be laid exactly over the spot it was
  // taken from while the sheet slides away.
  const [capturedImage, setCapturedImage] = useState<{ src: string; style: React.CSSProperties } | null>(
    null,
  );

  const isReady = state.status === "ready";

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  // Slide the sheet down, then hand off to the parent — the same 600 ms handshake as before.
  const closeAfterSlide = useCallback(
    (then?: () => void) => {
      setIsClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        then?.();
        setStream(false);
      }, SLIDE_MS);
    },
    [setStream],
  );

  const handleCancel = () => {
    if (isClosing) return;
    onStreamCancel?.();
    setIsCapturing(true);
    closeAfterSlide();
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (isCapturing || state.status !== "ready" || !video || !guide) return;

    onClickCapture?.();
    setIsCapturing(true);

    try {
      const crop = cropSpecFromElements(guide, video, { margin: cropMargin });
      const result = await capturePhoto(video, state.stream, { maxBytes: MAX_UPLOAD_BYTES, crop });
      const dataUrl = await blobToDataUrl(result.blob);
      const meta: CapturedImageMeta = { focus: result.focus, width: result.width, height: result.height };

      // Where the cut region sits on the element, in CSS px — exact, including the crop margin
      // and any clamping at the frame edge.
      const placed = result.cropRect ? mapSourceToOverlay(result.cropRect, crop, result.sourceSize) : null;
      const style: React.CSSProperties = placed
        ? { left: placed.x, top: placed.y, width: placed.width, height: placed.height }
        : { left: 0, top: 0, width: "100%", height: "100%" };

      video.pause(); // freeze the rest of the preview while the sheet slides away
      setCapturedImage({ src: dataUrl, style });
      closeAfterSlide(() => {
        void uploadImage(dataUrl, meta);
      });
    } catch (error) {
      console.error("[id-ocr] capture failed", error);
      setIsCapturing(false); // give the controls back so the user can try again
    }
  };

  const canSwitch = enableCameraSwitch && state.status === "ready" && state.allCameras.length > 1;
  const handleSwitch = () => {
    if (state.status !== "ready" || isCapturing) return;
    const index = state.allCameras.findIndex((c) => c.deviceId === state.camera.deviceId);
    const next = state.allCameras[(index + 1) % state.allCameras.length];
    if (next) switchTo(next);
  };

  return (
    <CameraContainer className="camera-container" data-capturing={isCapturing} data-closing={isClosing}>
      <CameraPlaceholder data-ready={isReady} />
      <CameraVideo ref={videoRef} className="camera" autoPlay playsInline muted data-ready={isReady} />

      {capturedImage && (
        <CapturedImage
          src={capturedImage.src}
          alt="captured"
          className="captured-image"
          style={capturedImage.style}
        />
      )}

      <GuideBox ref={guideRef} id="id_ektp_guide_box" />
      <GuidelineTextBox id="id_guidelines-text-box" className="container">
        <EKTPGuidelineTextTitle id="id_ektp_instruction_text1">{cmsContent.instructionText}</EKTPGuidelineTextTitle>
      </GuidelineTextBox>

      {state.status === "error" && (
        <ErrorOverlay role="alert">
          <ErrorText>{state.message}</ErrorText>
          <CancelButton type="button" onClick={retry}>
            {cmsContent.retryText ?? "Try again"}
          </CancelButton>
          <CancelButton type="button" onClick={handleCancel}>
            {cmsContent.cancelText}
          </CancelButton>
        </ErrorOverlay>
      )}

      <CaptureControlsContainer>
        <CancelButton
          type="button"
          onClick={handleCancel}
          data-testid="id_ektp_cancel_button"
          data-tag-identifier={streamCaptureCancelTagIdentifier}
        >
          {cmsContent.cancelText}
        </CancelButton>
        <CaptureButton
          id="id_ektp_capture_button"
          data-testid="id_ektp_capture_button"
          data-tag-identifier={streamCaptureCaptureTagIdentifier}
          onClick={() => void handleCapture()}
          disabled={!isReady || isCapturing}
        />
        {/* Third slot keeps the layout symmetrical, as before; doubles as the optional switcher. */}
        <CancelButton
          type="button"
          $invisible={!canSwitch}
          disabled={!canSwitch}
          aria-hidden={!canSwitch}
          onClick={handleSwitch}
        >
          {canSwitch ? cmsContent.switchCameraText ?? "Switch camera" : cmsContent.cancelText}
        </CancelButton>
      </CaptureControlsContainer>
    </CameraContainer>
  );
};

export default StreamCapture;
