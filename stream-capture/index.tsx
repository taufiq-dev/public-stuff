// packages/mfe-id-ocr/src/components/StreamCapture/index.tsx
//
// Same flow as before: slides up on mount → user taps capture → captured image holds on screen
// while the sheet slides down → after the slide, uploadImage(dataUrl) and setStream(false).
// Cancel: onStreamCancel() → slide down → setStream(false).
//
// What changed underneath:
//   - the camera is chosen by capability scoring (useMainRearCamera), not by whichever rear lens
//     the browser happened to hand back — this is what fixes the Huawei zoom-lens problem;
//   - the KTP crop is taken from the full-resolution still/frame in source pixels, not from a
//     viewport-sized canvas, so it is ~1000–2600 px wide instead of ~368 px;
//   - the guide box is a DOM element and the crop reads its rendered rect, so the two can't drift.

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StreamCaptureContent } from "../DocumentUpload";
import CaptureButton from "../CaptureButton";
import type { SelectionReport } from "../../camera/cameraSelection";
import { useMainRearCamera } from "../../camera/useMainRearCamera";
import { blobToDataUrl, capturePhoto, cropSpecFromElements } from "../../camera/capturePhoto";
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
} from "./styled.components";

const SLIDE_MS = 600; // must match the slide animations in styled.components
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type StreamCaptureProps = {
  cmsContent: StreamCaptureContent & { retryText?: string; switchCameraText?: string };
  /** Receives the captured KTP as a JPEG data URL — unchanged contract. */
  uploadImage: (dataUrl: string) => Promise<void>;
  setStream: (open: boolean) => void;
  onClickCapture?: () => void;
  onStreamCancel?: () => void;
  /** What each device reported and which camera was chosen. Wire to analytics. */
  onCameraReport?: (report: SelectionReport) => void;
  /** Shows a "switch camera" control when more than one rear camera is available. Off by default. */
  enableCameraSwitch?: boolean;
  streamCaptureCancelTagIdentifier?: string;
  streamCaptureCaptureTagIdentifier?: string;
};

const StreamCapture: React.FC<StreamCaptureProps> = ({
  cmsContent,
  uploadImage,
  setStream,
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

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
      const result = await capturePhoto(video, state.stream, {
        maxBytes: MAX_UPLOAD_BYTES,
        crop: cropSpecFromElements(guide, video),
      });
      const dataUrl = await blobToDataUrl(result.blob);

      video.pause(); // freeze the preview on what was captured while the sheet slides away
      setCapturedImage(dataUrl);
      closeAfterSlide(() => {
        void uploadImage(dataUrl);
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

      {capturedImage && isClosing && (
        <CapturedImage src={capturedImage} alt="captured" className="captured-image" />
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
