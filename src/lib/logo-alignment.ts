export function textInkBottom(top: number, height: number, ascent: number, descent: number, inkDescent: number) {
  return top + (height - ascent - descent) / 2 + ascent + inkDescent;
}

export function logoBottomOffset(slotBottom: number, targetBottom: number, transparentBottom: number, scale: number) {
  return slotBottom - targetBottom - transparentBottom * scale;
}
