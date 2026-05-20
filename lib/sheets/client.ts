// Google Sheets Service Account client（伺服器端）
// 必要環境變數：
//   GOOGLE_SHEETS_SA_JSON  Service Account JSON 全文（單行貼上）
//   META_AD_SHEET_ID       目標 Sheet ID
//   META_AD_SHEET_TAB      分頁名稱（預設 "meta"）

import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'

let cached: sheets_v4.Sheets | null = null

function readServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SHEETS_SA_JSON
  if (!raw) {
    throw new Error('缺少環境變數 GOOGLE_SHEETS_SA_JSON（Google Service Account JSON）')
  }
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error('GOOGLE_SHEETS_SA_JSON 不是合法 JSON')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SHEETS_SA_JSON 缺少 client_email 或 private_key')
  }
  // 環境變數 \n 還原為實際換行
  parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n')
  return parsed
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (cached) return cached
  const sa = readServiceAccount()
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  cached = google.sheets({ version: 'v4', auth })
  return cached
}

export function getMetaAdConfig() {
  const sheetId = process.env.META_AD_SHEET_ID
  if (!sheetId) throw new Error('缺少環境變數 META_AD_SHEET_ID')
  const tab = process.env.META_AD_SHEET_TAB || 'meta'
  return { sheetId, tab }
}

/** 把欄索引(0=A,1=B,...)轉成 Google Sheets A1 表示法的欄字母。 */
export function colIndexToLetter(idx: number): string {
  let n = idx
  let s = ''
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}
