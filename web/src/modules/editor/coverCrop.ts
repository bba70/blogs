export interface CropPosition { x: number; y: number }

export function cropRectangle(width: number, height: number, ratio: number, zoom: number, position: CropPosition) {
  const cropWidth = Math.min(width, height * ratio) / zoom
  const cropHeight = cropWidth / ratio
  return {
    x: (width - cropWidth) * (1 - position.x) / 2,
    y: (height - cropHeight) * (1 - position.y) / 2,
    width: cropWidth,
    height: cropHeight,
  }
}

export async function cropCover(image: HTMLImageElement, file: File, ratio: number, zoom: number, position: CropPosition) {
  const crop = cropRectangle(image.naturalWidth, image.naturalHeight, ratio, zoom, position)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1920 / Math.max(crop.width, crop.height))
  canvas.width = Math.max(1, Math.round(crop.width * scale))
  canvas.height = Math.max(1, Math.round(crop.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建裁剪图片。')
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('无法导出裁剪图片。')), type, 0.9)
  })
  if (blob.size > 5 * 1024 * 1024) throw new Error('裁剪后的图片超过 5MB，请缩小裁剪范围后重试。')
  return new File([blob], `cover-cropped.${type === 'image/jpeg' ? 'jpg' : 'png'}`, { type })
}
