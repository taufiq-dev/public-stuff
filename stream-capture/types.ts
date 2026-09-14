// types.ts
import type { SelectionReport } from "./camera-selection";
import type { FocusRegion } from "./capture-photo";

export type StreamCaptureContent = {
  instructionText?: string;
  line1?: string;
  line2?: string;
  loadingText?: string;
  cancelText?: string;
};

/** Everything needed to display the captured image as the user framed it. */
export type CapturedImageMeta = {
  /** The guide box within the image, as fractions. Pass to <FocusedImage> to hide the margin. */
  focus: FocusRegion;
  /** Encoded image size in pixels. */
  width: number;
  height: number;
};

export type StreamCaptureProps = {
  cmsContent: StreamCaptureContent & {
    retryText?: string;
    switchCameraText?: string;
  };
  /**
   * Receives the captured KTP as a JPEG data URL — the whole crop, margin included, for the
   * backend. `meta` says where the guide box sits in it; callers that ignore it still compile.
   */
  uploadImage: (dataUrl: string, meta: CapturedImageMeta) => Promise<void>;
  setStream: (open: boolean) => void;
  /**
   * Context added around the guide box on each side, as a fraction of the box (default 0.08).
   * Gives the backend room for detection and perspective correction; 0 crops to the box exactly.
   */
  cropMargin?: number;
  onClickCapture?: () => void;
  onStreamCancel?: () => void;
  /** What each device reported and which camera was chosen. Wire to analytics. */
  onCameraReport?: (report: SelectionReport) => void;
  /** Shows a "switch camera" control when more than one rear camera is available. Off by default. */
  enableCameraSwitch?: boolean;
  streamCaptureCancelTagIdentifier?: string;
  streamCaptureCaptureTagIdentifier?: string;
};
