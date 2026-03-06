import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

export type Box = [number, number, number, number];

export type DetectionBox = {
  box: Box; // [x1,y1,x2,y2] in ORIGINAL IMAGE pixels
  conf?: number;
  label?: string;
};

function fitContain(containerW: number, containerH: number, imageW: number, imageH: number) {
  const imageAspect = imageW / imageH;
  const containerAspect = containerW / containerH;

  let drawW = containerW;
  let drawH = containerH;
  let offsetX = 0;
  let offsetY = 0;

  // Matches <Image resizeMode="contain" />
  if (imageAspect > containerAspect) {
    drawW = containerW;
    drawH = containerW / imageAspect;
    offsetY = (containerH - drawH) / 2;
  } else {
    drawH = containerH;
    drawW = containerH * imageAspect;
    offsetX = (containerW - drawW) / 2;
  }

  const scaleX = drawW / imageW;
  const scaleY = drawH / imageH;

  return { offsetX, offsetY, scaleX, scaleY };
}

export default function BoundingBoxesOverlay(props: {
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
  detections: DetectionBox[];
}) {
  const { containerWidth, containerHeight, imageWidth, imageHeight, detections } = props;

  const fit = useMemo(
    () => fitContain(containerWidth, containerHeight, imageWidth, imageHeight),
    [containerWidth, containerHeight, imageWidth, imageHeight]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={containerWidth} height={containerHeight}>
        {detections.map((d, idx) => {
          const [x1, y1, x2, y2] = d.box;
          const x = fit.offsetX + x1 * fit.scaleX;
          const y = fit.offsetY + y1 * fit.scaleY;
          const w = (x2 - x1) * fit.scaleX;
          const h = (y2 - y1) * fit.scaleY;

          const label = d.label
            ? d.conf != null
              ? `${d.label} ${Math.round(d.conf * 100)}%`
              : d.label
            : d.conf != null
              ? `${Math.round(d.conf * 100)}%`
              : "";

          return (
            <React.Fragment key={idx}>
              <Rect x={x} y={y} width={w} height={h} stroke="#00E676" strokeWidth={2} fill="transparent" />
              {label ? (
                <SvgText x={x} y={Math.max(12, y - 4)} fill="#00E676" fontSize={12} fontWeight={700}>
                  {label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}