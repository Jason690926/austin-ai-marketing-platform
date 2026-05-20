import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSheetsClient, getMetaAdConfig, colIndexToLetter } from '@/lib/sheets/client'

interface PushBody {
  copyText: string
  campaignLabel?: string
  imageUrl?: string | null
  headlineOverride?: string   // 使用者指定主標題內容(多選一時)
}

interface ValueArgs {
  campaignLabel: string
  primaryText: string
  headline1: string
  description: string
  cta: string
  imageUrl: string
}

interface FieldDef {
  key: string
  matches: (label: string) => boolean
  getValue: (args: ValueArgs) => string
}

const FIELDS: FieldDef[] = [
  { key: '廣告主題',  matches: s => s.startsWith('廣告主題'),                                getValue: a => a.campaignLabel },
  { key: '文案',      matches: s => s.trim() === '文案',                                       getValue: a => a.primaryText },
  { key: '主標題',    matches: s => s.startsWith('主標題'),                                   getValue: a => clip(a.headline1, 25) },
  { key: '說明',      matches: s => s.startsWith('說明'),                                     getValue: a => clip(a.description, 30) },
  { key: '行動呼籲',  matches: s => s.includes('行動呼籲') || s.toUpperCase().includes('CTA'), getValue: a => a.cta },
  { key: '素材連結',  matches: s => s.includes('素材連結') || s.includes('素材網址'),         getValue: a => a.imageUrl },
]

const FRAME_GAP = 1   // 兩個 frame 中間留 1 欄空白做分隔
const MAX_FRAMES = 50 // 安全上限
const SCAN_ROW_LIMIT = 200

function parseSections(text: string): Map<string, string> {
  const headerRe = /^\s*【([^】\n]+)】\s*$/gm
  const matches = Array.from(text.matchAll(headerRe))
  const result = new Map<string, string>()
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const title = m[1].trim()
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const content = text.slice(start, end).trim()
    if (title) result.set(title, content)
  }
  return result
}

function clip(s: string | undefined, max: number): string {
  if (!s) return ''
  const chars = Array.from(s)
  if (chars.length <= max) return s
  return chars.slice(0, max - 1).join('') + '…'
}

interface SheetMeta {
  sheetTabId: number
  frameWidth: number
  maxRow: number
  columnCount: number     // sheet 目前的欄數(用來決定要不要擴充)
  rowCount: number        // sheet 目前的列數
  frame0Labels: Array<{ label: string; row: number }>
}

async function getSheetMeta(
  sheets: ReturnType<typeof getSheetsClient>,
  sheetId: string,
  tab: string,
): Promise<SheetMeta> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties),merges)',
  })
  const target = meta.data.sheets?.find(s => s.properties?.title === tab)
  if (!target) throw new Error(`找不到分頁 "${tab}"`)
  const sheetTabId = target.properties?.sheetId ?? 0
  const grid = target.properties?.gridProperties
  const columnCount = grid?.columnCount ?? 26
  const rowCount = grid?.rowCount ?? 1000
  const allMerges = target.merges ?? []

  // 迭代偵測「第一個 frame」寬度:依 startColumnIndex 排序所有合併,
  // 從 col 0 開始累積 endColumnIndex,遇到第 1 個間隔(gap)就停。
  // 例:A7:A18 (0..1), B7:D18 (1..4) → 累積到 4。
  //     若還有 F7:F18 (5..6),因 5 > 4 視為新 frame 的開始,停止。
  const sortedMerges = [...allMerges].sort(
    (a, b) => (a.startColumnIndex ?? 0) - (b.startColumnIndex ?? 0)
  )
  let frameWidth = 2  // 預設下限 1 label + 1 value
  let currentEnd = 0
  for (const m of sortedMerges) {
    const start = m.startColumnIndex ?? 0
    const end = m.endColumnIndex ?? 1
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end)
    } else {
      break  // gap detected,後面是其他 frame 的合併
    }
  }
  if (currentEnd > 0) frameWidth = currentEnd

  // 讀 column A 標籤(原始 frame)
  const aResp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A1:A${SCAN_ROW_LIMIT}`,
  })
  const aRows = aResp.data.values ?? []
  const frame0Labels: Array<{ label: string; row: number }> = []
  aRows.forEach((row, idx) => {
    const label = String(row[0] ?? '').trim()
    if (label) frame0Labels.push({ label, row: idx + 1 })
  })
  const maxRow = Math.max(...frame0Labels.map(r => r.row), 1)

  return { sheetTabId, frameWidth, maxRow, columnCount, rowCount, frame0Labels }
}

/** 若 sheet 目前欄數不夠裝下目標 frame,擴充到足夠 */
async function ensureEnoughColumns(
  sheets: ReturnType<typeof getSheetsClient>,
  sheetId: string,
  sheetTabId: number,
  currentColumnCount: number,
  requiredEndCol: number,  // exclusive,即 destination.endColumnIndex
): Promise<number> {
  if (requiredEndCol <= currentColumnCount) return currentColumnCount
  const needed = requiredEndCol - currentColumnCount
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        appendDimension: {
          sheetId: sheetTabId,
          dimension: 'COLUMNS',
          length: needed,
        },
      }],
    },
  })
  return currentColumnCount + needed
}

interface FrameInfo {
  idx: number          // 0-based frame index
  startCol: number     // label 欄的 col index
  labelCol: string     // 例 "A" / "F"
  hasLabels: boolean   // label 欄有任何文字?
  valuesFound: number  // value 欄找到的非空 cell 數
  occupied: boolean    // valuesFound > 0
}

/** 掃描 sheet 算出 N 個 frame 的狀態 */
async function analyzeFrames(
  sheets: ReturnType<typeof getSheetsClient>,
  sheetId: string,
  tab: string,
  frameWidth: number,
  stride: number,
  maxRow: number,
  framesToCheck: number,
): Promise<FrameInfo[]> {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!A1:ZZ${maxRow}`,
  })
  const rows = resp.data.values ?? []

  const result: FrameInfo[] = []
  for (let frameIdx = 0; frameIdx < framesToCheck; frameIdx++) {
    const startCol = frameIdx * stride
    let hasLabels = false
    let valuesFound = 0
    for (const row of rows) {
      const labelVal = String(row[startCol] ?? '').trim()
      if (labelVal) hasLabels = true
      for (let c = startCol + 1; c < startCol + frameWidth; c++) {
        const v = String(row[c] ?? '').trim()
        if (v) valuesFound++
      }
    }
    result.push({
      idx: frameIdx,
      startCol,
      labelCol: colIndexToLetter(startCol),
      hasLabels,
      valuesFound,
      occupied: valuesFound > 0,
    })
  }
  return result
}

/** 找第一個 value 全空的 frame */
function findFirstEmptyFrame(frames: FrameInfo[]): number {
  for (const f of frames) {
    if (!f.occupied) return f.idx
  }
  throw new Error(`已達 frame 上限(${frames.length} 個)`)
}

/** 複製原始 frame(col 0..frameWidth)到目標 frame 位置;含 labels、formats、merges */
async function replicateFrame(
  sheets: ReturnType<typeof getSheetsClient>,
  sheetId: string,
  sheetTabId: number,
  tab: string,
  frameWidth: number,
  dstFrameIdx: number,
  stride: number,
  maxRow: number,
  columnCount: number,
): Promise<{ copyPasteRequest: any }> {
  if (dstFrameIdx === 0) return { copyPasteRequest: null }
  const dstStartCol = dstFrameIdx * stride
  const dstEndCol = dstStartCol + frameWidth  // exclusive

  // 0) 先確保 sheet 有足夠的欄數
  if (dstEndCol > columnCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId: sheetTabId,
            dimension: 'COLUMNS',
            length: dstEndCol - columnCount,
          },
        }],
      },
    })
  }

  // 1) copyPaste 整個 frame 0(包含 labels + formats + merges)
  const copyPasteRequest = {
    copyPaste: {
      source: {
        sheetId: sheetTabId,
        startRowIndex: 0,
        endRowIndex: maxRow,
        startColumnIndex: 0,
        endColumnIndex: frameWidth,
      },
      destination: {
        sheetId: sheetTabId,
        startRowIndex: 0,
        endRowIndex: maxRow,
        startColumnIndex: dstStartCol,
        endColumnIndex: dstEndCol,
      },
      pasteType: 'PASTE_NORMAL',
      pasteOrientation: 'NORMAL',
    },
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [copyPasteRequest] },
  })

  // 2) 清空目標 frame 的 value 區塊(避免複製到舊資料)
  const valueStartLetter = colIndexToLetter(dstStartCol + 1)
  const valueEndLetter = colIndexToLetter(dstStartCol + frameWidth - 1)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${tab}!${valueStartLetter}1:${valueEndLetter}${maxRow}`,
  })

  return { copyPasteRequest }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 })

  let body: PushBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  if (!body.copyText) return NextResponse.json({ error: '缺少 copyText' }, { status: 400 })

  let sheets, sheetId: string, tab: string
  try {
    sheets = getSheetsClient()
    const cfg = getMetaAdConfig()
    sheetId = cfg.sheetId
    tab = cfg.tab
  } catch (e: any) {
    return NextResponse.json({ error: `Sheets 未設定:${e?.message || e}` }, { status: 500 })
  }

  // 解析文案
  const sections = parseSections(body.copyText)
  const args: ValueArgs = {
    campaignLabel: body.campaignLabel ?? '',
    primaryText: sections.get('Primary Text') ?? '',
    headline1: body.headlineOverride?.trim()
      || sections.get('Headline 1')
      || sections.get('Headline')
      || '',
    description: sections.get('Description') ?? sections.get('Description 1') ?? '',
    cta: sections.get('CTA') ?? '',
    imageUrl: body.imageUrl ?? '',
  }
  const sectionStatus = {
    PrimaryText: !!args.primaryText,
    Headline1: !!args.headline1,
    Description: !!args.description,
    CTA: !!args.cta,
  }

  // 1) 取得 sheet 結構
  let meta: SheetMeta
  try {
    meta = await getSheetMeta(sheets, sheetId, tab)
  } catch (e: any) {
    return NextResponse.json({ error: `讀取 Sheet 結構失敗:${e?.message || e}` }, { status: 502 })
  }
  if (meta.frame0Labels.length === 0) {
    return NextResponse.json({ error: '原始 frame 是空的(column A 無任何標籤)' }, { status: 500 })
  }

  const stride = meta.frameWidth + FRAME_GAP

  // 2) 分析所有 frame 狀態 + 找第一個空的
  let frames: FrameInfo[]
  let frameIdx: number
  try {
    frames = await analyzeFrames(sheets, sheetId, tab, meta.frameWidth, stride, meta.maxRow, MAX_FRAMES)
    frameIdx = findFirstEmptyFrame(frames)
  } catch (e: any) {
    return NextResponse.json({ error: `掃描 frame 失敗:${e?.message || e}` }, { status: 502 })
  }

  // 3) 若不是 frame 0,先複製模板到新位置
  //    但若目標 frame 已有 orphan 標籤(從歷史 bug 殘留),跳過 copyPaste 直接寫值
  const targetFrame = frames[frameIdx]
  const skipReplicate = frameIdx > 0 && targetFrame?.hasLabels === true
  let copyPasteDebug: any = null
  try {
    if (!skipReplicate) {
      const r = await replicateFrame(
        sheets, sheetId, meta.sheetTabId, tab, meta.frameWidth, frameIdx, stride, meta.maxRow, meta.columnCount,
      )
      copyPasteDebug = r.copyPasteRequest
    }
  } catch (e: any) {
    // 詳細錯誤:把 Google API 完整訊息與正在嘗試的 request 包進來,便於排查
    const googleErr = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message || String(e)
    return NextResponse.json({
      error: `複製 frame 失敗:${googleErr}`,
      debug: {
        frameIdx,
        frameStartCol: frameIdx * stride,
        frameWidth: meta.frameWidth,
        maxRow: meta.maxRow,
        columnCount: meta.columnCount,
        rowCount: meta.rowCount,
        sheetTabId: meta.sheetTabId,
        tab,
      },
    }, { status: 502 })
  }

  // 4) 計算這個 frame 的 value 欄位置(label 旁邊一欄)
  const frameStartCol = frameIdx * stride
  const valueCol = frameStartCol + 1
  const valueColLetter = colIndexToLetter(valueCol)
  const labelColLetter = colIndexToLetter(frameStartCol)

  // 5) 對每個 FIELDS 找 sheet 中對應的 label row,組 writes
  const writes: Array<{ row: number; key: string; sheetLabel: string; value: string }> = []
  const missingInSheet: string[] = []
  const emptyValues: string[] = []

  for (const field of FIELDS) {
    const value = field.getValue(args)
    const matched = meta.frame0Labels.find(lr => field.matches(lr.label))
    if (!value.trim()) {
      if (matched) emptyValues.push(field.key)
      continue
    }
    if (!matched) {
      missingInSheet.push(field.key)
      continue
    }
    writes.push({ row: matched.row, key: field.key, sheetLabel: matched.label, value })
  }

  if (writes.length === 0) {
    return NextResponse.json({
      error: '沒有任何內容可寫入',
      debug: { sectionStatus, frameIdx, frameStartCol, labelsInSheet: meta.frame0Labels.map(r => r.label), missingInSheet, emptyValues },
    }, { status: 400 })
  }

  // 6) 寫入新 frame 的 value 欄
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: writes.map(w => ({
          range: `${tab}!${valueColLetter}${w.row}`,
          values: [[w.value]],
        })),
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: `寫入 Sheet 失敗:${e?.message || e}` }, { status: 502 })
  }

  // 只取前 8 個 frame 狀態給 UI 顯示(避免 payload 太大)
  const frameMap = frames.slice(0, 8).map(f => ({
    idx: f.idx + 1,
    labelCol: f.labelCol,
    hasLabels: f.hasLabels,
    valuesFound: f.valuesFound,
    occupied: f.occupied,
  }))

  return NextResponse.json({
    success: true,
    frameIdx: frameIdx + 1,
    frameLabelColumn: labelColLetter,
    frameValueColumn: valueColLetter,
    frameWidth: meta.frameWidth,
    stride,
    skipReplicate,  // true = 重用既有 orphan 標籤、未呼叫 copyPaste
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    written: writes.map(w => ({ key: w.key, row: w.row, sheetLabel: w.sheetLabel, preview: w.value.slice(0, 30) })),
    sectionStatus,
    missingInSheet,
    emptyValues,
    frameMap,
  })
}
