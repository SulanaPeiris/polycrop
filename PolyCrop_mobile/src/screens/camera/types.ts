export type Detection = {
  label: string;
  confidence: number; // 0..1
  x1: number; y1: number; x2: number; y2: number; // pixel coords in sent image
};

export type DetectResponse = {
  image_width: number;
  image_height: number;
  detections: Detection[];
};
