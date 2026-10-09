/**
 * A phone photo, shrunk to at most `max` pixels on its longest side and saved as a JPEG.
 * Full-size photos are several megabytes and make Gemma slow without telling it much more.
 * Returns base64 without the data: prefix, the way Ollama wants images.
 */
export async function shrinkPhoto(file: Blob, max = 1024): Promise<string> {
  // createImageBitmap turns the photo the right way up from its EXIF orientation.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export function photoUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}
