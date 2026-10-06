const ESC = 0x1b, GS = 0x1d;
const cp850: Record<string, number> = { 'ü':129,'é':130,'á':160,'í':161,'ó':162,'ú':163,'ñ':164,'Ñ':165,'¿':168,'¡':173,'Á':181,'É':144,'Ó':224,'Ú':233,'Ü':154 };

export function encodePrinterText(text: string): number[] {
  return Array.from(text).map(character => cp850[character] ?? (character.charCodeAt(0) <= 127 ? character.charCodeAt(0) : 63));
}

export class EscPosBuilder {
  private bytes: number[] = [];
  initialize() { this.bytes.push(ESC, 0x40, ESC, 0x74, 19); return this; }
  leftMargin(units: number) {
    const margin = Math.max(0, Math.min(65535, Math.round(units)));
    this.bytes.push(GS, 0x4c, margin & 0xff, (margin >> 8) & 0xff);
    return this;
  }
  align(value: 'left' | 'center' | 'right') { this.bytes.push(ESC, 0x61, value === 'left' ? 0 : value === 'center' ? 1 : 2); return this; }
  bold(enabled: boolean) { this.bytes.push(ESC, 0x45, enabled ? 1 : 0); return this; }
  size(width: 1 | 2, height: 1 | 2) { this.bytes.push(GS, 0x21, ((width - 1) << 4) | (height - 1)); return this; }
  text(value: string) { this.bytes.push(...encodePrinterText(value)); return this; }
  line(value = '') { return this.text(value).feed(1); }
  feed(lines = 1) { for (let index = 0; index < lines; index++) this.bytes.push(0x0a); return this; }
  rasterBar(widthBytes = 32, height = 16) {
    const width = Math.max(1, Math.min(255, widthBytes));
    const rows = Math.max(1, Math.min(255, height));
    this.bytes.push(GS, 0x76, 0x30, 0, width, 0, rows, 0);
    for (let index = 0; index < width * rows; index++) this.bytes.push(0xff);
    return this;
  }
  cut(partial = true) { this.bytes.push(GS, 0x56, partial ? 1 : 0); return this; }
  build() { return Uint8Array.from(this.bytes); }
}

export function fitColumns(left: string, right: string, width: number) {
  const safeRight = right.slice(0, width);
  const room = Math.max(1, width - safeRight.length - 1);
  return `${left.slice(0, room).padEnd(room)} ${safeRight}`;
}
