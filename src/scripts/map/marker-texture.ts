import { CanvasTexture, SRGBColorSpace } from "three";
import type { MarkerStyle } from "../../lib/map-markers";

export function createMarkerTexture(style: MarkerStyle, highlighted: boolean): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Map icons require a 2D canvas context");

  if (highlighted) {
    context.beginPath();
    context.arc(48, 48, 44, 0, Math.PI * 2);
    context.fillStyle = "#452653";
    context.fill();
    context.beginPath();
    context.arc(48, 48, 41, 0, Math.PI * 2);
    context.fillStyle = "#f4bf3a";
    context.fill();
  }

  context.beginPath();
  context.arc(48, 48, 35, 0, Math.PI * 2);
  context.fillStyle = style.color;
  context.fill();
  context.strokeStyle = "#fffaf2";
  context.lineWidth = 3;
  context.stroke();

  context.translate(24, 24);
  context.scale(2, 2);
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke(new Path2D(style.path));

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
