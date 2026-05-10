import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function sizePresetToDimensions(size: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    '1080x1080': { width: 1080, height: 1080 },
    '1080x1350': { width: 1080, height: 1350 },
    '1080x1920': { width: 1080, height: 1920 },
    '1200x675':  { width: 1200, height: 675 },
    '1200x628':  { width: 1200, height: 628 },
    '1920x800':  { width: 1920, height: 800 },
  }
  return map[size] ?? { width: 1080, height: 1080 }
}

// gpt-image-1 supports: 1024x1024, 1536x1024, 1024x1536
export function sizePresetToOpenAISize(size: string): '1024x1024' | '1536x1024' | '1024x1536' {
  const tall = ['1080x1350', '1080x1920']
  const wide = ['1200x675', '1200x628', '1920x800']
  if (tall.includes(size)) return '1024x1536'
  if (wide.includes(size)) return '1536x1024'
  return '1024x1024'
}
